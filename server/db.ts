import fs from 'fs';
import path from 'path';
import { isAdminEmail } from './admin';
import {
  DocumentItem,
  Quiz,
  QuizAttempt,
  Flashcard,
  StudyAnalytics,
  QuizSession,
  DocumentChunk,
  TutorConversation,
  WeakTopicItem,
  AIStudyRecommendation,
  AccuracyTrendItem,
  ChapterProgressItem,
  AISettings,
  PlatformUser,
} from '../src/types';

interface DatabaseSchema {
  documents: DocumentItem[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  flashcards: Flashcard[];
  sessions: QuizSession[];
  chunks: DocumentChunk[];
  conversations: TutorConversation[];
  users: PlatformUser[];
  aiSettings?: AISettings;
}

const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'quizmind-data')
  : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'quizmind.json');

let memoryAiSettings: AISettings | null = null;

function ensureDbFile(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initial: DatabaseSchema = {
      documents: [],
      quizzes: [],
      attempts: [],
      flashcards: [],
      sessions: [],
      chunks: [],
      conversations: [],
      users: [],
      aiSettings: {
        provider: 'groq',
        groqModel: 'openai/gpt-oss-20b',
        geminiModel: 'gemini-3.6-flash',
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }

  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.documents) parsed.documents = [];
    if (!parsed.quizzes) parsed.quizzes = [];
    if (!parsed.attempts) parsed.attempts = [];
    if (!parsed.flashcards) parsed.flashcards = [];
    if (!parsed.sessions) parsed.sessions = [];
    if (!parsed.chunks) parsed.chunks = [];
    if (!parsed.conversations) parsed.conversations = [];
    if (!parsed.users) parsed.users = [];
    let repaired = false;
    const ownerByDoc = new Map(
      (parsed.documents || [])
        .filter((d: DocumentItem) => d.id && d.userId)
        .map((d: DocumentItem) => [d.id, d.userId as string])
    );
    for (const attempt of parsed.attempts || []) {
      if (!attempt.userId && attempt.documentId && ownerByDoc.has(attempt.documentId)) {
        attempt.userId = ownerByDoc.get(attempt.documentId);
        repaired = true;
      }
    }
    for (const quiz of parsed.quizzes || []) {
      if (!quiz.userId && quiz.documentId && ownerByDoc.has(quiz.documentId)) {
        quiz.userId = ownerByDoc.get(quiz.documentId);
        repaired = true;
      }
    }
    if (repaired) {
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    if (!parsed.aiSettings) {
      parsed.aiSettings = {
        provider: 'groq',
        groqModel: 'openai/gpt-oss-20b',
        geminiModel: 'gemini-3.6-flash',
      };
    }
    return parsed;
  } catch {
    const initial: DatabaseSchema = {
      documents: [],
      quizzes: [],
      attempts: [],
      flashcards: [],
      sessions: [],
      chunks: [],
      conversations: [],
      users: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

function saveDb(data: DatabaseSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export const db = {
  getDocuments(userId?: string): DocumentItem[] {
    const data = ensureDbFile();
    let docs = data.documents;
    if (userId && userId !== 'default-user') {
      docs = docs.filter((d) => d.userId === userId);
    }

    // Enrich each book with live real progress and lastStudiedAt from genuine attempts
    return docs.map((doc) => {
      const docAttempts = data.attempts.filter((a) => a.documentId === doc.id && (!userId || a.userId === userId));
      let lastStudiedAt: string | undefined = doc.lastStudiedAt;
      let progress = doc.progress || 0;

      if (docAttempts.length > 0) {
        // Sort attempts descending by date
        const sorted = [...docAttempts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        lastStudiedAt = sorted[0].date;

        // Calculate real chapter coverage: how many unique chapters or quizzes completed
        const testedChapters = new Set<string>();
        for (const att of docAttempts) {
          if (att.quizTitle) testedChapters.add(att.quizTitle);
        }
        const totalChapters = Math.max(1, doc.chapters?.length || 1);
        progress = Math.min(100, Math.round((testedChapters.size / totalChapters) * 100));
      }

      return {
        ...doc,
        processingStatus: doc.processingStatus || 'ready',
        lastStudiedAt,
        progress,
      };
    });
  },

  getDocumentById(id: string, userId?: string): DocumentItem | undefined {
    const data = ensureDbFile();
    const doc = data.documents.find((d) => d.id === id);
    if (!doc) return undefined;
    if (userId && userId !== 'default-user' && doc.userId && doc.userId !== userId) {
      return undefined;
    }
    return doc;
  },

  saveDocument(doc: DocumentItem): DocumentItem {
    const data = ensureDbFile();
    if (!doc.processingStatus) {
      doc.processingStatus = 'ready';
    }
    const index = data.documents.findIndex((d) => d.id === doc.id);
    if (index >= 0) {
      data.documents[index] = { ...data.documents[index], ...doc };
    } else {
      data.documents.unshift(doc);
    }
    saveDb(data);
    return doc;
  },

  deleteDocument(id: string, userId?: string): boolean {
    const data = ensureDbFile();
    const target = data.documents.find((d) => d.id === id);
    if (!target) return false;

    // Strict ownership verification: prevent deleting another user's book
    if (userId && userId !== 'default-user' && target.userId && target.userId !== userId) {
      console.warn(`[QuizMind Security] User ${userId} denied deletion of document ${id} owned by ${target.userId}`);
      return false;
    }

    const initialLength = data.documents.length;
    data.documents = data.documents.filter((d) => d.id !== id);
    data.chunks = data.chunks.filter((c) => c.bookId !== id);
    data.quizzes = data.quizzes.filter((q) => q.documentId !== id);
    data.attempts = data.attempts.filter((a) => a.documentId !== id);
    data.flashcards = data.flashcards.filter((f) => f.documentId !== id);
    data.sessions = data.sessions.filter((s) => s.bookId !== id);
    data.conversations = data.conversations.filter((c) => c.bookId !== id);

    saveDb(data);
    return data.documents.length < initialLength;
  },

  getQuizzes(documentId?: string, userId?: string): Quiz[] {
    const data = ensureDbFile();
    let quizzes = data.quizzes;
    if (userId && userId !== 'default-user') {
      quizzes = quizzes.filter((q) => q.userId === userId || !q.userId);
    }
    if (documentId) {
      quizzes = quizzes.filter((q) => q.documentId === documentId);
    }
    return quizzes;
  },

  getQuizById(id: string, userId?: string): Quiz | undefined {
    const data = ensureDbFile();
    const quiz = data.quizzes.find((q) => q.id === id);
    if (!quiz) return undefined;
    if (userId && userId !== 'default-user' && quiz.userId && quiz.userId !== userId) {
      return undefined;
    }
    return quiz;
  },

  saveQuiz(quiz: Quiz): Quiz {
    const data = ensureDbFile();
    const index = data.quizzes.findIndex((q) => q.id === quiz.id);
    if (index >= 0) {
      data.quizzes[index] = quiz;
    } else {
      data.quizzes.unshift(quiz);
    }

    // Also update document totalQuizzesGenerated
    const doc = data.documents.find((d) => d.id === quiz.documentId);
    if (doc) {
      doc.totalQuizzesGenerated = (doc.totalQuizzesGenerated || 0) + 1;
    }

    saveDb(data);
    return quiz;
  },

  getAttempts(documentId?: string, userId?: string): QuizAttempt[] {
    const data = ensureDbFile();
    let attempts = data.attempts;
    if (userId && userId !== 'default-user') {
      attempts = attempts.filter((a) => a.userId === userId || !a.userId);
    }
    if (documentId) {
      attempts = attempts.filter((a) => a.documentId === documentId);
    }
    return attempts;
  },

  saveAttempt(attempt: QuizAttempt): QuizAttempt {
    const data = ensureDbFile();
    data.attempts.unshift(attempt);

    // Update document average quiz score and lastStudiedAt
    const docAttempts = data.attempts.filter((a) => a.documentId === attempt.documentId);
    if (docAttempts.length > 0) {
      const avg = Math.round(
        docAttempts.reduce((acc, curr) => acc + curr.score, 0) / docAttempts.length
      );
      const doc = data.documents.find((d) => d.id === attempt.documentId);
      if (doc) {
        doc.averageQuizScore = avg;
        doc.lastStudiedAt = attempt.date;
      }
    }

    saveDb(data);
    return attempt;
  },

  getFlashcards(documentId?: string, userId?: string): Flashcard[] {
    const data = ensureDbFile();
    let cards = data.flashcards;
    if (userId && userId !== 'default-user') {
      cards = cards.filter((f) => f.userId === userId || !f.userId);
    }
    if (documentId) {
      cards = cards.filter((f) => f.documentId === documentId);
    }
    return cards;
  },

  saveFlashcards(cards: Flashcard[]): Flashcard[] {
    const data = ensureDbFile();
    for (const card of cards) {
      const idx = data.flashcards.findIndex((f) => f.id === card.id);
      if (idx >= 0) {
        data.flashcards[idx] = card;
      } else {
        data.flashcards.push(card);
      }
    }
    saveDb(data);
    return cards;
  },

  updateFlashcardStatus(id: string, status: 'new' | 'learning' | 'mastered', userId?: string): Flashcard | null {
    const data = ensureDbFile();
    const card = data.flashcards.find((f) => f.id === id);
    if (!card) return null;
    if (userId && userId !== 'default-user' && card.userId && card.userId !== userId) {
      return null;
    }
    card.masteryLevel = status;
    card.reviewCount = (card.reviewCount || 0) + 1;
    card.lastReviewed = new Date().toISOString();
    saveDb(data);
    return card;
  },

  getAnalytics(userId?: string): StudyAnalytics {
    const data = ensureDbFile();
    const isUserScoped = userId && userId !== 'default-user';

    const userDocs = isUserScoped ? data.documents.filter((d) => d.userId === userId) : data.documents;
    const userAttempts = isUserScoped ? data.attempts.filter((a) => a.userId === userId || !a.userId) : data.attempts;
    const userCards = isUserScoped ? data.flashcards.filter((f) => f.userId === userId || !f.userId) : data.flashcards;

    const totalDocuments = userDocs.length;
    const totalQuizzesTaken = userAttempts.length;

    // Honest empty state when no history exists
    if (totalQuizzesTaken === 0) {
      return {
        totalDocuments,
        totalQuizzesTaken: 0,
        averageScore: 0,
        totalQuestionsSolved: 0,
        flashcardsMastered: userCards.filter((f) => f.masteryLevel === 'mastered').length,
        studyStreakDays: 0,
        totalStudyTimeMinutes: 0,
        recentAttempts: [],
        topTopics: [],
        weakTopics: [],
        recommendations: [],
        accuracyTrend: [],
        chapterProgress: [],
      };
    }

    const averageScore = Math.round(userAttempts.reduce((sum, a) => sum + a.score, 0) / totalQuizzesTaken);
    const totalQuestionsSolved = userAttempts.reduce((sum, a) => sum + (a.totalCount || 0), 0);
    const flashcardsMastered = userCards.filter((f) => f.masteryLevel === 'mastered').length;
    const totalStudyTimeMinutes = Math.round(
      userAttempts.reduce((sum, a) => sum + (a.timeSpentSeconds || 60), 0) / 60
    );

    // Calculate actual active study days for streak
    const uniqueDays = new Set(userAttempts.map((a) => a.date.slice(0, 10)));
    const studyStreakDays = uniqueDays.size;

    // Accuracy Trend: chronological recent attempts
    const accuracyTrend: AccuracyTrendItem[] = [...userAttempts]
      .reverse()
      .slice(-10)
      .map((att) => ({
        date: att.date.slice(0, 10),
        score: att.score,
        quizTitle: att.quizTitle || att.documentTitle || 'Quiz',
      }));

    // Real topic performance breakdown & Weak-Topic Analysis
    const topicStats: Record<
      string,
      {
        totalQuestions: number;
        incorrectCount: number;
        lastTestedDate: string;
        bookTitle?: string;
        suggestedChapter?: string;
        suggestedPage?: number;
      }
    > = {};

    for (const attempt of userAttempts) {
      const fallbackTopic = attempt.documentTitle || 'General Topic';

      if (Array.isArray(attempt.answers) && attempt.answers.length > 0) {
        for (const ans of attempt.answers) {
          const topicName = ans.sourceReferences?.[0]?.chapter || fallbackTopic;
          if (!topicStats[topicName]) {
            topicStats[topicName] = {
              totalQuestions: 0,
              incorrectCount: 0,
              lastTestedDate: attempt.date,
              bookTitle: attempt.documentTitle,
              suggestedChapter: ans.sourceReferences?.[0]?.chapter,
              suggestedPage: ans.sourceReferences?.[0]?.page || ans.sourceReferences?.[0]?.pageNumber,
            };
          }
          topicStats[topicName].totalQuestions += 1;
          if (!ans.isCorrect) {
            topicStats[topicName].incorrectCount += 1;
          }
        }
      } else {
        // Fallback to overall attempt score
        if (!topicStats[fallbackTopic]) {
          topicStats[fallbackTopic] = {
            totalQuestions: 0,
            incorrectCount: 0,
            lastTestedDate: attempt.date,
            bookTitle: attempt.documentTitle,
          };
        }
        topicStats[fallbackTopic].totalQuestions += attempt.totalCount || 5;
        topicStats[fallbackTopic].incorrectCount += (attempt.totalCount || 5) - (attempt.correctCount || 0);
      }
    }

    const topTopics = Object.entries(topicStats).map(([topic, stat]) => {
      const accuracy =
        stat.totalQuestions > 0
          ? Math.round(((stat.totalQuestions - stat.incorrectCount) / stat.totalQuestions) * 100)
          : 0;
      return {
        topic,
        score: accuracy,
        count: stat.totalQuestions,
      };
    });

    // Determine real weak topics (accuracy < 75% or high mistake count)
    const weakTopics: WeakTopicItem[] = Object.entries(topicStats)
      .filter(([_, stat]) => stat.incorrectCount > 0)
      .map(([topic, stat]) => {
        const accuracy = Math.round(
          ((stat.totalQuestions - stat.incorrectCount) / Math.max(1, stat.totalQuestions)) * 100
        );
        return {
          topic,
          accuracy,
          incorrectCount: stat.incorrectCount,
          totalQuestions: stat.totalQuestions,
          lastTestedDate: stat.lastTestedDate,
          bookTitle: stat.bookTitle,
          suggestedChapter: stat.suggestedChapter,
          suggestedPage: stat.suggestedPage,
        };
      })
      .sort((a, b) => a.accuracy - b.accuracy || b.incorrectCount - a.incorrectCount)
      .slice(0, 5);

    // Chapter progress derived from user books and attempts
    const chapterProgress: ChapterProgressItem[] = [];
    for (const doc of userDocs) {
      if (doc.chapters) {
        for (const ch of doc.chapters) {
          const chAttempts = userAttempts.filter(
            (a) => a.documentId === doc.id && a.quizTitle.toLowerCase().includes(ch.title.toLowerCase())
          );
          const chScore =
            chAttempts.length > 0
              ? Math.round(chAttempts.reduce((s, a) => s + a.score, 0) / chAttempts.length)
              : 0;
          chapterProgress.push({
            chapterId: ch.id,
            chapterTitle: `${doc.title.slice(0, 20)}: ${ch.title}`,
            quizzesTaken: chAttempts.length,
            averageScore: chScore,
            status: chAttempts.length === 0 ? 'not_started' : chScore >= 80 ? 'mastered' : 'in_progress',
          });
        }
      }
    }

    // Actionable AI Study Recommendations derived from genuine weak topics
    const recommendations: AIStudyRecommendation[] = [];
    if (weakTopics.length > 0) {
      for (const wt of weakTopics.slice(0, 3)) {
        recommendations.push({
          id: `rec-${Math.random().toString(36).substring(2, 7)}`,
          type: 'practice_topic',
          title: `Reinforce ${wt.topic}`,
          actionableStep: wt.suggestedPage
            ? `Revisit Page ${wt.suggestedPage} in "${wt.bookTitle || 'your document'}" and take a focused 5-question review quiz on ${wt.topic}.`
            : `Review the key mechanisms of ${wt.topic} in ${wt.suggestedChapter || 'your study notes'} to boost your accuracy from ${wt.accuracy}%.`,
          targetTopic: wt.topic,
          targetChapter: wt.suggestedChapter,
          targetPage: wt.suggestedPage,
          difficulty: wt.accuracy < 50 ? 'Easy' : 'Medium',
        });
      }
    } else if (userDocs.length > 0) {
      recommendations.push({
        id: `rec-prog-1`,
        type: 'take_quiz',
        title: 'Maintain Active Recall',
        actionableStep: `You have strong mastery across tested topics! Try an Advanced mixed-format quiz on ${userDocs[0].title} to challenge retention.`,
        difficulty: 'Hard',
      });
    }

    return {
      totalDocuments,
      totalQuizzesTaken,
      averageScore,
      totalQuestionsSolved,
      flashcardsMastered,
      studyStreakDays,
      totalStudyTimeMinutes,
      recentAttempts: userAttempts.slice(0, 15),
      topTopics,
      weakTopics,
      recommendations,
      accuracyTrend,
      chapterProgress: chapterProgress.slice(0, 8),
    };
  },

  // Persistent Sessions
  saveSession(session: QuizSession): QuizSession {
    const data = ensureDbFile();
    const idx = data.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      data.sessions[idx] = session;
    } else {
      data.sessions.unshift(session);
    }
    saveDb(data);
    return session;
  },

  getSession(sessionId: string): QuizSession | undefined {
    const data = ensureDbFile();
    return data.sessions.find((s) => s.id === sessionId);
  },

  getActiveSession(userId: string): QuizSession | null {
    const data = ensureDbFile();
    const userSessions = data.sessions
      .filter((s) => s.userId === userId && s.status === 'in_progress')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return userSessions[0] || null;
  },

  getUserSessions(userId: string): QuizSession[] {
    const data = ensureDbFile();
    return data.sessions.filter((s) => s.userId === userId);
  },

  // Document Chunks & RAG
  saveChunks(chunks: DocumentChunk[]): void {
    const data = ensureDbFile();
    for (const chunk of chunks) {
      const idx = data.chunks.findIndex((c) => c.id === chunk.id);
      if (idx >= 0) {
        data.chunks[idx] = chunk;
      } else {
        data.chunks.push(chunk);
      }
    }
    saveDb(data);
  },

  getChunks(params: { userId: string; bookId: string; chapterId?: string; sectionId?: string }): DocumentChunk[] {
    const data = ensureDbFile();
    return data.chunks.filter((c) => {
      if (c.userId !== params.userId && c.userId !== 'default-user') return false;
      if (c.bookId !== params.bookId) return false;
      if (params.chapterId && c.chapterId && c.chapterId !== params.chapterId) return false;
      if (params.sectionId && c.sectionId && c.sectionId !== params.sectionId) return false;
      return true;
    });
  },

  // AI Tutor Conversations per user & book
  getConversations(userId: string, bookId?: string): TutorConversation[] {
    const data = ensureDbFile();
    return data.conversations.filter(
      (c) => (c.userId === userId || c.userId === 'default-user') && (!bookId || c.bookId === bookId)
    );
  },

  getConversation(userId: string, conversationId: string): TutorConversation | undefined {
    const data = ensureDbFile();
    return data.conversations.find(
      (c) => c.id === conversationId && (c.userId === userId || c.userId === 'default-user')
    );
  },

  saveConversation(conv: TutorConversation): TutorConversation {
    const data = ensureDbFile();
    const idx = data.conversations.findIndex((c) => c.id === conv.id);
    if (idx >= 0) {
      data.conversations[idx] = conv;
    } else {
      data.conversations.unshift(conv);
    }
    saveDb(data);
    return conv;
  },

  deleteConversation(userId: string, conversationId: string): boolean {
    const data = ensureDbFile();
    const initial = data.conversations.length;
    data.conversations = data.conversations.filter(
      (c) => !(c.id === conversationId && (c.userId === userId || c.userId === 'default-user'))
    );
    saveDb(data);
    return data.conversations.length < initial;
  },

  // Usage Quota Check: enforce maximum books, quiz generations, and tutor requests
  checkQuota(
    userId: string,
    action: 'upload_book' | 'generate_quiz' | 'tutor_chat'
  ): { allowed: boolean; message?: string } {
    const data = ensureDbFile();
    const userDocs = data.documents.filter((d) => d.userId === userId);

    if (action === 'upload_book') {
      const MAX_BOOKS = 10;
      if (userDocs.length >= MAX_BOOKS) {
        return {
          allowed: false,
          message: `You have reached the maximum limit of ${MAX_BOOKS} uploaded books. Please delete an older book to upload a new one.`,
        };
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    if (action === 'generate_quiz') {
      const MAX_DAILY_QUIZZES = 30;
      const todayQuizzes = data.quizzes.filter(
        (q) => q.userId === userId && q.createdAt && q.createdAt.startsWith(todayStr)
      );
      if (todayQuizzes.length >= MAX_DAILY_QUIZZES) {
        return {
          allowed: false,
          message: `Daily quiz generation limit (${MAX_DAILY_QUIZZES}/day) reached. Your limit resets tomorrow.`,
        };
      }
    }

    if (action === 'tutor_chat') {
      const MAX_DAILY_TUTOR_REQUESTS = 50;
      const userConvs = data.conversations.filter((c) => c.userId === userId);
      let todayTutorCount = 0;
      for (const conv of userConvs) {
        for (const msg of conv.messages) {
          if (msg.role === 'user' && msg.timestamp && msg.timestamp.startsWith(todayStr)) {
            todayTutorCount++;
          }
        }
      }
      if (todayTutorCount >= MAX_DAILY_TUTOR_REQUESTS) {
        return {
          allowed: false,
          message: `Daily AI Tutor message limit (${MAX_DAILY_TUTOR_REQUESTS}/day) reached. Your limit resets tomorrow.`,
        };
      }
    }

    return { allowed: true };
  },

  // ─── Admin-only helpers ──────────────────────────────────────────────────────
  getAllData(): DatabaseSchema {
    return ensureDbFile();
  },

  adminDeleteDocument(id: string): boolean {
    const data = ensureDbFile();
    const initialLength = data.documents.length;
    data.documents = data.documents.filter((d) => d.id !== id);
    data.chunks = data.chunks.filter((c) => c.bookId !== id);
    data.quizzes = data.quizzes.filter((q) => q.documentId !== id);
    data.attempts = data.attempts.filter((a) => a.documentId !== id);
    data.flashcards = data.flashcards.filter((f) => f.documentId !== id);
    data.sessions = data.sessions.filter((s) => s.bookId !== id);
    data.conversations = data.conversations.filter((c) => c.bookId !== id);
    saveDb(data);
    return data.documents.length < initialLength;
  },

  adminDeleteUser(uid: string): boolean {
    const data = ensureDbFile();
    const hadDocs = data.documents.some((d) => d.userId === uid);
    // Remove all user data
    const userDocs = data.documents.filter((d) => d.userId === uid).map((d) => d.id);
    data.documents = data.documents.filter((d) => d.userId !== uid);
    data.chunks = data.chunks.filter((c) => !userDocs.includes(c.bookId));
    data.quizzes = data.quizzes.filter((q) => q.userId !== uid);
    data.attempts = data.attempts.filter((a) => a.userId !== uid);
    data.flashcards = data.flashcards.filter((f) => f.userId !== uid);
    data.sessions = data.sessions.filter((s) => s.userId !== uid);
    data.conversations = data.conversations.filter((c) => c.userId !== uid);
    data.users = (data.users || []).filter((u) => u.uid !== uid);
    saveDb(data);
    return hadDocs;
  },

  upsertUser(profile: PlatformUser): PlatformUser {
    const data = ensureDbFile();
    if (!data.users) data.users = [];
    const now = new Date().toISOString();
    const existing = data.users.find((u) => u.uid === profile.uid);
    if (existing) {
      existing.email = profile.email || existing.email;
      existing.displayName = profile.displayName || existing.displayName;
      existing.photoURL = profile.photoURL || existing.photoURL;
      existing.role = profile.role || existing.role;
      existing.fullName = profile.fullName || existing.fullName;
      existing.phone = profile.phone || existing.phone;
      existing.school = profile.school || existing.school;
      existing.grade = profile.grade || existing.grade;
      existing.city = profile.city || existing.city;
      existing.lastLoginAt = now;
      saveDb(data);
      return existing;
    }
    const created: PlatformUser = {
      uid: profile.uid,
      email: profile.email || '',
      displayName: profile.displayName || profile.fullName || '',
      photoURL: profile.photoURL || '',
      role: profile.role || (isAdminEmail(profile.email) ? 'admin' : 'student'),
      fullName: profile.fullName || '',
      phone: profile.phone || '',
      school: profile.school || '',
      grade: profile.grade || '',
      city: profile.city || '',
      createdAt: now,
      lastLoginAt: now,
    };
    data.users.push(created);
    saveDb(data);
    return created;
  },

  getUsers(): PlatformUser[] {
    return ensureDbFile().users || [];
  },

  getAISettings(): AISettings {
    const data = ensureDbFile();
    const stored = memoryAiSettings || data.aiSettings || {
      provider: 'groq' as const,
      groqModel: 'openai/gpt-oss-20b',
      geminiModel: 'gemini-3.6-flash',
    };
    const envProvider = process.env.AI_PROVIDER === 'gemini' || process.env.AI_PROVIDER === 'groq'
      ? process.env.AI_PROVIDER
      : undefined;
    return {
      ...stored,
      provider: stored.provider || envProvider || 'groq',
      groqModel: stored.groqModel || process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      geminiModel: stored.geminiModel || process.env.GEMINI_MODEL || process.env.GEMINI_GENERATION_MODEL || 'gemini-3.6-flash',
    };
  },

  saveAISettings(settings: AISettings): void {
    memoryAiSettings = settings;
    const data = ensureDbFile();
    data.aiSettings = settings;
    saveDb(data);
  }
};
