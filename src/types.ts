export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'flashcard';
export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed' | 'Beginner' | 'Intermediate' | 'Advanced' | 'Comprehensive';
export type QuestionStyle = 'Conceptual' | 'Factual' | 'Application Based' | 'Scenario Based' | 'Mixed';

export interface ChapterItem {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  estimatedReadTime: string;
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface DocumentItem {
  id: string;
  userId?: string;
  title: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  pageCount: number;
  summary: string;
  extractedContent: string;
  chapters: ChapterItem[];
  keyTerms: KeyTerm[];
  overallDifficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  totalQuizzesGenerated: number;
  averageQuizScore?: number;
  processingStatus?: 'ready' | 'processing' | 'failed';
  lastStudiedAt?: string;
  progress?: number; // 0 - 100 percentage
}

export interface SourceReference {
  chapter?: string;
  chapterTitle?: string;
  chapterId?: string;
  page?: number;
  pageNumber?: number;
  chunkId?: string;
  excerpt?: string;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options: string[]; // exactly 4 options for MCQ
  correctAnswer: string;
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
  topic: string;
  sourceReferences: SourceReference[];
  hint?: string;
  chapterRef?: string;
  flashcardBack?: string;
}

export interface Quiz {
  id: string;
  userId?: string;
  documentId: string;
  documentTitle: string;
  title: string;
  createdAt: string;
  questionType: 'mixed' | 'multiple_choice' | 'true_false' | 'short_answer' | 'flashcards';
  difficulty: QuizDifficulty;
  chapterId?: string;
  chapterTitle?: string;
  topic?: string;
  questions: QuizQuestion[];
}

export interface QuizSessionAnswer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  explanation: string;
  sourceReferences: SourceReference[];
  answeredAt: string;
}

export interface QuizSession {
  id: string;
  userId: string;
  bookId: string;
  quizId?: string;
  documentId?: string;
  documentTitle?: string;
  chapterId?: string;
  chapterTitle?: string;
  sectionId?: string;
  quizConfiguration: {
    questionCount: number;
    difficulty: QuizDifficulty;
    questionStyle: QuestionStyle;
    topic?: string;
  };
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  answers: Record<string, QuizSessionAnswer>;
  score: number;
  correctCount: number;
  incorrectCount: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  timeRemainingSeconds?: number;
}

export interface DocumentChunk {
  id: string;
  bookId: string;
  userId: string;
  chapterId?: string;
  chapterTitle?: string;
  sectionId?: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  embedding?: number[];
}

export interface QuizAttemptAnswer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  explanation?: string;
  feedback?: string;
  sourceReferences?: SourceReference[];
}

export interface QuizAttempt {
  id: string;
  userId?: string;
  quizId: string;
  sessionId?: string;
  documentId: string;
  documentTitle: string;
  quizTitle: string;
  date: string;
  score: number; // 0 - 100
  correctCount: number;
  totalCount: number;
  timeSpentSeconds: number;
  answers: QuizAttemptAnswer[];
  userAnswers?: Record<string, string>;
  aiPerformanceInsight?: string;
}

export interface Flashcard {
  id: string;
  userId?: string;
  documentId: string;
  documentTitle: string;
  front: string;
  back: string;
  topic: string;
  chapterId?: string;
  chapterTitle?: string;
  hint?: string;
  masteryLevel: 'new' | 'learning' | 'mastered';
  reviewCount: number;
  lastReviewed?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: string[];
  sourceReferences?: SourceReference[];
}

export interface TutorConversation {
  id: string;
  userId: string;
  bookId: string;
  bookTitle: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface WeakTopicItem {
  topic: string;
  accuracy: number; // 0 - 100 percentage
  incorrectCount: number;
  missedCount?: number;
  totalQuestions: number;
  lastTestedDate: string;
  bookTitle?: string;
  suggestedChapter?: string;
  suggestedPage?: number;
}

export interface AIStudyRecommendation {
  id: string;
  type: 'review_section' | 'practice_topic' | 'revisit_page' | 'take_quiz';
  title: string;
  actionableStep: string;
  targetTopic?: string;
  targetChapter?: string;
  targetPage?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export interface AccuracyTrendItem {
  date: string;
  score: number;
  quizTitle: string;
}

export interface ChapterProgressItem {
  chapterId: string;
  chapterTitle: string;
  chapter?: string;
  quizzesTaken: number;
  averageScore: number;
  masteryPercent?: number;
  status: 'not_started' | 'in_progress' | 'mastered';
}

export interface StudyAnalytics {
  totalDocuments: number;
  totalQuizzesTaken: number;
  averageScore: number;
  totalQuestionsSolved: number;
  flashcardsMastered: number;
  studyStreakDays: number;
  totalStudyTimeMinutes: number;
  recentAttempts: QuizAttempt[];
  topTopics: { topic: string; score: number; count: number }[];
  weakTopics: WeakTopicItem[];
  recommendations: AIStudyRecommendation[];
  aiRecommendations?: AIStudyRecommendation[];
  accuracyTrend: AccuracyTrendItem[];
  chapterProgress: ChapterProgressItem[];
  activeSessions?: QuizSession[];
}

export interface AISettings {
  provider: 'groq' | 'gemini';
  groqKey?: string;
  groqModel?: string;
  geminiKey?: string;
  geminiModel?: string;
}

export interface PlatformUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: 'admin' | 'user';
  createdAt?: string;
  lastLoginAt?: string;
}
