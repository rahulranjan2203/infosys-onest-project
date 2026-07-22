# ONEST Certification Platform - Decoupled Trust Network

An interoperable, secure, and verifiable credential issuance backend system compliant with the **ONEST (Open Network for Education and Skills Transactions)** protocol framework. 

This platform decoupling the **Moodle LMS** and the **ONEST Certification Hub** into a dual-port architecture, complete with an interactive admin gradebook simulator and a cryptographic verifier dashboard.

---

## 🚀 Key Features

* **Dual-Port Decoupled Architecture**: 
  * **ONEST Cert Hub** runs on port `3000` (Syncing, cryptographic signing, database logging, and credential verification).
  * **Moodle LMS Simulator** runs on port `4000` (Gradebook management, student catalogs, and statistics widgets).
* **W3C Verifiable Credentials**: Generates structured, standardized, machine-readable JSON-LD credentials.
* **ES256 Digital Signatures**: Implements native JSON Web Signatures (JWS) using Elliptic Curve Cryptography (P-256 curve) with zero external JWT dependencies.
* **Interactive Visual Certificate (Diploma Card)**: Renders a printable visual digital credential card directly from the JSON-LD payload.
* **Drag-and-Drop Verification Vault**: Drag and drop a signed credential JSON file to verify its signature and check database revocation status in real-time.
* **Dual-Database Support**: Primary support for **MySQL** with an automatic **SQLite fallback** for quick local testing and zero-config deployment.

---

## 🛠️ Technology Stack

* **Runtime**: Node.js (v18+)
* **Framework**: Express.js
* **Databases**: MySQL (Production), SQLite (Development fallback)
* **Cryptographic Algorithms**: ECDSA ES256, SHA-256
* **Design Aesthetic**: Premium glassmorphic dark-mode (Cert Hub) & modern academic SaaS light-mode (Moodle LMS)

---

## 📂 Project Structure

```
onest-cert-hub/
├── .env                      # Local configuration file
├── package.json              # Scripts & dependencies
├── schema.sql                # Production MySQL schemas
├── index.html                # ONEST Cert Hub dashboard (Port 3000)
├── moodle.html               # Moodle LMS dashboard (Port 4000)
├── test.js                   # Decoupled integration test script
└── src/
    ├── app.js                # App entry point (boots both port servers)
    ├── config/
    │   └── database.js       # Database client pool (MySQL/SQLite)
    ├── routes/
    │   ├── credentialRoutes.js # ONEST endpoints (Sync, Get, Verify)
    │   └── mockMoodleRoutes.js # Moodle REST API & Admin Simulator endpoints
    ├── services/
    │   ├── cryptoService.js  # ES256 key generation, JWS signing & verification
    │   └── moodleService.js  # Moodle Web Services API client
    └── utils/
        └── dbInit.js         # Table creation & mock database seeder
```

---

## ⚙️ Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Verify your `.env` contains the correct port configurations:
```env
PORT=3000
MOODLE_PORT=4000
DB_TYPE=sqlite
MOODLE_API_URL=http://localhost:4000/mock-moodle
MOODLE_TOKEN=mock_moodle_api_token_12345
ISSUER_DID=did:web:onest.certplatform.com
```

---

## 🏃 Running the Application

### Option A: Run Automated Integration Tests
Starts separate test server instances (ports `3001` and `3002`), runs the database seeds, evaluates completions, tests tampering, and exits cleanly.
```bash
npm test
```

### Option B: Run the Development Servers
Starts the decoupled servers concurrently:
* ONEST Cert Hub: [http://localhost:3000](http://localhost:3000)
* Moodle LMS Portal: [http://localhost:4000](http://localhost:4000)
```bash
npm run dev
```

---

## 🔌 API Documentation

### 1. Sync & Issue Certificate
* **Endpoint**: `POST http://localhost:3000/api/credentials/sync`
* **Content-Type**: `application/json`
* **Payload**: `{"moodleUserId": 1, "moodleCourseId": 101}`

### 2. Verify Credential
* **Endpoint**: `POST http://localhost:3000/api/credentials/verify`
* **Content-Type**: `application/json`
* **Payload**: `{"jws": "header.payload.signature"}`

---

## 🔐 Cryptography Under the Hood

### Recursive Canonicalization
To prevent validation failures due to spacing or key ordering differences in JSON parsing across different platforms, the backend recursively sorts JSON keys alphabetically before hashing without filtering properties:
```javascript
function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalizeJson).join(',') + ']';
  const sortedKeys = Object.keys(obj).sort();
  const properties = sortedKeys.map(key => JSON.stringify(key) + ':' + canonicalizeJson(obj[key]));
  return '{' + properties.join(',') + '}';
}
```

### ES256 Elliptic Curve Signature
Signatures are generated using ECDSA P-256 with SHA-256. The JWS specification uses raw signature bytes (IEEE P1363 format). The Node.js native `crypto` module generates this format:
```javascript
const signature = sign.sign({
  key: privateKeyPem,
  dsaEncoding: 'ieee-p1363' // Ensures a standard 64-byte r + s signature
});
```
This guarantees maximum execution speed and standard compliance with Zero-npm bloat.
