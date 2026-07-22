const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

// Override DB_TYPE for tests to sqlite so it requires no external setup
process.env.DB_TYPE = 'sqlite';
process.env.PORT = '3001'; // Run tests on a separate port
process.env.MOODLE_PORT = '3002'; // Run Moodle mock server on separate port
process.env.MOODLE_API_URL = 'http://localhost:3002/mock-moodle'; // Route Moodle API requests to the mock server port

const app = require('./src/app');
const db = require('./src/config/database');
const cryptoService = require('./src/services/cryptoService');


const TEST_PORT = 3001;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Helper to make HTTP POST requests
function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'Connection': 'close'
        }
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              body: JSON.parse(responseData)
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              body: responseData
            });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

// Helper to make HTTP GET requests
function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: path,
        method: 'GET',
        headers: {
          'Connection': 'close'
        }
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              body: JSON.parse(responseData)
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              body: responseData
            });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function runTests() {
  console.log('\n==================================================');
  console.log('STARTING INTEGRATION TESTS FOR ONEST CERTIFICATION');
  console.log('==================================================\n');

  // Wait 1 second for the server to spin up and database to initialize
  await new Promise((resolve) => setTimeout(resolve, 1200));

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] - ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] - ${message}`);
      failed++;
    }
  }

  try {
    // Test 1: Check Server Health Status
    console.log('--- Test 1: Health Check ---');
    const health = await get('/api/health');
    assert(health.statusCode === 200, 'Server is online');
    assert(health.body.status === 'ONLINE', 'Status report returns ONLINE');

    // Test 2: Sync Grade for Alice (Pass Threshold 60%, Alice grade is 85%)
    console.log('\n--- Test 2: Alice Sync (Passing grade evaluation) ---');
    const aliceSync = await post('/api/credentials/sync', {
      moodleUserId: 1,
      moodleCourseId: 101
    });

    assert(
      aliceSync.statusCode === 201 || aliceSync.statusCode === 200,
      'Alice sync API executed successfully'
    );
    assert(
      aliceSync.body.success === true,
      'Eligibility engine evaluates student as eligible'
    );
    assert(
      aliceSync.body.credentialUuid !== undefined,
      'Returned valid Credential UUID reference'
    );
    assert(
      aliceSync.body.jws !== undefined,
      'Generated cryptographic JWS signature'
    );

    const aliceJws = aliceSync.body.jws;
    const aliceUuid = aliceSync.body.credentialUuid;

    // Test 3: Sync Grade for Bob (Pass Threshold 60%, Bob grade is 55%)
    console.log('\n--- Test 3: Bob Sync (Failing grade evaluation) ---');
    const bobSync = await post('/api/credentials/sync', {
      moodleUserId: 2,
      moodleCourseId: 101
    });
    assert(bobSync.statusCode === 200, 'Bob sync API returned status 200');
    assert(
      bobSync.body.success === false,
      'Eligibility engine evaluated Bob as ineligible (55% < 60%)'
    );
    assert(
      bobSync.body.jws === undefined,
      'No cryptographic signature issued for failing student'
    );

    // Test 4: Retrieve Alice's Issued Credential by UUID
    console.log('\n--- Test 4: Fetch credential by UUID ---');
    const retrieveCred = await get(`/api/credentials/${aliceUuid}`);
    assert(retrieveCred.statusCode === 200, 'Credential fetched successfully');
    assert(
      retrieveCred.body.credential.credentialSubject.studentName === 'Alice Dev',
      'Fetched payload name matches candidate record'
    );

    // Test 5: Verify Alice's JWS Signature (Untampered)
    console.log('\n--- Test 5: Verify Valid Signature (Untampered) ---');
    const verifyCred = await post('/api/credentials/verify', {
      jws: aliceJws
    });
    assert(verifyCred.statusCode === 200, 'Verify API executed successfully');
    assert(
      verifyCred.body.verified === true,
      'Cryptographic verification checks pass for original credential'
    );

    // Test 6: Verify Tampered Signature (Data Modified in transit)
    console.log('\n--- Test 6: Tampering Attempt Detection ---');
    // JWS structure is header.payload.signature
    const parts = aliceJws.split('.');
    const decodedPayload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    );

    // Tamper with Alice's grade in the JSON payload (Change 85% to 99%)
    decodedPayload.credentialSubject.gradeReported = '99%';

    // Re-encode tampered payload
    const tamperedPayloadEncoded = Buffer.from(
      cryptoService.canonicalizeJson(decodedPayload)
    ).toString('base64url');

    // Assemble JWS with modified payload but ORIGINAL signature
    const tamperedJws = `${parts[0]}.${tamperedPayloadEncoded}.${parts[2]}`;

    const verifyTampered = await post('/api/credentials/verify', {
      jws: tamperedJws
    });

    assert(
      verifyTampered.body.verified === false,
      'Cryptographic signature check correctly fails for tampered payload!'
    );
    console.log(`   Verification failed explanation: ${verifyTampered.body.reason}`);

    // Test 7: Revocation and Verification Dynamics
    console.log('\n--- Test 7: Revocation Toggle & Dynamic Verification ---');
    const createdUuid = aliceSync.body.credentialUuid;

    // A. Toggle Revocation to REVOKED
    const revokeResponse = await post('/api/credentials/revoke', { credentialUuid: createdUuid });
    assert(revokeResponse.statusCode === 200, 'Revocation toggle status returned 200');
    assert(revokeResponse.body.status === 'REVOKED', 'Revocation registry toggled to REVOKED');

    // B. Check Verification of Revoked Credential (should fail DB check but keep math valid)
    const verifyRevoked = await post('/api/credentials/verify', { jws: aliceSync.body.jws });
    assert(verifyRevoked.statusCode === 200, 'Verify API executed successfully on revoked item');
    assert(verifyRevoked.body.verified === false, 'Cryptographic verification correctly fails for revoked status');
    assert(verifyRevoked.body.status === 'REVOKED', 'Verification output correctly identifies status as REVOKED');

    // C. Toggle Revocation back to ACTIVE
    const restoreResponse = await post('/api/credentials/revoke', { credentialUuid: createdUuid });
    assert(restoreResponse.statusCode === 200, 'Revocation toggle status returned 200 on restore');
    assert(restoreResponse.body.status === 'ACTIVE', 'Revocation registry toggled back to ACTIVE');

    // D. Check Verification again (should pass)
    const verifyRestored = await post('/api/credentials/verify', { jws: aliceSync.body.jws });
    assert(verifyRestored.body.verified === true, 'Verification succeeds again once credential is restored to ACTIVE');
    console.log('✅ [PASS] - Revocation toggle and dynamic registry check functions perfectly!');

    console.log('\n==================================================');
    console.log(`TEST COMPLETED. Passed: ${passed}/${passed + failed}`);
    console.log('==================================================\n');

    // Close Server, DB connection and exit programmatically
    await app.closeServer();
    await db.close();
    
    // Give Windows Libuv event loop a tick to fully release sockets before hard exit
    setTimeout(() => {
      process.exit(failed > 0 ? 1 : 0);
    }, 100);

  } catch (error) {
    console.error('Test execution failed with exception:', error);
    process.exit(1);
  }
}

runTests();
