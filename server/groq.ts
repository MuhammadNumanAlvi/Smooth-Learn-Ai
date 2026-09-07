/**
 * Groq-powered AI module — ultra-fast inference (GPT-OSS / Qwen on Groq).
 * Drop-in replacement for slow Gemini generation calls.
 */
import Groq from 'groq-sdk';
import { QuizQuestion, SourceReference, QuestionStyle, QuizDifficulty } from '../src/types';
import { isBroadChapterQuery, resolveChapterFromQuery, retrieveRelevantContext } from './rag';
import { db } from './db';

function getGroqClient(): Groq {
  const settings = db.getAISettings();
  const apiKey = process.env.GROQ_API_KEY || settings.groqKey;
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured');
  return new Groq({ apiKey });
}

const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';

/** Groq retired several Llama/Mixtral/Gemma IDs in 2025–2026. */
const DEPRECATED_GROQ_MODELS: Record<string, string> = {
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'mixtral-8x7b-32768': 'openai/gpt-oss-20b',
  'gemma2-9b-it': 'openai/gpt-oss-20b',
  'llama3-8b-8192': 'openai/gpt-oss-20b',
  'llama3-70b-8192': 'openai/gpt-oss-120b',
};

function resolveGroqModel(model?: string): string {
  const requested = (model || '').trim();
  if (!requested) return DEFAULT_GROQ_MODEL;
  return DEPRECATED_GROQ_MODELS[requested] || requested;
}

function getGroqModel(): string {
  const settings = db.getAISettings();
  return resolveGroqModel(settings.groqModel);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeJson(text: string): any {
  // Strip markdown fences if present
  let cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Attempt to salvage truncated JSON array of objects
    try {
      const lastClose = cleaned.lastIndexOf('}');
      if (lastClose !== -1) {
        const repaired = cleaned.substring(0, lastClose + 1) + ']';
        return JSON.parse(repaired);
      }
    } catch (err) {}
    throw e;
  }
}

function validateQuizQuestion(q: any, retrievedSources: SourceReference[]): QuizQuestion | null {
  if (!q || typeof q !== 'object') return null;
  const question = typeof q.question === 'string' ? q.question.trim() : '';
  if (question.length < 5) return null;
  if (!Array.isArray(q.options) || q.options.length !== 4) return null;
  const options = q.options.map((o: any) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean);
  if (options.length !== 4) return null;
  const uniqueOptions = new Set(options.map((o: string) => o.toLowerCase()));
  if (uniqueOptions.size !== 4) return null;
  const correctAnswer = typeof q.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
  if (!correctAnswer) return null;
  const matchedOption = options.find((opt: string) => opt.toLowerCase() === correctAnswer.toLowerCase());
  if (!matchedOption) return null;
  const explanation =
    typeof q.explanation === 'string' && q.explanation.trim().length > 10
      ? q.explanation.trim()
      : `The correct answer is "${matchedOption}".`;
  const validDifficulties = ['Easy', 'Medium', 'Hard'] as const;
  const difficulty: 'Easy' | 'Medium' | 'Hard' = validDifficulties.includes(q.difficulty) ? q.difficulty : 'Medium';
  const topic = typeof q.topic === 'string' && q.topic.trim().length > 0 ? q.topic.trim() : 'Core Concept';
  let sourceReferences: SourceReference[] = [];
  if (Array.isArray(q.sourceReferences) && q.sourceReferences.length > 0) {
    sourceReferences = q.sourceReferences
      .filter((ref: any) => ref && (ref.chapter || ref.page))
      .map((ref: any) => ({
        chapter: ref.chapter || retrievedSources[0]?.chapter || 'Study Material',
        page: Number(ref.page) || retrievedSources[0]?.page || 1,
        chunkId: ref.chunkId || retrievedSources[0]?.chunkId,
        excerpt: ref.excerpt || retrievedSources[0]?.excerpt,
      }));
  }
  if (sourceReferences.length === 0 && retrievedSources.length > 0) {
    sourceReferences = [retrievedSources[0]];
  }
  return {
    id: q.id || `q-${Math.random().toString(36).substring(2, 9)}`,
    type: 'multiple_choice',
    question,
    options,
    correctAnswer: matchedOption,
    explanation,
    difficulty,
    topic,
    sourceReferences,
    hint: q.hint || 'Recall the key definitions from your study material.',
  };
}

function deduplicateQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    const sig = q.question.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

// ─── Document Analysis ───────────────────────────────────────────────────────

export async function groqAnalyzeDocument(params: {
  text: string;
  fileName: string;
}): Promise<{
  title: string;
  summary: string;
  estimatedPages: number;
  chapters: Array<{ id: string; title: string; summary: string; keyPoints: string[]; estimatedReadTime: string }>;
  keyTerms: Array<{ term: string; definition: string }>;
  overallDifficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}> {
  const groq = getGroqClient();
  const model = getGroqModel();

  const prompt = `You are an expert academic study assistant. Analyze this educational document and respond ONLY with valid JSON (no markdown, no explanation outside the JSON).

File: ${params.fileName}
Content (first 20000 chars):
${params.text.slice(0, 20000)}

Return this exact JSON structure:
{
  "title": "string",
  "summary": "2-3 paragraph summary",
  "estimatedPages": number,
  "overallDifficulty": "Beginner"|"Intermediate"|"Advanced",
  "chapters": [{"id":"ch-1","title":"...","summary":"...","keyPoints":["..."],"estimatedReadTime":"X mins"}],
  "keyTerms": [{"term":"...","definition":"..."}]
}

Rules:
- Extract ACTUAL chapters from the Table of Contents. If no ToC exists, use major headings.
- Include 6-12 keyTerms (important technical vocabulary).
- chapters array must have at least 1 item.`;

  try {
    const resp = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    });
    const raw = resp.choices[0]?.message?.content || '{}';
    const parsed = safeJson(raw);
    return {
      title: parsed.title || params.fileName.replace(/\.[^/.]+$/, ''),
      summary: parsed.summary || 'Educational document.',
      estimatedPages: parsed.estimatedPages || Math.max(1, Math.round(params.text.length / 2500)),
      overallDifficulty: parsed.overallDifficulty || 'Intermediate',
      chapters: (parsed.chapters || []).map((ch: any, i: number) => ({
        id: ch.id || `ch-${i + 1}`,
        title: ch.title || `Chapter ${i + 1}`,
        summary: ch.summary || '',
        keyPoints: Array.isArray(ch.keyPoints) ? ch.keyPoints : [],
        estimatedReadTime: ch.estimatedReadTime || '10 mins',
      })),
      keyTerms: (parsed.keyTerms || []).map((kt: any) => ({ term: kt.term, definition: kt.definition })),
    };
  } catch (err) {
    console.error('[Groq] analyzeDocument error:', err);
    const title = params.fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    return {
      title: title.charAt(0).toUpperCase() + title.slice(1),
      summary: `Study document: ${params.fileName}`,
      estimatedPages: Math.max(1, Math.round(params.text.length / 2000)),
      overallDifficulty: 'Intermediate',
      chapters: [{ id: 'ch-1', title: 'Core Content', summary: 'Main study material', keyPoints: [], estimatedReadTime: '10 mins' }],
      keyTerms: [],
    };
  }
}

// ─── Quiz Generation ─────────────────────────────────────────────────────────

export async function groqGenerateQuizQuestions(params: {
  userId: string;
  bookId: string;
  documentTitle: string;
  chapterId?: string;
  chapterTitle?: string;
  sectionId?: string;
  topic?: string;
  questionCount: number;
  difficulty: QuizDifficulty;
  questionStyle?: QuestionStyle;
}): Promise<{ questions: QuizQuestion[]; sourceReferences: SourceReference[] }> {
  const retrieval = await retrieveRelevantContext({
    userId: params.userId,
    bookId: params.bookId,
    query: `${params.topic || ''} ${params.chapterTitle || ''} key concepts exam questions`,
    chapterId: params.chapterId,
    chapterTitle: params.chapterTitle,
    sectionId: params.sectionId,
    topic: params.topic,
    topK: Math.min(10, Math.max(4, Math.ceil(params.questionCount * 1.5))),
  });

  if (!retrieval.hasSufficientMaterial) {
    throw new Error('Not enough material found. Please select a broader scope or upload more content.');
  }

  const groq = getGroqClient();
  const model = getGroqModel();
  const count = Math.max(1, Math.min(20, params.questionCount));

  const prompt = `You are an expert academic examiner. Generate exactly ${count} multiple-choice questions grounded in the source material below. Respond ONLY with a valid JSON array.

SOURCE MATERIAL:
${retrieval.contextText}

PARAMETERS:
- Count: ${count}
- Scope: ${params.chapterTitle ? `Chapter: ${params.chapterTitle}` : 'Full Document'}
- Style: ${params.questionStyle || 'Mixed'}
- Difficulty: ${params.difficulty}

Return a JSON array of objects with this structure:
[{
  "id": "q-1",
  "question": "Clear question stem",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "Option A",
  "explanation": "Brief 1-sentence explanation",
  "difficulty": "Easy"|"Medium"|"Hard",
  "topic": "specific topic",
  "hint": "subtle memory cue",
  "sourceReferences": [{"chapter": "...", "page": 1, "chunkId": "..."}]
}]

Rules:
1. Every question MUST be grounded in the source material above.
2. Options must be exactly 4 distinct strings, no duplicates.
3. correctAnswer must exactly match one of the options strings.
4. Keep the explanation EXTREMELY CONCISE (under 10 words) to save output tokens.
5. No near-duplicate questions.`;

  try {
    const resp = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 900,
    });

    const raw = resp.choices[0]?.message?.content || '[]';
    const parsed = safeJson(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AI returned empty or invalid response.');
    }

    const valid: QuizQuestion[] = [];
    for (const rawQ of parsed) {
      const q = validateQuizQuestion(rawQ, retrieval.sourceReferences);
      if (q) valid.push(q);
    }

    const deduped = deduplicateQuestions(valid);
    if (deduped.length === 0) throw new Error('No valid questions passed quality check.');
    return { questions: deduped.slice(0, count), sourceReferences: retrieval.sourceReferences };
  } catch (err: any) {
    console.error('[Groq] generateQuizQuestions error:', err);
    throw new Error(err.message || 'Failed to generate quiz questions.');
  }
}

// ─── Flashcard Generation ────────────────────────────────────────────────────

export async function groqGenerateFlashcards(params: {
  documentTitle: string;
  documentContent: string;
  count?: number;
}): Promise<Array<{ front: string; back: string; topic: string; hint?: string }>> {
  const groq = getGroqClient();
  const model = getGroqModel();
  const count = params.count || 8;

  const prompt = `You are a memory specialist. Generate ${count} high-quality spaced-repetition flashcards for the document below. Respond ONLY with a valid JSON array.

Document: ${params.documentTitle}
Content:
${params.documentContent.slice(0, 15000)}

Return a JSON array:
[{"front":"Clear question/prompt","back":"Precise answer/explanation","topic":"sub-topic","hint":"memory cue"}]`;

  try {
    const resp = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 3000,
    });
    return safeJson(resp.choices[0]?.message?.content || '[]');
  } catch (err) {
    console.error('[Groq] generateFlashcards error:', err);
    throw new Error('Failed to generate flashcards.');
  }
}

// ─── Tutor Chat ──────────────────────────────────────────────────────────────

export async function groqAnswerTutorQuestion(params: {
  userId: string;
  bookId: string;
  documentTitle: string;
  userQuestion: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  action?: 'explain_simpler' | 'give_example' | 'standard';
}): Promise<{ reply: string; citations: string[]; sourceReferences: SourceReference[] }> {
  const book = db.getDocumentById(params.bookId, params.userId);
  const chapters = book?.chapters || [];
  const resolvedChapter = resolveChapterFromQuery(params.userQuestion, chapters);
  const chapterMeta = resolvedChapter
    ? chapters.find((c) => c.id === resolvedChapter.id)
    : undefined;
  const wantsSummary = isBroadChapterQuery(params.userQuestion);

  const retrieval = await retrieveRelevantContext({
    userId: params.userId,
    bookId: params.bookId,
    query: params.userQuestion,
    chapterId: resolvedChapter?.id,
    chapterTitle: resolvedChapter?.title,
    chapters,
    topK: wantsSummary ? 12 : 6,
  });

  if (retrieval.chunks.length === 0 && !chapterMeta) {
    return {
      reply: 'I could not find enough information about this in your uploaded material. Please upload relevant documents.',
      citations: [],
      sourceReferences: [],
    };
  }

  const groq = getGroqClient();
  const model = getGroqModel();
  
  const history = params.messages
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Student' : 'AI Tutor'}: ${m.content.slice(0, 400)}`)
    .join('\n');

  let directive = '';
  if (params.action === 'explain_simpler') {
    directive = 'Use simple language, real-world analogies, and avoid jargon (ELI5 style).';
  } else if (params.action === 'give_example') {
    directive = 'Provide a concrete worked example or real-world scenario illustrating the concept.';
  }

  const chapterOutline = chapters
    .map((c, i) => `${i + 1}. ${c.title}`)
    .join('\n');
  const resolvedNote = resolvedChapter
    ? `The student is asking about book chapter ${resolvedChapter.index + 1}: "${resolvedChapter.title}". Treat "ch ${resolvedChapter.index + 1}" / "chapter ${resolvedChapter.index + 1}" as this chapter.`
    : 'No specific chapter number was detected; use the selected book as a whole.';
  const chapterFacts = chapterMeta
    ? `CHAPTER METADATA:\nTitle: ${chapterMeta.title}\nSummary: ${chapterMeta.summary || 'n/a'}\nKey points:\n${(chapterMeta.keyPoints || []).map((p) => `- ${p}`).join('\n')}`
    : '';

  const prompt = `You are an AI academic tutor for the student's selected book: "${params.documentTitle}". Respond ONLY with valid JSON.

SELECTED BOOK CHAPTERS:
${chapterOutline || '(chapter list unavailable)'}

${resolvedNote}

${chapterFacts}

RULES:
1. Answer ONLY from this selected book — its chapter metadata and the retrieved source chunks below.
2. If the user asks a question in Roman Urdu, Urdu, Hindi, or another language, understand it and reply in the same language or English depending on context. (e.g., "ch1 ko summarize kro" -> Summarize Chapter 1 of this book).
3. If they ask to summarize a chapter, write a real study summary using the chapter metadata and source chunks: main ideas, key terms, and important points. Do NOT say you could not find enough information when chapter metadata or source chunks are present.
4. Only say "I could not find enough information" if there is no chapter metadata AND the chunks are empty or completely unrelated to this book.
5. Write formulas in plain text (C4H10, H2O, PV = k, 25 °C). Never use LaTeX, dollar signs or backslash commands.
6. ${directive}

RETRIEVED SOURCE CHUNKS:
${retrieval.contextText || '(no extra page excerpts; use chapter metadata above)'}

CONVERSATION HISTORY:
${history}

STUDENT'S QUESTION: "${params.userQuestion}"

Return JSON:
{"reply": "Markdown-formatted educational answer with **bold** terms","citations": ["exact quote 1"]}`;

  try {
    const resp = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });
    const parsed = safeJson(resp.choices[0]?.message?.content || '{}');
    return {
      reply: parsed.reply || 'I analyzed your study material regarding this topic.',
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      sourceReferences: retrieval.sourceReferences,
    };
  } catch (err) {
    console.error('[Groq] answerTutorQuestion error:', err);
    throw new Error('Tutor AI encountered an issue. Please try again.');
  }
}

// ─── Explain Concept ─────────────────────────────────────────────────────────

export async function groqExplainConcept(params: {
  userId: string;
  bookId: string;
  question: string;
  correctAnswer: string;
  userAnswer?: string;
  originalExplanation: string;
  style: 'more' | 'simpler';
}): Promise<{ style: 'more' | 'simpler'; explanation: string; keyTakeaway: string; citations: SourceReference[] }> {
  const retrieval = await retrieveRelevantContext({
    userId: params.userId,
    bookId: params.bookId,
    query: `${params.question} ${params.correctAnswer}`,
    topK: 3,
  });

  const groq = getGroqClient();
  const model = getGroqModel();
  const isSimpler = params.style === 'simpler';

  const prompt = isSimpler
    ? `Explain why "${params.correctAnswer}" is the correct answer to "${params.question}" in simple everyday language (ELI5). Use an analogy. Return JSON: {"explanation":"...","keyTakeaway":"one-liner rule"}`
    : `Provide an in-depth academic breakdown of why "${params.correctAnswer}" is correct for "${params.question}". Include mechanisms, edge cases, and implications. Context: ${retrieval.contextText.slice(0, 3000)}. Return JSON: {"explanation":"...","keyTakeaway":"advanced principle"}`;

  try {
    const resp = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });
    const parsed = safeJson(resp.choices[0]?.message?.content || '{}');
    return {
      style: params.style,
      explanation: parsed.explanation || params.originalExplanation,
      keyTakeaway: parsed.keyTakeaway || params.correctAnswer,
      citations: retrieval.sourceReferences,
    };
  } catch (err) {
    return {
      style: params.style,
      explanation: params.originalExplanation,
      keyTakeaway: `Remember: ${params.correctAnswer}`,
      citations: retrieval.sourceReferences,
    };
  }
}
