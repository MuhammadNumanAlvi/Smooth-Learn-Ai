const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace the old import
code = code.replace(/import pdfParse from "pdf-parse";/, 'import { PDFParse } from "pdf-parse";');

// Replace the usage
const oldUsage = `          const pdfData = await pdfParse(pdfBuffer);
          extractedRawText = pdfData.text;`;
          
const newUsage = `          const parser = new PDFParse({ data: pdfBuffer });
          const pdfData = await parser.getText();
          extractedRawText = pdfData.text;`;

if (code.includes(oldUsage)) {
  code = code.replace(oldUsage, newUsage);
  fs.writeFileSync('server.ts', code);
  console.log('Successfully patched pdf-parse usage in server.ts');
} else {
  console.log('Old usage not found. Searching loosely...');
  code = code.replace(/const pdfData = await pdfParse\(pdfBuffer\);\s*extractedRawText = pdfData\.text;/, newUsage);
  fs.writeFileSync('server.ts', code);
  console.log('Applied patch via regex');
}
