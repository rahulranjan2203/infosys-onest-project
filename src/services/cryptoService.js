const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keysDir = path.resolve(__dirname, '../../.keys');
const privateKeyPath = path.join(keysDir, 'private.pem');
const publicKeyPath = path.join(keysDir, 'public.pem');

/**
 * Initializes private/public key pairs if they do not exist.
 * This guarantees the application is instantly runnable.
 */
function initKeys() {
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
    console.log('Cryptographic keys missing. Generating fresh ECDSA P-256 key pair...');
    
    // Generate Elliptic Curve P-256 keys
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey);
    console.log(`Successfully generated and saved EC P-256 keys to: ${keysDir}`);
  }
}

/**
 * Recursively canonicalizes a JSON-serializable object by sorting its keys.
 * This prevents keys from being stripped in nested objects (which occurs with the
 * standard JSON.stringify array-replacer approach) and ensures consistent hashing.
 */
function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const properties = sortedKeys.map(key => {
    return JSON.stringify(key) + ':' + canonicalizeJson(obj[key]);
  });
  return '{' + properties.join(',') + '}';
}

/**
 * Helper to encode object/string into Base64URL (RFC 7515)
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Signs a payload with ES256 (ECDSA P-256 with SHA-256)
 * Returns a standard JWS string (header.payload.signature)
 */
function signES256(payload) {
  // Ensure keys exist
  initKeys();
  
  const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');

  // Define standard JWS header
  const header = { alg: 'ES256', typ: 'JWT' };
  
  // Canonicalize payload recursively sorting keys
  const canonicalPayload = canonicalizeJson(payload);
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(canonicalPayload);
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign('SHA256');
  sign.update(dataToSign);

  // Generate signature in raw IEEE P1363 format (concatenated r and s, 64 bytes total)
  const signature = sign.sign({
    key: privateKeyPem,
    dsaEncoding: 'ieee-p1363'
  });

  const encodedSignature = signature.toString('base64url');

  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Verifies a JWS string using the issuer's public key
 */
function verifyES256(jws, publicKeyPem = null) {
  try {
    const parts = jws.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWS structure.');
      return false;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToVerify = `${encodedHeader}.${encodedPayload}`;
    const signatureBuffer = Buffer.from(encodedSignature, 'base64url');

    // Decode header and verify alg
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    if (header.alg !== 'ES256') {
      console.warn(`Unsupported algorithm: ${header.alg}`);
      return false;
    }

    // Load key (if null, fallback to the local generated public key)
    if (!publicKeyPem) {
      initKeys();
      publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');
    }

    const verify = crypto.createVerify('SHA256');
    verify.update(dataToVerify);

    console.log(`[DEBUG verifyES256] Header+Payload: ${dataToVerify}`);
    console.log(`[DEBUG verifyES256] Signature (Base64url): ${encodedSignature}`);
    console.log(`[DEBUG verifyES256] Signature Buffer Length: ${signatureBuffer.length} bytes`);

    // Verify raw IEEE P1363 signature using public key
    const result = verify.verify({
      key: publicKeyPem,
      dsaEncoding: 'ieee-p1363'
    }, signatureBuffer);

    console.log(`[DEBUG verifyES256] Verification Result: ${result}`);
    return result;
  } catch (error) {
    console.error('ES256 validation error:', error);
    return false;
  }
}

/**
 * Decodes the JSON payload from a JWS without verifying the signature
 */
function decodePayload(jws) {
  try {
    const parts = jws.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payloadJson);
  } catch (error) {
    console.error('JWS Decode error:', error);
    return null;
  }
}

module.exports = {
  initKeys,
  getPublicKey: () => {
    initKeys();
    return fs.readFileSync(publicKeyPath, 'utf8');
  },
  signES256,
  verifyES256,
  decodePayload,
  canonicalizeJson
};
