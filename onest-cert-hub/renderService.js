// renderService.js

/**
 * Renders the signed credential JSON into a human-readable HTML document.
 * This function is imported by the main hub file.
 * @param {object} credential - The full, signed PDC JSON object.
 * @param {string} qrCodeDataUrl - The base64 data URL for the QR code image.
 * @returns {string} HTML string of the printable certificate.
 */
function renderCertificate(credential, qrCodeDataUrl) {
  const subject = credential.credentialSubject;
  const claims = credential.claimsAlignment;
  const proof = credential.proof;

  // NOTE: HTML/CSS is simplified for guaranteed browser rendering
  const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Official Verifiable Credential</title>
            <style>
                body { font-family: 'Times New Roman', serif; margin: 0; padding: 40px; border: 10px solid #004d99; max-width: 800px; margin: 50px auto; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { color: #004d99; font-size: 28px; margin: 0; border-bottom: 2px solid #004d99; padding-bottom: 10px; }
                .body-text { font-size: 18px; line-height: 1.6; text-align: justify; margin-bottom: 20px; }
                .details { margin-top: 20px; border: 1px solid #ddd; padding: 15px; background-color: #f9f9f9; }
                .details p { margin: 5px 0; }
                .signature-box { display: flex; justify-content: space-between; margin-top: 50px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 14px; }
                .qr-code { width: 100px; height: 100px; border: 1px solid #000; }
                .seal { text-align: right; }
            </style>
        </head>
        <body>
            <div class="header">
                <p style="font-size: 14px; color: #555;">Issued by the ONEST DigiAttestor Hub</p>
                <h1>VERIFIABLE PROFESSIONAL CERTIFICATE</h1>
            </div>

            <div class="body-text">
                This certifies that ${
                  subject.fullName
                } has successfully completed the required assessment, verified against the official records of the LMS authority.
            </div>

            <div class="details">
                <p><strong>Course Title:</strong> ${
                  subject.courseTitle
                } (Score: ${subject.achievedScore}%)</p>
                <p><strong>Issuance Date:</strong> ${new Date(
                  credential.issuanceDate
                ).toLocaleDateString()}</p>
            </div>
            
            <div class="details" style="margin-top: 15px;">
                <p><strong>Standardization (ONEST/SFIA):</strong></p>
                <p>— **NSQF Level:** ${claims.nsqfLevel}</p>
                <p>— **SFIA Skill:** ${claims.sfiaCode} (${
    claims.sfiaDescription
  })</p>
            </div>

            <div class="signature-box">
                <div>
                    <p><strong>Issuer DID:</strong> ${credential.issuer}</p>
                    <p style="color: #c00;">Cryptographic Proof (JWS): ${proof.jws.substring(
                      0,
                      16
                    )}...</p>
                </div>
                
            </div>
        </body>
        </html>
    `;
  return htmlContent;
}

module.exports = { renderCertificate };

/*
<div class="seal">
  <img src="${qrCodeDataUrl}" alt="Verification QR Code" class="qr-code">
  <p style="margin-top: 5px; font-style: italic;">Scan to Verify Status</p>
</div>
                */
