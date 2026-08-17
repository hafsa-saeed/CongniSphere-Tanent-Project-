const PDFDocument = require('pdfkit');

/**
 * Renders a landscape A4 "Certificate of Completion" PDF entirely in
 * memory and resolves with the resulting Buffer. No temp files are
 * written — the caller decides whether to persist the buffer (via
 * config/storage.js) and/or stream it directly in an HTTP response.
 */
function buildCertificatePdfBuffer({
  learnerName,
  courseTitle,
  companyName,
  completionDate,
  certificateCode,
  signatureName,
  signatureTitle,
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 0 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { width, height } = doc.page;

      // ---------- Background & border ----------
      doc.rect(0, 0, width, height).fill('#FAFAFA');
      doc.lineWidth(3).strokeColor('#4F46E5').rect(30, 30, width - 60, height - 60).stroke();
      doc.lineWidth(1).strokeColor('#C7D2FE').rect(40, 40, width - 80, height - 80).stroke();

      // ---------- Header ----------
      doc
        .fillColor('#4F46E5')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(companyName.toUpperCase(), 0, 70, { align: 'center', characterSpacing: 2 });

      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(34)
        .text('Certificate of Completion', 0, 110, { align: 'center' });

      doc
        .moveTo(width / 2 - 80, 165)
        .lineTo(width / 2 + 80, 165)
        .lineWidth(2)
        .strokeColor('#818CF8')
        .stroke();

      // ---------- Body ----------
      doc.fillColor('#6B7280').font('Helvetica').fontSize(14).text('This certifies that', 0, 195, { align: 'center' });

      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(28).text(learnerName, 0, 220, { align: 'center' });

      doc
        .fillColor('#6B7280')
        .font('Helvetica')
        .fontSize(14)
        .text('has successfully completed the training course', 0, 265, { align: 'center' });

      doc.fillColor('#4F46E5').font('Helvetica-Bold').fontSize(22).text(courseTitle, 60, 292, {
        align: 'center',
        width: width - 120,
      });

      // ---------- Footer ----------
      const footerY = height - 110;
      const dateStr = new Date(completionDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      doc.fillColor('#374151').font('Helvetica').fontSize(11).text(`Date of Completion: ${dateStr}`, 80, footerY, {
        width: width / 2 - 100,
        align: 'left',
      });

      doc
        .fillColor('#374151')
        .font('Helvetica')
        .fontSize(11)
        .text(`Certificate ID: ${certificateCode}`, width / 2, footerY, {
          width: width / 2 - 80,
          align: 'right',
        });

      if (signatureName) {
        const sigY = footerY - 32;
        doc.moveTo(width / 2 - 90, sigY).lineTo(width / 2 + 90, sigY).lineWidth(1).strokeColor('#9CA3AF').stroke();
        doc.fillColor('#374151').font('Helvetica-Bold').fontSize(11).text(signatureName, 0, sigY + 5, { align: 'center' });
        if (signatureTitle) {
          doc.fillColor('#6B7280').font('Helvetica').fontSize(9).text(signatureTitle, 0, sigY + 19, { align: 'center' });
        }
      }

      doc
        .fillColor('#9CA3AF')
        .font('Helvetica-Oblique')
        .fontSize(9)
        .text('This certificate can be verified using the Certificate ID above.', 0, footerY + 30, {
          align: 'center',
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildCertificatePdfBuffer };
