import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Users,
  Activity,
  Database,
  LogOut,
  Search,
  Trash2,
  ArrowRight,
  FileText,
  BookOpen,
  BarChart3,
  Settings,
  Brain,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Layers,
  TrendingUp,
  Award,
  Clock,
  X,
  Zap,
} from 'lucide-react';
import { ADMIN_EMAIL, isAdminEmail } from '../lib/admin';
import { auth, firestore } from '../lib/firebase';
import { api } from '../lib/api';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';

type Tab = 'overview' | 'users' | 'documents' | 'quizzes' | 'settings';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUsers, setSearchUsers] = useState('');
  const [searchDocs, setSearchDocs] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'user' | 'document'; id: string; name: string } | null>(null);
  const [aiSettings, setAiSettings] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingProvider, setTestingProvider] = useState<'groq' | 'gemini' | null>(null);
  const [keyDrafts, setKeyDrafts] = useState<{ groqKey: string; geminiKey: string }>({ groqKey: '', geminiKey: '' });
  const [settingsStatus, setSettingsStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [s, u, d, a, ais] = await Promise.all([
        api.adminGetStats(),
        api.adminGetUsers(),
        api.adminGetDocuments(),
        api.adminGetAttempts(),
        api.adminGetAISettings(),
      ]);
      setStats(s);
      setUsers(u);
      setDocuments(d);
      setAttempts(a);
      setAiSettings(ais);
    } catch (err) {
      console.error('Admin data load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/');
      } else if (!isAdminEmail(user.email)) {
        navigate('/dashboard');
      } else {
        loadData();
      }
    });
    return () => unsubscribe();
  }, [navigate, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleTestProvider = async (provider: 'groq' | 'gemini') => {
    setTestingProvider(provider);
    setSettingsStatus(null);
    try {
      const result = await api.adminTestAISettings({
        provider,
        model: provider === 'groq' ? aiSettings?.groqModel : aiSettings?.geminiModel,
        apiKey: provider === 'groq' ? keyDrafts.groqKey : keyDrafts.geminiKey,
      });
      setSettingsStatus({
        type: result.ok ? 'success' : 'error',
        msg: result.ok
          ? `${provider === 'groq' ? 'Groq' : 'Gemini'} reachable on ${result.model} in ${result.latencyMs} ms. ${result.message}`
          : `${provider === 'groq' ? 'Groq' : 'Gemini'} test failed — ${result.message}`,
      });
    } catch (e: any) {
      setSettingsStatus({ type: 'error', msg: e.message || 'Connection test failed.' });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsStatus(null);
    try {
      const updated = await api.adminSaveAISettings({
        provider: aiSettings.provider,
        groqModel: aiSettings.groqModel,
        geminiModel: aiSettings.geminiModel,
        groqKey: keyDrafts.groqKey,
        geminiKey: keyDrafts.geminiKey,
      });
      setAiSettings(updated);
      setKeyDrafts({ groqKey: '', geminiKey: '' });
      setSettingsStatus({
        type: 'success',
        msg: `Saved and verified. ${updated.provider === 'groq' ? 'Groq' : 'Gemini'} is now powering the platform on ${
          updated.provider === 'groq' ? updated.groqModel : updated.geminiModel
        }.`,
      });
    } catch (e: any) {
      setSettingsStatus({ type: 'error', msg: e.message || 'Failed to save AI Settings.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    setDeletingId(id);
    try {
      await api.adminDeleteDocument(id);
      
      // Delete from Firestore
      const batch = writeBatch(firestore);
      
      const attemptsSnap = await getDocs(query(collection(firestore, 'attempts'), where('documentId', '==', id)));
      attemptsSnap.forEach(doc => batch.delete(doc.ref));
      
      const quizzesSnap = await getDocs(query(collection(firestore, 'quizzes'), where('documentId', '==', id)));
      quizzesSnap.forEach(docSnap => batch.delete(docSnap.ref));
      batch.delete(doc(firestore, 'documents', id));
      
      await batch.commit();

      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setStats((prev: any) => prev ? { ...prev, totalDocuments: prev.totalDocuments - 1 } : prev);
    } catch (err) {
      console.error('Delete document error:', err);
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    setDeletingId(uid);
    try {
      await api.adminDeleteUser(uid);
      
      // Delete from Firestore
      const batch = writeBatch(firestore);
      
      const attemptsSnap = await getDocs(query(collection(firestore, 'attempts'), where('userId', '==', uid)));
      attemptsSnap.forEach(doc => batch.delete(doc.ref));
      
      const quizzesSnap = await getDocs(query(collection(firestore, 'quizzes'), where('userId', '==', uid)));
      quizzesSnap.forEach(doc => batch.delete(doc.ref));
      
      // We also delete user sessions
      const sessionsSnap = await getDocs(collection(firestore, `users/${uid}/quizSessions`));
      sessionsSnap.forEach(doc => batch.delete(doc.ref));

      await batch.commit();
      
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
    } catch (err) {
      console.error('Delete user error:', err);
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const filteredUsers = users.filter((u) =>
    u.uid?.toLowerCase().includes(searchUsers.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchUsers.toLowerCase())
  );

  const filteredDocs = documents.filter((d) =>
    d.title?.toLowerCase().includes(searchDocs.toLowerCase()) ||
    d.userId?.toLowerCase().includes(searchDocs.toLowerCase())
  );

  const tabs: { id: Tab; label: string; icon: React.FC<any> }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'quizzes', label: 'Quiz Activity', icon: Brain },
    { id: 'settings', label: 'AI Settings', icon: Settings },
  ];

  const statCards = stats ? [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { label: 'Documents', value: stats.totalDocuments, icon: FileText, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100' },
    { label: 'Quizzes Generated', value: stats.totalQuizzes, icon: Brain, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
    { label: 'Quiz Attempts', value: stats.totalAttempts, icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: 'Avg Score', value: `${stats.avgScore}%`, icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Active Today', value: stats.activeToday, icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
  ] : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#cbede3] to-[#d6efe5] flex items-center justify-center p-8">
        <div className="w-full max-w-[1400px] h-[85vh] bg-[#F5F2EB] rounded-[36px] shadow-2xl flex border-[12px] border-black/5 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-teal-100 rounded-full" />
              <div className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin" />
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100">
                <ShieldCheck className="w-6 h-6 text-teal-500" />
              </div>
            </div>
            <p className="text-sm font-bold text-gray-500 tracking-wide">Loading Admin Portal...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#cbede3] to-[#d6efe5] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-[1500px] h-[92vh] bg-[#FAF8F3] rounded-[36px] shadow-2xl overflow-hidden flex flex-col ring-[12px] ring-black/5">

        {/* Header */}
        <header className="h-[72px] px-8 flex items-center justify-between border-b border-[#e8e4db] shrink-0 bg-white/70 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-[14px] bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900 leading-none">Admin Portal</h1>
              <p className="text-[11px] font-bold text-gray-400 tracking-wide uppercase mt-0.5">Smooth Learn • Control Center</p>
            </div>
            {/* Live badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Live Data</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className={`w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:text-teal-600 hover:border-teal-300 transition-all shadow-sm ${refreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/student')}
              className="px-4 py-2 flex items-center gap-2 rounded-full bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs transition-colors shadow-sm border border-gray-200"
            >
              Student App <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleLogout}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors shadow-sm border border-gray-200"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar */}
          <nav className="w-[220px] shrink-0 border-r border-[#e8e4db] bg-white/40 backdrop-blur-sm flex flex-col py-6 gap-1 px-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left ${
                  activeTab === tab.id
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </button>
            ))}

            <div className="mt-auto px-4 py-4 rounded-2xl bg-white/60 border border-[#f0ece1]">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Logged in as</p>
              <p className="text-xs font-bold text-gray-900 truncate">{ADMIN_EMAIL}</p>
              <p className="text-[10px] text-indigo-600 font-bold mt-0.5">Super Admin</p>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-8">
            <AnimatePresence mode="wait">

              {/* ── OVERVIEW TAB ── */}
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-2xl font-black text-gray-900">Platform Overview</h2>
                    <p className="text-sm text-gray-500 font-medium mt-1">Real-time statistics from the production database.</p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
                    {statCards.map((card, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="bg-white p-6 rounded-[28px] border border-[#f0ece1] shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow"
                      >
                        <div className={`w-14 h-14 rounded-[18px] ${card.bg} ${card.border} border flex items-center justify-center shrink-0`}>
                          <card.icon className={`w-6 h-6 ${card.color}`} />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{card.label}</p>
                          <p className="text-3xl font-black text-gray-900">{card.value}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-white rounded-[28px] border border-[#f0ece1] shadow-sm p-8">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Recent Quiz Activity</h3>
                    {attempts.length === 0 ? (
                      <p className="text-gray-400 text-sm font-medium">No quiz attempts recorded yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {attempts.slice(0, 8).map((a, i) => (
                          <motion.div
                            key={a.id || i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center gap-4 p-4 bg-[#FAF8F3] rounded-2xl border border-[#f0ece1]"
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                              a.score >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              a.score >= 60 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {a.score}%
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate">{a.quizTitle || 'Quiz Attempt'}</p>
                              <p className="text-[11px] text-gray-400 font-medium truncate">User: {a.userId?.slice(0, 16)}... • {a.correctCount}/{a.totalCount} correct</p>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium shrink-0">
                              <Clock className="w-3 h-3" />
                              {a.date ? new Date(a.date).toLocaleDateString() : 'Unknown'}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── USERS TAB ── */}
              {activeTab === 'users' && (
                <motion.div
                  key="users"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-gray-900">User Management</h2>
                      <p className="text-sm text-gray-500 font-medium mt-1">{users.length} users registered on the platform.</p>
                    </div>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={searchUsers}
                        onChange={(e) => setSearchUsers(e.target.value)}
                        className="pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all w-64 font-medium text-gray-800"
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-[28px] border border-[#f0ece1] shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-[#FAF8F3] border-b border-gray-100">
                            <th className="px-8 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-8 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Documents</th>
                            <th className="px-8 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Quizzes</th>
                            <th className="px-8 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Last Active</th>
                            <th className="px-8 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredUsers.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-8 py-12 text-center text-gray-400 text-sm font-medium">
                                No users found.
                              </td>
                            </tr>
                          ) : filteredUsers.map((u, i) => (
                            <motion.tr
                              key={u.uid}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.04 }}
                              className="hover:bg-gray-50/50 transition-colors"
                            >
                              <td className="px-8 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                                    <Users className="w-4 h-4 text-indigo-500" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-900 text-sm truncate max-w-[220px]">{u.email || u.displayName || u.uid.slice(0, 16)}</p>
                                    <p className="text-[11px] text-gray-400 font-medium truncate max-w-[220px]">{u.uid}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-4">
                                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-700">
                                  <FileText className="w-3.5 h-3.5 text-teal-500" />
                                  {u.documentsCount}
                                </span>
                              </td>
                              <td className="px-8 py-4">
                                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-700">
                                  <Brain className="w-3.5 h-3.5 text-violet-500" />
                                  {u.quizzesCount}
                                </span>
                              </td>
                              <td className="px-8 py-4 text-sm text-gray-500 font-medium">
                                {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-8 py-4 text-right">
                                <button
                                  onClick={() => setConfirmDelete({ type: 'user', id: u.uid, name: u.uid.slice(0, 12) + '...' })}
                                  className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                  title="Delete all user data"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── DOCUMENTS TAB ── */}
              {activeTab === 'documents' && (
                <motion.div
                  key="documents"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-gray-900">Document Library</h2>
                      <p className="text-sm text-gray-500 font-medium mt-1">{documents.length} PDFs uploaded across all users.</p>
                    </div>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search documents..."
                        value={searchDocs}
                        onChange={(e) => setSearchDocs(e.target.value)}
                        className="pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all w-64 font-medium text-gray-800"
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-[28px] border border-[#f0ece1] shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-[#FAF8F3] border-b border-gray-100">
                            <th className="px-8 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Document</th>
                            <th className="px-8 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Owner</th>
                            <th className="px-8 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Chapters</th>
                            <th className="px-8 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-8 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Uploaded</th>
                            <th className="px-8 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredDocs.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-8 py-12 text-center text-gray-400 text-sm font-medium">
                                No documents found.
                              </td>
                            </tr>
                          ) : filteredDocs.map((doc, i) => (
                            <motion.tr
                              key={doc.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.04 }}
                              className="hover:bg-gray-50/50 transition-colors"
                            >
                              <td className="px-8 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4 text-teal-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-gray-900 text-sm truncate max-w-[220px]">{doc.title}</p>
                                    <p className="text-[11px] text-gray-400 font-medium truncate max-w-[220px]">{doc.id}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-4">
                                <p className="text-sm font-bold text-gray-600 truncate max-w-[160px]">
                                  {users.find((u) => u.uid === doc.userId)?.email || (doc.userId ? doc.userId.slice(0, 12) + '…' : '—')}
                                </p>
                              </td>
                              <td className="px-8 py-4">
                                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-700">
                                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                                  {doc.chapters?.length || 0}
                                </span>
                              </td>
                              <td className="px-8 py-4">
                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                                  doc.processingStatus === 'ready'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${doc.processingStatus === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                  {doc.processingStatus === 'ready' ? 'Ready' : 'Processing'}
                                </span>
                              </td>
                              <td className="px-8 py-4 text-sm text-gray-500 font-medium">
                                {doc.uploadDate || doc.uploadedAt ? new Date(doc.uploadDate || doc.uploadedAt).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-8 py-4 text-right">
                                <button
                                  onClick={() => setConfirmDelete({ type: 'document', id: doc.id, name: doc.title })}
                                  className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                  title="Delete document"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── QUIZZES TAB ── */}
              {activeTab === 'quizzes' && (
                <motion.div
                  key="quizzes"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-black text-gray-900">Quiz Activity</h2>
                    <p className="text-sm text-gray-500 font-medium mt-1">{attempts.length} quiz attempts recorded across the platform.</p>
                  </div>

                  {attempts.length === 0 ? (
                    <div className="bg-white rounded-[28px] border border-[#f0ece1] shadow-sm p-16 flex flex-col items-center justify-center text-center">
                      <Brain className="w-12 h-12 text-gray-200 mb-4" />
                      <p className="text-gray-400 font-bold text-lg">No quiz attempts yet</p>
                      <p className="text-gray-400 text-sm mt-1">Quiz attempts will appear here once users start taking quizzes.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {attempts.map((a, i) => (
                        <motion.div
                          key={a.id || i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="bg-white rounded-[24px] border border-[#f0ece1] shadow-sm p-6 flex items-center gap-6"
                        >
                          {/* Score ring */}
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-black shrink-0 border-2 ${
                            a.score >= 80 ? 'border-emerald-300 text-emerald-700 bg-emerald-50' :
                            a.score >= 60 ? 'border-amber-300 text-amber-700 bg-amber-50' :
                            'border-rose-300 text-rose-700 bg-rose-50'
                          }`}>
                            {a.score}%
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 truncate">{a.quizTitle || 'Quiz Attempt'}</p>
                            <p className="text-sm text-gray-500 font-medium mt-0.5 truncate">
                              {a.documentTitle || 'Unknown Document'} • {a.correctCount}/{a.totalCount} correct
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1">User: {a.userId?.slice(0, 20)}...</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full ${
                              a.score >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              a.score >= 60 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {a.score >= 80 ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              {a.score >= 80 ? 'Passed' : a.score >= 60 ? 'Fair' : 'Needs Review'}
                            </span>
                            <p className="text-[11px] text-gray-400 font-medium mt-2">
                              {a.date ? new Date(a.date).toLocaleDateString() : ''}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── AI SETTINGS TAB ── */}
              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6 max-w-4xl"
                >
                  <div>
                    <h2 className="text-2xl font-black text-gray-900">AI Configuration</h2>
                    <p className="text-sm text-gray-500 font-medium mt-1">Configure which AI provider powers the platform globally.</p>
                  </div>

                  {aiSettings && (
                    <div className="bg-white rounded-[28px] border border-[#f0ece1] shadow-sm p-8 space-y-8">
                      {settingsStatus && (
                        <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold ${
                          settingsStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {settingsStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                          {settingsStatus.msg}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Active AI Provider</label>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            onClick={() => setAiSettings({ ...aiSettings, provider: 'groq' })}
                            className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                              aiSettings.provider === 'groq' 
                                ? 'border-indigo-500 bg-indigo-50' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                              aiSettings.provider === 'groq' ? 'border-indigo-600' : 'border-gray-300'
                            }`}>
                              {aiSettings.provider === 'groq' && <div className="w-3 h-3 bg-indigo-600 rounded-full" />}
                            </div>
                            <div className="text-left">
                              <p className={`font-black ${aiSettings.provider === 'groq' ? 'text-indigo-900' : 'text-gray-700'}`}>Groq AI</p>
                              <p className="text-xs text-gray-500 font-medium mt-0.5">Ultra-fast inference (GPT-OSS, Qwen)</p>
                            </div>
                          </button>
                          
                          <button
                            onClick={() => setAiSettings({ ...aiSettings, provider: 'gemini' })}
                            className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                              aiSettings.provider === 'gemini' 
                                ? 'border-teal-500 bg-teal-50' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                              aiSettings.provider === 'gemini' ? 'border-teal-600' : 'border-gray-300'
                            }`}>
                              {aiSettings.provider === 'gemini' && <div className="w-3 h-3 bg-teal-600 rounded-full" />}
                            </div>
                            <div className="text-left">
                              <p className={`font-black ${aiSettings.provider === 'gemini' ? 'text-teal-900' : 'text-gray-700'}`}>Google Gemini</p>
                              <p className="text-xs text-gray-500 font-medium mt-0.5">High accuracy (Gemini models)</p>
                            </div>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Groq Settings */}
                        <div className={`space-y-5 p-6 rounded-[24px] border transition-opacity ${
                          aiSettings.provider === 'groq' ? 'border-indigo-100 bg-indigo-50/30' : 'border-gray-100 opacity-50 grayscale'
                        }`}>
                          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500" /> Groq Settings
                          </h3>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">API Key</label>
                            <input 
                              type="password"
                              value={keyDrafts.groqKey}
                              onChange={(e) => setKeyDrafts({ ...keyDrafts, groqKey: e.target.value })}
                              placeholder={aiSettings.hasGroqKey ? aiSettings.groqKeyMasked : 'gsk_...'}
                              className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono text-sm"
                            />
                            <p className="text-[10px] text-gray-400 mt-1.5">
                              {aiSettings.hasGroqKey
                                ? 'A key is stored on the server. Leave blank to keep it, or paste a new key to replace it.'
                                : 'No key stored yet — paste a Groq key to activate this provider.'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Model</label>
                            <select
                              value={aiSettings.groqModel}
                              onChange={(e) => setAiSettings({...aiSettings, groqModel: e.target.value})}
                              className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-sm text-gray-700"
                            >
                              {(aiSettings.models?.groq || []).map((m: any) => (
                                <option key={m.id} value={m.id}>
                                  {m.label}{m.recommended ? ' (Recommended)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={() => handleTestProvider('groq')}
                            disabled={testingProvider !== null}
                            className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 bg-white text-indigo-700 text-sm font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {testingProvider === 'groq' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            Test Connection
                          </button>
                        </div>

                        {/* Gemini Settings */}
                        <div className={`space-y-5 p-6 rounded-[24px] border transition-opacity ${
                          aiSettings.provider === 'gemini' ? 'border-teal-100 bg-teal-50/30' : 'border-gray-100 opacity-50 grayscale'
                        }`}>
                          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-teal-500" /> Gemini Settings
                          </h3>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">API Key</label>
                            <input 
                              type="password"
                              value={keyDrafts.geminiKey}
                              onChange={(e) => setKeyDrafts({ ...keyDrafts, geminiKey: e.target.value })}
                              placeholder={aiSettings.hasGeminiKey ? aiSettings.geminiKeyMasked : 'AIza...'}
                              className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all font-mono text-sm"
                            />
                            <p className="text-[10px] text-gray-400 mt-1.5">
                              {aiSettings.hasGeminiKey
                                ? 'A key is stored on the server. Leave blank to keep it, or paste a new key to replace it.'
                                : 'No key stored yet — paste a Gemini key to activate this provider.'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Model</label>
                            <select
                              value={aiSettings.geminiModel}
                              onChange={(e) => setAiSettings({...aiSettings, geminiModel: e.target.value})}
                              className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all font-bold text-sm text-gray-700"
                            >
                              {(aiSettings.models?.gemini || []).map((m: any) => (
                                <option key={m.id} value={m.id}>
                                  {m.label}{m.recommended ? ' (Recommended)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={() => handleTestProvider('gemini')}
                            disabled={testingProvider !== null}
                            className="w-full px-4 py-2.5 rounded-xl border border-teal-200 bg-white text-teal-700 text-sm font-bold hover:bg-teal-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {testingProvider === 'gemini' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            Test Connection
                          </button>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-100 flex justify-end">
                        <button
                          onClick={handleSaveSettings}
                          disabled={savingSettings || testingProvider !== null}
                          className="px-8 py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-black transition-colors flex items-center gap-2"
                        >
                          {savingSettings ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Settings className="w-5 h-5" />}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* ── Confirm Delete Modal ── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[28px] shadow-2xl border border-rose-100 p-8 max-w-md w-full"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-6">
                <AlertTriangle className="w-7 h-7 text-rose-500" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Confirm Delete</h3>
              <p className="text-gray-600 font-medium text-sm mb-6">
                Are you sure you want to permanently delete{' '}
                <strong className="text-gray-900">"{confirmDelete.name}"</strong>?
                {confirmDelete.type === 'user' && ' This will remove ALL their documents, quizzes, and attempts.'}
                {confirmDelete.type === 'document' && ' This will also remove all associated quizzes, chunks, and attempts.'}
                {' '}This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmDelete.type === 'document') handleDeleteDocument(confirmDelete.id);
                    else handleDeleteUser(confirmDelete.id);
                  }}
                  disabled={!!deletingId}
                  className="flex-1 py-3 rounded-2xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {deletingId ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete Permanently
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
