import {
  DocumentItem,
  Quiz,
  QuizAttempt,
  Flashcard,
  StudyAnalytics,
  QuizSession,
  QuizSessionAnswer,
  SourceReference,
  TutorConversation,
} from '../types';
import { auth } from './firebase';

function getAuthHeaders(): Record<string, string> {
  const uid = auth.currentUser?.uid || 'default-user';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${uid}`,
  };
  return headers;
}

export const api = {
  async getDocuments(): Promise<DocumentItem[]> {
    const uid = auth.currentUser?.uid || 'default-user';
    const res = await fetch(`/api/documents?userId=${uid}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch documents');
    return json.data;
  },

  async getDocument(id: string): Promise<DocumentItem> {
    const res = await fetch(`/api/documents/${id}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch document');
    return json.data;
  },

  async analyzeDocument(payload: {
    fileName: string;
    text?: string;
    fileSize?: string;
    pdfBase64?: string;
  }): Promise<DocumentItem> {
    const res = await fetch('/api/documents/analyze', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...payload,
        userId: auth.currentUser?.uid || 'default-user',
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to analyze document');
    return json.data;
  },

  async pollDocumentProgress(id: string): Promise<{ status: string; progress: number; title: string }> {
    const res = await fetch(`/api/documents/${id}/progress`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to poll progress');
    return json.data;
  },


  async deleteDocument(id: string): Promise<boolean> {
    const res = await fetch(`/api/documents/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    return !!json.success;
  },

  async retryProcessing(id: string): Promise<DocumentItem> {
    const res = await fetch(`/api/documents/${id}/retry`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to re-process document');
    return json.data;
  },

  // Real RAG MCQ Quiz Generation
  async generateQuiz(payload: {
    documentId: string;
    chapterTitle?: string;
    chapterId?: string;
    sectionId?: string;
    topic?: string;
    questionType?: string;
    difficulty?: string;
    questionStyle?: string;
    count: number;
  }): Promise<{ quiz: Quiz; session?: QuizSession }> {
    const res = await fetch('/api/quizzes/generate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...payload,
        userId: auth.currentUser?.uid || 'default-user',
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to generate quiz');
    return {
      quiz: json.data,
      session: json.session,
    };
  },

  async practiceWeakAreas(bookId?: string): Promise<{ quiz: Quiz; session?: QuizSession }> {
    const res = await fetch('/api/quizzes/practice-weak-areas', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ bookId }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to generate weak-area quiz');
    return {
      quiz: json.data,
      session: json.session,
    };
  },

  async getQuizzes(documentId?: string): Promise<Quiz[]> {
    const uid = auth.currentUser?.uid || 'default-user';
    const url = documentId
      ? `/api/quizzes?documentId=${documentId}&userId=${uid}`
      : `/api/quizzes?userId=${uid}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch quizzes');
    return json.data;
  },

  async getQuiz(id: string): Promise<Quiz> {
    const res = await fetch(`/api/quizzes/${id}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch quiz');
    return json.data;
  },

  // Persistent Quiz Sessions in Firestore
  async getActiveSession(): Promise<QuizSession | null> {
    const uid = auth.currentUser?.uid || 'default-user';
    const res = await fetch(`/api/quiz-sessions/active?userId=${uid}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) return null;
    return json.data;
  },

  async getSession(sessionId: string): Promise<QuizSession> {
    const res = await fetch(`/api/quiz-sessions/${sessionId}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch quiz session');
    return json.data;
  },

  async submitSessionAnswer(params: {
    sessionId: string;
    questionId: string;
    userAnswer: string;
    nextQuestionIndex: number;
    isFinished?: boolean;
  }): Promise<{ session: QuizSession; evaluation: QuizSessionAnswer }> {
    const res = await fetch(`/api/quiz-sessions/${params.sessionId}/answer`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        questionId: params.questionId,
        userAnswer: params.userAnswer,
        nextQuestionIndex: params.nextQuestionIndex,
        isFinished: params.isFinished,
        userId: auth.currentUser?.uid || 'default-user',
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to record answer');
    return json.data;
  },

  async completeSession(params: {
    sessionId: string;
    timeSpentSeconds: number;
  }): Promise<{ session: QuizSession; attempt: QuizAttempt }> {
    const res = await fetch(`/api/quiz-sessions/${params.sessionId}/complete`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        timeSpentSeconds: params.timeSpentSeconds,
        userId: auth.currentUser?.uid || 'default-user',
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to complete quiz');
    return json.data;
  },

  async explainQuestion(params: {
    sessionId: string;
    questionId: string;
    style: 'more' | 'simpler';
  }): Promise<{
    style: 'more' | 'simpler';
    explanation: string;
    keyTakeaway: string;
    citations: SourceReference[];
  }> {
    const res = await fetch(`/api/quiz-sessions/${params.sessionId}/explain`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        questionId: params.questionId,
        style: params.style,
        userId: auth.currentUser?.uid || 'default-user',
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to get detailed explanation');
    return json.data;
  },

  async submitQuiz(payload: {
    quizId: string;
    answers: Record<string, string>;
    timeSpentSeconds: number;
  }): Promise<QuizAttempt> {
    const res = await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...payload,
        userId: auth.currentUser?.uid || 'default-user',
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to submit quiz');
    return json.data;
  },

  async submitQuizAttempt(quizId: string, attempt: QuizAttempt): Promise<QuizAttempt> {
    return this.submitQuiz({
      quizId,
      answers: attempt.userAnswers || {},
      timeSpentSeconds: attempt.timeSpentSeconds,
    });
  },

  async getAttempts(documentId?: string): Promise<QuizAttempt[]> {
    const uid = auth.currentUser?.uid || 'default-user';
    const url = documentId
      ? `/api/quiz/attempts?documentId=${documentId}&userId=${uid}`
      : `/api/quiz/attempts?userId=${uid}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch attempts');
    return json.data;
  },

  async getFlashcards(documentId: string, chapter?: { chapterId?: string; chapterTitle?: string }): Promise<Flashcard[]> {
    const params = new URLSearchParams();
    if (chapter?.chapterId) params.set('chapterId', chapter.chapterId);
    if (chapter?.chapterTitle) params.set('chapterTitle', chapter.chapterTitle);
    const qs = params.toString();
    const res = await fetch(`/api/flashcards/${documentId}${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch flashcards');
    return json.data;
  },

  async updateFlashcardStatus(id: string, status: 'new' | 'learning' | 'mastered'): Promise<Flashcard> {
    const res = await fetch('/api/flashcards/update', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, status }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to update flashcard');
    return json.data;
  },

  async getTutorConversations(documentId?: string): Promise<TutorConversation[]> {
    const url = documentId
      ? `/api/tutor/conversations?documentId=${documentId}`
      : '/api/tutor/conversations';
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch conversations');
    return json.data;
  },

  async deleteTutorConversation(id: string): Promise<boolean> {
    const res = await fetch(`/api/tutor/conversations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    return !!json.success;
  },

  async chatTutor(payload: {
    documentId: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    userQuestion: string;
    action?: 'explain_simpler' | 'give_example' | 'standard';
    conversationId?: string;
  }): Promise<{
    reply: string;
    citations: string[];
    sourceReferences?: SourceReference[];
    conversationId?: string;
  }> {
    const res = await fetch('/api/tutor/chat', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to get tutor answer');
    return json.data;
  },

  async sendStudentOtp(email: string): Promise<void> {
    const res = await fetch('/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to send login code');
  },

  async verifyStudentOtp(email: string, code: string): Promise<{ password: string }> {
    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Invalid login code');
    return json.data;
  },

  async registerStudentVault(payload: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    school: string;
    grade: string;
    city?: string;
  }): Promise<void> {
    const res = await fetch('/api/auth/student/register', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to save student profile');
  },

  async syncCurrentUser(): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    await fetch('/api/users/sync', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        role: user.email === 'saasproduct@admin.pk' ? 'admin' : 'student',
      }),
    }).catch(() => {});
  },

  async getAnalytics(): Promise<StudyAnalytics> {
    const uid = auth.currentUser?.uid || 'default-user';
    const res = await fetch(`/api/analytics?userId=${uid}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch analytics');
    return json.data;
  },

  // ─── Admin API Methods ──────────────────────────────────────────────────────
  async adminGetStats(): Promise<any> {
    const res = await fetch('/api/admin/stats', { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch admin stats');
    return json.data;
  },

  async adminGetDocuments(): Promise<any[]> {
    const res = await fetch('/api/admin/documents', { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch admin documents');
    return json.data;
  },

  async adminDeleteDocument(id: string): Promise<boolean> {
    const res = await fetch(`/api/admin/documents/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to delete admin document');
    return true;
  },

  async adminGetAISettings(): Promise<any> {
    const res = await fetch('/api/admin/settings/ai', { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch AI settings');
    return json.data;
  },

  async adminSaveAISettings(settings: any): Promise<any> {
    const res = await fetch('/api/admin/settings/ai', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to save AI settings');
    return json.data;
  },

  async adminTestAISettings(payload: {
    provider: 'groq' | 'gemini';
    model?: string;
    apiKey?: string;
  }): Promise<{ ok: boolean; provider: string; model: string; latencyMs: number; message: string }> {
    const res = await fetch('/api/admin/settings/ai/test', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to test AI connection');
    return json.data;
  },

  async adminGetUsers(): Promise<any[]> {
    const res = await fetch('/api/admin/users', { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch admin users');
    return json.data;
  },

  async adminDeleteUser(uid: string): Promise<boolean> {
    const res = await fetch(`/api/admin/users/${uid}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    return !!json.success;
  },

  async adminGetAttempts(): Promise<any[]> {
    const res = await fetch('/api/admin/attempts', { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch attempts');
    return json.data;
  },
};
