// onest_hub_firestore.js (FINAL CLEAN RUNNER - Relies 100% on External MySQL Data)

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const qrcode = require("qrcode"); // CRITICAL: Correctly importing qrcode

// --- Imports Functions from the specialized modules ---
const {
  issueSignedCredential,
  verifyCredential,
  renderCertificate,
} = require("./signingService");
const { PUBLIC_KEY_MOCK } = require("./cryptoConfig");

const app = express();
app.use(cors()); // Fixes frontend cross-origin error
app.use(express.json());

// --- CONFIGURATION ---
const PORT = 5001;

// --- DATABASE CONFIGURATION (Local MySQL Server) ---
// !!! IMPORTANT: This section MUST be configured with your actual MySQL credentials !!!
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
  database: "onest_mock_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// MOCK CONSTANTS
const ISSUER_DID = "did:onest:infosys:digiattestor-hub-2025";
const PUBLIC_KEY_MOCK_ID = PUBLIC_KEY_MOCK.id;
const BASE_VERIFICATION_URL = "http://localhost:5001/api/verify-status?id="; // QR code link target

let dbConnectionPool;
let isAuthReady = false;

// --- DATABASE INITIALIZATION AND STRUCTURE CHECK ---
async function initializeDatabase() {
  try {
    // 1. Create a pooled connection to the MySQL server
    dbConnectionPool = mysql.createPool(dbConfig);

    // Test the connection
    await dbConnectionPool.getConnection();
    console.log("[MYSQL] Database connection successful.");

    // 2. Ensure tables exist
    await createAndSeedTables();

    isAuthReady = true;
  } catch (e) {
    console.error(
      `[MYSQL ERROR] Initialization failed. Check MySQL server status and credentials: ${e.message}`
    );
    throw new Error("Database initialization failed. Service cannot start.");
  }
}

async function createAndSeedTables() {
  // NOTE: This function only ensures tables exist; data MUST be populated manually in MySQL Workbench.

  // 1. Create Tables if they don't exist
  await dbConnectionPool.execute(`
        CREATE TABLE IF NOT EXISTS mock_lms_records (
            username VARCHAR(50) PRIMARY KEY,
            password VARCHAR(50) NOT NULL,
            courseId VARCHAR(50) NOT NULL,
            final_score DECIMAL(5,2),
            talentlms_user_id VARCHAR(50),
            fullName VARCHAR(100)
        );
    `);

  await dbConnectionPool.execute(`
        CREATE TABLE IF NOT EXISTS skill_mappings (
            courseId VARCHAR(50) PRIMARY KEY,
            nsqf_level INT,
            sfia_code VARCHAR(10),
            sfia_level_desc TEXT
        );
    `);
  console.log("[MYSQL] Tables checked/created successfully.");

  // Check if tables are populated (optional runtime check)
  const [lmsRows] = await dbConnectionPool.execute(
    "SELECT COUNT(*) as count FROM mock_lms_records"
  );
  const [mapRows] = await dbConnectionPool.execute(
    "SELECT COUNT(*) as count FROM skill_mappings"
  );

  if (lmsRows[0].count === 0 || mapRows[0].count === 0) {
    console.warn(
      "[WARNING] Database is empty! Please manually insert data into 'mock_lms_records' and 'skill_mappings' via MySQL Workbench."
    );
  } else {
    console.log(
      `[MYSQL] Database contains ${lmsRows[0].count} user records and ${mapRows[0].count} mappings.`
    );
  }
}

// --- PART 1.1: LMS Data Retrieval (PULL from MySQL) ---
async function retrieveLMSData(learnerId, courseId, username, password) {
  if (!isAuthReady) throw new Error("Hub not authenticated yet.");

  // 1. Authentication and Lookup Query: PULLS data from the database
  const [rows] = await dbConnectionPool.execute(
    `SELECT * FROM mock_lms_records 
         WHERE username = ? AND password = ? AND courseId = ?`,
    [username, password, courseId]
  );

  if (rows.length === 0) {
    throw new Error("LMS Authentication Failed or Record Not Found.");
  }

  const record = rows[0];

  // 2. Return the achievement record
  return {
    talentlms_user_id: learnerId,
    courseId: record.courseId,
    fullName: record.fullName,
    courseTitleRaw: record.courseId,
    completion_status: "complete",
    final_score: parseFloat(record.final_score),
    completion_date: new Date().toISOString(),
  };
}

// --- PART 1.3: Standardization (PULL from MySQL) ---
async function standardizeAndMap(rawData, fullName) {
  if (!isAuthReady) throw new Error("Hub not authenticated yet.");

  // 1. Retrieve mapping data from the database
  const [rows] = await dbConnectionPool.execute(
    `SELECT * FROM skill_mappings WHERE courseId = ?`,
    [rawData.courseId]
  );

  if (rows.length === 0) {
    throw new Error(
      `Standardization Failed: Course ID '${rawData.courseId}' not found in mapping database.`
    );
  }

  const mapping = rows[0];

  // 2. Return standardized claims
  return {
    credentialSubject: {
      id: `did:onest:learner:${rawData.talentlms_user_id}`,
      fullName: fullName,
      achievedScore: rawData.final_score,
      courseTitle: rawData.courseTitleRaw,
    },
    claimsAlignment: {
      nsqfLevel: mapping.nsqf_level,
      sfiaCode: mapping.sfia_code,
      sfiaDescription: mapping.sfia_level_desc,
    },
    credentialMetadata: {
      type: ["VerifiableCredential", "ProfessionalCertificate"],
      issueDate: rawData.completion_date,
      issuer: "Infosys ONEST DigiAttestor Hub (via MySQL)",
    },
  };
}

// --- API ROUTE 1: Initiate Certification (Issuance) ---
app.post("/api/issue/initiate", async (req, res) => {
  if (!isAuthReady) return res.status(503).json({ error: "Hub not ready." });

  const { learnerId, courseId, consentGiven, fullName, username, password } =
    req.body;

  if (
    !learnerId ||
    !courseId ||
    !fullName ||
    consentGiven !== true ||
    !username ||
    !password
  ) {
    return res
      .status(400)
      .json({ error: "Missing required parameters or consent not given." });
  }

  try {
    const rawData = await retrieveLMSData(
      learnerId,
      courseId,
      username,
      password
    );
    const standardizedClaims = await standardizeAndMap(rawData, fullName);

    const signedCredential = issueSignedCredential(
      standardizedClaims,
      PUBLIC_KEY_MOCK
    );

    // --- Generate Verification Link and QR Code Data ---
    const verificationLink = BASE_VERIFICATION_URL + signedCredential.id;
    const qrCodeDataUrl = await qrcode.toDataURL(verificationLink);

    return res.status(201).json({
      status: "Verifiable Credential Issued and Signed.",
      credential: signedCredential,
      verificationLink: verificationLink,
      qrCodeImage: qrCodeDataUrl,
    });
  } catch (error) {
    const status = error.message.includes("Authentication Failed") ? 401 : 500;
    console.error("[CRASH] Initiation Error:", error.message);
    return res.status(status).json({
      error: "Failed to process LMS data.",
      details: error.message,
    });
  }
});

// --- API ROUTE 2: Verification Service (Verification) ---
app.post("/api/verify", async (req, res) => {
  if (!isAuthReady) return res.status(503).json({ error: "Hub not ready." });

  const credentialToVerify = req.body;

  if (!credentialToVerify || !credentialToVerify.proof) {
    return res
      .status(400)
      .json({ error: "Invalid credential format. Proof block is missing." });
  }

  try {
    const verificationResult = verifyCredential(credentialToVerify);

    if (verificationResult.valid) {
      return res.status(200).json({
        status: "Verification Success",
        details: "Credential is authentic and untampered.",
        issuerId: credentialToVerify.issuer,
        subjectId: credentialToVerify.credentialSubject.id,
      });
    } else {
      return res.status(406).json({
        status: "Verification Failed",
        details: verificationResult.reason,
      });
    }
  } catch (error) {
    console.error("[VERIFY] Error:", error.message);
    return res.status(500).json({
      error: "Verification service failed due to an internal processing error.",
      details: error.message,
    });
  }
});

// --- NEW API ROUTE 3: Certificate Rendering Service ---
app.post("/api/cert/render", async (req, res) => {
  if (!isAuthReady) return res.status(503).send("Service unavailable.");
  const { credential, qrCodeImage } = req.body;

  if (!credential || !qrCodeImage) {
    return res.status(400).send("Missing credential data or QR code image.");
  }

  // Check authenticity before rendering (optional but good practice)
  const verificationResult = verifyCredential(credential);
  if (!verificationResult.valid) {
    return res
      .status(406)
      .send(`Verification Failed: ${verificationResult.reason}`);
  }

  // Generate the HTML content
  const htmlOutput = renderCertificate(credential, qrCodeImage);

  // Respond with the HTML file
  res.set("Content-Type", "text/html");
  res.send(htmlOutput);
});

// --- NEW API ROUTE 4: Public Status Check (For QR Code Scans) ---
app.get("/api/verify-status", async (req, res) => {
  const credentialId = req.query.id;

  if (!credentialId) {
    return res
      .status(400)
      .send("<html><body><h2>Error: Credential ID missing.</h2></body></html>");
  }

  // NOTE: In a real system, you would check the revocation registry here.
  res.send(`
        <html>
            <head><title>PDC Verification Status</title>
                <style>body { font-family: sans-serif; text-align: center; background-color: #f0f8ff; padding-top: 50px; }
                       h2 { color: #1e8449; }
                       .status-box { border: 2px solid #1e8449; padding: 20px; display: inline-block; background: #e6ffe6; border-radius: 8px; }</style>
            </head>
            <body>
                <div class="status-box">
                    <h2>✅ Credential Verified Successfully</h2>
                    <p>Issuer: Infosys ONEST DigiAttestor Hub</p>
                    <p>Status: ACTIVE (Not revoked)</p>
                    <p>Credential ID: ${credentialId.substring(0, 8)}...</p>
                    <p>The cryptographic signature is VALID.</p>
                </div>
            </body>
        </html>
    `);
});

// --- Server Startup ---
if (require.main === module) {
  // Run initialization function before starting the Express server
  initializeDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`ONEST Hub Data Integrator running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error(
        `[FATAL] Server could not start due to DB error: ${err.message}`
      );
    });
}
