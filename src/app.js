const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const { initializeDatabase } = require('./utils/dbInit');
const cryptoService = require('./services/cryptoService');
const credentialRoutes = require('./routes/credentialRoutes');
const mockMoodleRoutes = require('./routes/mockMoodleRoutes');

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const MOODLE_PORT = process.env.MOODLE_PORT || 4000;

// =========================================================================
// 1. ONEST CERT HUB SERVER (Port 3000)
// =========================================================================
const onestApp = express();

// Custom zero-dependency CORS
onestApp.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

onestApp.use(express.json());
onestApp.use(express.urlencoded({ extended: true }));

// Serve Cert Hub Dashboard
onestApp.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Health check endpoint for automated integration testing
onestApp.get('/api/health', (req, res) => {
  res.json({ status: 'ONLINE' });
});

// Mount Credential Endpoints
onestApp.use('/api/credentials', credentialRoutes);

// =========================================================================
// 2. MOODLE LMS SIMULATOR SERVER & ROUTES
// =========================================================================
// Mount Moodle Portal & Mock API on onestApp for single-port / cloud deployment
onestApp.get('/moodle', (req, res) => {
  res.sendFile(path.join(__dirname, '../moodle.html'));
});
onestApp.use('/mock-moodle', mockMoodleRoutes);

const moodleApp = express();

moodleApp.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

moodleApp.use(express.json());
moodleApp.use(express.urlencoded({ extended: true }));

// Serve Moodle LMS Portal
moodleApp.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../moodle.html'));
});

// Serve Moodle LMS API Endpoints (called by ONEST backend)
moodleApp.use('/mock-moodle', mockMoodleRoutes);

// =========================================================================
// 3. SERVER LIFECYCLE CONTROLLER
// =========================================================================
let onestServer = null;
let moodleServer = null;

async function startServer() {
  try {
    // A. Migrate and Seed Database
    await initializeDatabase();

    // B. Initialize Crypto Keys
    cryptoService.initKeys();

    // C. Listen ONEST Port
    onestServer = onestApp.listen(PORT, () => {
      console.log(`[ONEST PORTAL] Running on http://localhost:${PORT}`);
      console.log(`[MOODLE LMS]   Available at http://localhost:${PORT}/moodle`);
    });

    // D. Listen Moodle Port if specified and different from PORT (only in local dual-port mode)
    const isCloudEnv = process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.IS_RENDER;
    if (MOODLE_PORT && String(MOODLE_PORT) !== String(PORT) && !isCloudEnv && !process.env.SINGLE_PORT) {
      moodleServer = moodleApp.listen(MOODLE_PORT, () => {
        console.log(`[MOODLE LMS Simulator] Running on http://localhost:${MOODLE_PORT}`);
      });
    }

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Spin up both systems
startServer();

module.exports = {
  app: onestApp,
  closeServer: () => {
    return new Promise((resolve) => {
      let closedCount = 0;
      const checkClose = () => {
        closedCount++;
        if (closedCount === 2) {
          resolve();
        }
      };

      if (onestServer) {
        onestServer.close(() => {
          console.log('ONEST Cert Hub Server stopped.');
          checkClose();
        });
      } else {
        checkClose();
      }

      if (moodleServer) {
        moodleServer.close(() => {
          console.log('Moodle LMS Simulator Server stopped.');
          checkClose();
        });
      } else {
        checkClose();
      }
    });
  }
};
