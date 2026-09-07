const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Move PDF extraction before analysis
const extractionCode = `      let extractedRawText = text || '';
      if (pdfBase64) {
        try {
          console.log('[QuizMind] Extracting raw text from PDF using pdf-parse...');
          const pdfBuffer = Buffer.from(pdfBase64, 'base64');
          const pdfData = await pdfParse(pdfBuffer);
          extractedRawText = pdfData.text;
          console.log(\`[QuizMind] PDF Text extracted successfully: \${extractedRawText.length} characters\`);
        } catch (e) {
          console.error('[QuizMind] Failed to parse PDF text:', e);
        }
      }`;

if (code.includes(extractionCode)) {
  code = code.replace(extractionCode, '');
  
  const insertTarget = `      console.log(\`[QuizMind] Analyzing document: \${fileName || 'Uploaded Document'} for user: \${userId}...\`);`;
  code = code.replace(insertTarget, extractionCode + '\n\n' + insertTarget);
  
  // Update analyzeDocumentContent call
  code = code.replace(
    `const analysis = await analyzeDocumentContent({
        text: text || '',
        fileName: fileName || 'Study Document.pdf',
        pdfBase64,
      });`,
    `const analysis = await analyzeDocumentContent({
        text: extractedRawText || '',
        fileName: fileName || 'Study Document.pdf',
        pdfBase64,
      });`
  );
  
  fs.writeFileSync('server.ts', code);
  console.log('Successfully reordered PDF text extraction!');
} else {
  console.log('Extraction code not found');
}
