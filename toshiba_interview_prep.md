# Toshiba Trainee Engineer Interview Preparation Guide
## Project: ONEST Certification Platform

---

## 1. Project Explanation in Simple Terms (2-Minute Teach)

### What is ONEST?
**ONEST** (Open Network for Education and Skills Transactions)/(open network for employment and skilling transformation) is an open network initiative in India (conceptually similar to UPI for payments or ONDC for e-commerce) designed to solve the lack of communication between different education, skilling, and job platforms. It establishes standardized APIs and data schemas so that any learning portal can securely exchange credentials, content, and job opportunities.

### What Problem Does it Solve?
Traditionally, certificates are stored in "walled gardens"—locked inside individual Learning Management Systems (LMS) like Moodle, Coursera, or university databases. Sharing these credentials requires manual validation (e.g., attaching a PDF to an email, which a recruiter then has to manually verify with the institution). This process is slow, expensive, and highly vulnerable to forgery (e.g., editing a PDF in Photoshop).

### Why Interoperability Matters
Interoperability ensures that different software systems can read, understand, and cryptographically verify credentials automatically without needing direct custom integrations between every single school and employer. It empowers learners to own their achievements in a digital wallet and present them to any employer for instant verification.

### The "Explain Like I'm Five" Analogy (The 2-Minute Teach)
> **The Analogy**: Think of a standardized passport. A passport works anywhere in the world because every government agreed on the shape, the fields (name, date of birth), and the holographic security seals. A border agent can verify your passport instantly without calling your home country's government because the security seals prove it is authentic.
>
> Without **ONEST** and **Verifiable Credentials**, digital certificates are like custom club membership cards. Every club prints their own, they all look different, and a border officer has no easy way to verify if a card is real or fake without calling the club to check. Our project turns those custom "club cards" into secure, globally recognized "passports" for digital training.

---

## 2. Technical Terms Explained with Analogies

| Technical Term | Plain English Explanation | Real-World Analogy |
| :--- | :--- | :--- |
| **ONEST Protocol** | An open set of specifications and API formats that allows learning, skilling, and employment platforms to exchange data in a standardized, decentralized network. | **UPI (Unified Payments Interface)**: Just like UPI allows GPay, PhonePe, and HDFC Bank to transfer money seamlessly using a single common protocol, ONEST allows Moodle, job portals, and digital wallets to exchange credentials. |
| **Moodle LMS & API** | **Moodle** is an open-source Learning Management System where courses are hosted. The **Moodle API** is a program interface that allows external software to fetch student grades, course progress, and enrollment data. | **The University Registrar's Window**: Moodle is the university registrar's office holding all student files. The API is the clerk sitting at the window who takes an authorized request, checks the record cabinet, and hands back the grades. |
| **W3C Verifiable Credential (VC)** | A global standard format for digital credentials that are tamper-evident, machine-readable, cryptographically signed, and verifyable without calling the issuer. | **A Physical Passport**: It contains your information, is stamped with an official government holographic seal, and is carried by you. Anyone can look at the seal to verify it's real without calling the government. |
| **JSON Web Signature (JWS)** | An RFC standard for signing JSON content. It links the credential's JSON data to a cryptographic signature to prove authenticity and detect if even a single character has changed. | **A Wax Seal on an Envelope**: The letter inside is your data (JSON). The wax seal on the flap with the sender's unique signet ring is the JWS. If the wax is broken or altered, the receiver knows the message was tampered with. |
| **ES256 Algorithm** | An Elliptic Curve Digital Signature Algorithm (ECDSA) using the P-256 curve and SHA-256 hashing. It creates highly secure signatures with tiny key sizes (256 bits), making signature verification extremely fast and lightweight. | **A Advanced Biometric Keycard**: It is tiny and fits in your wallet, opening doors instantly with low battery power, yet it is mathematically impossible to replicate, unlike a massive, heavy iron padlock (which is like RSA). |
| **Cryptographic Data Integrity** | The guarantee that a piece of digital information has not been altered, modified, or corrupted during transit or storage since it was signed. | **A Tamper-Evident Medicine Bottle**: If the plastic seal on the bottle cap is completely intact, you are 100% sure the medicine inside has not been changed or contaminated. |
| **Interoperability** | The ability of different systems (such as a school's database, an HR database, and a candidate's digital wallet) to exchange and use data without custom middleware. | **A USB-C Cable**: No matter who made your phone (Apple, Samsung, Google) or your charger, they connect and work together seamlessly because they all agree on the USB-C physical and electrical standard. |

---

## 3. System Architecture & Flow

### Text-Based Data Flow Diagram

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

### Step-by-Step Execution Sequence

1. **Course Completion**: A student completes a course on Moodle and finishes the final assessment.
2. **Detection & API Call**: The Node.js backend detects completion (via a webhook or cron polling). It calls the Moodle API (specifically `core_completion_get_course_completion_status` and `core_grades_get_grades`) to get the student's name, email, course title, and final grade.
3. **Eligibility Validation**: The backend checks the retrieved grade against the database's threshold (e.g., grade must be >= 60%). If eligible, it starts the credential generation process.
4. **Credential Construction**: The backend creates a standardized JSON-LD W3C Verifiable Credential payload:
   ```json
   {
     "@context": ["https://www.w3.org/2018/credentials/v1"],
     "id": "urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
     "type": ["VerifiableCredential", "ONESTTrainingCredential"],
     "issuer": "did:web:onest.certplatform.com",
     "issuanceDate": "2026-07-22T12:00:00Z",
     "credentialSubject": {
       "id": "did:key:z6MkpTHR8VNsBxuexb6F",
       "studentName": "John Doe",
       "courseName": "Embedded Systems Boot Camp",
       "finalGrade": "85%",
       "status": "Pass"
     }
   }
   ```
5. **ES256 Cryptographic Signing**:
   * **Header Creation**: Define signature parameters: `{"alg": "ES256", "typ": "JWT"}`. Base64URL-encode this header.
   * **Payload Encoding**: Base64URL-encode the W3C VC payload JSON.
   * **Hash & Sign**: Concatenate the encoded header and payload with a dot (`header.payload`). Hash this string using **SHA-256**, then sign it using the Issuer's Private EC key (P-256 curve) to generate a unique signature.
   * **Assemble JWS**: Concatenate the signature to the header and payload (`header.payload.signature`) to produce the final signed credential string.
6. **MySQL Storage**: Save transaction logs and issued credential references to MySQL.
7. **Verification**: When the student shares this credential (as JSON or a QR code), a verifier (like an employer) parses the JWS, fetches the issuer's public key (retrieved from `did:web:onest.certplatform.com`), and validates the signature mathematically. If any detail (like the grade) was edited, the signature validation fails immediately.

---

### Database Schema (MySQL)

We used a normalized database structure to manage student enrollments, course rules, issued credentials, and system logs:

```sql
-- 1. Users Table (Maps students to their decentralized IDs)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    moodle_user_id INT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    user_did VARCHAR(100) UNIQUE NOT NULL, -- Student's Decentralized Identifier
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Courses Table (Defines course details and passing criteria)
CREATE TABLE courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    moodle_course_id INT UNIQUE NOT NULL,
    course_name VARCHAR(150) NOT NULL,
    passing_grade DECIMAL(5,2) DEFAULT 60.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Course Completions Table (Records grade evaluations from Moodle)
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

-- 4. Issued Credentials Table (Stores signed verifiable credentials)
CREATE TABLE issued_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    completion_id INT UNIQUE NOT NULL,
    credential_uuid VARCHAR(36) UNIQUE NOT NULL, -- Standard W3C Credential ID
    jws_signature TEXT NOT NULL,                  -- The generated ES256 signature
    vc_payload JSON NOT NULL,                     -- Complete W3C JSON-LD payload
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('ACTIVE', 'REVOKED') DEFAULT 'ACTIVE',
    FOREIGN KEY (completion_id) REFERENCES course_completions(id)
);
```

---

## 4. Prep for Interview Questions

* **"Explain your ONEST project in 2 minutes"**
  > **Answer**: "We built an interoperable, secure certification platform compliant with India's ONEST protocol. The system integrates with Moodle LMS via its APIs to track when students complete courses, checks if their assessment grades meet eligibility criteria, and automatically issues tamper-proof W3C Verifiable Credentials. To secure these credentials, we implemented JSON Web Signatures using the ES256 elliptic-curve algorithm, allowing employers and external portals to instantly verify the certificate's authenticity without contacting our servers."

* **"What is your specific contribution in this 4-person team?"**
  > **Answer**: "I served as the Lead Backend Developer. My primary responsibility was building the Node.js core service that integrates with the Moodle REST APIs and designing the MySQL database schema to handle transaction logs. I also implemented the cryptographic signing module using Node’s `crypto` library to hash the payloads and generate ES256 signatures, ensuring complete data integrity."

* **"What is ES256 and why did you use it over other algorithms?"**
  > **Answer**: "ES256 stands for Elliptic Curve Digital Signature Algorithm using the P-256 curve and SHA-256. We chose it over RSA algorithms (like RS256) because it provides the same cryptographic strength as a 3072-bit RSA key but with a much smaller 256-bit key size. This makes key storage smaller, signature generation faster, and verification significantly less CPU-intensive, which is critical for scaling API performance."

* **"What is a verifiable credential and how is it different from a regular certificate?"**
  > **Answer**: "A traditional digital certificate is typically a PDF file, which has no built-in security and can be easily edited or forged using basic graphic design software. A Verifiable Credential is a structured JSON-LD data payload that includes a cryptographic digital signature from the issuer. It is machine-readable and tamper-evident; if a single character of the certificate metadata is modified, the signature validation fails mathematically."

* **"How does Moodle LMS API work in your system?"**
  > **Answer**: "We configure Moodle to trigger a webhook, or our Node.js backend polls Moodle's REST web services. Using an authorized access token, we call the `core_grades_get_grades` endpoint with the student's ID and course ID to fetch their grade. We then parse the response, store the record, and run it through our eligibility engine."

* **"What happens if the Moodle API is down?"**
  > **Answer**: "To prevent data loss, we decoupled the API fetching from the core validation logic using a retry queue. If a request to Moodle fails or times out, the task is marked as pending in our database and placed in a queue. It retries automatically with exponential backoff, and alerts the system administrator if the API remains unreachable after 5 attempts."

* **"How did you ensure the credential cannot be tampered with?"**
  > **Answer**: "We guarantee integrity by signing the Base64URL-encoded header and payload of the credential with our platform's private EC key. During verification, the verifier decodes the payload, hashes it, and verifies it against the signature using our public key. Any tampering with the data breaks the mathematical alignment between the hash and the signature, alerting the verifier."

* **"What was the hardest part of building this?"**
  > **Answer**: "The most challenging part was ensuring data canonicalization before signing the JSON payload. In JavaScript, JSON object key ordering is not guaranteed, and minor structural or white-space differences alter the generated hash, causing verification to fail. We solved this by using a deterministic JSON stringify library to enforce identical key sorting during both signing and verification."

* **"What would you improve if you had more time?"**
  > **Answer**: "I would implement a distributed key management system (KMS) or Hardware Security Module (HSM) connection to secure the private keys, rather than loading them via standard environment variables. Additionally, I would write a revocation registry using cryptographic accumulator lists, allowing us to revoke credentials instantly in real-time."

* **"How does this scale to 10,000 users?"**
  > **Answer**: "Node.js uses non-blocking I/O, which is excellent for handling concurrent network calls. To scale to 10,000 users, we would implement database indexing on the query columns (`moodle_user_id` and `moodle_course_id`), introduce Redis to cache public keys and manage the retry queue, and containerize the Node.js application with Docker to load-balance traffic across multiple nodes."

* **"What is ONEST compliance and how did you achieve it?"**
  > **Answer**: "ONEST compliance requires that all credential schemas and API endpoints follow the Beckn-based protocol schemas defined by the network. We achieved this by structuring our Verifiable Credential fields to match the official ONEST schemas, and implementing specific API request-response structures that can interface with ONEST network gateways."

* **"How is your system different from just sending a PDF certificate over email?"**
  > **Answer**: "A PDF emailed to a student requires manual verification by an employer, who must call or email the university to verify its validity. Our system outputs machine-readable JSON data that an employer's HR software can verify programmatically and instantly using public-key cryptography, removing the need for manual, slow, and expensive human verification."

---

## 5. The Exact 90-Second Pitch (Word-for-Word)

> *"Good morning/afternoon. Today I want to talk about my project, the **ONEST Certification Platform**, which I built in a team of four.*
>
> *The core problem we solved is the lack of interoperability in professional credentials. Today, when you finish a course on an LMS like Moodle, your certificate sits in a silo. Showing it to a recruiter means sending a PDF, which is easy to forge and hard to verify.*
> 
> *To solve this, we built a Node.js and MySQL backend system that connects directly to the Moodle API. When a student completes a course, our system pulls their grades and checks their eligibility. If they pass, we generate a W3C-standard Verifiable Credential. We secure this using digital signatures with the **ES256 algorithm**.*
>
> *By hashing the credential payload and signing it with our private key, we make it completely tamper-proof. Any third-party verifier can instantly validate the signature using our public key. They can be 100% sure of who issued it, who earned it, and that the grade has not been changed. This creates a secure, open network where certifications can move freely between LMS portals, digital wallets, and job boards. I focused heavily on building the API integrations, database schemas, and cryptographic signing pipeline."*

---

## 6. Technical Deep-Dive Questions (For Senior Engineers)

### Q1: "Explain exactly how ES256 signature verification works mathematically. What parameters are involved?"
> **Answer**: "ES256 uses the ECDSA algorithm over the NIST P-256 elliptic curve. The signature consists of a coordinate pair $(r, s)$. 
> During verification, the verifier takes the hash of the payload ($z$), the public key ($Q$), and the signature values $(r, s)$. 
> The verifier calculates:
> * $w = s^{-1} \pmod n$
> * $u_1 = z \cdot w \pmod n$
> * $u_2 = r \cdot w \pmod n$
> Using these scalar multipliers, we compute the point on the curve:
> * $(x_1, y_1) = u_1 \cdot G + u_2 \cdot Q$
> If $x_1 \equiv r \pmod n$, the signature is mathematically proven to be valid and signed by the holder of the private key."

### Q2: "If someone intercepts the Verifiable Credential mid-transit and changes the name from 'Alice' to 'Bob', what step in the verification process catches this?"
> **Answer**: "When the verifier receives the tampered credential, they extract the payload data ('Bob') and hash it using SHA-256. 
> They then verify the signature using the issuer's public key. The output of that verification yields the mathematical value representing the original hash of the data signed by the issuer. 
> Because the name was changed, the new hash of the tampered data will not match the hash reconstructed from the signature. This mismatch causes the cryptographic check to fail, and the system flags the credential as invalid."

### Q3: "Why did you choose Node.js for this backend over a language like Java or Go which have stronger typing and CPU-bound crypto execution?"
> **Answer**: "We chose Node.js because the primary performance bottleneck of our system is I/O-bound—waiting on Moodle API responses and database queries. Node.js's asynchronous event loop is highly efficient for I/O operations. 
> For the CPU-bound cryptographic operations, Node.js uses the native C++ bindings of OpenSSL through its built-in `crypto` module, meaning the actual ES256 signing and SHA-256 hashing execute at native speed, bypassing JS performance limitations."

### Q4: "How did you prevent SQL Injection attacks on your MySQL database, particularly when storing JSON payloads?"
> **Answer**: "We prevented SQL Injection by using **Parameterized Queries** and **Prepared Statements** via the `mysql2` driver in Node.js, ensuring that no user-supplied data is concatenated directly into SQL strings. 
> For the JSON payloads, we validated the input schema using libraries like `joi` or `yup` before stringifying it and inserting it into the database using placeholder variables (`?`)."

### Q5: "Explain how you handle Replay Attacks where a user takes a valid credential issued to someone else and tries to present it as their own."
> **Answer**: "A Verifiable Credential has a `credentialSubject.id` field, which contains the recipient's **DID (Decentralized Identifier)**. 
> During verification, the verifier does not just check the issuer's signature; they also challenge the holder of the credential to prove ownership of the private key corresponding to the student's `credentialSubject.id` (via a cryptographic challenge-response protocol). 
> If a malicious user tries to present someone else's credential, they will fail to solve this challenge because they do not own the student's private key, stopping the replay attack."

---

## 7. Connecting the Project to Toshiba's Work (Firmware Validation)

At Toshiba, a Trainee Engineer role heavily involves **firmware validation**, writing test cases, and verifying hardware behavior. You can directly connect your backend project to this role using these points:

1. **Firmware Integrity and Secure Boot**:
   * *The Connection*: Modern hardware uses **Secure Boot** to ensure that firmware images running on the microcontrollers haven't been tampered with. This is done by signing the firmware binary with a private key (using algorithms like ES256/RSA) and having the hardware bootloader verify it using a public key burned into the silicon. 
   * *What to Say*: *"In my project, I used ES256 signing to guarantee data integrity of certificates. This uses the exact same cryptographic verification principles as Secure Boot in embedded systems, where a hardware bootloader verifies the digital signature of a firmware image before executing it to prevent malicious code injection."*

2. **Rigid Specification Compliance**:
   * *The Connection*: Firmware development and validation require writing code that strictly adheres to hardware specifications (datasheets, timing diagrams, bus protocols). 
   * *What to Say*: *"Implementing W3C Verifiable Credentials and ONEST required mapping API data schemas to strict external protocol specifications. This taught me how to read complex standards documents, write code that strictly complies with precise specifications, and debug systems when compliance checks fail—skills directly applicable to validating firmware against hardware datasheets."*

3. **API and Boundary Testing**:
   * *The Connection*: Testing firmware involves simulating hardware inputs, checking bounds, and writing robust test scripts.
   * *What to Say*: *"Integrating the Moodle API forced me to design comprehensive test suites, checking how my system responded to edge cases like malformed payloads, data boundary issues (like negative grades), network timeouts, and offline states. Writing these test cases to validate backend behavior gave me a strong mental model for writing rigorous firmware test suites that verify hardware registers and state machines under unexpected conditions."*

4. **State Machine Modeling**:
   * *The Connection*: Both firmware control loops and credential lifecycles are modeled as strict finite state machines.
   * *What to Say*: *"My database and logic design modeled credentials as state machines (Active, Expired, Revoked) triggered by external API events. Firmware validation relies on verifying that hardware states transition correctly under different input sequences, so my experience designing and testing logic transitions translates directly to validating hardware states."*
