// cryptoConfig.js (Simulates secure key storage for your DigiAttestor identity)

const ISSUER_DID = "did:onest:infosys:digiattestor-hub-2025";

// --- MOCK CRYPTOGRAPHIC KEYS ---
// Private Key (Used only by signingService.js to create the seal)
const PRIVATE_KEY_MOCK = {
  kty: "EC",
  crv: "P-256",
  d: "MOCK_SECRET_PRIVATE_KEY_DATA_XYZ",
  x: "MOCK_PUBLIC_X_COORD",
  y: "MOCK_PUBLIC_Y_COORD",
};

// Public Key (Used by server.js to link the verification method in the proof)
const PUBLIC_KEY_MOCK = {
  kty: "EC",
  crv: "P-256",
  x: "MOCK_PUBLIC_X_COORD",
  y: "MOCK_PUBLIC_Y_COORD",
  id: "key-1",
};

module.exports = {
  ISSUER_DID,
  PRIVATE_KEY_MOCK,
  PUBLIC_KEY_MOCK,
};
