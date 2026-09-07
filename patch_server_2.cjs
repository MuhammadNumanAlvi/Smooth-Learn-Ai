const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `      const analysis = await analyzeDocumentContent({
        text: text || '',
        fileName: fileName || 'Study Document.pdf',
        pdfBase64,
      });`;

const replacement = `      const analysis = await analyzeDocumentContent({
        text: extractedRawText || '',
        fileName: fileName || 'Study Document.pdf',
        pdfBase64,
      });`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('server.ts', code);
  console.log('Patched analyzeDocumentContent to use extractedRawText');
} else {
  console.log('Target not found for second patch');
}
