import { QuizSession, QuizSessionAnswer, QuizAttempt, DocumentChunk } from '../src/types';
import { db as localDb } from './db';

// Server-side database service managing local persistence and caching
export const firestoreService = {
  async saveSession(session: QuizSession): Promise<QuizSession> {
    return localDb.saveSession(session);
  },

  async getSession(userId: string, sessionId: string): Promise<QuizSession | null> {
    const session = localDb.getSession(sessionId);
    if (session && session.userId === userId) {
      return session;
    }
    return session || null;
  },

  async getActiveSession(userId: string): Promise<QuizSession | null> {
    return localDb.getActiveSession(userId);
  },

  async saveSessionAnswer(params: {
    userId: string;
    sessionId: string;
    answer: QuizSessionAnswer;
    nextQuestionIndex: number;
    isFinished: boolean;
  }): Promise<QuizSession | null> {
    const session = await this.getSession(params.userId, params.sessionId);
    if (!session) return null;

    session.answers[params.answer.questionId] = params.answer;
    session.currentQuestionIndex = params.nextQuestionIndex;
    session.updatedAt = new Date().toISOString();

    const answersList = Object.values(session.answers) as QuizSessionAnswer[];
    const correctCount = answersList.filter((a) => a.isCorrect).length;
    const incorrectCount = answersList.filter((a) => !a.isCorrect).length;
    session.correctCount = correctCount;
    session.incorrectCount = incorrectCount;
    session.score = Math.round((correctCount / Math.max(1, session.questions.length)) * 100);

    return await this.saveSession(session);
  },

  async completeSession(params: {
    userId: string;
    sessionId: string;
    timeSpentSeconds?: number;
  }): Promise<{ session: QuizSession; attempt: QuizAttempt }> {
    const session = await this.getSession(params.userId, params.sessionId);
    if (!session) throw new Error('Quiz session not found');

    if (session.status === 'completed' && session.completedAt) {
      // Idempotency: prevent duplicate completion
      const existingAttempt = localDb.getAttempts(session.bookId).find((a) => a.sessionId === session.id);
      if (existingAttempt) {
        return { session, attempt: existingAttempt };
      }
    }

    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    session.updatedAt = session.completedAt;

    const answersList = Object.values(session.answers) as QuizSessionAnswer[];
    const correctCount = answersList.filter((a) => a.isCorrect).length;
    const totalCount = session.questions.length;
    const score = Math.round((correctCount / Math.max(1, totalCount)) * 100);
    session.score = score;
    session.correctCount = correctCount;
    session.incorrectCount = totalCount - correctCount;

    await this.saveSession(session);

    // Save completed attempt
    const attemptId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let aiPerformanceInsight = 'Excellent performance! You showed strong mastery over the retrieved content.';
    if (score < 60) {
      aiPerformanceInsight = 'Foundational study needed. Review the specific chapter source references and explanations provided for missed questions.';
    } else if (score < 85) {
      aiPerformanceInsight = 'Solid grasp of core concepts. Deepening review on specific sections referenced in the explanations will reinforce retention.';
    }

    const attempt: QuizAttempt = {
      id: attemptId,
      userId: session.userId,
      quizId: session.id,
      sessionId: session.id,
      documentId: session.bookId,
      documentTitle: session.documentTitle || 'Study Material',
      quizTitle: session.chapterTitle ? `${session.chapterTitle} Quiz` : 'Comprehensive Document Quiz',
      date: session.completedAt,
      score,
      correctCount,
      totalCount,
      timeSpentSeconds: params.timeSpentSeconds || 60,
      answers: answersList.map((a) => ({
        questionId: a.questionId,
        userAnswer: a.userAnswer,
        isCorrect: a.isCorrect,
        explanation: a.explanation,
        sourceReferences: a.sourceReferences,
      })),
      aiPerformanceInsight,
    };

    localDb.saveAttempt(attempt);

    return { session, attempt };
  },

  async saveDocumentChunks(chunks: DocumentChunk[]): Promise<void> {
    localDb.saveChunks(chunks);
  },

  async getDocumentChunks(params: {
    userId: string;
    bookId: string;
    chapterId?: string;
    sectionId?: string;
  }): Promise<DocumentChunk[]> {
    return localDb.getChunks(params);
  },
};
