import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  UploadCloud,
  BookOpen,
  HelpCircle,
  Sparkles,
  BarChart3,
  CheckCircle2,
  FileText,
  Clock,
  Plus,
  Play,
  Loader2,
  Trophy,
  Flame,
  ChevronRight,
  TrendingUp,
  Target,
  Zap,
  Search,
  Bell,
  MoreHorizontal,
  Layers,
  ArrowUpRight,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { DocumentItem, Quiz, QuizAttempt, StudyAnalytics, QuizSession } from '../types';
import { isAdminEmail } from '../lib/admin';
import { api } from '../lib/api';
import { ensureSignedIn, auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import {
  validateFirestoreConnection,
  getActiveSessionFromFirestore,
  saveSessionToFirestore,
  saveAttemptToFirestore,
  saveDocumentToFirestore,
  deleteDocumentFromFirestore,
  saveQuizToFirestore,
} from '../lib/firestoreClient';
import { Navbar } from '../components/Navbar';
import { DocumentCard } from '../components/DocumentCard';
import { DocumentUploadModal } from '../components/DocumentUploadModal';
import { ChapterExplorer } from '../components/ChapterExplorer';
import { KeyTermsGlossary } from '../components/KeyTermsGlossary';
import { QuizConfigModal } from '../components/QuizConfigModal';
import { ActiveQuizView } from '../components/ActiveQuizView';
import { QuizResultsView } from '../components/QuizResultsView';
import { FlashcardDeck } from '../components/FlashcardDeck';
import { TutorChatView } from '../components/TutorChatView';
import { AnalyticsView } from '../components/AnalyticsView';

export function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'materials' | 'quiz' | 'flashcards' | 'tutor' | 'analytics'>('materials');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activeSession, setActiveSession] = useState<QuizSession | null>(null);
  const [lastAttempt, setLastAttempt] = useState<{ quiz: Quiz; attempt: QuizAttempt } | null>(null);
  const [analytics, setAnalytics] = useState<StudyAnalytics | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [quizChapterPreset, setQuizChapterPreset] = useState<string | undefined>(undefined);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statsPeriod, setStatsPeriod] = useState<'24h' | '7d' | '30d' | 'all'>('all');
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const refreshData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const { loadLocalDocuments } = await import('../lib/bookText');
      const { listUserDocuments } = await import('../lib/firestoreClient');
      const [serverDocs, cloudDocs] = await Promise.all([
        api.getDocuments().catch(() => [] as DocumentItem[]),
        listUserDocuments().catch(() => [] as DocumentItem[]),
      ]);
      const merged = new Map<string, DocumentItem>();
      [...loadLocalDocuments(), ...cloudDocs, ...serverDocs].forEach((doc) => {
        if (doc?.id) merged.set(doc.id, doc);
      });
      const docs = Array.from(merged.values()).sort((a, b) =>
        String(b.uploadDate || '').localeCompare(String(a.uploadDate || ''))
      );
      setDocuments(docs);
      if (docs.length > 0 && !selectedDoc) setSelectedDoc(docs[0]);
      docs.filter((d) => d.processingStatus === 'ready' || !d.processingStatus).forEach((d) => {
        saveDocumentToFirestore(d).catch(() => {});
      });
      setInitialLoading(false);
      const [stats, serverSession, firestoreSession] = await Promise.all([
        api.getAnalytics().catch(() => null),
        api.getActiveSession().catch(() => null),
        (async () => {
          try {
            validateFirestoreConnection().catch(() => {});
            return await getActiveSessionFromFirestore(user.uid);
          } catch { return null; }
        })(),
      ]);
      if (stats) setAnalytics(stats);
      const resolvedSession = firestoreSession || serverSession;
      if (resolvedSession?.status === 'in_progress') setActiveSession(resolvedSession);
    } catch { setInitialLoading(false); }
  };

  useEffect(() => { refreshData(); }, []);

  // Poll processing docs
  useEffect(() => {
    const processingDocs = documents.filter((d) => d.processingStatus === 'processing');
    if (processingDocs.length === 0) return;
    const interval = setInterval(async () => {
      let anyChanged = false;
      const updated = await Promise.all(
        documents.map(async (doc) => {
          if (doc.processingStatus !== 'processing') return doc;
          try {
            const prog = await api.pollDocumentProgress(doc.id);
            if (prog.status !== doc.processingStatus || prog.progress !== doc.progress) {
              anyChanged = true;
              return { ...doc, processingStatus: prog.status as any, progress: prog.progress, title: prog.title || doc.title };
            }
          } catch { }
          return doc;
        })
      );
      if (anyChanged) {
        setDocuments(updated);
        const newlyReady = updated.filter(
          (d) => d.processingStatus === 'ready' && documents.find((o) => o.id === d.id)?.processingStatus === 'processing'
        );
        newlyReady.forEach((d) => saveDocumentToFirestore(d).catch(() => {}));
        if (newlyReady.length > 0) {
          refreshData();
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [documents]);

  useEffect(() => {
    const loadQuizzes = async () => {
      if (!selectedDoc) return;
      try { setQuizzes(await api.getQuizzes(selectedDoc.id)); } catch { }
    };
    if (activeTab === 'quiz' || activeTab === 'materials') loadQuizzes();
  }, [selectedDoc, activeTab]);

  const handleStartChapterQuiz = (chapterId?: string) => {
    setQuizChapterPreset(chapterId);
    setQuizModalOpen(true);
  };
  const handleAskTutorAboutChapter = () => setActiveTab('tutor');

  const handleGenerateQuiz = async (quiz: Quiz, session?: QuizSession) => {
    setActiveQuiz(quiz);
    if (session) {
      setActiveSession(session);
      await saveSessionToFirestore(session).catch(() => {});
    }
    setQuizzes((prev) => [quiz, ...prev.filter((q) => q.id !== quiz.id)]);
    await saveQuizToFirestore(quiz).catch(() => {});
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleDeleteBook = async (docId: string) => {
    setDeletingDocId(docId);
    try {
      await api.deleteDocument(docId).catch(() => false);
      await deleteDocumentFromFirestore(docId).catch(() => {});
      const { removeLocalDocument } = await import('../lib/bookText');
      removeLocalDocument(docId);
      const next = documents.filter((d) => d.id !== docId);
      setDocuments(next);
      if (selectedDoc?.id === docId) setSelectedDoc(next[0] || null);
    } catch (err) {
      console.error('Delete book failed:', err);
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleResumeSession = (session: QuizSession) => {
    const matchingQuiz = quizzes.find((q) => q.id === session.id?.replace('session-', 'quiz-')) || {
      id: `quiz-resumed-${session.id}`,
      userId: session.userId,
      documentId: session.bookId,
      documentTitle: session.documentTitle,
      title: session.chapterTitle ? `${session.chapterTitle} Quiz` : 'Study Quiz',
      createdAt: session.startedAt,
      questionType: 'multiple_choice',
      difficulty: session.quizConfiguration?.difficulty || 'Medium',
      questions: session.questions,
    } as Quiz;
    setActiveQuiz(matchingQuiz);
  };

  const handleQuizComplete = async (quiz: Quiz, attempt: QuizAttempt) => {
    try {
      const savedAttempt = await api.submitQuiz({
        quizId: quiz.id, answers: attempt.userAnswers || {}, timeSpentSeconds: attempt.timeSpentSeconds,
      });
      savedAttempt.userAnswers = attempt.userAnswers;
      await saveAttemptToFirestore({ ...savedAttempt, userId: auth.currentUser?.uid || 'default-user' }).catch(() => {});
      setLastAttempt({ quiz, attempt: savedAttempt });
      setActiveQuiz(null);
      setActiveSession(null);
      refreshData();
    } catch {
      setLastAttempt({ quiz, attempt });
      setActiveQuiz(null);
    }
  };

  const navItems = [
    { id: 'materials' as const, label: 'Materials', icon: BookOpen },
    { id: 'quiz' as const, label: 'Quiz', icon: HelpCircle },
    { id: 'flashcards' as const, label: 'Flashcards', icon: Layers },
    { id: 'tutor' as const, label: 'Tutor', icon: Brain },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  ];

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#D6EFE5] flex items-center justify-center p-8">
        <div className="w-full max-w-[1400px] h-[85vh] bg-[#F5F2EB] rounded-[32px] shadow-2xl flex border-8 border-gray-900/5 items-center justify-center">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
              <p className="text-gray-500 font-medium">Loading workspace...</p>
            </div>
        </div>
      </div>
    );
  }

  if (activeQuiz) {
    return <ActiveQuizView quiz={activeQuiz} session={activeSession || undefined} onComplete={handleQuizComplete} onExit={() => setActiveQuiz(null)} />;
  }
  if (lastAttempt && !activeQuiz) {
    return <QuizResultsView quiz={lastAttempt.quiz} attempt={lastAttempt.attempt} onRetake={() => { setActiveQuiz(lastAttempt.quiz); setLastAttempt(null); }} onDone={() => setLastAttempt(null)} />;
  }

  const periodMs =
    statsPeriod === '24h' ? 86400000 : statsPeriod === '7d' ? 7 * 86400000 : statsPeriod === '30d' ? 30 * 86400000 : Infinity;
  const periodAttempts = (analytics?.recentAttempts || []).filter((a) => {
    if (!a.date) return statsPeriod === 'all';
    return Date.now() - new Date(a.date).getTime() <= periodMs;
  });
  const periodAvg =
    periodAttempts.length > 0
      ? Math.round(periodAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / periodAttempts.length)
      : statsPeriod === 'all'
        ? analytics?.averageScore || 0
        : 0;
  const readyBooks = documents.filter((d) => d.processingStatus === 'ready' || !d.processingStatus).length;
  const totalChapters = documents.reduce((sum, d) => sum + (d.chapters?.length || 0), 0);
  const filteredBooks = documents.filter((d) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return d.title.toLowerCase().includes(q) || (d.fileName || '').toLowerCase().includes(q);
  });

  const statsCards = [
    { label: 'Total Books', value: documents.length, icon: BookOpen, hint: `${readyBooks} ready` },
    { label: 'Quizzes', value: statsPeriod === 'all' ? quizzes.length : periodAttempts.length, icon: HelpCircle, hint: statsPeriod === 'all' ? 'generated' : 'in period' },
    { label: 'Avg. Score', value: `${periodAvg}%`, icon: Trophy, hint: periodAttempts.length ? `${periodAttempts.length} attempts` : 'no attempts yet' },
    { label: 'Study Streak', value: analytics?.studyStreakDays || 0, icon: Flame, hint: 'active study days' },
  ];
  const analyzedPct = documents.length ? readyBooks / documents.length : 0;
  const quizPct = documents.length ? Math.min(1, quizzes.length / documents.length) : 0;
  const chapterPct = documents.length ? Math.min(1, totalChapters / (documents.length * 10)) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#cbede3] to-[#d6efe5] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-[1500px] h-[90vh] bg-[#FAF8F3] rounded-[36px] shadow-2xl overflow-hidden flex relative ring-[12px] ring-black/5 ring-inset">
        
        {/* Sidebar */}
        <aside className="w-[80px] bg-[#FAF8F3] border-r border-[#e8e4db] flex flex-col items-center py-8 z-10 shrink-0">
          <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center shadow-lg mb-8">
            <Flame className="w-5 h-5 text-white" />
          </div>
          
          <nav className="flex-1 flex flex-col gap-4">
            {navItems.map(({ id, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  title={id}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    active ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </nav>
          
          <button onClick={() => setUploadModalOpen(true)} className="w-12 h-12 rounded-full bg-teal-500 text-white flex items-center justify-center shadow-md hover:bg-teal-600 transition-colors">
            <Plus className="w-6 h-6" />
          </button>
        </aside>

        {/* Main Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF8F3]">
          
          {/* Header */}
          <header className="h-[88px] px-8 flex items-center justify-between border-b border-[#e8e4db] shrink-0">
            <div>
              <h1 className="text-[26px] font-semibold text-gray-900">Dashboard</h1>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-100">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search books..."
                  className="bg-transparent text-sm focus:outline-none w-36 placeholder:text-gray-300"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 pr-3 border-r border-gray-200">
                  <img src={auth.currentUser?.photoURL || `https://ui-avatars.com/api/?name=${auth.currentUser?.email || 'Student'}&background=random`} alt="User" className="w-9 h-9 rounded-full bg-gray-200 object-cover" />
                  <span className="text-sm font-medium text-gray-700">{auth.currentUser?.displayName || 'Student'}</span>
                </div>
                {isAdminEmail(auth.currentUser?.email) && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="px-3 py-2 rounded-full bg-white border border-gray-100 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                  >
                    Admin
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Content Body */}
          <main className="flex-1 overflow-y-auto p-8 flex flex-col xl:flex-row gap-8">
            <div className={`flex-1 min-w-0 ${activeTab === 'flashcards' ? 'flex flex-col' : 'space-y-8'}`}>
              
              {activeTab === 'materials' && (
                <>
                  {/* Overview Stats */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">Overview</h2>
                  <div className="flex bg-white rounded-full p-1 shadow-sm border border-gray-100">
                    {(['24h', '7d', '30d', 'all'] as const).map((period) => (
                      <button
                        key={period}
                        onClick={() => setStatsPeriod(period)}
                        className={`px-4 py-1 text-xs font-medium rounded-full capitalize ${
                          statsPeriod === period ? 'bg-gray-900 text-white shadow' : 'bg-transparent text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {period === 'all' ? 'All' : period}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {statsCards.map((card, i) => (
                    <motion.div key={i} initial={{opacity:0, y:10}} animate={{opacity:1,y:0}} transition={{delay: i*0.1}} className="bg-white p-5 rounded-[24px] border border-[#f0ece1] shadow-sm flex flex-col justify-between h-[130px]">
                      <div className="flex items-center gap-2 text-gray-500">
                        <card.icon className="w-4 h-4" />
                        <span className="text-xs font-medium">{card.label}</span>
                      </div>
                      <div className="flex items-end gap-3">
                        <span className="text-[32px] font-semibold text-gray-900 leading-none">{card.value}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1">{card.hint}</span>
                    </motion.div>
                  ))}
                </div>
              </section>

               {/* Main Activity Area */}
              <section className="bg-white rounded-[32px] border border-[#f0ece1] shadow-sm p-6 flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-1">
                   <h2 className="text-lg font-semibold text-gray-800 mb-1">Study Activity</h2>
                   <p className="text-xs text-gray-400 mb-6">Your progress across all books</p>
                   
                   <div className="flex items-center justify-center h-[200px]">
                      <div className="relative w-48 h-48">
                         <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                           <circle cx="50" cy="50" r="40" stroke="#f3f4f6" strokeWidth="12" fill="none" />
                           <circle cx="50" cy="50" r="40" stroke="#93c5fd" strokeWidth="12" fill="none" strokeDasharray={`${(analyzedPct * 251.2).toFixed(1)} 251.2`} className="drop-shadow-sm" />
                           <circle cx="50" cy="50" r="40" stroke="#c4b5fd" strokeWidth="12" fill="none" strokeDasharray={`${(quizPct * 251.2).toFixed(1)} 251.2`} strokeDashoffset={-(analyzedPct * 251.2)} />
                           <circle cx="50" cy="50" r="40" stroke="#2dd4bf" strokeWidth="12" fill="none" strokeDasharray={`${(chapterPct * 251.2).toFixed(1)} 251.2`} strokeDashoffset={-((analyzedPct + quizPct) * 251.2)} />
                         </svg>
                         <div className="absolute inset-0 flex flex-col items-center justify-center">
                           <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Analyzed</span>
                           <span className="text-3xl font-bold text-gray-900">{readyBooks}</span>
                         </div>
                      </div>
                   </div>
                </div>
                
                {/* Book Detail Card */}
                {selectedDoc && (
                  <motion.div initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} className="w-full md:w-[340px] bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden p-5 shrink-0">
                    <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white shrink-0">
                         <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm truncate">{selectedDoc.title}</h3>
                        <p className="text-[11px] text-gray-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Ready for study
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-medium">
                          <span className="text-gray-500">Index completeness</span>
                          <span className="text-gray-900">
                            {Math.min(
                              100,
                              (selectedDoc.chapters?.length ? 50 : 0) +
                                (selectedDoc.keyTerms?.length ? 30 : 0) +
                                ((selectedDoc.summary || '').length > 40 ? 20 : 0)
                            )}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1">
                          <div
                            className="bg-teal-400 h-1 rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                (selectedDoc.chapters?.length ? 50 : 0) +
                                  (selectedDoc.keyTerms?.length ? 30 : 0) +
                                  ((selectedDoc.summary || '').length > 40 ? 20 : 0)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-semibold text-gray-900 mb-1">Summary</h4>
                        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3">{selectedDoc.summary}</p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-semibold text-teal-600 mb-2 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Key Highlights
                        </h4>
                        <ul className="space-y-2">
                          <li className="flex gap-2 text-[11px] text-gray-600 leading-tight">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            {selectedDoc.chapters?.length} distinct chapters found and indexed.
                          </li>
                          <li className="flex gap-2 text-[11px] text-gray-600 leading-tight">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            {selectedDoc.keyTerms?.length} key vocabulary terms extracted.
                          </li>
                        </ul>
                      </div>
                      <div className="pt-2 flex gap-2">
                         <button onClick={() => setQuizModalOpen(true)} className="flex-1 bg-gray-900 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-gray-800 transition-colors">Generate Quiz</button>
                         <button
                           onClick={() => handleDeleteBook(selectedDoc.id)}
                           disabled={deletingDocId === selectedDoc.id}
                           className="px-3 bg-white border border-rose-100 text-rose-600 text-xs font-semibold py-2.5 rounded-xl hover:bg-rose-50 transition-colors"
                         >
                           {deletingDocId === selectedDoc.id ? '...' : 'Delete'}
                         </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </section>
              {selectedDoc && selectedDoc.chapters?.length > 0 && (
                <ChapterExplorer
                  document={selectedDoc}
                  onStartChapterQuiz={(chapterId, chapterTitle) => handleStartChapterQuiz(chapterTitle || chapterId)}
                />
              )}
              {selectedDoc && selectedDoc.keyTerms?.length > 0 && (
                <KeyTermsGlossary document={selectedDoc} />
              )}
              </>
              )}

              {activeTab === 'flashcards' && selectedDoc && (
                <FlashcardDeck key={selectedDoc.id} document={selectedDoc} />
              )}
              {activeTab === 'tutor' && selectedDoc && (
                <TutorChatView document={selectedDoc} />
              )}
              {activeTab === 'analytics' && (
                <AnalyticsView analytics={analytics} />
              )}
              {activeTab === 'quiz' && selectedDoc && (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col bg-white rounded-[32px] border border-[#f0ece1] shadow-sm overflow-hidden p-8 items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4">
                      <HelpCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Test Your Knowledge</h2>
                    <p className="text-sm text-gray-500 mb-6">Generate an AI-powered quiz for {selectedDoc.title}</p>
                    <button onClick={() => setQuizModalOpen(true)} className="px-6 py-3 bg-gray-900 text-white rounded-full font-bold shadow-md hover:bg-gray-800 transition-colors">
                      Generate New Quiz
                    </button>
                  </div>
                  
                  {quizzes.length > 0 && (
                    <div className="bg-white rounded-[32px] border border-[#f0ece1] shadow-sm overflow-hidden p-8">
                      <h3 className="text-lg font-bold text-gray-900 mb-6">Past Quizzes</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {quizzes.map(q => (
                          <div key={q.id} className="bg-[#FAF8F3] p-5 rounded-[24px] border border-[#e8e4db] flex flex-col items-start text-left hover:border-teal-300 transition-colors">
                            <h4 className="font-bold text-gray-900 mb-1 truncate w-full">{q.title}</h4>
                            <p className="text-xs text-gray-500 mb-4">{q.questions.length} questions • {q.difficulty}</p>
                            <button 
                              onClick={() => setActiveQuiz(q)} 
                              className="mt-auto px-4 py-2 bg-white border border-gray-200 text-teal-600 font-bold text-sm rounded-xl hover:bg-teal-50 transition-colors"
                            >
                              Retake Quiz
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {activeTab !== 'materials' && !selectedDoc && activeTab !== 'analytics' && (
                <div className="flex flex-col h-full bg-white rounded-[32px] border border-[#f0ece1] shadow-sm overflow-hidden p-8 items-center justify-center text-center">
                  <p className="text-gray-500 font-medium">Please select a book from the right panel to use this feature.</p>
                </div>
              )}

            </div>

            {/* Right Sidebar - Recent Activity */}
            <aside className="w-full xl:w-[380px] shrink-0 space-y-6">
              
              <div className="flex items-center justify-between px-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">My Books</h2>
                  <p className="text-xs text-gray-400">Manage and study your library</p>
                </div>
                <button
                  onClick={() => setUploadModalOpen(true)}
                  title="Upload a book"
                  className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 hover:bg-gray-50"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="space-y-3">
                {filteredBooks.map((doc, i) => (
                  <motion.div 
                    key={doc.id} 
                    initial={{opacity:0, x:20}} 
                    animate={{opacity:1, x:0}} 
                    transition={{delay: i*0.1}}
                    onClick={() => setSelectedDoc(doc)}
                    className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer flex gap-4 items-center ${selectedDoc?.id === doc.id ? 'border-teal-400 ring-2 ring-teal-50 shadow-md' : 'border-[#f0ece1] hover:border-gray-300 shadow-sm'}`}
                  >
                    <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-100 flex items-center justify-center shrink-0">
                       <FileText className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-semibold text-gray-900 text-sm truncate pr-2">{doc.title}</h4>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                          {doc.processingStatus === 'processing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                          {doc.processingStatus === 'processing' ? `Processing ${doc.progress || 0}%` : 'Ready'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3" /> {doc.chapters?.length || 0} chapters
                      </p>
                      
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-[9px] text-gray-400 font-medium px-0.5">
                            <span>{doc.processingStatus === 'processing' ? 'Analyzing structure...' : 'Completed'}</span>
                            {doc.processingStatus === 'processing' && (
                              <span>{(doc.progress || 0) < 50 ? '~ 1-2 mins left' : '< 1 min left'}</span>
                            )}
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <motion.div 
                              className="bg-teal-400 h-1.5 rounded-full" 
                              initial={{ width: 0 }}
                              animate={{ width: `${doc.progress || 0}%` }}
                              transition={{ ease: 'linear', duration: 0.5 }}
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Selection Checkbox */}
                      <div className="shrink-0 flex items-center justify-center pl-3 border-l border-gray-100/50">
                        <div className={`w-6 h-6 rounded-full border-[2px] flex items-center justify-center transition-all ${
                          selectedDoc?.id === doc.id 
                            ? 'bg-teal-500 border-teal-500 text-white shadow-sm scale-110' 
                            : 'border-gray-300 bg-gray-50'
                        }`}>
                          {selectedDoc?.id === doc.id && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    </motion.div>
                ))}
                
                {filteredBooks.length === 0 && (
                   <div className="p-8 text-center bg-white/50 border border-dashed border-gray-200 rounded-2xl">
                     <p className="text-sm text-gray-500">{searchQuery ? 'No books match that search.' : 'No books added yet.'}</p>
                     {!searchQuery && (
                       <button onClick={() => setUploadModalOpen(true)} className="mt-3 text-xs font-bold text-teal-600">
                         Upload a PDF
                       </button>
                     )}
                   </div>
                )}
              </div>

            </aside>
          </main>
        </div>
      </div>

      {/* Modals */}
      <DocumentUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploaded={(doc) => {
          setDocuments((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]);
          setSelectedDoc(doc);
          saveDocumentToFirestore(doc).catch(() => {});
        }}
      />
      {selectedDoc && (
        <QuizConfigModal
          isOpen={quizModalOpen}
          onClose={() => setQuizModalOpen(false)}
          documents={documents}
          selectedDoc={selectedDoc}
          initialChapterTitle={quizChapterPreset}
          onQuizGenerated={handleGenerateQuiz}
        />
      )}
    </div>
  );
}
