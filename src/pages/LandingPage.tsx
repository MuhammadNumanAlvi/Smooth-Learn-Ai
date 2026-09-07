import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Brain,
  FileText,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Zap,
  BookOpen,
  Layers,
  MessageCircle,
  BarChart3,
  HelpCircle,
  Upload,
  ListChecks,
} from 'lucide-react';
import { AuthModal } from '../components/AuthModal';

export function LandingPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const navigate = useNavigate();

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const steps = [
    {
      icon: Upload,
      title: 'Create a free account',
      desc: 'Sign up with email or Google. Your books and scores stay on your account only.',
    },
    {
      icon: FileText,
      title: 'Upload your textbook',
      desc: 'Drop in a PDF — notes, syllabus, or a full Grade 10 book. AI reads it in the background.',
    },
    {
      icon: BookOpen,
      title: 'Study chapter by chapter',
      desc: 'Get a table of contents, summaries, and key terms pulled from YOUR book — not the internet.',
    },
    {
      icon: ListChecks,
      title: 'Test yourself',
      desc: 'Generate quizzes and flashcards for one chapter, flip cards, then chat with a tutor that only uses that book.',
    },
  ];

  const tools = [
    {
      icon: HelpCircle,
      title: 'Chapter quizzes',
      desc: 'Pick a chapter, set difficulty, and get questions grounded in the pages you uploaded.',
    },
    {
      icon: Layers,
      title: 'Flashcards',
      desc: 'Left side shows every chapter. Open one and review only those cards — not the whole book mixed together.',
    },
    {
      icon: MessageCircle,
      title: 'AI Tutor',
      desc: 'Ask “summarize chapter 1” or “explain Boyle’s Law”. Answers come from your selected book.',
    },
    {
      icon: BarChart3,
      title: 'Progress',
      desc: 'See scores, streaks, and weak topics so you know what to revise before the exam.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#cbede3] to-[#d6efe5] font-sans antialiased overflow-x-hidden text-gray-900">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-teal-400/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-400/5 rounded-full blur-[100px]" />
      </div>

      <nav className="fixed top-0 z-40 w-full border-b border-gray-200/50 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
              <Brain className="w-4 h-4" />
            </div>
            <span className="text-lg font-black tracking-tight text-gray-900">QuizMind AI</span>
          </a>
          <div className="hidden md:flex items-center gap-6 text-sm font-bold text-gray-600">
            <a href="#how-it-works" className="hover:text-gray-900">How it works</a>
            <a href="#tools" className="hover:text-gray-900">What you get</a>
            <a href="#why" className="hover:text-gray-900">Why it is different</a>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              type="button"
              onClick={() => openAuth('login')}
              className="text-sm font-bold text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-white/70"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => openAuth('register')}
              className="text-sm font-bold bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-800 shadow-md"
            >
              Create account
            </button>
          </div>
        </div>
      </nav>

      <main id="top" className="relative z-10 pt-28 sm:pt-32 pb-16 px-4 sm:px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mx-auto space-y-6"
        >
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white border border-teal-100 text-teal-700 text-xs font-bold uppercase tracking-wider shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>For students — not a generic chatbot</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-gray-900">
            Upload your book.{' '}
            <span className="bg-gradient-to-r from-teal-600 to-indigo-500 bg-clip-text text-transparent">
              Study it like an exam.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 font-medium leading-relaxed">
            QuizMind AI turns a textbook PDF into chapters, quizzes, flashcards, and a tutor that only answers from
            <strong className="text-gray-800"> your</strong> book. Create a free account, upload once, then practice until you are ready.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => openAuth('register')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gray-900 text-white font-bold hover:bg-gray-800 shadow-xl shadow-gray-900/15 flex items-center justify-center gap-2"
            >
              Create your free account
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50"
            >
              See the full idea
            </a>
          </div>
          <div className="flex items-center justify-center gap-5 flex-wrap pt-2 text-xs text-gray-500 font-medium">
            {['Free to start', 'Your books stay private', 'No admin account needed'].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {item}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-14 grid sm:grid-cols-3 gap-4"
        >
          {[
            { k: '01', t: 'Your book', d: 'Chemistry, notes, any PDF syllabus' },
            { k: '02', t: 'Your practice', d: 'Chapter quizzes + flashcards' },
            { k: '03', t: 'Your tutor', d: 'Ask questions, get book-based answers' },
          ].map((card) => (
            <div key={card.k} className="bg-white/80 border border-white rounded-3xl p-5 shadow-sm text-left">
              <p className="text-[11px] font-black text-teal-600 tracking-widest">{card.k}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{card.t}</p>
              <p className="text-sm text-gray-500 mt-1">{card.d}</p>
            </div>
          ))}
        </motion.div>
      </main>

      <section id="how-it-works" className="relative z-10 py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> How it works
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">From PDF to exam practice</h2>
            <p className="text-gray-600 font-medium max-w-2xl mx-auto">
              This is a student study workspace. You are not logging into an admin panel — you create a learner account and start with your first book.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-white rounded-[28px] border border-[#f0ece1] p-6 shadow-sm"
              >
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mb-4">
                  <step.icon className="w-6 h-6 text-teal-700" />
                </div>
                <p className="text-[11px] font-black text-gray-400 mb-1">STEP {i + 1}</p>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="tools" className="relative z-10 py-8 px-4 sm:px-6 pb-20">
        <div className="max-w-6xl mx-auto bg-white rounded-[36px] border border-[#f0ece1] shadow-sm p-8 md:p-12">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl font-extrabold text-gray-900">Everything after you upload</h2>
            <p className="text-gray-600 font-medium mt-3">
              One dashboard. One selected book. Then you choose how to study — quiz, cards, tutor, or progress.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {tools.map((tool) => (
              <div key={tool.title} className="flex gap-4 p-5 rounded-3xl bg-[#FAF8F3] border border-[#e8e4db]">
                <div className="w-11 h-11 rounded-2xl bg-white border border-[#e8e4db] flex items-center justify-center shrink-0">
                  <tool.icon className="w-5 h-5 text-gray-800" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{tool.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{tool.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="why" className="relative z-10 pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto rounded-[36px] bg-gray-900 text-white p-8 md:p-12 grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-teal-200 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              Grounded in your syllabus
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
              Not ChatGPT with a random answer. Your textbook, cited.
            </h2>
            <p className="text-white/70 font-medium leading-relaxed">
              Quizzes, flashcards, and the tutor pull from the chapters inside the book you selected. That is the whole idea: practice what you will actually be tested on.
            </p>
            <ul className="space-y-3 text-sm font-medium text-white/85">
              {[
                'Chapters extracted from the PDF you upload',
                'Questions and cards scoped to one chapter',
                'Tutor refuses to invent a different book',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Example student flow</p>
            <div className="space-y-3 text-sm">
              <div className="bg-white text-gray-800 rounded-2xl p-4 font-medium">
                I uploaded Chemistry Grade 10. Show me cards for States of Matter.
              </div>
              <div className="bg-teal-500/15 border border-teal-400/20 rounded-2xl p-4 text-teal-50">
                13 chapters are ready. Open “States of Matter” on the left — melting, boiling, and diffusion cards load for that chapter only.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 pb-24 px-4 text-center">
        <div className="max-w-2xl mx-auto bg-white p-10 sm:p-12 rounded-[40px] shadow-sm border border-[#f0ece1] space-y-5">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Ready to try it with your book?</h2>
          <p className="text-gray-600 font-medium">
            Create a student account, upload one PDF, and run your first chapter quiz. Sign in later with the same email.
          </p>
          <button
            type="button"
            onClick={() => openAuth('register')}
            className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl bg-gray-900 text-white font-bold text-lg hover:bg-gray-800 shadow-xl"
          >
            Create account
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-sm text-gray-500">
            Already studying here?{' '}
            <button type="button" onClick={() => openAuth('login')} className="font-bold text-teal-700 hover:underline">
              Sign in
            </button>
          </p>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[#e8e4db] bg-white/70 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-sm">
          <div className="flex items-center gap-2 font-extrabold text-gray-900">
            <Brain className="w-4 h-4 text-teal-600" />
            QuizMind AI
          </div>
          <p className="text-gray-400 font-medium">A book-based study app for students</p>
          <div className="flex items-center gap-4 text-gray-400">
            <button type="button" onClick={() => openAuth('login')} className="hover:text-gray-700 font-medium">
              Admin sign in
            </button>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => navigate('/dashboard')}
      />
    </div>
  );
}
