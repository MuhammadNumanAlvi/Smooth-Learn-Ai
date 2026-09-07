const fs = require('fs');
let code = fs.readFileSync('server/gemini.ts', 'utf8');

const target = `  const prompt = \`You are a world-class academic study assistant analyzing an educational document or textbook:
File Name: \${params.fileName}
Document Text Sample / Content:
\${params.text.slice(0, 30000)}

Please analyze this document deeply and return a structured JSON object with:
1. title: An accurate, professional title for the study material
2. summary: A thorough 2-3 paragraph executive summary of the document's core concepts, learning objectives, and practical implications
3. estimatedPages: Estimated page count based on depth (integer >= 1)
4. overallDifficulty: Either "Beginner", "Intermediate", or "Advanced"
5. chapters: Extract the ACTUAL chapters/sections strictly based on the Table of Contents or Outline page in the book/document. Do NOT invent chapters. You must extract all major chapters listed in the outline. Each chapter must have:
   - id: unique string (e.g. "ch-1")
   - title: clear academic chapter/section title
   - summary: concise summary of what this chapter covers
   - keyPoints: array of 3-5 high-yield bullet points
   - estimatedReadTime: estimated time to study (e.g. "8 mins")
6. keyTerms: An array of 6 to 12 crucial definitions, technical vocabulary, or key concepts (each with term and definition).

Format your response strictly as valid JSON matching this schema.\`;`;

const replacement = `  const prompt = \`You are an expert academic study assistant tasked with analyzing an educational document or textbook.

CRITICAL INSTRUCTION FOR CHAPTER EXTRACTION:
You MUST locate the "Table of Contents" or "Outline" page in the document. 
Extract the exact chapters or major sections exactly as they are listed in that Table of Contents. 
Do NOT invent, summarize, or logically group chapters on your own. If the document has a Table of Contents listing 12 chapters, you must extract all 12 chapters with their exact titles. If there is no Table of Contents, extract the main headings as chapters.

File Name: \${params.fileName}
Document Text Sample / Content:
\${params.text.slice(0, 30000)}

Please analyze this document deeply and return a structured JSON object with:
1. title: An accurate, professional title for the study material
2. summary: A thorough 2-3 paragraph executive summary of the document's core concepts, learning objectives, and practical implications
3. estimatedPages: Estimated page count based on depth (integer >= 1)
4. overallDifficulty: Either "Beginner", "Intermediate", or "Advanced"
5. chapters: Extract the ACTUAL chapters/sections strictly based on the Table of Contents. Each chapter must have:
   - id: unique string (e.g. "ch-1")
   - title: exact chapter title from the document outline
   - summary: concise summary of what this chapter covers
   - keyPoints: array of 3-5 high-yield bullet points
   - estimatedReadTime: estimated time to study (e.g. "8 mins")
6. keyTerms: An array of 6 to 12 crucial definitions, technical vocabulary, or key concepts (each with term and definition).

Format your response strictly as valid JSON matching this schema.\`;`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('server/gemini.ts', code);
  console.log('patched prompt successfully');
} else {
  console.log('Target not found in server/gemini.ts');
  // Attempt looser replace
  code = code.replace(/const prompt = \`You are a world-class academic study assistant[\s\S]*?Format your response strictly as valid JSON matching this schema.\`;/g, replacement);
  fs.writeFileSync('server/gemini.ts', code);
  console.log('patched prompt via regex');
}
