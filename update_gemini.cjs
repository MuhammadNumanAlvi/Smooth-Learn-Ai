const fs = require('fs');
let code = fs.readFileSync('server/gemini.ts', 'utf8');
code = code.replace(/export async function generateRagQuizQuestions\(params: \{/g, 'export async function generateRagQuizQuestions(params: { apiKey?: string;');
code = code.replace(/const ai = getAiClient\(\);/g, 'const ai = getAiClient(params.apiKey);');
code = code.replace(/const ai = getAi\(\);/g, 'const ai = getAiClient(params.apiKey);'); // in case
fs.writeFileSync('server/gemini.ts', code);

let ragCode = fs.readFileSync('server/rag.ts', 'utf8');
ragCode = ragCode.replace(/function getAi\(\): GoogleGenAI \{/g, 'function getAi(customKey?: string): GoogleGenAI {\n  if (customKey) return new GoogleGenAI({ apiKey: customKey });');
ragCode = ragCode.replace(/export async function embedText\(text: string\): Promise<number\[\]> \{/g, 'export async function embedText(text: string, customKey?: string): Promise<number[]> {');
ragCode = ragCode.replace(/const ai = getAi\(\);/g, 'const ai = getAi(customKey);'); // Need to be careful here
fs.writeFileSync('server/rag.ts', ragCode);
