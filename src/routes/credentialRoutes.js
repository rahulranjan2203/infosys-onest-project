const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/database');
const moodleService = require('../services/moodleService');
const cryptoService = require('../services/cryptoService');

/**
 * POST /api/credentials/sync
 * Body: { moodleUserId: 1, moodleCourseId: 101 }
 * Pulls completion grade from Moodle, evaluates eligibility, issues ES256-signed W3C VC
 */
router.post('/sync', async (req, res) => {
  const { moodleUserId, moodleCourseId } = req.body;

  if (!moodleUserId || !moodleCourseId) {
    return res.status(400).json({ error: 'moodleUserId and moodleCourseId are required fields.' });
  }

  try {
    // 1. Fetch user and course from DB to make sure they exist
    const users = await db.query('SELECT * FROM users WHERE moodle_user_id = ?', [moodleUserId]);
    const courses = await db.query('SELECT * FROM courses WHERE moodle_course_id = ?', [moodleCourseId]);

    if (users.length === 0) {
      return res.status(404).json({ error: `User with moodle_user_id ${moodleUserId} not found in database.` });
    }
    if (courses.length === 0) {
      return res.status(404).json({ error: `Course with moodle_course_id ${moodleCourseId} not found in database.` });
    }

    const user = users[0];
    const course = courses[0];

    console.log(`Syncing credentials for user ${user.name} in course "${course.course_name}"...`);

    // 2. Fetch course completion and grade from Moodle API
    const completionData = await moodleService.fetchCourseCompletion(moodleUserId, moodleCourseId);
    
    // Check if course completion criteria are met
    const isCompletedOnMoodle = completionData.completionstatus && completionData.completionstatus.completed;
    if (!isCompletedOnMoodle) {
      return res.status(422).json({
        success: false,
        message: 'Student has not marked the course as completed on Moodle.'
      });
    }

    const gradeData = await moodleService.fetchStudentGrade(moodleUserId, moodleCourseId);
    const finalGrade = gradeData.grade;
    const passingGrade = parseFloat(course.passing_grade);
    const isEligible = finalGrade >= passingGrade;

    // 3. Save completion record to Database (upsert behavior)
    let completionId = null;
    const existingCompletion = await db.query(
      'SELECT id FROM course_completions WHERE user_id = ? AND course_id = ?',
      [user.id, course.id]
    );

    const now = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format as YYYY-MM-DD HH:MM:SS

    if (existingCompletion.length > 0) {
      completionId = existingCompletion[0].id;
      await db.query(
        'UPDATE course_completions SET grade = ?, completed_at = ?, is_eligible = ? WHERE id = ?',
        [finalGrade, now, isEligible ? 1 : 0, completionId]
      );
      console.log(`Updated course completion ID: ${completionId}`);
    } else {
      const result = await db.query(
        'INSERT INTO course_completions (user_id, course_id, grade, completed_at, is_eligible) VALUES (?, ?, ?, ?, ?)',
        [user.id, course.id, finalGrade, now, isEligible ? 1 : 0]
      );
      completionId = result.insertId;
      console.log(`Created new course completion ID: ${completionId}`);
    }

    // 4. Evaluate Grade Eligibility for Credential
    if (!isEligible) {
      return res.json({
        success: false,
        message: `Grade synced: ${finalGrade}%. Passing grade required: ${passingGrade}%. Student is ineligible for a certificate.`,
        grade: finalGrade,
        passingGrade: passingGrade
      });
    }

    // 5. Check if credential was already issued
    const existingCredential = await db.query(
      'SELECT * FROM issued_credentials WHERE completion_id = ?',
      [completionId]
    );

    if (existingCredential.length > 0) {
      const cred = existingCredential[0];
      // SQLite stores JSON as string, MySQL stores as JSON object. Parse if necessary.
      const vcPayload = typeof cred.vc_payload === 'string' ? JSON.parse(cred.vc_payload) : cred.vc_payload;
      return res.json({
        success: true,
        message: 'Verifiable Credential already generated previously.',
        credentialUuid: cred.credential_uuid,
        jws: cred.jws_signature,
        credential: vcPayload
      });
    }

    // 6. Generate the W3C Verifiable Credential Payload
    const credentialUuid = crypto.randomUUID(); // Uses Node.js native crypto UUID v4
    const issuerDid = process.env.ISSUER_DID || 'did:web:onest.certplatform.com';
    
    const vcPayload = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://schema.onest.network/credentials/v1"
      ],
      "id": `urn:uuid:${credentialUuid}`,
      "type": ["VerifiableCredential", "ONESTTrainingCredential"],
      "issuer": issuerDid,
      "issuanceDate": new Date().toISOString(),
      "credentialSubject": {
        "id": user.user_did,
        "studentName": user.name,
        "studentEmail": user.email,
        "courseName": course.course_name,
        "moodleCourseId": course.moodle_course_id,
        "gradeReported": `${finalGrade}%`,
        "status": "Pass"
      }
    };

    // 7. Cryptographically sign VC payload using ES256
    const jws = cryptoService.signES256(vcPayload);

    // 8. Store issued credential reference in DB
    const stringifiedPayload = JSON.stringify(vcPayload);
    await db.query(
      'INSERT INTO issued_credentials (completion_id, credential_uuid, jws_signature, vc_payload) VALUES (?, ?, ?, ?)',
      [completionId, credentialUuid, jws, stringifiedPayload]
    );

    console.log(`Credential ${credentialUuid} issued successfully for student ${user.name}`);

    return res.status(201).json({
      success: true,
      message: 'Verifiable Credential issued successfully!',
      credentialUuid,
      jws,
      credential: vcPayload
    });

  } catch (error) {
    console.error('Credential Sync Error:', error);
    return res.status(500).json({ error: 'Internal Server Error during credential sync.', details: error.message });
  }
});

/**
 * GET /api/credentials/:uuid
 * Fetches an issued credential from database
 */
router.get('/:uuid', async (req, res) => {
  const { uuid } = req.params;

  try {
    const results = await db.query(
      'SELECT ic.*, u.name as student_name, c.course_name FROM issued_credentials ic ' +
      'JOIN course_completions cc ON ic.completion_id = cc.id ' +
      'JOIN users u ON cc.user_id = u.id ' +
      'JOIN courses c ON cc.course_id = c.id ' +
      'WHERE ic.credential_uuid = ?',
      [uuid]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: `Credential with UUID ${uuid} not found.` });
    }

    const cred = results[0];
    const vcPayload = typeof cred.vc_payload === 'string' ? JSON.parse(cred.vc_payload) : cred.vc_payload;

    return res.json({
      credentialUuid: cred.credential_uuid,
      status: cred.status,
      issuedAt: cred.issued_at,
      jws: cred.jws_signature,
      credential: vcPayload
    });

  } catch (error) {
    console.error('Fetch credential error:', error);
    return res.status(500).json({ error: 'Internal Server Error fetching credential.' });
  }
});

/**
 * POST /api/credentials/verify
 * Body: { jws: "header.payload.signature" }
 * Cryptographically verifies a JWS credential and checks DB revocation status
 */
router.post('/verify', async (req, res) => {
  const { jws } = req.body;

  if (!jws) {
    return res.status(400).json({ error: 'jws signature string is required.' });
  }

  try {
    // 1. Decode payload to extract metadata
    const payload = cryptoService.decodePayload(jws);
    if (!payload) {
      return res.status(400).json({ verified: false, error: 'Malformed JWS structure.' });
    }

    // 2. Perform Mathematical ES256 Signature Verification
    const isSignatureValid = cryptoService.verifyES256(jws);

    if (!isSignatureValid) {
      return res.json({
        verified: false,
        reason: 'Cryptographic signature is mathematically invalid (data altered or wrong keys).'
      });
    }

    // 3. Extract credential ID and check database for revocation status
    const urnUuid = payload.id; // e.g., urn:uuid:f81d4fae-...
    const uuid = urnUuid.replace('urn:uuid:', '');

    const dbCreds = await db.query('SELECT status FROM issued_credentials WHERE credential_uuid = ?', [uuid]);

    let status = 'UNKNOWN';
    if (dbCreds.length > 0) {
      status = dbCreds[0].status; // ACTIVE or REVOKED
    }

    // A credential is verified if signature matches AND database records show status is active
    const verified = status === 'ACTIVE';

    return res.json({
      verified,
      status,
      reason: verified ? 'Signature is valid and credential is active.' : `Credential status is ${status}.`,
      issuer: payload.issuer,
      subject: payload.credentialSubject
    });

  } catch (error) {
    console.error('Verification API error:', error);
    return res.status(500).json({ error: 'Internal Server Error during verification.', details: error.message });
  }
});

/**
 * POST /api/credentials/revoke
 * Body: { credentialUuid }
 * Toggles the revocation status of a credential in the database (ACTIVE <-> REVOKED)
 */
router.post('/revoke', async (req, res) => {
  const { credentialUuid } = req.body;

  if (!credentialUuid) {
    return res.status(400).json({ error: 'credentialUuid is required.' });
  }

  try {
    const results = await db.query('SELECT status FROM issued_credentials WHERE credential_uuid = ?', [credentialUuid]);

    if (results.length === 0) {
      return res.status(404).json({ error: `Credential with UUID ${credentialUuid} not found.` });
    }

    const currentStatus = results[0].status;
    const newStatus = currentStatus === 'ACTIVE' ? 'REVOKED' : 'ACTIVE';

    await db.query('UPDATE issued_credentials SET status = ? WHERE credential_uuid = ?', [newStatus, credentialUuid]);
    console.log(`Revocation status toggled for ${credentialUuid} -> ${newStatus}`);

    return res.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Revocation toggle error:', error);
    return res.status(500).json({ error: 'Internal Server Error toggling status.' });
  }
});

module.exports = router;
