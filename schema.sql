-- ONEST Certification Platform - Database Schema (MySQL)

CREATE DATABASE IF NOT EXISTS onest_cert_db;
USE onest_cert_db;

-- 1. Users Table (Maps students to their decentralized IDs)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    moodle_user_id INT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    user_did VARCHAR(100) UNIQUE NOT NULL, -- Student's Decentralized Identifier
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Courses Table (Defines course details and passing criteria)
CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    moodle_course_id INT UNIQUE NOT NULL,
    course_name VARCHAR(150) NOT NULL,
    passing_grade DECIMAL(5,2) DEFAULT 60.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Course Completions Table (Records grade evaluations from Moodle)
CREATE TABLE IF NOT EXISTS course_completions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    grade DECIMAL(5,2) NOT NULL,
    completed_at DATETIME NOT NULL,
    is_eligible BOOLEAN GENERATED ALWAYS AS (grade >= 60.00) STORED,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_course (user_id, course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Issued Credentials Table (Stores signed verifiable credentials)
CREATE TABLE IF NOT EXISTS issued_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    completion_id INT UNIQUE NOT NULL,
    credential_uuid VARCHAR(36) UNIQUE NOT NULL, -- Standard W3C Credential ID
    jws_signature TEXT NOT NULL,                  -- The generated ES256 signature
    vc_payload JSON NOT NULL,                     -- Complete W3C JSON-LD payload
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('ACTIVE', 'REVOKED') DEFAULT 'ACTIVE',
    FOREIGN KEY (completion_id) REFERENCES course_completions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
