# ONEST Certification Platform - Decentralized Trust & Credential Verification Engine

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](https://github.com/rahulranjan2203/infosys-onest-project)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-blue.svg)](https://nodejs.org/)
[![W3C Standard](https://img.shields.io/badge/W3C-Verifiable%20Credentials-informational.svg)](https://www.w3.org/TR/vc-data-model/)
[![Cryptography](https://img.shields.io/badge/Cryptography-ES256%20ECDSA-success.svg)](https://datatracker.ietf.org/doc/html/rfc7515)
[![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)](LICENSE)

An enterprise-grade, interoperable credential verification platform compliant with India's **ONEST (Open Network for Education and Skills Transactions)** framework. This system connects learning platforms (such as Moodle LMS) to decentralized trust networks using W3C Verifiable Credentials and JSON Web Signatures (JWS) powered by ES256 (NIST P-256) elliptic-curve cryptography.

---

## Live Deployment Links

- **ONEST Credential Verification Platform**: [https://onest-cert-hub.onrender.com](https://onest-cert-hub.onrender.com)
- **Moodle LMS Administrator Portal**: [https://onest-cert-hub.onrender.com/moodle](https://onest-cert-hub.onrender.com/moodle)
- **GitHub Repository**: [https://github.com/rahulranjan2203/infosys-onest-project.git](https://github.com/rahulranjan2203/infosys-onest-project.git)

---

## 1. Executive Summary & Problem Statement

### What is ONEST?
ONEST (Open Network for Education and Skills Transactions) is an open network initiative in India, conceptually similar to UPI for digital payments or ONDC for e-commerce. It establishes standardized APIs and decentralized data schemas so that educational institutions, learning management systems, candidates, and employers can exchange credentials, learning content, and employment opportunities seamlessly.

### The Core Problem: Siloed Credentials
Traditionally, academic and professional certificates are trapped in isolated Learning Management Systems (LMS) or institutional databases. Verifying these credentials requires slow, manual human intervention (e.g., sending a PDF over email, which an HR team must manually verify with the university). PDF certificates are also highly vulnerable to graphic editing and forgery.

### The Solution: The "Digital Passport" Analogy
- **Walled Gardens**: Conventional certificates are like custom club membership cards. Every institution prints their own, they lack universal standards, and external parties cannot easily verify their authenticity without contacting the issuer directly.
- **Verifiable Credentials**: ONEST turns custom club cards into standardized, cryptographically sealed digital passports. A border official can verify a physical passport instantly using holographic seals without calling the issuing country's government. Similarly, our platform signs student achievement data with public-key cryptography (ES256), enabling employers to verify certificate authenticity programmatically in milliseconds.

---

## 2. Core Technical Terminology & Analogies

| Technical Term | Definition | Real-World Analogy |
| :--- | :--- | :--- |
| **ONEST Protocol** | Open specifications and API formats enabling decentralized education and job networks to exchange data. | **UPI (Unified Payments Interface)**: Allows different banking apps (GPay, PhonePe, HDFC) to transfer funds using a unified open protocol. |
| **Moodle LMS API** | REST API web services exposing student course progress, enrollment, and gradebook evaluations. | **University Registrar Window**: The clerk who verifies student records in the file cabinet and hands back authorized transcripts. |
| **W3C Verifiable Credential (VC)** | Standard machine-readable format for tamper-evident digital credentials. | **Physical Passport**: Contains personal metadata stamped with official holographic government security seals. |
| **JSON Web Signature (JWS)** | RFC 7515 standard linking JSON data to a cryptographic digital signature string. | **Wax Seal on an Envelope**: The letter inside is the payload; the unbroken signet wax seal proves the message was not tampered with. |
| **ES256 Algorithm** | ECDSA algorithm using the NIST P-256 curve and SHA-256 hashing. | **Biometric Smart Keycard**: Provides high security with small key sizes (256 bits), minimizing storage and CPU overhead. |
| **Cryptographic Integrity** | Mathematical guarantee that digital data has not been modified in transit or storage. | **Tamper-Evident Medicine Bottle**: An intact plastic seal guarantees the contents inside remain untampered. |

---

## 3. System Architecture & Data Flow

```
+------------+        1. Course Completed        +------------+
|            | --------------------------------> |            |
| Moodle LMS |                                   |  Node.js   |
|            | <-------------------------------- |  Backend   |
+------------+       2. Fetch Student Grade      +------------+
                             (API Call)                |
                                                       | 3. Validate Eligibility
                                                       v (Grade >= 60%)
+------------+                                   +------------+
|            |        6. Store Credential & Log  | Cryptography|
| MySQL DB   | <-------------------------------- |   Module   |
|            |                                   |  (ES256)   |
+------------+                                   +------------+
                                                       |
                                                       | 4. Sign JSON VC Payload
                                                       | 5. Output JWS Signed VC
                                                       v
                                                 +------------+
                                                 | Verifiable |
                                                 | Credential |
                                                 +------------+
                                                       |
                                                       | 7. Share VC with Employer
                                                       v
                                                 +------------+
                                                 |  Verifier  |
                                                 | (Employer) |
                                                 +------------+
                                                       |
                                                       | 8. Verify JWS with 
                                                       |    Issuer's Public Key
                                                       v
                                                 [SUCCESS / FAIL]
```

### Execution Flow Sequence
1. **Course Completion**: A student completes a course assessment on Moodle LMS.
2. **Gradebook Fetch**: The Node.js service calls Moodle REST APIs (`core_grades_get_grades`) to retrieve student marks and course metadata.
3. **Eligibility Engine**: Evaluates student marks against passing criteria (Default: Grade >= 60.00%).
4. **W3C Payload Construction**: Constructs a JSON-LD payload containing student DID, issuer DID, course details, and reported grade.
5. **ES256 Cryptographic Signing**: Hashes the payload using SHA-256 and signs it with the platform's private EC key (P-256 curve) to generate a 64-byte JWS signature string.
6. **Database Persistence**: Stores execution logs and issued credential references in MySQL / SQLite.
7. **Verification**: Employer or external verifiers validate the signature using the issuer's public key (`did:web:onest.certplatform.com`) and check database status.

---

## 4. W3C Verifiable Credential Payload Example

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://schema.onest.network/credentials/v1"
  ],
  "id": "urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
  "type": [
    "VerifiableCredential",
    "ONESTTrainingCredential"
  ],
  "issuer": "did:web:onest.certplatform.com",
  "issuanceDate": "2026-09-02T12:00:00.000Z",
  "credentialSubject": {
    "id": "did:key:z6MkpTHR8VNsBxuexb6F_alice_dev",
    "studentName": "Alice Dev",
    "studentEmail": "alice@example.com",
    "courseName": "Embedded Systems Boot Camp",
    "moodleCourseId": 101,
    "gradeReported": "85%",
    "status": "Pass"
  },
  "proof": {
    "type": "JsonWebSignature2020",
    "created": "2026-09-02T12:00:00.000Z",
    "proofPurpose": "assertionMethod",
    "verificationMethod": "did:web:onest.certplatform.com#key-1",
    "jws": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWJqZWN0IjoiQWxpY2UgRGV2In0.MEQCIE..."
  }
}
```

---

## 5. Mathematical Cryptographic Verification (ES256 / NIST P-256)

ES256 uses Elliptic Curve Digital Signature Algorithm (ECDSA) over the NIST P-256 curve. The signature consists of a coordinate pair (r, s).

```
During verification:
1. Extract SHA-256 hash of payload: z
2. Public Key: Q
3. Signature components: (r, s)

Computations:
w  = s^(-1) mod n
u1 = (z * w) mod n
u2 = (r * w) mod n

Curve Point:
(x1, y1) = u1 * G + u2 * Q

Validation Criteria:
If x1 ≡ r (mod n) => Signature is Cryptographically Valid.
```

---

## 6. Database Schema Architecture

```sql
-- 1. Users Table (Maps students to Decentralized Identifiers)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    moodle_user_id INT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    user_did VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Courses Table (Defines course details and passing threshold)
CREATE TABLE courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    moodle_course_id INT UNIQUE NOT NULL,
    course_name VARCHAR(150) NOT NULL,
    passing_grade DECIMAL(5,2) DEFAULT 60.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Course Completions Table (Records student grade evaluations)
CREATE TABLE course_completions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    grade DECIMAL(5,2) NOT NULL,
    completed_at DATETIME NOT NULL,
    is_eligible BOOLEAN GENERATED ALWAYS AS (grade >= 60.00) STORED,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    UNIQUE KEY unique_user_course (user_id, course_id)
);

-- 4. Issued Credentials Table (Stores ES256 signatures & VC payloads)
CREATE TABLE issued_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    completion_id INT UNIQUE NOT NULL,
    credential_uuid VARCHAR(36) UNIQUE NOT NULL,
    jws_signature TEXT NOT NULL,
    vc_payload JSON NOT NULL,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('ACTIVE', 'REVOKED') DEFAULT 'ACTIVE',
    FOREIGN KEY (completion_id) REFERENCES course_completions(id)
);
```

---

## 7. Toshiba Firmware Validation Alignment

The architecture of this backend platform directly mirrors core principles required in embedded systems and firmware validation:

1. **Secure Boot & Firmware Integrity**:
   - **Connection**: Embedded microcontrollers use Secure Boot to verify that firmware binaries have not been tampered with before execution.
   - **Implementation**: Our platform uses ES256 signing to guarantee credential data integrity. The verification process follows identical cryptographic mathematical proofs as hardware bootloaders verifying firmware signatures against public keys burned into silicon.

2. **Rigid Protocol Specification Compliance**:
   - **Connection**: Firmware validation requires strict compliance with hardware datasheets, bus timing diagrams, and register maps.
   - **Implementation**: Mapping Moodle API endpoints to W3C JSON-LD standards enforced strict schema parsing and canonicalization rules.

3. **API & Boundary Fault Testing**:
   - **Connection**: Testing hardware microcontrollers requires writing test scripts for out-of-bounds inputs, register overflows, and bus noise.
   - **Implementation**: Test suites check backend behavior under edge conditions including malformed payloads, invalid signatures, network timeouts, and grade threshold boundaries.

4. **Finite State Machine (FSM) Modeling**:
   - **Connection**: Microcontroller control loops and hardware states operate as finite state machines.
   - **Implementation**: Credential status lifecycle (Active, Expired, Revoked) is managed via state machine logic triggered by API events.

---

## 8. REST API Reference

### 1. Batch Sync & Issue Certificates
- **POST** `/api/credentials/sync-all`
- **Description**: Pulls student grades from Moodle LMS, evaluates eligibility (Grade >= 60%), issues or re-signs W3C credentials with ES256 signatures.

### 2. Verify Credential Signature
- **POST** `/api/credentials/verify`
- **Body**: `{ "jws": "header.payload.signature" }`
- **Description**: Performs mathematical ES256 signature verification and checks database revocation status.

### 3. Toggle Revocation Status
- **POST** `/api/credentials/revoke`
- **Body**: `{ "credentialUuid": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6" }`
- **Description**: Toggles credential status between `ACTIVE` and `REVOKED`.

### 4. Fetch All Credentials
- **GET** `/api/credentials/all`
- **Description**: Returns all issued credentials joined with student and course metadata.

---

## 9. Local Installation & Development Setup

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### Setup Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/rahulranjan2203/infosys-onest-project.git
   cd infosys-onest-project
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (`.env`):
   ```env
   PORT=3000
   DB_TYPE=sqlite
   MOODLE_API_URL=http://localhost:3000/mock-moodle
   MOODLE_TOKEN=mock_moodle_api_token_12345
   ISSUER_DID=did:web:onest.certplatform.com
   ```

4. Start the development server:
   ```bash
   npm start
   ```

5. Access local portals in browser:
   - **ONEST Cert Hub**: `http://localhost:3000`
   - **Moodle LMS Portal**: `http://localhost:3000/moodle`

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
