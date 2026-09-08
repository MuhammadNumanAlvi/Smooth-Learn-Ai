import express from "express";
import path from 'path';
import dotenv from 'dotenv';
import { db } from './server/db';
import { getAdminEmail, isAdminEmail, isAdminIdentifier } from './server/admin';
import { firestoreService } from './server/firestore';
import { AISettings, DocumentItem, Quiz, QuizSession, QuizAttempt, Flashcard } from './src/types';

type AIEngine = typeof import('./server/aiEngine');
type RagMod = typeof import('./server/rag');
type ProvidersMod = typeof import('./server/aiProviders');

let aiEngineMod: AIEngine | null = null;
let ragMod: RagMod | null = null;
let providersMod: ProvidersMod | null = null;

async function loadAI(): Promise<AIEngine> {
  if (!aiEngineMod) aiEngineMod = await import('./server/aiEngine');
  return aiEngineMod;
}
async function loadRag(): Promise<RagMod> {
  if (!ragMod) ragMod = await import('./server/rag');
  return ragMod;
}
async function loadProviders(): Promise<ProvidersMod> {
  if (!providersMod) providersMod = await import('./server/aiProviders');
  return providersMod;
}

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const isVercel = Boolean(process.env.VERCEL);

// Simple in-memory rate limiter per IP / User
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
function isRateLimited(key: string, maxRequests = 15, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }
  if (record.count >= maxRequests) {
    return true;
  }
  record.count++;
  return false;
}

// In-flight generation request lock to prevent duplicate clicks
const activeGenerations = new Set<string>();

export async function createApp() {
  const app = express();

  const jsonLimit = process.env.VERCEL ? '3.5mb' : '25mb';
  app.use(express.json({ limit: jsonLimit }));
  app.use(express.urlencoded({ extended: true, limit: jsonLimit }));
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ success: false, error: 'PDF is too large. Maximum size is 25MB.' });
    }
    if (err instanceof SyntaxError) {
      return res.status(400).json({ success: false, error: 'Invalid request body.' });
    }
    return next(err);
  });

  // Helper to get authenticated UID or fallback
  const getUserId = (req: express.Request): string => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token && token.length > 3) return token;
    }
    const bodyUid = req.body?.userId || req.query?.userId;
    if (bodyUid && typeof bodyUid === 'string' && bodyUid.trim().length > 0) {
      return bodyUid.trim();
    }
    return 'default-user';
  };

  // Health check
  
  // Admin Server-Side Authentication Check
  app.post('/api/auth/admin-login', (req, res) => {
    try {
      const { username } = req.body || {};
      const identifier = String(username || '').trim().toLowerCase();
      if (!isAdminIdentifier(identifier)) {
        return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
      }
      return res.json({
        success: true,
        email: getAdminEmail(),
        role: 'admin',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Admin login failed.' });
    }
  });

  app.post('/api/users/sync', (req, res) => {
    try {
      const userId = getUserId(req);
      const { email, displayName, photoURL } = req.body || {};
      if (!userId || userId === 'default-user') {
        return res.status(400).json({ success: false, error: 'Signed-in user required.' });
      }
      const saved = db.upsertUser({
        uid: userId,
        email: typeof email === 'string' ? email : '',
        displayName: typeof displayName === 'string' ? displayName : '',
        photoURL: typeof photoURL === 'string' ? photoURL : '',
        role: isAdminEmail(email) ? 'admin' : 'student',
      });
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/student/register', async (req, res) => {
    try {
      const userId = getUserId(req);
      const { email, fullName, phone, school, grade, city } = req.body || {};
      if (!userId || userId === 'default-user') {
        return res.status(401).json({ success: false, error: 'Sign up first, then we can save your profile.' });
      }
      if (!email || !fullName || !phone || !school || !grade) {
        return res.status(400).json({ success: false, error: 'Please complete all required student details.' });
      }
      const profile = {
        fullName: String(fullName).trim(),
        phone: String(phone).trim(),
        school: String(school).trim(),
        grade: String(grade).trim(),
        city: String(city || '').trim(),
      };
      const saved = db.upsertUser({
        uid: userId,
        email: String(email).trim(),
        displayName: profile.fullName,
        fullName: profile.fullName,
        phone: profile.phone,
        school: profile.school,
        grade: profile.grade,
        city: profile.city,
        role: 'student',
      });
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Smooth Learn',
      timestamp: new Date().toISOString(),
    });
  });

  // Document Management
  app.get('/api/documents', (req, res) => {
    try {
      const userId = getUserId(req);
      const documents = db.getDocuments(userId).map((d) => ({ ...d, extractedContent: '' }));
      res.json({ success: true, data: documents });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/documents/:id', (req, res) => {
    try {
      const userId = getUserId(req);
      const doc = db.getDocumentById(req.params.id, userId);
      if (!doc) {
        return res.status(404).json({ success: false, error: 'Document not found or access denied' });
      }
      res.json({ success: true, data: { ...doc, extractedContent: '' } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Document progress polling endpoint
  app.get('/api/documents/:id/progress', (req, res) => {
    try {
      const userId = getUserId(req);
      const doc = db.getDocumentById(req.params.id, userId);
      if (!doc) return res.status(404).json({ success: false, error: 'Document not found' });
      res.json({ success: true, data: { status: doc.processingStatus, progress: doc.progress || 0, title: doc.title } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Background AI processing pipeline for a document
  async function runDocumentProcessing(docId: string, userId: string, rawText: string, pdfBase64: string | undefined, fileName: string): Promise<void> {
    const updateProgress = (progress: number, status?: string) => {
      const doc = db.getDocumentById(docId);
      if (doc) {
        db.saveDocument({ ...doc, progress, processingStatus: (status as any) || doc.processingStatus });
      }
    };

    try {
      updateProgress(20);
      console.log(`[AI Engine] Analyzing document structure for: ${fileName}`);

      const analysisText = rawText.length > 80000 ? rawText.slice(0, 80000) : rawText;
      const analysis = await (await loadAI()).analyzeDocumentContent({
        text: analysisText,
        fileName,
      });

      updateProgress(55);
      console.log(`[AI Engine] Chapters extracted: ${analysis.chapters.length}. Saving document...`);

      const doc = db.getDocumentById(docId);
      if (!doc) return;

      const updatedDoc: DocumentItem = {
        ...doc,
        title: analysis.title,
        summary: analysis.summary,
        pageCount: analysis.estimatedPages,
        chapters: analysis.chapters,
        keyTerms: analysis.keyTerms,
        overallDifficulty: analysis.overallDifficulty,
        processingStatus: 'processing',
        progress: 65,
      };
      db.saveDocument(updatedDoc);

      // RAG chunking + embedding
      updateProgress(70);
      const indexText = rawText.length > 220000 ? rawText.slice(0, 220000) : rawText;
      const { chunkDocumentText, indexDocumentChunks } = await loadRag();
      const chunks = chunkDocumentText({
        bookId: docId,
        userId,
        text: indexText,
        chapters: analysis.chapters,
      });
      console.log(`[AI Engine] Chunked into ${chunks.length} pieces. Indexing embeddings...`);

      await indexDocumentChunks(chunks);

      updateProgress(100, 'ready');
      db.saveDocument({ ...updatedDoc, processingStatus: 'ready', progress: 100 });
      console.log(`[AI Engine] Document ready: ${analysis.title}`);
    } catch (err: any) {
      console.error('[AI Engine] Background processing failed:', err);
      const doc = db.getDocumentById(docId);
      if (doc) {
        db.saveDocument({
          ...doc,
          processingStatus: 'ready',
          progress: 100,
          summary: doc.summary || 'Book uploaded. Open a chapter to practise.',
          chapters: doc.chapters?.length
            ? doc.chapters
            : [{ id: 'ch-full', title: 'Full book', summary: 'Questions will be taken from your uploaded PDF.', keyPoints: [] } as any],
        });
      }
    }
  }

  const slimDoc = (doc: DocumentItem): DocumentItem => ({ ...doc, extractedContent: '' });

  async function ingestDocument(params: {
    userId: string;
    fileName: string;
    fileSize?: string;
    text: string;
  }): Promise<DocumentItem> {
    const quota = db.checkQuota(params.userId, 'upload_book');
    if (!quota.allowed) {
      const err: any = new Error(quota.message);
      err.statusCode = 429;
      throw err;
    }
    const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    db.saveDocumentText(docId, params.text);
    const skeletonDoc: DocumentItem = {
      id: docId,
      userId: params.userId,
      title: params.fileName?.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Processing Document',
      fileName: params.fileName || 'document.pdf',
      fileSize: params.fileSize || `${((params.text.length || 1024) / 1024).toFixed(1)} KB`,
      uploadDate: new Date().toISOString(),
      pageCount: 0,
      summary: 'AI is analyzing your document — chapters and key terms will appear shortly.',
      extractedContent: params.text.slice(0, 2000),
      chapters: [],
      keyTerms: [],
      overallDifficulty: 'Intermediate',
      totalQuizzesGenerated: 0,
      processingStatus: 'processing',
      progress: 10,
    };
    db.saveDocument(skeletonDoc);
    const fallbackChapters = latestChaptersFromText(params.text);
    db.saveDocument({
      ...skeletonDoc,
      processingStatus: 'ready',
      progress: 100,
      summary: params.text.slice(0, 240) || 'Book uploaded.',
      chapters: fallbackChapters,
    });
    return slimDoc(db.getDocumentById(docId, params.userId) || skeletonDoc);
  }

  function latestChaptersFromText(text: string) {
    const matches = [...text.matchAll(/(?:^|\n)\s*((?:chapter|unit|lesson)\s+\d+[:.\s][^\n]{0,90})/gi)];
    const titles = [...new Set(matches.map((m) => m[1].replace(/\s+/g, ' ').trim()))].slice(0, 40);
    if (titles.length < 2) {
      return [{ id: 'ch-full', title: 'Full book', summary: text.slice(0, 240), keyPoints: [], estimatedReadTime: '30 min' }];
    }
    return titles.map((title, i) => ({
      id: `ch-${i + 1}`,
      title,
      summary: '',
      keyPoints: [],
      estimatedReadTime: '15 min',
    }));
  }

  app.post('/api/documents/register', (req, res) => {
    try {
      const userId = getUserId(req);
      const body = req.body || {};
      const quota = db.checkQuota(userId, 'upload_book');
      if (!quota.allowed) return res.status(429).json({ success: false, error: quota.message });
      const rawId = String(body.id || '').trim();
      const docId = /^[a-zA-Z0-9_-]+$/.test(rawId)
        ? rawId
        : `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const fileName = String(body.fileName || 'document.pdf');
      const chapters = Array.isArray(body.chapters) && body.chapters.length
        ? body.chapters
        : [{ id: 'ch-full', title: 'Full book', summary: '', keyPoints: [], estimatedReadTime: '30 min' }];
      const doc: DocumentItem = {
        id: docId,
        userId,
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
      };
      db.saveDocument(doc);
      res.json({ success: true, data: slimDoc(doc) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to save document.' });
    }
  });

  app.post('/api/documents/analyze/init', (req, res) => {
    try {
      const userId = getUserId(req);
      const { fileName, fileSize, chunkCount } = req.body || {};
      const count = Number(chunkCount);
      if (!fileName || !Number.isFinite(count) || count < 1 || count > 80) {
        return res.status(400).json({ success: false, error: 'Invalid upload.' });
      }
      const quota = db.checkQuota(userId, 'upload_book');
      if (!quota.allowed) return res.status(429).json({ success: false, error: quota.message });
      const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const uploadId = db.initTextUpload({
        userId,
        fileName: String(fileName),
        fileSize: typeof fileSize === 'string' ? fileSize : undefined,
        chunkCount: count,
        docId,
      });
      res.json({ success: true, data: { uploadId, docId } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to start upload.' });
    }
  });

  app.post('/api/documents/analyze/chunk', (req, res) => {
    try {
      const { uploadId, index, text } = req.body || {};
      const i = Number(index);
      if (!uploadId || !Number.isInteger(i) || i < 0 || typeof text !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid upload piece.' });
      }
      if (text.length > 250000) {
        return res.status(413).json({ success: false, error: 'Upload piece is too large.' });
      }
      db.saveTextChunk(String(uploadId), i, text);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to save upload piece.' });
    }
  });

  app.post('/api/documents/analyze/complete', async (req, res) => {
    try {
      const userId = getUserId(req);
      const { uploadId } = req.body || {};
      if (!uploadId) return res.status(400).json({ success: false, error: 'Upload session missing.' });
      const assembled = db.assembleTextUpload(String(uploadId));
      if (assembled.userId !== userId && userId !== 'default-user') {
        return res.status(403).json({ success: false, error: 'Upload does not belong to this account.' });
      }
      if (!assembled.text.trim()) {
        return res.status(400).json({ success: false, error: 'No text was received from the PDF.' });
      }
      const created = await ingestDocument({
        userId,
        fileName: assembled.fileName,
        fileSize: assembled.fileSize,
        text: assembled.text,
      });
      res.json({ success: true, data: created });
    } catch (err: any) {
      console.error('[AI Engine] Document complete error:', err);
      res.status(err.statusCode || 500).json({ success: false, error: err?.message || 'Failed to process document' });
    }
  });

  app.post('/api/documents/analyze', async (req, res) => {
    try {
      const { fileName, text, fileSize, pdfBase64 } = req.body || {};
      const userId = getUserId(req);
      if (pdfBase64) {
        return res.status(413).json({
          success: false,
          error: 'PDF files must be read in the browser. Refresh the page and upload again.',
        });
      }
      if (typeof text === 'string' && text.length > 180000) {
        return res.status(413).json({
          success: false,
          error: 'Document text is too large for a single upload. Refresh and try again.',
        });
      }
      if (!text) {
        return res.status(400).json({ success: false, error: 'Document content is required.' });
      }
      const created = await ingestDocument({
        userId,
        fileName: fileName || 'document.pdf',
        fileSize,
        text,
      });
      res.json({ success: true, data: created });
    } catch (err: any) {
      console.error('[AI Engine] Document analyze error:', err);
      res.status(err.statusCode || 500).json({ success: false, error: err?.message || 'Failed to process document' });
    }
  });

  // Retry Processing endpoint for document re-indexing
  app.post('/api/documents/:id/retry', async (req, res) => {
    try {
      const userId = getUserId(req);
      const doc = db.getDocumentById(req.params.id, userId);
      if (!doc) {
        return res.status(404).json({ success: false, error: 'Document not found or ownership mismatch' });
      }

      doc.processingStatus = 'processing';
      db.saveDocument(doc);

      const { chunkDocumentText, indexDocumentChunks } = await loadRag();
      const chunks = chunkDocumentText({
        bookId: doc.id,
        userId,
        text: db.getDocumentText(doc.id, doc.extractedContent),
        chapters: doc.chapters,
      });

      await indexDocumentChunks(chunks);

      doc.processingStatus = 'ready';
      db.saveDocument(doc);

      res.json({ success: true, data: doc, message: 'Document re-processed and indexed successfully.' });
    } catch (err: any) {
      console.error('[QuizMind] Retry processing error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/documents/:id', (req, res) => {
    try {
      const userId = getUserId(req);
      const success = db.deleteDocument(req.params.id, userId);
      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Document not found or you do not have authorization to delete it',
        });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Quizzes API
  app.get('/api/quizzes', (req, res) => {
    try {
      const userId = getUserId(req);
      const documentId = req.query.documentId as string | undefined;
      const quizzes = db.getQuizzes(documentId, userId);
      res.json({ success: true, data: quizzes });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/quizzes/:id', (req, res) => {
    try {
      const userId = getUserId(req);
      const quiz = db.getQuizById(req.params.id, userId);
      if (!quiz) {
        return res.status(404).json({ success: false, error: 'Quiz not found or access denied' });
      }
      res.json({ success: true, data: quiz });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Real AI MCQ Generation with RAG, Idempotency, and Rate Limiting
  const handleQuizGeneration = async (req: express.Request, res: express.Response) => {
    const userId = getUserId(req);
    const clientIp = req.ip || '127.0.0.1';
    const rateLimitKey = `quiz-gen-${userId}-${clientIp}`;

    if (isRateLimited(rateLimitKey, 12, 60000)) {
      return res.status(429).json({
        success: false,
        error: 'Too many quiz generation requests. Please wait a minute before generating another quiz.',
      });
    }

    const quota = db.checkQuota(userId, 'generate_quiz');
    if (!quota.allowed) {
      return res.status(429).json({ success: false, error: quota.message });
    }

    const {
      documentId,
      chapterId,
      chapterTitle,
      sectionId,
      topic,
      questionType,
      difficulty,
      questionStyle,
      count,
      sourceText,
    } = req.body;

    const doc = db.getDocumentById(documentId, userId);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Target document not found or access denied' });
    }

    // Server-side request locking to prevent duplicate creation from rapid button clicks
    const lockKey = `${userId}-${documentId}-${chapterTitle || 'all'}-${Date.now() - (Date.now() % 5000)}`;
    if (activeGenerations.has(lockKey)) {
      return res.status(409).json({
        success: false,
        error: 'A quiz generation is already in progress for this material. Please wait a moment.',
      });
    }

    activeGenerations.add(lockKey);

    try {
      const questionCount = Math.max(1, Math.min(20, Number(count) || 5));
      console.log(
        `[QuizMind RAG] Generating ${questionCount} MCQs (${difficulty || 'Medium'}, ${questionStyle || 'Mixed'}) for "${doc.title}"...`
      );

      // Ensure chunks exist; if not indexed yet, chunk now
      let existingChunks = await firestoreService.getDocumentChunks({
        userId,
        bookId: doc.id,
      });

      if (existingChunks.length === 0) {
        const { chunkDocumentText, indexDocumentChunks } = await loadRag();
        const generatedChunks = chunkDocumentText({
          bookId: doc.id,
          userId,
          text: (typeof sourceText === 'string' && sourceText.trim().length > 80)
            ? sourceText.slice(0, 80000)
            : db.getDocumentText(doc.id, doc.extractedContent),
          chapters: doc.chapters,
        });
        await indexDocumentChunks(generatedChunks);
      }

      // Generate RAG grounded questions using AI Engine
      const aiResponse = await (await loadAI()).generateQuizQuestions({
        userId,
        bookId: doc.id,
        documentTitle: doc.title,
        chapterId,
        chapterTitle,
        sectionId,
        topic,
        questionCount,
        difficulty: difficulty || 'Medium',
        questionStyle: questionStyle || 'Mixed',
      });

      const quizId = `quiz-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newQuiz: Quiz = {
        id: quizId,
        userId,
        documentId: doc.id,
        documentTitle: doc.title,
        title: chapterTitle ? `${chapterTitle} Mastery Quiz` : `${doc.title} Comprehensive Quiz`,
        createdAt: new Date().toISOString(),
        questionType: (questionType as any) || 'multiple_choice',
        difficulty: difficulty || 'Medium',
        chapterId,
        chapterTitle,
        topic,
        questions: aiResponse.questions,
      };

      db.saveQuiz(newQuiz);

      // Automatically initialize a persistent QuizSession for resume capability
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const session: QuizSession = {
        id: sessionId,
        userId,
        bookId: doc.id,
        documentTitle: doc.title,
        chapterId,
        chapterTitle,
        sectionId,
        quizConfiguration: {
          questionCount,
          difficulty: difficulty || 'Medium',
          questionStyle: questionStyle || 'Mixed',
          topic,
        },
        questions: aiResponse.questions,
        currentQuestionIndex: 0,
        answers: {},
        score: 0,
        correctCount: 0,
        incorrectCount: 0,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'in_progress',
      };

      await firestoreService.saveSession(session);

      res.json({
        success: true,
        data: newQuiz,
        session,
      });
    } catch (err: any) {
      console.error('[QuizMind RAG] Quiz generation error:', err);
      const isRateLimit = err?.status === 429 || err?.message?.includes('429');
      res.status(isRateLimit ? 429 : 500).json({
        success: false,
        error: isRateLimit 
          ? 'AI generation rate limit exceeded. Please wait a minute before generating more quizzes.' 
          : (err.message || 'Failed to generate quiz questions with AI'),
      });
    } finally {
      activeGenerations.delete(lockKey);
    }
  };

  app.post('/api/quizzes/generate', handleQuizGeneration);
  app.post('/api/quiz/generate', handleQuizGeneration); // backward compatibility

  // Practice My Weak Areas API
  app.post('/api/quizzes/practice-weak-areas', async (req, res) => {
    try {
      const userId = getUserId(req);
      const quota = db.checkQuota(userId, 'generate_quiz');
      if (!quota.allowed) {
        return res.status(429).json({ success: false, error: quota.message });
      }

      const analytics = db.getAnalytics(userId);
      if (!analytics.weakTopics || analytics.weakTopics.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No weak areas identified yet! Complete more quizzes to discover topics needing reinforcement.',
        });
      }

      const targetWeak = analytics.weakTopics[0];
      const userDocs = db.getDocuments(userId);
      const targetDoc =
        (targetWeak.bookTitle && userDocs.find((d) => d.title === targetWeak.bookTitle)) ||
        userDocs[0];

      if (!targetDoc) {
        return res.status(404).json({
          success: false,
          error: 'No study materials found. Please upload your textbook or notes first.',
        });
      }

      console.log(
        `[QuizMind] Generating Weak-Area Practice on "${targetWeak.topic}" from "${targetDoc.title}" for user: ${userId}...`
      );

      const aiResponse = await (await loadAI()).generateQuizQuestions({
        userId,
        bookId: targetDoc.id,
        documentTitle: targetDoc.title,
        topic: targetWeak.topic,
        chapterTitle: targetWeak.suggestedChapter,
        questionCount: 5,
        difficulty: targetWeak.accuracy < 50 ? 'Easy' : 'Medium',
        questionStyle: 'Conceptual',
      });

      const quizId = `quiz-weak-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const quizTitle = `Targeted Mastery: ${targetWeak.topic}`;

      const newQuiz: Quiz = {
        id: quizId,
        userId,
        documentId: targetDoc.id,
        documentTitle: targetDoc.title,
        title: quizTitle,
        createdAt: new Date().toISOString(),
        questionType: 'multiple_choice',
        difficulty: targetWeak.accuracy < 50 ? 'Easy' : 'Medium',
        topic: targetWeak.topic,
        chapterTitle: targetWeak.suggestedChapter,
        questions: aiResponse.questions,
      };

      db.saveQuiz(newQuiz);

      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const session: QuizSession = {
        id: sessionId,
        userId,
        bookId: targetDoc.id,
        documentTitle: targetDoc.title,
        chapterTitle: targetWeak.suggestedChapter,
        quizConfiguration: {
          questionCount: newQuiz.questions.length,
          difficulty: targetWeak.accuracy < 50 ? 'Easy' : 'Medium',
          questionStyle: 'Conceptual',
          topic: targetWeak.topic,
        },
        questions: newQuiz.questions,
        currentQuestionIndex: 0,
        answers: {},
        score: 0,
        correctCount: 0,
        incorrectCount: 0,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'in_progress',
      };

      await firestoreService.saveSession(session);

      res.json({ success: true, data: newQuiz, session });
    } catch (err: any) {
      console.error('[QuizMind] Practice weak areas error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to generate weak areas quiz',
      });
    }
  });

  // Persistent Quiz Sessions API
  app.get('/api/quiz-sessions/active', async (req, res) => {
    try {
      const userId = getUserId(req);
      const activeSession = await firestoreService.getActiveSession(userId);
      res.json({ success: true, data: activeSession });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/quiz-sessions/:sessionId', async (req, res) => {
    try {
      const userId = getUserId(req);
      const session = await firestoreService.getSession(userId, req.params.sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Quiz session not found' });
      }
      res.json({ success: true, data: session });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/quiz-sessions/:sessionId/answer', async (req, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;
      const { questionId, userAnswer, nextQuestionIndex, isFinished } = req.body;

      const session = await firestoreService.getSession(userId, sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Quiz session not found' });
      }

      const question = session.questions.find((q) => q.id === questionId);
      if (!question) {
        return res.status(404).json({ success: false, error: 'Question not found in this session' });
      }

      // Evaluate answer
      const isCorrect =
        String(userAnswer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase();

      const sessionAnswer = {
        questionId,
        userAnswer: String(userAnswer).trim(),
        isCorrect,
        explanation: question.explanation,
        sourceReferences: question.sourceReferences || [],
        answeredAt: new Date().toISOString(),
      };

      const updatedSession = await firestoreService.saveSessionAnswer({
        userId,
        sessionId,
        answer: sessionAnswer,
        nextQuestionIndex: typeof nextQuestionIndex === 'number' ? nextQuestionIndex : session.currentQuestionIndex,
        isFinished: !!isFinished,
      });

      res.json({
        success: true,
        data: {
          session: updatedSession,
          evaluation: sessionAnswer,
        },
      });
    } catch (err: any) {
      console.error('[QuizMind] Answer submit error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/quiz-sessions/:sessionId/complete', async (req, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId } = req.params;
      const { timeSpentSeconds } = req.body;

      const result = await firestoreService.completeSession({
        userId,
        sessionId,
        timeSpentSeconds: Number(timeSpentSeconds) || 60,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[QuizMind] Complete session error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Explain More / Explain in Simpler Words using RAG
  app.post('/api/quiz-sessions/:sessionId/explain', async (req, res) => {
    const userId = getUserId(req);
    const rateLimitKey = `explain-${userId}`;

    if (isRateLimited(rateLimitKey, 20, 60000)) {
      return res.status(429).json({
        success: false,
        error: 'Too many explanation requests. Please wait a moment.',
      });
    }

    try {
      const { sessionId } = req.params;
      const { questionId, style } = req.body; // 'more' | 'simpler'

      const session = await firestoreService.getSession(userId, sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Quiz session not found' });
      }

      const question = session.questions.find((q) => q.id === questionId);
      if (!question) {
        return res.status(404).json({ success: false, error: 'Question not found' });
      }

      const answerRecord = session.answers[questionId];

      const aiResponse = await (await loadAI()).explainConcept({
        userId,
        bookId: session.bookId,
        question: question.question,
        correctAnswer: question.correctAnswer,
        userAnswer: answerRecord?.userAnswer,
        originalExplanation: question.explanation,
        style: style === 'simpler' ? 'simpler' : 'more',
      });

      res.json({
        success: true,
        data: aiResponse,
      });
    } catch (err: any) {
      console.error('[QuizMind RAG] Deep explanation error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Legacy submit route
  app.post('/api/quiz/submit', async (req, res) => {
    try {
      const { quizId, answers, timeSpentSeconds } = req.body;
      const quiz = db.getQuizById(quizId);
      if (!quiz) {
        return res.status(404).json({ success: false, error: 'Quiz not found' });
      }

      const gradedAnswers: any[] = [];
      let correctCount = 0;

      for (const q of quiz.questions) {
        const userAns = answers?.[q.id] ?? '';
        const isCorrect =
          String(userAns).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
        if (isCorrect) correctCount++;
        gradedAnswers.push({
          questionId: q.id,
          userAnswer: String(userAns),
          isCorrect,
          explanation: q.explanation,
          sourceReferences: q.sourceReferences,
        });
      }

      const score = Math.round((correctCount / Math.max(1, quiz.questions.length)) * 100);

      const attemptId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const attempt: QuizAttempt = {
        id: attemptId,
        quizId: quiz.id,
        documentId: quiz.documentId,
        documentTitle: quiz.documentTitle,
        quizTitle: quiz.title,
        date: new Date().toISOString(),
        score,
        correctCount,
        totalCount: quiz.questions.length,
        timeSpentSeconds: Number(timeSpentSeconds) || 60,
        answers: gradedAnswers,
        aiPerformanceInsight:
          score >= 80
            ? 'Strong performance! Excellent grasp of the retrieved concepts.'
            : 'Good effort. Review the source references to reinforce understanding.',
      };

      db.saveAttempt(attempt);
      res.json({ success: true, data: attempt });
    } catch (err: any) {
      console.error('[QuizMind] Quiz submit error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/quiz/attempts', (req, res) => {
    try {
      const userId = getUserId(req);
      const documentId = req.query.documentId as string | undefined;
      const attempts = db.getAttempts(documentId, userId);
      res.json({ success: true, data: attempts });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Flashcards
  app.all('/api/flashcards/:documentId', async (req, res) => {
    try {
      const userId = getUserId(req);
      const { documentId } = req.params;
      const chapterId = String(req.body?.chapterId || req.query.chapterId || '');
      const chapterTitle = String(req.body?.chapterTitle || req.query.chapterTitle || '');
      const incomingText = typeof req.body?.sourceText === 'string' ? req.body.sourceText : '';
      const existing = db.getFlashcards(documentId, userId);
      const doc = db.getDocumentById(documentId, userId);
      if (!doc) {
        return res.status(404).json({ success: false, error: 'Document not found or access denied' });
      }

      const chapters = doc.chapters || [];
      const chapter = chapters.find((c) => c.id === chapterId || c.title === chapterTitle);

      const stop = new Set(['this', 'that', 'with', 'from', 'what', 'when', 'where', 'which', 'have', 'been', 'they', 'them', 'your', 'into', 'than', 'then', 'does', 'during', 'about', 'their']);
      const tokens = (text: string) =>
        text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 3 && !stop.has(w));

      const chapterCorpus = (c: { title: string; summary?: string; keyPoints?: string[] }) =>
        `${c.title} ${c.summary || ''} ${(c.keyPoints || []).join(' ')}`;

      const scoreCardForChapter = (card: Flashcard, c: { title: string; summary?: string; keyPoints?: string[] }) => {
        const hay = chapterCorpus(c);
        const words = new Set(tokens(`${card.topic || ''} ${card.front} ${card.back}`));
        let score = 0;
        words.forEach((w) => {
          if (hay.toLowerCase().includes(w)) score += 1;
        });
        if (card.chapterId && card.chapterId === (c as any).id) score += 20;
        if ((card.chapterTitle || '').toLowerCase() === c.title.toLowerCase()) score += 20;
        return score;
      };

      const bestChapterForCard = (card: Flashcard) => {
        if (card.chapterId) {
          const tagged = chapters.find((c) => c.id === card.chapterId);
          if (tagged) return tagged;
        }
        if (!chapters.length) return undefined;
        let best = chapters[0];
        let bestScore = -1;
        for (const c of chapters) {
          const s = scoreCardForChapter(card, c);
          if (s > bestScore) {
            best = c;
            bestScore = s;
          }
        }
        return bestScore >= 3 ? best : undefined;
      };

      const matchesChapter = (card: Flashcard) => {
        if (!chapterId && !chapterTitle) return true;
        if (chapterId && card.chapterId === chapterId) return true;
        const title = (card.chapterTitle || '').toLowerCase();
        const wanted = (chapterTitle || chapter?.title || '').toLowerCase();
        if (wanted && title && (title === wanted || title.includes(wanted) || wanted.includes(title))) {
          return true;
        }
        const assigned = bestChapterForCard(card);
        return Boolean(assigned && chapter && assigned.id === chapter.id);
      };

      const scoped = existing.filter(matchesChapter);
      if (scoped.length > 0) {
        const tagged = scoped.map((card) => {
          if (card.chapterId || !chapter) return card;
          const next = { ...card, chapterId: chapter.id, chapterTitle: chapter.title };
          return next;
        });
        if (tagged.some((card, i) => card.chapterId !== scoped[i].chapterId)) {
          db.saveFlashcards(tagged);
        }
        return res.json({ success: true, data: tagged });
      }
      if (existing.length > 0 && !chapterId && !chapterTitle) {
        return res.json({ success: true, data: existing });
      }

      const storedBookText = incomingText.trim().length > 80
        ? incomingText.slice(0, 80000)
        : db.getDocumentText(doc.id, doc.extractedContent);
      const chapterLabel = chapter?.title || chapterTitle || doc.title;
      let chapterMaterial = storedBookText || (chapter
        ? `${chapter.title}\n${chapter.summary || ''}\n${(chapter.keyPoints || []).join('\n')}`
        : '');

      if (chapter) {
        try {
          const { retrieveRelevantContext } = await loadRag();
          const retrieval = await retrieveRelevantContext({
            userId,
            bookId: doc.id,
            query: `key concepts flashcards ${chapter.title}`,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            chapters,
            topK: 12,
          });
          if (retrieval.contextText) {
            chapterMaterial = `${chapterMaterial}\n\n${retrieval.contextText}`;
          }
        } catch (err) {
          console.warn('[QuizMind] Flashcard RAG fallback to chapter metadata:', err);
        }
      }

      console.log(`[AI Engine] Generating flashcards for ${doc.title} / ${chapterLabel}...`);
      const flashcards = await (await loadAI()).generateFlashcards({
        documentId: doc.id,
        documentTitle: `${doc.title}${chapter ? ` — ${chapter.title}` : ''}`,
        documentContent: chapterMaterial || storedBookText,
        count: chapter ? 6 : 8,
      });

      const newCards: Flashcard[] = flashcards.map((c, i) => ({
        id: `fc-${Date.now()}-${chapter?.id || 'all'}-${i}`,
        userId,
        documentId: doc.id,
        documentTitle: doc.title,
        front: c.front,
        back: c.back,
        topic: c.topic || chapterLabel,
        chapterId: chapter?.id,
        chapterTitle: chapter?.title || chapterTitle || undefined,
        hint: c.hint,
        masteryLevel: 'new',
        reviewCount: 0,
      }));

      db.saveFlashcards(newCards);
      res.json({ success: true, data: newCards });
    } catch (err: any) {
      console.error('[QuizMind] Flashcard error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/flashcards/update', (req, res) => {
    try {
      const userId = getUserId(req);
      const { id, status } = req.body;
      const updated = db.updateFlashcardStatus(id, status, userId);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Flashcard not found or ownership mismatch' });
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // AI Document Tutor Chat with RAG, Grounding & Persistent Conversations
  app.get('/api/tutor/conversations', (req, res) => {
    try {
      const userId = getUserId(req);
      const documentId = req.query.documentId as string | undefined;
      const conversations = db.getConversations(userId, documentId);
      res.json({ success: true, data: conversations });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/tutor/conversations/:id', (req, res) => {
    try {
      const userId = getUserId(req);
      const success = db.deleteConversation(userId, req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/tutor/chat', async (req, res) => {
    try {
      const userId = getUserId(req);
      const { documentId, messages, userQuestion, action, conversationId, sourceText } = req.body;

      // Rate limit check
      const clientIp = req.ip || '127.0.0.1';
      if (isRateLimited(`tutor-${userId}-${clientIp}`, 20, 60000)) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Please wait a moment before sending another message to your AI Tutor.',
        });
      }

      // Quota check
      const quota = db.checkQuota(userId, 'tutor_chat');
      if (!quota.allowed) {
        return res.status(429).json({ success: false, error: quota.message });
      }

      // Ownership verification
      const doc = db.getDocumentById(documentId, userId);
      if (!doc) {
        return res.status(404).json({ success: false, error: 'Study material not found or access denied' });
      }

      if (typeof sourceText === 'string' && sourceText.trim().length > 80) {
        const bookSlice = sourceText.slice(0, 80000);
        db.saveDocumentText(doc.id, bookSlice);
        const { chunkDocumentText, indexDocumentChunks } = await loadRag();
        const generatedChunks = chunkDocumentText({
          bookId: doc.id,
          userId,
          text: bookSlice,
          chapters: doc.chapters,
        });
        await indexDocumentChunks(generatedChunks.slice(0, 24));
      }

      const tutorResponse = await (await loadAI()).answerTutorQuestion({
        userId,
        bookId: doc.id,
        documentTitle: doc.title,
        userQuestion: String(userQuestion || '').trim(),
        messages: Array.isArray(messages) ? messages : [],
        action: action || 'standard',
      });

      // Persist conversation
      const now = new Date().toISOString();
      const userMsg = {
        id: `msg-${Date.now()}-u`,
        role: 'user' as const,
        content: userQuestion,
        timestamp: now,
      };
      const assistantMsg = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant' as const,
        content: tutorResponse.reply,
        timestamp: new Date(Date.now() + 50).toISOString(),
        citations: tutorResponse.citations,
        sourceReferences: tutorResponse.sourceReferences,
      };

      let conv = conversationId ? db.getConversation(userId, conversationId) : undefined;
      if (!conv) {
        const titleSnippet = userQuestion.slice(0, 40) + (userQuestion.length > 40 ? '...' : '');
        conv = {
          id: conversationId || `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId,
          bookId: doc.id,
          bookTitle: doc.title,
          createdAt: now,
          updatedAt: now,
          messages: [userMsg, assistantMsg],
        };
      } else {
        conv.messages.push(userMsg, assistantMsg);
        conv.updatedAt = now;
      }
      db.saveConversation(conv);

      res.json({
        success: true,
        data: {
          ...tutorResponse,
          conversationId: conv.id,
        },
      });
    } catch (err: any) {
      console.error('[QuizMind] Tutor chat error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin API Endpoints ───────────────────────────────────────────────────
  const isAdmin = (req: express.Request): boolean => {
    const uid = getUserId(req);
    const adminToken = process.env.ADMIN_API_TOKEN || '';
    return (Boolean(adminToken) && req.headers['x-admin-token'] === adminToken) || !!uid;
  };

  // GET all users across the platform (from JSON DB documents)
  app.get('/api/admin/stats', (req, res) => {
    try {
      const data = (db as any).getAllData();
      const totalDocs = data.documents.length;
      const totalQuizzes = data.quizzes.length;
      const totalAttempts = data.attempts.length;
      const totalFlashcards = data.flashcards.length;
      const totalChunks = data.chunks.length;

      // Unique users by userId across documents
      const userIds = new Set<string>();
      (data.users || []).forEach((u: any) => { if (u.uid && u.uid !== 'default-user') userIds.add(u.uid); });
      data.documents.forEach((d: any) => { if (d.userId && d.userId !== 'default-user') userIds.add(d.userId); });
      data.attempts.forEach((a: any) => { if (a.userId && a.userId !== 'default-user') userIds.add(a.userId); });

      // Active today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activeToday = data.attempts.filter((a: any) => {
        const d = new Date(a.date);
        return d >= today;
      }).length;

      // Average score
      const avgScore = data.attempts.length > 0
        ? Math.round(data.attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / data.attempts.length)
        : 0;

      res.json({
        success: true,
        data: {
          totalUsers: userIds.size,
          totalDocuments: totalDocs,
          totalQuizzes,
          totalAttempts,
          totalFlashcards,
          totalChunks,
          activeToday,
          avgScore,
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET all documents across all users
  app.get('/api/admin/documents', (req, res) => {
    try {
      const data = (db as any).getAllData();
      res.json({ success: true, data: data.documents });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE any document (admin force-delete, no ownership check)
  app.delete('/api/admin/documents/:id', (req, res) => {
    try {
      const deleted = (db as any).adminDeleteDocument(req.params.id);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET all quiz attempts across all users
  app.get('/api/admin/attempts', (req, res) => {
    try {
      const data = (db as any).getAllData();
      res.json({ success: true, data: data.attempts });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET all users (profiles + activity counts)
  app.get('/api/admin/users', (req, res) => {
    try {
      const data = (db as any).getAllData();
      const userMap = new Map<string, any>();

      for (const profile of data.users || []) {
        if (!profile.uid || profile.uid === 'default-user') continue;
        userMap.set(profile.uid, {
          uid: profile.uid,
          email: profile.email || '',
          displayName: profile.displayName || '',
          role: profile.role || 'user',
          documentsCount: 0,
          quizzesCount: 0,
          lastActive: profile.lastLoginAt || profile.createdAt || null,
        });
      }

      data.documents.forEach((d: any) => {
        if (!d.userId || d.userId === 'default-user') return;
        if (!userMap.has(d.userId)) {
          userMap.set(d.userId, {
            uid: d.userId,
            email: '',
            displayName: '',
            role: 'user',
            documentsCount: 0,
            quizzesCount: 0,
            lastActive: d.uploadDate || null,
          });
        }
        userMap.get(d.userId).documentsCount++;
        const stamp = d.uploadDate || d.lastStudiedAt;
        if (stamp && (!userMap.get(d.userId).lastActive || stamp > userMap.get(d.userId).lastActive)) {
          userMap.get(d.userId).lastActive = stamp;
        }
      });

      data.attempts.forEach((a: any) => {
        if (!a.userId || a.userId === 'default-user') return;
        if (!userMap.has(a.userId)) {
          userMap.set(a.userId, {
            uid: a.userId,
            email: '',
            displayName: '',
            role: 'user',
            documentsCount: 0,
            quizzesCount: 0,
            lastActive: a.date || null,
          });
        }
        userMap.get(a.userId).quizzesCount++;
        if (a.date && (!userMap.get(a.userId).lastActive || a.date > userMap.get(a.userId).lastActive)) {
          userMap.get(a.userId).lastActive = a.date;
        }
      });

      const users = Array.from(userMap.values()).sort((a, b) =>
        String(b.lastActive || '').localeCompare(String(a.lastActive || ''))
      );
      res.json({ success: true, data: users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE all data for a specific user
  app.delete('/api/admin/users/:uid', (req, res) => {
    try {
      const deleted = (db as any).adminDeleteUser(req.params.uid);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Keys never leave the server — the admin UI only ever sees a masked preview.
  const presentAISettings = async (settings: AISettings) => {
    const { maskKey, resolveGroqKey, resolveGeminiKey } = await loadProviders();
    return {
      provider: settings.provider === 'gemini' ? 'gemini' : 'groq',
      groqModel: settings.groqModel || '',
      geminiModel: settings.geminiModel || '',
      groqKeyMasked: maskKey(resolveGroqKey(settings)),
      geminiKeyMasked: maskKey(resolveGeminiKey(settings)),
      hasGroqKey: Boolean(resolveGroqKey(settings)),
      hasGeminiKey: Boolean(resolveGeminiKey(settings)),
    };
  };

  // GET AI Settings
  app.get('/api/admin/settings/ai', async (req, res) => {
    try {
      if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Access denied' });
      const settings: AISettings = (db as any).getAISettings();
      const { listAvailableModels } = await loadProviders();
      const models = await listAvailableModels(settings);
      res.json({ success: true, data: { ...(await presentAISettings(settings)), models } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST AI Settings
  app.post('/api/admin/settings/ai', async (req, res) => {
    try {
      if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Access denied' });
      const current: AISettings = (db as any).getAISettings();
      const body = req.body || {};

      const provider = body.provider === 'gemini' ? 'gemini' : body.provider === 'groq' ? 'groq' : undefined;
      if (body.provider && !provider) {
        return res.status(400).json({ success: false, error: 'Provider must be "groq" or "gemini".' });
      }

      const next: AISettings = { ...current };
      if (provider) next.provider = provider;

      const groqModel = typeof body.groqModel === 'string' ? body.groqModel.trim() : '';
      if (groqModel) next.groqModel = groqModel;
      const geminiModel = typeof body.geminiModel === 'string' ? body.geminiModel.trim() : '';
      if (geminiModel) next.geminiModel = geminiModel;

      // Blank means "leave the stored key alone" so saving never wipes a working key.
      const groqKey = typeof body.groqKey === 'string' ? body.groqKey.trim() : '';
      if (groqKey) next.groqKey = groqKey;
      const geminiKey = typeof body.geminiKey === 'string' ? body.geminiKey.trim() : '';
      if (geminiKey) next.geminiKey = geminiKey;

      const { resolveGeminiKey, resolveGroqKey, testProviderConnection, listAvailableModels } = await loadProviders();
      const activeProvider = next.provider === 'gemini' ? 'gemini' : 'groq';
      const activeKey = activeProvider === 'gemini' ? resolveGeminiKey(next) : resolveGroqKey(next);
      if (!activeKey) {
        return res.status(400).json({
          success: false,
          error: `No API key configured for ${activeProvider}. Add a key before activating this provider.`,
        });
      }

      const check = await testProviderConnection({
        provider: activeProvider,
        model: activeProvider === 'gemini' ? next.geminiModel : next.groqModel,
        apiKey: activeKey,
      });
      if (!check.ok) {
        return res.status(400).json({ success: false, error: `Not saved — ${check.message}` });
      }

      (db as any).saveAISettings(next);
      const models = await listAvailableModels(next);
      res.json({ success: true, data: { ...(await presentAISettings(next)), models } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Verify a provider/model/key combination without saving it
  app.post('/api/admin/settings/ai/test', async (req, res) => {
    try {
      if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Access denied' });
      const body = req.body || {};
      const { testProviderConnection } = await loadProviders();
      const provider = body.provider === 'gemini' ? 'gemini' : 'groq';
      const result = await testProviderConnection({
        provider,
        model: typeof body.model === 'string' ? body.model : undefined,
        apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
      });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Analytics & Stats
  app.get('/api/analytics', (req, res) => {
    try {
      const userId = getUserId(req);
      const analytics = db.getAnalytics(userId);
      res.json({ success: true, data: analytics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // On Vercel the frontend is served from /dist; this function only handles /api.
  if (!isVercel) {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  return app;
}

if (!isVercel) {
  createApp()
    .then((app) => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[QuizMind AI] Server running at http://0.0.0.0:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start QuizMind AI server:', err);
    });
}
