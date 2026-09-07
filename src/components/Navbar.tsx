import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Brain,
  BookOpen,
  HelpCircle,
  Layers,
  Sparkles,
  BarChart3,
  UploadCloud,
  ChevronDown,
  FileText,
  User as UserIcon,
  LogOut,
  LogIn,
} from 'lucide-react';
import { DocumentItem } from '../types';
import { auth, logoutUser, subscribeToAuth } from '../lib/firebase';
import { getUserRole } from '../lib/firestoreClient';
import { useNavigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import { AuthModal } from './AuthModal';

interface NavbarProps {
  activeTab?: 'materials' | 'quiz' | 'flashcards' | 'tutor' | 'analytics';
  setActiveTab?: (tab: 'materials' | 'quiz' | 'flashcards' | 'tutor' | 'analytics') => void;
  documents?: DocumentItem[];
  selectedDoc?: DocumentItem | null;
  onSelectDoc?: (doc: DocumentItem) => void;
  onOpenUpload?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  documents = [],
  selectedDoc = null,
  onSelectDoc,
  onOpenUpload,
  onLogout,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (user) => {
      setCurrentUser(user);
      if (user && !user.isAnonymous) {
        const role = await getUserRole(user.uid);
        setIsAdmin(role === 'admin');
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await logoutUser();
      setUserDropdownOpen(false);
      onLogout?.();
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const navItems = [
    { id: 'materials' as const, label: 'My Books', icon: BookOpen },
    { id: 'quiz' as const, label: 'Quiz Engine', icon: HelpCircle },
    { id: 'flashcards' as const, label: 'Flashcards & SRS', icon: Layers },
    { id: 'tutor' as const, label: 'AI Study Tutor', icon: Sparkles },
    { id: 'analytics' as const, label: 'Performance', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-sm ring-1 ring-indigo-500/20">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-slate-900 font-sans">
                  Smooth Learn
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  RAG SaaS
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                AI-Powered PDF Study & Quiz Intelligence
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          {activeTab && setActiveTab && (
            <nav className="hidden md:flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-tab-${item.id}`}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-indigo-600 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Right Action: Document Selector, Upload Button, & Auth */}
          <div className="flex items-center space-x-2.5">
            {/* Active Document Selector */}
            {documents.length > 0 && (
              <div className="relative">
                <button
                  id="active-doc-selector-btn"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors max-w-[170px] sm:max-w-[210px] cursor-pointer"
                  title="Current Active Document"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate text-left">
                    {selectedDoc ? selectedDoc.title : 'Select Document'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto" />
                </button>

                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        Switch Active Document ({documents.length})
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1">
                        {documents.map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => {
                              onSelectDoc?.(doc);
                              setDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-start space-x-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                              selectedDoc?.id === doc.id
                                ? 'bg-indigo-50/70 text-indigo-900 font-semibold'
                                : 'text-slate-700'
                            }`}
                          >
                            <FileText className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{doc.title}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {doc.fileName} • {doc.chapters?.length || 0} chapters
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Primary Upload CTA */}
            {onOpenUpload && (
              <button
                id="header-upload-btn"
                onClick={onOpenUpload}
                className="flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-all ring-1 ring-indigo-500/20 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span className="hidden sm:inline">Upload Material</span>
                <span className="sm:hidden">Upload</span>
              </button>
            )}

            {/* User Account / Firebase Auth Status */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
                title={currentUser?.email || (currentUser?.isAnonymous ? 'Anonymous Student' : 'Sign In')}
              >
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="User"
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  <UserIcon className="w-4 h-4 text-slate-600" />
                )}
              </button>

              {userDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 w-60 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
                    <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
                      <p className="font-bold text-slate-900 truncate">
                        {currentUser?.displayName || (currentUser?.isAnonymous ? 'Guest Student' : 'My Account')}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {currentUser?.email || (currentUser ? `ID: ${currentUser.uid.substring(0, 10)}...` : 'Not Signed In')}
                      </p>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          navigate('/admin');
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 text-slate-700 font-semibold flex items-center space-x-2 transition-colors cursor-pointer mb-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                        <span>Admin Dashboard</span>
                      </button>
                    )}
                    {!currentUser || currentUser.isAnonymous ? (
                      <button
                        id="open-auth-modal-btn"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setAuthModalOpen(true);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Sign In / Register</span>
                      </button>
                    ) : (
                      <button
                        id="logout-btn"
                        onClick={handleLogout}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-rose-50 text-rose-700 font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-600" />
                        <span>Sign Out</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        {activeTab && setActiveTab && (
          <div className="flex md:hidden overflow-x-auto py-2 border-t border-slate-100 no-scrollbar space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          setAuthModalOpen(false);
        }}
      />
    </header>
  );
};
