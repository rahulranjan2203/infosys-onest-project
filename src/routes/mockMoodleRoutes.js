const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * Mock Moodle REST API Endpoint
 * Mimics Moodle's web service parameters and returns database-driven mock JSON data
 */
router.get('/', async (req, res) => {
  const { wstoken, wsfunction, userid, courseid, userids } = req.query;

  // 1. Authenticate Token
  const expectedToken = process.env.MOODLE_TOKEN || 'mock_moodle_api_token_12345';
  if (wstoken !== expectedToken) {
    return res.status(401).json({
      exception: 'moodle_exception',
      errorcode: 'invalidtoken',
      message: 'Invalid token - token not found'
    });
  }

  // Extract userId depending on how it's sent (direct userid or userids[0] array query)
  let parsedUserId = userid ? parseInt(userid) : null;
  if (!parsedUserId && req.query['userids']) {
    parsedUserId = parseInt(req.query['userids'][0]);
  }
  const parsedCourseId = parseInt(courseid);

  console.log(`Mock Moodle Service: Fetching function "${wsfunction}" for User: ${parsedUserId}, Course: ${parsedCourseId}`);

  // Fetch grade and completion state from mock Moodle table
  let mockGrade = 0.00;
  let mockCompleted = false;
  let hasRecord = false;

  try {
    const results = await db.query(
      'SELECT grade, completed FROM moodle_mock_grades WHERE moodle_user_id = ? AND moodle_course_id = ?',
      [parsedUserId, parsedCourseId]
    );
    if (results.length > 0) {
      mockGrade = parseFloat(results[0].grade);
      mockCompleted = !!results[0].completed;
      hasRecord = true;
    }
  } catch (error) {
    console.error('Error reading mock Moodle grades from DB:', error.message);
  }

  // 2. Route based on Moodle Web Service Function
  if (wsfunction === 'core_completion_get_course_completion_status') {
    return res.json({
      completionstatus: {
        completed: mockCompleted,
        aggregation: 1,
        critera: [
          { reqid: 1, type: 4, title: 'Activities completed', status: mockCompleted ? 1 : 0, complete: mockCompleted }
        ]
      }
    });
  } 
  
  else if (wsfunction === 'core_grades_get_grades') {
    return res.json({
      items: [
        {
          itemtype: 'course',
          grademin: 0,
          grademax: 100,
          grades: [
            {
              userid: parsedUserId,
              grade: hasRecord ? mockGrade : null,
              strgrade: hasRecord ? `${mockGrade.toFixed(2)}` : '-'
            }
          ]
        }
      ]
    });
  }

  // 3. Fallback for unhandled Moodle function calls
  return res.status(400).json({
    exception: 'invalid_parameter_exception',
    message: `Mock server does not implement WS function: ${wsfunction}`
  });
});

/* ============================================================
   ADMIN SIMULATOR ROUTES
   Used by the Moodle HTML portal to view and edit simulated data
============================================================ */

/**
 * GET /mock-moodle/admin/grades
 * Retrieves all mock Moodle grades with user and course joins
 */
router.get('/admin/grades', async (req, res) => {
  try {
    const queryStr = `
      SELECT mmg.*, u.name as student_name, c.course_name, c.passing_grade 
      FROM moodle_mock_grades mmg
      JOIN users u ON mmg.moodle_user_id = u.moodle_user_id
      JOIN courses c ON mmg.moodle_course_id = c.moodle_course_id
    `;
    const results = await db.query(queryStr);
    res.json(results);
  } catch (error) {
    console.error('Admin Fetch Grades Error:', error.message);
    res.status(500).json({ error: 'Database error fetching gradebook entries.' });
  }
});

/**
 * POST /mock-moodle/admin/grades
 * Body: { moodleUserId, moodleCourseId, grade, completed }
 * Updates or inserts a mock Moodle grade record
 */
router.post('/admin/grades', async (req, res) => {
  const { moodleUserId, moodleCourseId, grade, completed } = req.body;

  if (moodleUserId === undefined || moodleCourseId === undefined || grade === undefined) {
    return res.status(400).json({ error: 'moodleUserId, moodleCourseId, and grade are required.' });
  }

  try {
    // Check if user and course exist in our database mappings
    const user = await db.query('SELECT id FROM users WHERE moodle_user_id = ?', [moodleUserId]);
    const course = await db.query('SELECT id FROM courses WHERE moodle_course_id = ?', [moodleCourseId]);

    if (user.length === 0 || course.length === 0) {
      return res.status(404).json({ error: 'User or Course mapping not found in system database.' });
    }

    // Database-agnostic upsert (works on both MySQL and SQLite)
    const existing = await db.query(
      'SELECT id FROM moodle_mock_grades WHERE moodle_user_id = ? AND moodle_course_id = ?',
      [moodleUserId, moodleCourseId]
    );

    if (existing.length > 0) {
      await db.query(
        'UPDATE moodle_mock_grades SET grade = ?, completed = ? WHERE moodle_user_id = ? AND moodle_course_id = ?',
        [grade, completed, moodleUserId, moodleCourseId]
      );
      console.log(`Updated mock Moodle grade: User ${moodleUserId}, Course ${moodleCourseId} -> ${grade}%`);
    } else {
      await db.query(
        'INSERT INTO moodle_mock_grades (moodle_user_id, moodle_course_id, grade, completed) VALUES (?, ?, ?, ?)',
        [moodleUserId, moodleCourseId, grade, completed]
      );
      console.log(`Inserted mock Moodle grade: User ${moodleUserId}, Course ${moodleCourseId} -> ${grade}%`);
    }

    res.json({ success: true, message: 'Mock LMS Grade updated successfully!' });
  } catch (error) {
    console.error('Admin Update Grade Error:', error.message);
    res.status(500).json({ error: 'Database error updating mock gradebook.' });
  }
});

/**
 * POST /mock-moodle/admin/students
 * Body: { moodleUserId, name, email, userDid }
 * Registers a new student in the shared database
 */
router.post('/admin/students', async (req, res) => {
  const { moodleUserId, name, email, userDid } = req.body;

  if (!moodleUserId || !name || !email) {
    return res.status(400).json({ error: 'moodleUserId, name, and email are required.' });
  }

  const generatedDid = userDid || `did:key:z6MkpTHR8VNsBxuexb6F_${name.toLowerCase().replace(/\s+/g, '_')}`;

  try {
    // Check if user already exists
    const existing = await db.query('SELECT id FROM users WHERE moodle_user_id = ? OR email = ?', [moodleUserId, email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Student with this Moodle ID or Email already exists.' });
    }

    await db.query(
      'INSERT INTO users (moodle_user_id, name, email, user_did) VALUES (?, ?, ?, ?)',
      [moodleUserId, name, email, generatedDid]
    );
    
    // Seed an initial grade of 0.00% for this student in course 101 so they show up in the gradebook immediately
    await db.query(
      'INSERT INTO moodle_mock_grades (moodle_user_id, moodle_course_id, grade, completed) VALUES (?, 101, 0.00, 1)',
      [moodleUserId]
    );

    console.log(`Registered new Moodle student: ${name} (ID: ${moodleUserId})`);
    res.json({ success: true, message: 'Student registered successfully!' });
  } catch (error) {
    console.error('Register Student Error:', error.message);
    res.status(500).json({ error: 'Database error registering student.' });
  }
});

/**
 * POST /mock-moodle/admin/courses
 * Body: { moodleCourseId, courseName, passingGrade }
 * Registers a new course in the shared database
 */
router.post('/admin/courses', async (req, res) => {
  const { moodleCourseId, courseName, passingGrade } = req.body;

  if (!moodleCourseId || !courseName || !passingGrade) {
    return res.status(400).json({ error: 'moodleCourseId, courseName, and passingGrade are required.' });
  }

  try {
    const existing = await db.query('SELECT id FROM courses WHERE moodle_course_id = ?', [moodleCourseId]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Course with this Moodle Course ID already exists.' });
    }

    await db.query(
      'INSERT INTO courses (moodle_course_id, course_name, passing_grade) VALUES (?, ?, ?)',
      [moodleCourseId, courseName, parseFloat(passingGrade)]
    );

    console.log(`Registered new Moodle course: ${courseName} (ID: ${moodleCourseId})`);
    res.json({ success: true, message: 'Course registered successfully!' });
  } catch (error) {
    console.error('Register Course Error:', error.message);
    res.status(500).json({ error: 'Database error registering course.' });
  }
});

/**
 * GET /mock-moodle/admin/students-list
 * Returns basic info of all registered students
 */
router.get('/admin/students-list', async (req, res) => {
  try {
    const results = await db.query('SELECT moodle_user_id, name FROM users');
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /mock-moodle/admin/courses-list
 * Returns basic info of all registered courses
 */
router.get('/admin/courses-list', async (req, res) => {
  try {
    const results = await db.query('SELECT moodle_course_id, course_name FROM courses');
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
