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
  MonitorPlay,
  Zap,
  BookOpen,
  Star,
} from 'lucide-react';
import { AuthModal } from '../components/AuthModal';

export function LandingPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const navigate = useNavigate();

  const features = [
    {
      icon: FileText,
      color: 'from-indigo-500 to-violet-500',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      title: '1. Upload Your PDF',
      desc: 'Upload any textbook, notes, or research paper. AI instantly creates your document card — no waiting.',
    },
    {
      icon: Brain,
      color: 'from-amber-400 to-orange-500',
      bg: 'bg-amber-500/10 border-amber-500/20',
      title: '2. AI Analyzes & Extracts',
      desc: 'Chapters, key terms, difficulty levels — all automatically extracted by ultra-fast AI in seconds.',
    },
    {
      icon: MonitorPlay,
      color: 'from-emerald-400 to-teal-500',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      title: '3. Quiz, Learn & Track',
      desc: 'Generate quizzes per chapter, review with flashcards, chat with AI Tutor, and watch your mastery grow.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#cbede3] to-[#d6efe5] font-sans antialiased overflow-x-hidden">

      {/* Animated background gradient */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-teal-400/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-400/5 rounded-full blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-40 border-b border-gray-200/50 bg-white/60 backdrop-blur-xl fixed top-0 w-full shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
              <Brain className="w-4.5 h-4.5" />
            </div>
            <span className="text-lg font-black tracking-tight text-gray-900">QuizMind AI</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setAuthModalOpen(true)}
              className="text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100/50"
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="text-sm font-bold bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-800 shadow-md transition-all"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6 max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-xs font-bold uppercase tracking-wider shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smarter Studying Starts Here</span>
          </motion.div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] text-gray-900">
            Turn Your PDFs Into{' '}
            <span className="bg-gradient-to-r from-teal-500 to-indigo-500 bg-clip-text text-transparent">
              AI Study Power
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 font-medium leading-relaxed max-w-2xl mx-auto">
            Upload any textbook or lecture notes. Get instant AI-extracted chapters, personalized quizzes, flashcards, and a grounded AI Tutor — all in seconds.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={() => setAuthModalOpen(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gray-900 text-white font-bold text-base hover:bg-gray-800 shadow-xl shadow-gray-900/20 transition-all flex items-center justify-center space-x-2 group cursor-pointer"
            >
              <span>Start Learning for Free</span>
              <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white border border-gray-200 text-gray-700 font-bold text-base hover:bg-gray-50 shadow-sm transition-all flex items-center justify-center cursor-pointer"
            >
              See How It Works
            </a>
          </motion.div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 pt-6 flex-wrap">
            {['No credit card required', 'Instant setup', 'AI-grounded answers'].map((badge) => (
              <div key={badge} className="flex items-center space-x-1.5 text-xs text-zinc-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>{badge}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-20 mx-auto max-w-5xl"
        >
          <div className="rounded-[36px] shadow-2xl bg-[#FAF8F3] overflow-hidden p-3 ring-[12px] ring-black/5">
            <div className="rounded-3xl bg-white border border-[#f0ece1] aspect-[16/10] flex items-center justify-center relative overflow-hidden shadow-sm">
              {/* Fake dashboard UI overlay */}
              <div className="absolute inset-0 flex">
                <div className="w-[80px] border-r border-[#e8e4db] bg-[#FAF8F3] flex flex-col items-center py-6">
                  <div className="w-10 h-10 rounded-full bg-gray-900 mb-8" />
                  <div className="w-10 h-10 rounded-full bg-gray-200 mb-4" />
                  <div className="w-10 h-10 rounded-full bg-gray-200 mb-4" />
                  <div className="w-10 h-10 rounded-full bg-gray-200 mb-4" />
                </div>
                <div className="flex-1 p-8 bg-[#FAF8F3]">
                  <div className="h-10 w-48 bg-gray-200 rounded-lg mb-8" />
                  <div className="flex gap-4 mb-8">
                    <div className="h-32 flex-1 bg-white border border-[#f0ece1] rounded-2xl" />
                    <div className="h-32 flex-1 bg-white border border-[#f0ece1] rounded-2xl" />
                    <div className="h-32 flex-1 bg-white border border-[#f0ece1] rounded-2xl" />
                  </div>
                  <div className="h-64 bg-white border border-[#f0ece1] rounded-3xl" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* How it Works */}
      <section id="how-it-works" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider shadow-sm">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>How It Works</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Master Material in Three Steps</h2>
            <p className="text-gray-600 font-medium max-w-xl mx-auto">From PDF to exam-ready in under a minute.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative p-8 rounded-[32px] bg-white border border-[#f0ece1] shadow-sm hover:border-teal-300 hover:shadow-md transition-all group"
              >
                <div className={`w-14 h-14 rounded-2xl ${f.bg} border flex items-center justify-center mb-6`}>
                  <f.icon className="w-7 h-7 text-gray-700" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{f.title}</h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">{f.desc}</p>
                <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-[#FAF8F3] border border-[#e8e4db] flex items-center justify-center text-xs font-bold text-gray-400 group-hover:text-teal-600 group-hover:bg-teal-50 transition-colors">
                  {i + 1}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* RAG / Security Section */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-[36px] bg-white border border-[#f0ece1] shadow-sm p-8 md:p-12 grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Grounded AI Architecture</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
                Answers based strictly on your textbooks.
              </h2>
              <p className="text-gray-600 font-medium leading-relaxed">
                Unlike generic AI that hallucinates facts, QuizMind uses Retrieval-Augmented Generation (RAG). Every quiz question and AI Tutor response is grounded in your uploaded PDFs.
              </p>
              <ul className="space-y-3">
                {['Real page references for every explanation', 'Your books are private & secure', 'No generic web answers — just your syllabus'].map((item) => (
                  <li key={item} className="flex items-center space-x-3 text-gray-700 font-medium text-sm">
                    <CheckCircle2 className="w-4.5 h-4.5 text-teal-500 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-[#FAF8F3] rounded-3xl p-6 border border-[#e8e4db] space-y-3 relative overflow-hidden"
            >
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 shrink-0 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-teal-600" />
                </div>
                <div className="bg-white shadow-sm rounded-2xl p-4 text-sm text-gray-700 font-medium border border-[#f0ece1]">
                  "Based on Chapter 4, the mitochondria carries out cellular respiration via the Krebs cycle."
                  <div className="mt-2 text-xs text-teal-600 font-bold flex items-center space-x-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Source: Biology 101.pdf — Page 42</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
                <span className="text-xs text-gray-500 font-bold ml-1 uppercase tracking-wider">Grounded AI answers</span>
              </div>
              <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-teal-100/50 rounded-full blur-3xl" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto space-y-6 bg-white p-12 rounded-[40px] shadow-sm border border-[#f0ece1]"
        >
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
            Ready to study smarter?
          </h2>
          <p className="text-gray-600 font-medium text-lg">Upload your first PDF and get AI quizzes in under 30 seconds.</p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="inline-flex items-center space-x-2 px-10 py-4 rounded-2xl bg-gray-900 text-white font-bold text-lg hover:bg-gray-800 shadow-xl shadow-gray-900/20 transition-all group cursor-pointer"
          >
            <span>Get Started Free</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#e8e4db] bg-white/60 backdrop-blur-md py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5" />
            </div>
            <span className="text-base font-extrabold text-gray-900 tracking-tight">QuizMind AI</span>
          </div>
          <div className="flex space-x-6 text-sm font-bold text-gray-500">
            {['Features', 'How It Works', 'Privacy', 'Terms'].map((link) => (
              <a key={link} href="#" className="hover:text-gray-900 transition-colors">{link}</a>
            ))}
          </div>
          <div className="text-sm font-bold text-gray-400">
            © {new Date().getFullYear()} QuizMind AI
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => navigate('/dashboard')}
      />
    </div>
  );
}
