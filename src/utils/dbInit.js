const db = require('../config/database');

async function initializeDatabase() {
  console.log(`Initializing database tables for ${db.type}...`);

  try {
    if (db.type === 'mysql') {
      // MySQL Table Schemas
      await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          moodle_user_id INT UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          user_did VARCHAR(100) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS courses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          moodle_course_id INT UNIQUE NOT NULL,
          course_name VARCHAR(150) NOT NULL,
          passing_grade DECIMAL(5,2) DEFAULT 60.00,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS course_completions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          course_id INT NOT NULL,
          grade DECIMAL(5,2) NOT NULL,
          completed_at DATETIME NOT NULL,
          is_eligible BOOLEAN DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_course (user_id, course_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS issued_credentials (
          id INT AUTO_INCREMENT PRIMARY KEY,
          completion_id INT UNIQUE NOT NULL,
          credential_uuid VARCHAR(36) UNIQUE NOT NULL,
          jws_signature TEXT NOT NULL,
          vc_payload JSON NOT NULL,
          issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status ENUM('ACTIVE', 'REVOKED') DEFAULT 'ACTIVE',
          FOREIGN KEY (completion_id) REFERENCES course_completions(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS moodle_mock_grades (
          id INT AUTO_INCREMENT PRIMARY KEY,
          moodle_user_id INT NOT NULL,
          moodle_course_id INT NOT NULL,
          grade DECIMAL(5,2) NOT NULL,
          completed BOOLEAN DEFAULT 1,
          UNIQUE KEY unique_user_course (moodle_user_id, moodle_course_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } else {
      // SQLite Table Schemas (Slight syntax variations)
      await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          moodle_user_id INTEGER UNIQUE NOT NULL,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          user_did TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS courses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          moodle_course_id INTEGER UNIQUE NOT NULL,
          course_name TEXT NOT NULL,
          passing_grade REAL DEFAULT 60.00,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS course_completions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          course_id INTEGER NOT NULL,
          grade REAL NOT NULL,
          completed_at DATETIME NOT NULL,
          is_eligible INTEGER DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
          UNIQUE (user_id, course_id)
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS issued_credentials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          completion_id INTEGER UNIQUE NOT NULL,
          credential_uuid TEXT UNIQUE NOT NULL,
          jws_signature TEXT NOT NULL,
          vc_payload TEXT NOT NULL, -- SQLite stores JSON as TEXT
          issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT CHECK(status IN ('ACTIVE', 'REVOKED')) DEFAULT 'ACTIVE',
          FOREIGN KEY (completion_id) REFERENCES course_completions(id) ON DELETE CASCADE
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS moodle_mock_grades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          moodle_user_id INTEGER NOT NULL,
          moodle_course_id INTEGER NOT NULL,
          grade REAL NOT NULL,
          completed INTEGER DEFAULT 1,
          UNIQUE(moodle_user_id, moodle_course_id)
        );
      `);
    }

    console.log('Database tables created successfully.');
    await seedMockData();
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

async function seedMockData() {
  console.log('Seeding mock data...');
  try {
    // 1. Seed Courses
    const coursesCount = await db.query('SELECT COUNT(*) as count FROM courses');
    const hasCourses = db.type === 'sqlite' ? coursesCount[0].count : coursesCount[0].count;
    
    if (hasCourses === 0) {
      await db.query('INSERT INTO courses (moodle_course_id, course_name, passing_grade) VALUES (?, ?, ?)', [101, 'Embedded Systems Boot Camp', 60.00]);
      await db.query('INSERT INTO courses (moodle_course_id, course_name, passing_grade) VALUES (?, ?, ?)', [102, 'Node.js Backend Essentials', 70.00]);
      console.log('Mock courses seeded.');
    }

    // 2. Seed Users
    const usersCount = await db.query('SELECT COUNT(*) as count FROM users');
    const hasUsers = db.type === 'sqlite' ? usersCount[0].count : usersCount[0].count;
    
    if (hasUsers === 0) {
      await db.query(
        'INSERT INTO users (moodle_user_id, name, email, user_did) VALUES (?, ?, ?, ?)',
        [1, 'Alice Dev', 'alice@toshiba.com', 'did:key:z6MkpTHR8VNsBxuexb6F_alice']
      );
      await db.query(
        'INSERT INTO users (moodle_user_id, name, email, user_did) VALUES (?, ?, ?, ?)',
        [2, 'Bob Code', 'bob@toshiba.com', 'did:key:z6MkpTHR8VNsBxuexb6F_bob']
      );
      console.log('Mock users seeded.');
    }

    // 3. Seed Moodle Mock Grades
    const gradesCount = await db.query('SELECT COUNT(*) as count FROM moodle_mock_grades');
    const hasGrades = db.type === 'sqlite' ? gradesCount[0].count : gradesCount[0].count;
    
    if (hasGrades === 0) {
      await db.query('INSERT INTO moodle_mock_grades (moodle_user_id, moodle_course_id, grade, completed) VALUES (?, ?, ?, ?)', [1, 101, 85.00, 1]);
      await db.query('INSERT INTO moodle_mock_grades (moodle_user_id, moodle_course_id, grade, completed) VALUES (?, ?, ?, ?)', [2, 101, 55.00, 1]);
      console.log('Mock Moodle grades seeded.');
    }
  } catch (error) {
    console.error('Failed to seed mock data:', error);
  }
}

module.exports = { initializeDatabase };
