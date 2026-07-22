// signingService.js

const crypto = require("crypto");
// We are skipping the internal renderService.js file and placing the function body here for guaranteed import.
// This ensures that the main hub file can import all necessary functions from one place.

const { ISSUER_DID, PRIVATE_KEY_MOCK } = require("./cryptoConfig");

/**
 * Helper function for JSON Canonicalization (Deep Key Sorting).
 */
function canonicalize(obj) {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }

  // Sort the keys of the object
  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  for (const key of sortedKeys) {
    result[key] = canonicalize(obj[key]);
  }
  return result;
}

/**
 * Helper function to hash the claims after canonicalizing them.
 */
function hashClaims(claims) {
  const canonicalizedClaims = canonicalize(claims);
  const dataString = JSON.stringify(canonicalizedClaims);

  return crypto.createHash("sha256").update(dataString).digest("base64");
}

/**
 * 2.2 & 2.3: Generates and signs the W3C Verifiable Credential.
 */
function issueSignedCredential(standardizedClaims, publicKeyConfig) {
  // 1. Format for W3C Verifiable Credential (VC)
  const credential = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://www.w3.org/2025/onest/claims/v1",
    ],
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: standardizedClaims.credentialMetadata.type,
    issuer: ISSUER_DID,
    issuanceDate: standardizedClaims.credentialMetadata.issueDate,
    credentialSubject: standardizedClaims.credentialSubject,
    claimsAlignment: standardizedClaims.claimsAlignment,
  };

  // 2. Create the Digital Signature (Attestation)
  const documentHash = hashClaims(credential);

  // --- SIGNING ACTION SIMULATION ---
  const digitalSignature = crypto
    .createHmac("sha256", PRIVATE_KEY_MOCK.d)
    .update(documentHash)
    .digest("hex");

  // 3. Attach the Proof (Digital Seal)
  credential.proof = {
    type: "JsonWebSignature2020",
    created: new Date().toISOString(),
    verificationMethod: `${ISSUER_DID}#${publicKeyConfig.id}`,
    proofPurpose: "assertionMethod",
    jws: digitalSignature,
  };

  return credential;
}

/**
 * Part 3.2: Verifies the integrity and authenticity of a signed credential.
 */
function verifyCredential(credential) {
  // 1. Separate the Proof and the Document
  const proof = credential.proof;
  const signatureValue = proof.jws;

  // 2. Prepare the document for hashing (remove the proof block)
  const credentialWithoutProof = { ...credential };
  delete credentialWithoutProof.proof;

  // 3. Re-hash the received content
  const receivedHash = hashClaims(credentialWithoutProof);

  // 4. Re-simulate the expected signature using your Private Key
  const expectedSignature = crypto
    .createHmac("sha256", PRIVATE_KEY_MOCK.d)
    .update(receivedHash)
    .digest("hex");

  // 5. Integrity Check
  const isAuthentic = expectedSignature === signatureValue;
  const isRevoked = false;

  if (isAuthentic && !isRevoked) {
    return { valid: true, reason: "Signature valid and active." };
  } else if (isRevoked) {
    return { valid: false, reason: "Credential has been revoked." };
  } else {
    return {
      valid: false,
      reason: "Signature mismatch (Data tampering detected).",
    };
  }
}

// --- RENDER LOGIC MOVED HERE FOR GUARANTEED EXPORT (Replaces renderService.js) ---

/**
 * Renders the signed credential JSON into a human-readable HTML document.
 */
function renderCertificate(credential, qrCodeDataUrl) {
  const subject = credential.credentialSubject;
  const claims = credential.claimsAlignment;
  const proof = credential.proof;

  // NOTE: HTML/CSS is simplified for guaranteed browser rendering
  const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Official Verifiable Credential</title>
            <style>
                body { font-family: 'Times New Roman', serif; margin: 0; padding: 40px; border: 10px solid #004d99; max-width: 800px; margin: 50px auto; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { color: #004d99; font-size: 28px; margin: 0; border-bottom: 2px solid #004d99; padding-bottom: 10px; }
                .body-text { font-size: 18px; line-height: 1.6; text-align: justify; margin-bottom: 20px; }
                .details { margin-top: 20px; border: 1px solid #ddd; padding: 15px; background-color: #f9f9f9; }
                .details p { margin: 5px 0; }
                .signature-box { display: flex; justify-content: space-between; margin-top: 50px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 14px; }
                .qr-code { width: 100px; height: 100px; border: 1px solid #000; }
                .seal { text-align: right; }
            </style>
        </head>
        <body>
            <div class="header">
                <p style="font-size: 14px; color: #555;">Issued by the ONEST DigiAttestor Hub</p>
                <h1>VERIFIABLE PROFESSIONAL CERTIFICATE</h1>
            </div>

            <div class="body-text">
                This certifies that ${
                  subject.fullName
                } has successfully completed the required assessment, verified against the official records of the LMS authority.
            </div>

            <div class="details">
                <p><strong>Course Title:</strong> ${
                  subject.courseTitle
                } (Score: ${subject.achievedScore}%)</p>
                <p><strong>Issuance Date:</strong> ${new Date(
                  credential.issuanceDate
                ).toLocaleDateString()}</p>
            </div>
            
            <div class="details" style="margin-top: 15px;">
                <p><strong>Standardization (ONEST/SFIA):</strong></p>
                <p>— **NSQF Level:** ${claims.nsqfLevel}</p>
                <p>— **SFIA Skill:** ${claims.sfiaCode} (${
    claims.sfiaDescription
  })</p>
            </div>

            <div class="signature-box">
                <div>
                    <p><strong>Issuer DID:</strong> ${credential.issuer}</p>
                    <p style="color: #c00;">Cryptographic Proof (JWS): ${proof.jws.substring(
                      0,
                      16
                    )}...</p>
                </div>
                
            </div>
        </body>
        </html>
    `;
  return htmlContent;
}

module.exports = { issueSignedCredential, verifyCredential, renderCertificate }; // <-- EXPORT ALL THREE FUNCTIONS

/*
<div class="seal">
  <img src="${qrCodeDataUrl}" alt="Verification QR Code" class="qr-code">
  <p style="margin-top: 5px; font-style: italic;">Scan to Verify Status</p>
</div>*/
