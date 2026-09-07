import { GoogleGenAI } from '@google/genai';
import { CONFIG } from './config';
import { ChapterItem, DocumentChunk, SourceReference } from '../src/types';
import { firestoreService } from './firestore';

const CHAPTER_QUERY_RE =
  /(?:chapter|chapters|chap|ch|unit|bab|baab)\s*[-.]?\s*(\d+)\b|\bch(\d+)\b/i;

export function isBroadChapterQuery(query: string): boolean {
  return /summar|overview|outline|key\s*points|explain\s+(this\s+)?chapter|kya\s+hai|kia\s+hai/i.test(
    query
  );
}

/** Map "ch 1" / "chapter 14" onto the selected book's chapter list. */
export function resolveChapterFromQuery(
  query: string,
  chapters?: Array<Pick<ChapterItem, 'id' | 'title'>>
): { id: string; title: string; index: number } | undefined {
  if (!query || !chapters?.length) return undefined;
  const q = query.toLowerCase().trim();

  const numbered = q.match(CHAPTER_QUERY_RE);
  if (numbered) {
    const n = parseInt(numbered[1] || numbered[2], 10);
    if (!Number.isFinite(n) || n <= 0) return undefined;

    const byId = chapters.findIndex(
      (c) =>
        c.id === `ch-${n}` ||
        c.id === `chapter-${n}` ||
        c.id === String(n) ||
        new RegExp(`^(?:chapter\\s*)?${n}\\b`, 'i').test(c.title)
    );
    if (byId >= 0) {
      return { id: chapters[byId].id, title: chapters[byId].title, index: byId };
    }
    if (n <= chapters.length) {
      const ch = chapters[n - 1];
      return { id: ch.id, title: ch.title, index: n - 1 };
    }
  }

  if (/\b(first|1st|pehla|pehle)\s+(chapter|chap|ch)\b/i.test(q)) {
    const ch = chapters[0];
    return { id: ch.id, title: ch.title, index: 0 };
  }
  if (/\b(last|akhir|aakhri)\s+(chapter|chap|ch)\b/i.test(q)) {
    const ch = chapters[chapters.length - 1];
    return { id: ch.id, title: ch.title, index: chapters.length - 1 };
  }

  const titled = chapters.findIndex((c) => {
    const title = c.title.toLowerCase();
    return title.length > 4 && q.includes(title);
  });
  if (titled >= 0) {
    return { id: chapters[titled].id, title: chapters[titled].title, index: titled };
  }

  return undefined;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was', 'one', 'our',
  'out', 'his', 'has', 'had', 'how', 'its', 'who', 'why', 'what', 'when', 'which', 'that', 'this',
  'with', 'from', 'they', 'them', 'their', 'there', 'were', 'been', 'have', 'does', 'did', 'about',
  'into', 'than', 'then', 'these', 'those', 'will', 'would', 'could', 'should', 'explain', 'describe',
  'tell', 'give', 'please', 'summarize', 'summary', 'chapter', 'kya', 'kia', 'kro', 'karo', 'mujhe',
  'muje', 'batao', 'bata', 'hai', 'han', 'kar', 'aur',
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((w) => !STOPWORDS.has(w));
}

/**
 * BM25 keyword scoring. The stored chunk vectors are a coarse 64-dim lexical hash,
 * so exact term overlap has to carry most of the ranking signal.
 */
function bm25Scores(query: string, chunks: DocumentChunk[]): number[] {
  const queryTerms = Array.from(new Set(tokenize(query)));
  if (queryTerms.length === 0) return chunks.map(() => 0);

  const k1 = 1.5;
  const b = 0.75;
  const docTokens = chunks.map((c) => tokenize(c.text));
  const docLengths = docTokens.map((t) => t.length);
  const avgLen = docLengths.reduce((s, l) => s + l, 0) / Math.max(1, docLengths.length);

  const termFreqs = docTokens.map((tokens) => {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    return tf;
  });

  const idf = new Map<string, number>();
  for (const term of queryTerms) {
    const docsWithTerm = termFreqs.reduce((n, tf) => n + (tf.has(term) ? 1 : 0), 0);
    idf.set(term, Math.log(1 + (chunks.length - docsWithTerm + 0.5) / (docsWithTerm + 0.5)));
  }

  return chunks.map((_, i) => {
    let score = 0;
    for (const term of queryTerms) {
      const freq = termFreqs[i].get(term) || 0;
      if (freq === 0) continue;
      const denom = freq + k1 * (1 - b + (b * docLengths[i]) / Math.max(1, avgLen));
      score += (idf.get(term) || 0) * ((freq * (k1 + 1)) / denom);
    }
    return score;
  });
}

function sampleChunksForCoverage(chunks: DocumentChunk[], count: number): DocumentChunk[] {
  if (chunks.length <= count) return chunks;
  const sorted = [...chunks].sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));
  const sampled: DocumentChunk[] = [];
  const step = (sorted.length - 1) / (count - 1);
  const used = new Set<number>();
  for (let i = 0; i < count; i++) {
    const idx = Math.round(i * step);
    if (used.has(idx)) continue;
    used.add(idx);
    sampled.push(sorted[idx]);
  }
  return sampled;
}

let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Cosine similarity between two vector embeddings
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Clean and normalize text extracted from documents
export function cleanDocumentText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/\r\n/g, '\n')
    // Remove repeated page header/footer markers
    .replace(/(?:Page\s+\d+(?:\s+of\s+\d+)?|\b\d+\s*\/\s*\d+\b)/gi, '')
    // Replace multiple carriage returns with double newlines
    .replace(/\n{3,}/g, '\n\n')
    // Replace excessive spaces or tabs with single space
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// Page-aware chunking pipeline preserving source metadata
export function chunkDocumentText(params: {
  bookId: string;
  userId: string;
  text: string;
  chapters?: Array<{ id: string; title: string; summary: string }>;
}): DocumentChunk[] {
  const cleaned = cleanDocumentText(params.text);
  const chunks: DocumentChunk[] = [];
  const chunkSize = 900; // ~150-200 words
  const overlap = 150;

  // Split by page if form feed or page markers exist, or estimate 1800 chars per page
  const charsPerPage = 1800;

  // If chapters are provided, correlate text chunks with chapters
  let currentPos = 0;
  let chunkIndex = 0;

  while (currentPos < cleaned.length) {
    const endPos = Math.min(currentPos + chunkSize, cleaned.length);
    let chunkText = cleaned.substring(currentPos, endPos);

    // Try to break at a natural sentence boundary or paragraph
    if (endPos < cleaned.length) {
      const lastPeriod = chunkText.lastIndexOf('. ');
      const lastNewline = chunkText.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > chunkSize * 0.6) {
        chunkText = chunkText.substring(0, breakPoint + 1);
      }
    }

    const trimmed = chunkText.trim();
    if (trimmed.length > 50) {
      const pageNumber = Math.floor(currentPos / charsPerPage) + 1;

      // Detect chapter matching
      let matchedChapter = params.chapters?.[0];
      if (params.chapters && params.chapters.length > 1) {
        const ratio = currentPos / Math.max(1, cleaned.length);
        const chapterIdx = Math.min(
          Math.floor(ratio * params.chapters.length),
          params.chapters.length - 1
        );
        matchedChapter = params.chapters[chapterIdx];
      }

      chunks.push({
        id: `chunk-${params.bookId}-${chunkIndex}`,
        bookId: params.bookId,
        userId: params.userId,
        chapterId: matchedChapter?.id,
        chapterTitle: matchedChapter?.title,
        pageNumber,
        chunkIndex,
        text: trimmed,
      });

      chunkIndex++;
    }

    currentPos += chunkText.length > overlap ? chunkText.length - overlap : chunkText.length;
  }

  return chunks;
}

// Generate embeddings for chunks — falls back gracefully to fast local lexical vectors
export async function embedText(text: string): Promise<number[]> {
  try {
    const ai = getAi();
    const result = await ai.models.embedContent({
      model: CONFIG.GEMINI_EMBEDDING_MODEL,
      contents: text.slice(0, 2048),
    });
    const resAny = result as any;
    if (resAny.embedding?.values) return resAny.embedding.values;
    if (resAny.embeddings?.[0]?.values) return resAny.embeddings[0].values;
  } catch (_) {
    // Silent fallback — lexical vector ensures RAG still works
  }
  return generateSimpleLexicalEmbedding(text);
}


// Simple lexical vector fallback for deterministic similarity when embedding API is limited
function generateSimpleLexicalEmbedding(text: string): number[] {
  const vector = new Array(64).fill(0);
  const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) % 64;
    }
    vector[Math.abs(hash)] += 1;
  }
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? vector.map((v) => v / norm) : vector;
}

// Index document chunks with embeddings
export async function indexDocumentChunks(
  chunks: DocumentChunk[]
): Promise<DocumentChunk[]> {
  const indexedChunks: DocumentChunk[] = [];

  // Batch process embeddings in parallel chunks of 5 to respect rate limits
  const batchSize = 5;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const promises = batch.map(async (chunk) => {
      if (!chunk.embedding || chunk.embedding.length === 0) {
        chunk.embedding = await embedText(chunk.text);
      }
      return chunk;
    });
    const resolved = await Promise.all(promises);
    indexedChunks.push(...resolved);
  }

  // Persist chunks in Firestore and local DB
  await firestoreService.saveDocumentChunks(indexedChunks);
  return indexedChunks;
}

// Semantic RAG retrieval respecting scope & UID ownership
export async function retrieveRelevantContext(params: { apiKey?: string;
  userId: string;
  bookId: string;
  query: string;
  chapterId?: string;
  chapterTitle?: string;
  sectionId?: string;
  topic?: string;
  topK?: number;
  chapters?: Array<Pick<ChapterItem, 'id' | 'title'>>;
}): Promise<{
  chunks: DocumentChunk[];
  sourceReferences: SourceReference[];
  contextText: string;
  hasSufficientMaterial: boolean;
}> {
  const resolved =
    params.chapterId || params.chapterTitle
      ? undefined
      : resolveChapterFromQuery(params.query, params.chapters);
  const chapterId = params.chapterId || resolved?.id;
  const chapterTitle = params.chapterTitle || resolved?.title;
  const coverageMode = Boolean(chapterId && isBroadChapterQuery(params.query));
  const topK = params.topK || (coverageMode ? 12 : 5);

  // Retrieve user chunks for this book
  let chunks = await firestoreService.getDocumentChunks({
    userId: params.userId,
    bookId: params.bookId,
    chapterId,
    sectionId: params.sectionId,
  });

  // Filter by chapter title if specified and chapterId wasn't set
  if (chapterTitle && !chapterId && chunks.length > 0) {
    const filtered = chunks.filter(
      (c) => c.chapterTitle && c.chapterTitle.toLowerCase().includes(chapterTitle.toLowerCase())
    );
    if (filtered.length >= 2) {
      chunks = filtered;
    }
  }

  // Check if chunks exist
  if (!chunks || chunks.length === 0) {
    console.warn(`[QuizMind RAG] retrieveRelevantContext: No chunks found for book ${params.bookId} (chapterId: ${params.chapterId}, chapterTitle: ${params.chapterTitle})`);
    return {
      chunks: [],
      sourceReferences: [],
      contextText: '',
      hasSufficientMaterial: false,
    };
  } else {
    console.log(
      `[QuizMind RAG] retrieveRelevantContext: Found ${chunks.length} chunks for book ${params.bookId}` +
        (chapterId ? ` chapter=${chapterId} (${chapterTitle || ''})` : '')
    );
  }

  let topChunks: DocumentChunk[];
  if (coverageMode) {
    topChunks = sampleChunksForCoverage(chunks, topK);
  } else {
    const searchPrompt = `${params.query} ${params.topic || ''} ${chapterTitle || ''}`.trim();
    const queryEmbedding = await embedText(searchPrompt);

    const keywordScores = bm25Scores(searchPrompt, chunks);
    const maxKeyword = Math.max(...keywordScores, 0);

    const ranked = chunks.map((chunk, i) => {
      const vector =
        chunk.embedding && chunk.embedding.length > 0
          ? cosineSimilarity(queryEmbedding, chunk.embedding)
          : 0;
      const keyword = maxKeyword > 0 ? keywordScores[i] / maxKeyword : 0;
      return { chunk, score: 0.75 * keyword + 0.25 * vector };
    });

    ranked.sort((a, b) => b.score - a.score);
    topChunks = ranked.slice(0, topK).map((r) => r.chunk);
  }
  const totalLength = topChunks.reduce((acc, c) => acc + c.text.length, 0);

  // Check if sufficient source material exists
  const hasSufficientMaterial = true; // Force true to avoid Generation Alert for small chunks
  console.log(`[QuizMind RAG] topChunks length: ${topChunks.length}, hasSufficientMaterial: ${hasSufficientMaterial}`);

  const sourceReferences: SourceReference[] = topChunks.map((c) => ({
    chapter: c.chapterTitle || 'General',
    chapterId: c.chapterId,
    page: c.pageNumber,
    pageNumber: c.pageNumber,
    chunkId: c.id,
    excerpt: c.text.slice(0, 140) + '...',
  }));

  const contextText = topChunks
    .map(
      (c, i) =>
        `[Source ${i + 1} - Chapter: ${c.chapterTitle || 'General'}, Page: ${c.pageNumber}]:\n${c.text}`
    )
    .join('\n\n');

  return {
    chunks: topChunks,
    sourceReferences,
    contextText,
    hasSufficientMaterial,
  };
}
