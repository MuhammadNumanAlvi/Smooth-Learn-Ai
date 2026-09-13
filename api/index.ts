import type { IncomingMessage, ServerResponse } from 'http';

function sendJson(res: ServerResponse, status: number, body: unknown) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function pathOf(req: IncomingMessage): string {
  return String(req.url || '').split('?')[0];
}

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function userIdOf(req: IncomingMessage, body: any): string {
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  const fromBody = String(body?.userId || '').trim();
  return fromBody || 'default-user';
}

function safeJson(text: string): any {
  const cleaned = String(text || '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('AI returned invalid JSON.');
  }
}

function normalizeQuestions(raw: any[], chapterTitle?: string): any[] {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const question = String(item.question || '').trim();
    if (question.length < 5) continue;
    const options = (Array.isArray(item.options) ? item.options : [])
      .map((opt: unknown) => String(opt || '').trim())
      .filter(Boolean);
    if (options.length !== 4) continue;
    if (new Set(options.map((opt: string) => opt.toLowerCase())).size !== 4) continue;
    const correct = String(item.correctAnswer || '').trim();
    const matched = options.find((opt: string) => opt.toLowerCase() === correct.toLowerCase());
    if (!matched) continue;
    const sig = question.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 36);
    if (seen.has(sig)) continue;
    seen.add(sig);
    const difficulty = ['Easy', 'Medium', 'Hard'].includes(item.difficulty) ? item.difficulty : 'Medium';
    out.push({
      id: `q-${out.length + 1}`,
      type: 'multiple_choice',
      question,
      options,
      correctAnswer: matched,
      explanation:
        String(item.explanation || '').trim().length > 8
          ? String(item.explanation).trim()
          : `The correct answer is "${matched}".`,
      difficulty,
      topic: String(item.topic || chapterTitle || 'Core concept').trim(),
      hint: String(item.hint || '').trim() || undefined,
      sourceReferences: [{ chapter: chapterTitle || 'Study material' }],
    });
  }
  return out;
}

function buildPrompt(params: {
  count: number;
  sourceText: string;
  chapterTitle?: string;
  topic?: string;
  difficulty?: string;
  questionStyle?: string;
}): string {
  return `You are an expert academic examiner. Generate exactly ${params.count} multiple-choice questions grounded in the source material. Respond ONLY with a valid JSON array.

SOURCE MATERIAL:
${params.sourceText}

PARAMETERS:
- Count: ${params.count}
- Scope: ${params.chapterTitle ? `Chapter: ${params.chapterTitle}` : 'Full Document'}
- Topic focus: ${params.topic || 'full selected scope'}
- Style: ${params.questionStyle || 'Mixed'}
- Difficulty: ${params.difficulty || 'Medium'}

Return a JSON array:
[{
  "id": "q-1",
  "question": "Clear question stem",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "Option A",
  "explanation": "Brief 1-sentence explanation",
  "difficulty": "Easy",
  "topic": "specific topic",
  "hint": "subtle memory cue"
}]

Rules:
1. Ground every question in the source material.
2. Options must be exactly 4 distinct strings.
3. correctAnswer must match one option exactly.
4. Keep explanations under 18 words.
5. No duplicate questions.`;
}

async function generateWithGroq(prompt: string, count: number): Promise<any[]> {
  const apiKey = String(process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured');
  const model = String(process.env.GROQ_MODEL || 'openai/gpt-oss-20b').trim();
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: Math.min(4000, 450 * count),
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Groq request failed (${res.status})`);
  }
  return safeJson(data?.choices?.[0]?.message?.content || '[]');
}

async function generateWithGemini(prompt: string): Promise<any[]> {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  const model = String(process.env.GEMINI_MODEL || process.env.GEMINI_GENERATION_MODEL || 'gemini-2.0-flash').trim();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini request failed (${res.status})`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join('\n') || '[]';
  return safeJson(text);
}

async function generateQuestions(params: {
  sourceText: string;
  count: number;
  chapterTitle?: string;
  topic?: string;
  difficulty?: string;
  questionStyle?: string;
}): Promise<any[]> {
  const prompt = buildPrompt(params);
  let lastError = 'AI generation failed';
  if (process.env.GROQ_API_KEY) {
    try {
      const parsed = await generateWithGroq(prompt, params.count);
      const questions = normalizeQuestions(Array.isArray(parsed) ? parsed : [], params.chapterTitle);
      if (questions.length) return questions.slice(0, params.count);
      lastError = 'Groq returned no valid questions';
    } catch (err: any) {
      lastError = err?.message || lastError;
    }
  }
  if (process.env.GEMINI_API_KEY) {
    const parsed = await generateWithGemini(prompt);
    const questions = normalizeQuestions(Array.isArray(parsed) ? parsed : [], params.chapterTitle);
    if (questions.length) return questions.slice(0, params.count);
    throw new Error('Gemini returned no valid questions');
  }
  throw new Error(lastError);
}

function isHealth(pathname: string): boolean {
  return pathname === '/api/health' || pathname === '/health';
}

function isRegister(pathname: string): boolean {
  return pathname === '/api/documents/register' || pathname === '/documents/register';
}

function isQuizGenerate(pathname: string): boolean {
  return (
    pathname === '/api/quizzes/generate' ||
    pathname === '/api/quiz/generate' ||
    pathname === '/quizzes/generate' ||
    pathname === '/quiz/generate'
  );
}

function flashcardDocumentId(pathname: string): string | null {
  const match = pathname.match(/^\/(?:api\/)?flashcards\/([^/]+)$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  if (!id || id === 'update') return null;
  return id;
}

function isFlashcardUpdate(pathname: string): boolean {
  return pathname === '/api/flashcards/update' || pathname === '/flashcards/update';
}

function normalizeFlashcards(raw: any[], fallbackTopic?: string): Array<{ front: string; back: string; topic: string; hint?: string }> {
  const out: Array<{ front: string; back: string; topic: string; hint?: string }> = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const front = String(item.front || item.question || '').trim();
    const back = String(item.back || item.answer || '').trim();
    if (front.length < 3 || back.length < 3) continue;
    const sig = front.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 36);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({
      front,
      back,
      topic: String(item.topic || fallbackTopic || 'Core concept').trim(),
      hint: String(item.hint || '').trim() || undefined,
    });
  }
  return out;
}

function buildFlashcardPrompt(params: { count: number; sourceText: string; documentTitle: string; chapterTitle?: string }): string {
  return `You are a memory specialist. Generate exactly ${params.count} high-quality spaced-repetition flashcards. Respond ONLY with a valid JSON array.

Document: ${params.documentTitle}${params.chapterTitle ? ` — ${params.chapterTitle}` : ''}
Content:
${params.sourceText}

Return a JSON array:
[{"front":"Clear question/prompt","back":"Precise answer/explanation","topic":"sub-topic","hint":"memory cue"}]

Rules:
1. Ground every card in the content above.
2. Front should be a short prompt, not a paragraph.
3. Back should be a precise answer.
4. No duplicate fronts.`;
}

async function generateFlashcardItems(params: {
  sourceText: string;
  count: number;
  documentTitle: string;
  chapterTitle?: string;
}): Promise<Array<{ front: string; back: string; topic: string; hint?: string }>> {
  const prompt = buildFlashcardPrompt(params);
  let lastError = 'AI generation failed';
  if (process.env.GROQ_API_KEY) {
    try {
      const parsed = await generateWithGroq(prompt, params.count);
      const cards = normalizeFlashcards(Array.isArray(parsed) ? parsed : [], params.chapterTitle);
      if (cards.length) return cards.slice(0, params.count);
      lastError = 'Groq returned no valid flashcards';
    } catch (err: any) {
      lastError = err?.message || lastError;
    }
  }
  if (process.env.GEMINI_API_KEY) {
    const parsed = await generateWithGemini(prompt);
    const cards = normalizeFlashcards(Array.isArray(parsed) ? parsed : [], params.chapterTitle);
    if (cards.length) return cards.slice(0, params.count);
    throw new Error('Gemini returned no valid flashcards');
  }
  throw new Error(lastError);
}

async function handleRegister(req: IncomingMessage, res: ServerResponse) {
  const body = await readJsonBody(req);
  const fileName = String(body.fileName || 'document.pdf');
  const rawId = String(body.id || '').trim();
  const id = /^[a-zA-Z0-9_-]+$/.test(rawId)
    ? rawId
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const chapters =
    Array.isArray(body.chapters) && body.chapters.length
      ? body.chapters
      : [{ id: 'ch-full', title: 'Full book', summary: '', keyPoints: [], estimatedReadTime: '30 min' }];
  return sendJson(res, 200, {
    success: true,
    data: {
      id,
      userId: userIdOf(req, body),
      title: String(body.title || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')),
      fileName,
      fileSize: String(body.fileSize || ''),
      uploadDate: new Date().toISOString(),
      pageCount: Number(body.pageCount) || 0,
      summary: String(body.summary || 'Book uploaded. Open a chapter to practise.'),
      extractedContent: '',
      chapters,
      keyTerms: [],
      overallDifficulty: 'Intermediate',
      totalQuizzesGenerated: 0,
      processingStatus: 'ready',
      progress: 100,
    },
  });
}

async function handleQuiz(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Use POST to generate a quiz.' });
  }
  const body = await readJsonBody(req);
  const sourceText = String(body.sourceText || '').trim();
  if (sourceText.length < 80) {
    return sendJson(res, 400, {
      success: false,
      error: 'Book text was not found on this device. Open the book again, then generate the quiz.',
    });
  }
  const count = Math.max(1, Math.min(20, Number(body.count) || 5));
  const chapterTitle = String(body.chapterTitle || '').trim() || undefined;
  const documentTitle = String(body.documentTitle || body.title || 'Study material').trim();
  const documentId = String(body.documentId || `doc-${Date.now()}`).trim();
  const userId = userIdOf(req, body);
  const difficulty = String(body.difficulty || 'Medium');
  const questionStyle = String(body.questionStyle || 'Mixed');
  const topic = String(body.topic || '').trim() || undefined;

  const questions = await generateQuestions({
    sourceText: sourceText.slice(0, 24000),
    count,
    chapterTitle,
    topic,
    difficulty,
    questionStyle,
  });

  const quizId = `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const quiz = {
    id: quizId,
    userId,
    documentId,
    documentTitle,
    title: chapterTitle ? `${chapterTitle} Mastery Quiz` : `${documentTitle} Comprehensive Quiz`,
    createdAt: new Date().toISOString(),
    questionType: 'multiple_choice',
    difficulty,
    chapterTitle,
    topic,
    questions,
  };
  const session = {
    id: sessionId,
    userId,
    bookId: documentId,
    quizId,
    documentId,
    documentTitle,
    chapterTitle,
    quizConfiguration: { questionCount: questions.length, difficulty, questionStyle, topic },
    questions,
    currentQuestionIndex: 0,
    answers: {},
    score: 0,
    correctCount: 0,
    incorrectCount: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'in_progress',
  };
  return sendJson(res, 200, { success: true, data: quiz, session });
}

async function handleFlashcards(req: IncomingMessage, res: ServerResponse, documentId: string) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return sendJson(res, 405, { success: false, error: 'Use POST to generate flashcards.' });
  }
  const body = req.method === 'POST' ? await readJsonBody(req) : {};
  const sourceText = String(body.sourceText || '').trim();
  if (sourceText.length < 80) {
    return sendJson(res, 400, {
      success: false,
      error: 'Book text was not found on this device. Open the book again, then open Flashcards.',
    });
  }
  const chapterId = String(body.chapterId || '').trim() || undefined;
  const chapterTitle = String(body.chapterTitle || '').trim() || undefined;
  const documentTitle = String(body.documentTitle || 'Study material').trim();
  const userId = userIdOf(req, body);
  const count = chapterTitle ? 6 : 8;
  const items = await generateFlashcardItems({
    sourceText: sourceText.slice(0, 15000),
    count,
    documentTitle,
    chapterTitle,
  });
  const cards = items.map((card, i) => ({
    id: `fc-${Date.now()}-${chapterId || 'all'}-${i}`,
    userId,
    documentId,
    documentTitle,
    front: card.front,
    back: card.back,
    topic: card.topic || chapterTitle || documentTitle,
    chapterId,
    chapterTitle,
    hint: card.hint,
    masteryLevel: 'new',
    reviewCount: 0,
  }));
  return sendJson(res, 200, { success: true, data: cards });
}

async function handleFlashcardUpdate(req: IncomingMessage, res: ServerResponse) {
  const body = await readJsonBody(req);
  const id = String(body.id || '').trim();
  const status = String(body.status || 'learning');
  if (!id) {
    return sendJson(res, 400, { success: false, error: 'Flashcard id is required.' });
  }
  return sendJson(res, 200, {
    success: true,
    data: {
      id,
      documentId: String(body.documentId || ''),
      documentTitle: String(body.documentTitle || ''),
      front: String(body.front || ''),
      back: String(body.back || ''),
      topic: String(body.topic || ''),
      masteryLevel: ['new', 'learning', 'mastered'].includes(status) ? status : 'learning',
      reviewCount: 1,
      lastReviewed: new Date().toISOString(),
    },
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const pathname = pathOf(req);
  try {
    if (isHealth(pathname)) {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'Smooth Learn',
        timestamp: new Date().toISOString(),
      });
    }
    if (req.method === 'POST' && isRegister(pathname)) {
      return await handleRegister(req, res);
    }
    if (isQuizGenerate(pathname)) {
      return await handleQuiz(req, res);
    }
    if (isFlashcardUpdate(pathname)) {
      return await handleFlashcardUpdate(req, res);
    }
    const flashcardDocId = flashcardDocumentId(pathname);
    if (flashcardDocId) {
      return await handleFlashcards(req, res, flashcardDocId);
    }
    return sendJson(res, 404, { success: false, error: `No API route for ${pathname}` });
  } catch (err: any) {
    const message = err?.message || 'API request failed';
    console.error('[Smooth Learn API]', message);
    sendJson(res, 500, { success: false, error: message });
  }
}
