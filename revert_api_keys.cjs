const fs = require('fs');

// 1. src/lib/api.ts
let apiCode = fs.readFileSync('src/lib/api.ts', 'utf8');
apiCode = apiCode.replace(/  const customKey = localStorage.getItem\('gemini_api_key'\);\n/g, '');
apiCode = apiCode.replace(/  if \(customKey\) \{\n    headers\['X-Gemini-Key'\] = customKey;\n  \}\n/g, '');
fs.writeFileSync('src/lib/api.ts', apiCode);

// 2. src/pages/Dashboard.tsx
let dbCode = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
dbCode = dbCode.replace(/  const \[apiKey, setApiKey\] = useState\(''\);\n  const \[keySaved, setKeySaved\] = useState\(false\);\n/g, '');
dbCode = dbCode.replace(/    const saved = localStorage.getItem\('gemini_api_key'\);\n    if \(saved\) \{\n      setApiKey\(saved\);\n      setKeySaved\(true\);\n    \}\n/g, '');
dbCode = dbCode.replace(/  const handleSaveKey = \(\) => \{\n    if \(apiKey.trim\(\)\) \{\n      localStorage.setItem\('gemini_api_key', apiKey.trim\(\)\);\n      setKeySaved\(true\);\n      setTimeout\(\(\) => setKeySaved\(false\), 3000\);\n    \}\n  \};\n/g, '');
const step2Regex = /\{\/\* Step 2: Gemini Key \*\/\}.*?\{\/\* Step 3: Choose Chapter \*\/\}/s;
dbCode = dbCode.replace(step2Regex, '{/* Step 2: Choose Chapter */}');
dbCode = dbCode.replace(/3\. Choose a chapter/, '2. Choose a chapter');
dbCode = dbCode.replace(/<span className="absolute top-8 right-8 bg-indigo-50 text-indigo-700 font-extrabold px-3 py-1 rounded-lg text-xs tracking-wide">03<\/span>/, '<span className="absolute top-8 right-8 bg-indigo-50 text-indigo-700 font-extrabold px-3 py-1 rounded-lg text-xs tracking-wide">02</span>');
dbCode = dbCode.replace(/\{\/\* Step 4: Quiz Settings \*\/\}/, '{/* Step 3: Quiz Settings */}');
dbCode = dbCode.replace(/4\. Quiz settings/, '3. Quiz settings');
dbCode = dbCode.replace(/<span className="absolute top-8 right-8 bg-indigo-50 text-indigo-700 font-extrabold px-3 py-1 rounded-lg text-xs tracking-wide">04<\/span>/, '<span className="absolute top-8 right-8 bg-indigo-50 text-indigo-700 font-extrabold px-3 py-1 rounded-lg text-xs tracking-wide">03</span>');
fs.writeFileSync('src/pages/Dashboard.tsx', dbCode);

// 3. server.ts
let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(/ apiKey: req.headers\['x-gemini-key'\] as string \| undefined,\n/g, '');
serverCode = serverCode.replace(/ apiKey: req.headers\['x-gemini-key'\] as string \| undefined,/g, '');
serverCode = serverCode.replace(/indexDocumentChunks\(req.headers\['x-gemini-key'\] as string \| undefined, chunks\)/g, 'indexDocumentChunks(chunks)');
serverCode = serverCode.replace(/indexDocumentChunks\(req.headers\['x-gemini-key'\] as string \| undefined, generatedChunks\)/g, 'indexDocumentChunks(generatedChunks)');
fs.writeFileSync('server.ts', serverCode);

// 4. server/gemini.ts
let geminiCode = fs.readFileSync('server/gemini.ts', 'utf8');
geminiCode = geminiCode.replace(/function getAiClient\(customKey\?: string\): GoogleGenAI \{\n  if \(customKey\) return new GoogleGenAI\(\{ apiKey: customKey, httpOptions: \{ headers: \{ "User-Agent": "aistudio-build" \} \} \}\);\n/g, 'function getAiClient(): GoogleGenAI {\n');
geminiCode = geminiCode.replace(/export async function generateRagQuizQuestions\(params: \{\n  userId/g, 'export async function generateRagQuizQuestions(params: {\n  userId');
geminiCode = geminiCode.replace(/export async function analyzeDocumentContent\(params: \{\n  text/g, 'export async function analyzeDocumentContent(params: {\n  text');
geminiCode = geminiCode.replace(/export async function explainQuestionConcept\(params: \{\n  question/g, 'export async function explainQuestionConcept(params: {\n  question');
geminiCode = geminiCode.replace(/export async function generateFlashcards\(params: \{\n  documentTitle/g, 'export async function generateFlashcards(params: {\n  documentTitle');
geminiCode = geminiCode.replace(/export async function answerTutorQuestion\(params: \{\n  userQuestion/g, 'export async function answerTutorQuestion(params: {\n  userQuestion');
geminiCode = geminiCode.replace(/const ai = getAiClient\(params.apiKey\);/g, 'const ai = getAiClient();');
geminiCode = geminiCode.replace(/apiKey: params.apiKey,\n/g, '');
fs.writeFileSync('server/gemini.ts', geminiCode);

// 5. server/rag.ts
let ragCode = fs.readFileSync('server/rag.ts', 'utf8');
ragCode = ragCode.replace(/function getAi\(customKey\?: string\): GoogleGenAI \{\n  if \(customKey\) return new GoogleGenAI\(\{ apiKey: customKey \}\);\n/g, 'function getAi(): GoogleGenAI {\n');
ragCode = ragCode.replace(/export async function embedText\(text: string, customKey\?: string\): Promise<number\[\]> \{/g, 'export async function embedText(text: string): Promise<number[]> {');
ragCode = ragCode.replace(/const ai = getAi\(customKey\);/g, 'const ai = getAi();');
ragCode = ragCode.replace(/export async function indexDocumentChunks\( apiKey: string \| undefined,\n/g, 'export async function indexDocumentChunks(\n');
ragCode = ragCode.replace(/chunk.embedding = await embedText\(chunk.text, apiKey\);/g, 'chunk.embedding = await embedText(chunk.text);');
ragCode = ragCode.replace(/export async function retrieveRelevantContext\(params: \{\n  userId/g, 'export async function retrieveRelevantContext(params: {\n  userId');
ragCode = ragCode.replace(/const queryEmbedding = await embedText\(searchPrompt, params.apiKey\);/g, 'const queryEmbedding = await embedText(searchPrompt);');
fs.writeFileSync('server/rag.ts', ragCode);

console.log('Revert complete');
