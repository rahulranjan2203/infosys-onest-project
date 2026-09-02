const dotenv = require('dotenv');
dotenv.config();

function getMoodleApiUrl() {
  return process.env.MOODLE_API_URL || `http://localhost:${process.env.PORT || 3000}/mock-moodle`;
}

function getMoodleToken() {
  return process.env.MOODLE_TOKEN || 'MOCK_MOODLE_TOKEN_123';
}

/**
 * Fetches course completion status for a student from Moodle REST API
 */
async function fetchCourseCompletion(moodleUserId, moodleCourseId) {
  const wsFunction = 'core_completion_get_course_completion_status';
  const url = `${getMoodleApiUrl()}?wstoken=${getMoodleToken()}&wsfunction=${wsFunction}&moodlewsrestformat=json&userid=${moodleUserId}&courseid=${moodleCourseId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Check if Moodle returned an API exception
    if (data.exception) {
      throw new Error(`Moodle API Exception: ${data.message}`);
    }

    return data;
  } catch (error) {
    console.error(`Error fetching completion status for user ${moodleUserId}, course ${moodleCourseId}:`, error.message);
    throw error;
  }
}

/**
 * Fetches assessment grades for a student in a course from Moodle REST API
 */
async function fetchStudentGrade(moodleUserId, moodleCourseId) {
  const wsFunction = 'core_grades_get_grades';
  // Moodle requires userids parameter as an array format: userids[0]=val
  const url = `${getMoodleApiUrl()}?wstoken=${getMoodleToken()}&wsfunction=${wsFunction}&moodlewsrestformat=json&courseid=${moodleCourseId}&userids[0]=${moodleUserId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Check for API exceptions
    if (data.exception) {
      throw new Error(`Moodle API Exception: ${data.message}`);
    }

    // Parse the Moodle grade report structure
    // Moodle returns format: { items: [ { grademin, grademax, grades: [ { userid, grade } ] } ] }
    if (data.items && data.items.length > 0) {
      const courseGradeItem = data.items.find(item => item.itemtype === 'course');
      if (courseGradeItem && courseGradeItem.grades && courseGradeItem.grades.length > 0) {
        const studentGrade = courseGradeItem.grades.find(g => g.userid === parseInt(moodleUserId));
        if (studentGrade) {
          return {
            grade: studentGrade.grade !== null ? parseFloat(studentGrade.grade) : 0,
            grademax: parseFloat(courseGradeItem.grademax || 100),
            strgrade: studentGrade.strgrade
          };
        }
      }
    }
    
    // In case of nested structure variations, fallback check:
    if (data.grades && data.grades.length > 0) {
      const g = data.grades[0];
      return {
        grade: g.grade !== null ? parseFloat(g.grade) : 0,
        grademax: 100,
        strgrade: g.strgrade || `${g.grade}`
      };
    }

    return { grade: 0, grademax: 100, strgrade: '0.00' };
  } catch (error) {
    console.error(`Error fetching grade for user ${moodleUserId}, course ${moodleCourseId}:`, error.message);
    throw error;
  }
}

module.exports = {
  fetchCourseCompletion,
  fetchStudentGrade
};
