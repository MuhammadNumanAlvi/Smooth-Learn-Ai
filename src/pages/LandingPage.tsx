import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Brain,
  FileText,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  Layers,
  MessageCircle,
  BarChart3,
  HelpCircle,
  Upload,
} from 'lucide-react';
import { AuthModal } from '../components/AuthModal';

const faqs = [
  {
    q: 'What is Smooth Learn?',
    a: 'Smooth Learn is a study site for school and college students. You upload a textbook or notes as a PDF, then practise from that same book — chapter quizzes, flashcards, and a tutor that stays on your material.',
  },
  {
    q: 'Who is it for?',
    a: 'Mostly secondary and college students who already have a syllabus book and want to test themselves before exams. If you are cramming Chemistry Grade 10 or revising lecture notes, this is built for that.',
  },
  {
    q: 'Do I need to pay to start?',
    a: 'You can create a free account, upload a book, and start a quiz. No card is asked on signup.',
  },
  {
    q: 'Are my books public?',
    a: 'No. A book you upload sits on your account. Other students do not see your PDFs or your scores.',
  },
  {
    q: 'How do quizzes work?',
    a: 'Pick the book, pick a chapter if you want, then generate a quiz. Questions are pulled from that chapter, not from a random internet page.',
  },
  {
    q: 'Can I study one chapter at a time?',
    a: 'Yes. Flashcards list every chapter on the left. Open one chapter and you only see those cards. Same idea for chapter quizzes.',
  },
];

export function LandingPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const navigate = useNavigate();

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#cbede3] to-[#d6efe5] font-sans antialiased overflow-x-hidden text-gray-900">
      <header className="fixed top-0 z-40 w-full border-b border-gray-200/50 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center space-x-2.5" aria-label="Smooth Learn home">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
              <Brain className="w-4 h-4" aria-hidden="true" />
            </div>
            <span className="text-lg font-black tracking-tight text-gray-900">Smooth Learn</span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-gray-600" aria-label="Page">
            <a href="#how-it-works" className="hover:text-gray-900">How it works</a>
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#faq" className="hover:text-gray-900">FAQ</a>
          </nav>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button type="button" onClick={() => openAuth('login')} className="text-sm font-bold text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-white/70">
              Sign In
            </button>
            <button type="button" onClick={() => openAuth('register')} className="text-sm font-bold bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-800 shadow-md">
              Create account
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative z-10 pt-28 sm:pt-32 pb-16 px-4 sm:px-6 max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto space-y-6">
            <p className="text-sm font-semibold text-teal-800">Study from the book you already have</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.12] text-gray-900">
              Open the PDF. Practise the chapter. Close the book when you are done.
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 leading-relaxed">
              Smooth Learn is a quiet place to revise. Upload your textbook, pick a chapter, and run through questions
              and cards until the topic sits. No extra apps. No mixed-up notes from someone else’s syllabus.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => openAuth('register')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gray-900 text-white font-bold hover:bg-gray-800 shadow-xl flex items-center justify-center gap-2"
              >
                Create a free account
                <ArrowRight className="w-4 h-4" />
              </button>
              <a href="#how-it-works" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50">
                See how a book is studied
              </a>
            </div>
            <p className="text-sm text-gray-500">Free to join. Sign in later with the same email and password.</p>
          </motion.div>
        </section>

        <section id="how-it-works" className="relative z-10 py-16 px-4 sm:px-6" aria-labelledby="how-heading">
          <div className="max-w-6xl mx-auto">
            <h2 id="how-heading" className="text-3xl sm:text-4xl font-extrabold text-gray-900 text-center mb-3">
              Four steps, then you are in the book
            </h2>
            <p className="text-gray-600 text-center max-w-2xl mx-auto mb-12">
              Most people finish setup in one sitting. After that you come back, pick the chapter you failed last time, and try again.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: Upload, title: 'Make an account', text: 'Name, school, class, email, password. That is the whole form.' },
                { icon: FileText, title: 'Upload the PDF', text: 'Your textbook, photocopied notes, or a chapter pack. One file is enough to start.' },
                { icon: BookOpen, title: 'Wait for chapters', text: 'The site splits the file into a contents list with short summaries and key terms.' },
                { icon: HelpCircle, title: 'Practise a chapter', text: 'Quiz it, flip cards, or ask a question about that chapter only.' },
              ].map((step, i) => (
                <article key={step.title} className="bg-white rounded-[28px] border border-[#f0ece1] p-6 shadow-sm">
                  <step.icon className="w-6 h-6 text-teal-700 mb-4" aria-hidden="true" />
                  <p className="text-[11px] font-black text-gray-400 mb-1">STEP {i + 1}</p>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="relative z-10 py-8 px-4 sm:px-6 pb-16" aria-labelledby="features-heading">
          <div className="max-w-6xl mx-auto bg-white rounded-[36px] border border-[#f0ece1] shadow-sm p-8 md:p-12">
            <h2 id="features-heading" className="text-3xl font-extrabold text-gray-900">What you actually use after upload</h2>
            <p className="text-gray-600 mt-3 max-w-2xl">
              The dashboard is small on purpose. Select a book on the right, then stay in one of these four tools.
            </p>
            <div className="grid sm:grid-cols-2 gap-6 mt-10">
              {[
                { icon: HelpCircle, title: 'Chapter quizzes', text: 'Five to twenty questions from the chapter you chose. You see the mark as soon as you finish.' },
                { icon: Layers, title: 'Flashcards', text: 'Chapters sit in a list. Click one and only those cards show. Flip for the answer, then go next.' },
                { icon: MessageCircle, title: 'Book tutor', text: 'Ask “what is in chapter 1?” or a line you did not get. It answers from the uploaded book, not a general webpage.' },
                { icon: BarChart3, title: 'Your scores', text: 'Past quizzes, average mark, and the topics you keep missing. Useful the week before a paper.' },
              ].map((item) => (
                <article key={item.title} className="flex gap-4 p-5 rounded-3xl bg-[#FAF8F3] border border-[#e8e4db]">
                  <item.icon className="w-5 h-5 text-gray-800 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h3 className="font-bold text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 pb-16 px-4 sm:px-6" aria-labelledby="who-heading">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
            <article className="bg-white rounded-[32px] border border-[#f0ece1] p-8">
              <h2 id="who-heading" className="text-2xl font-extrabold text-gray-900 mb-3">Built around a real syllabus</h2>
              <p className="text-gray-600 leading-relaxed">
                If your class is on States of Matter this week, you should not get a quiz on polymers. Smooth Learn
                keeps practice inside the chapter you opened. That is the whole point of uploading your own file
                instead of picking a generic subject from a list.
              </p>
            </article>
            <article className="bg-white rounded-[32px] border border-[#f0ece1] p-8">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-3">A normal login</h2>
              <p className="text-gray-600 leading-relaxed">
                Students sign in with email and password. Tick “remember me” if you use the same laptop at home.
                Create the account once; next time you just come back and open the book.
              </p>
            </article>
          </div>
        </section>

        <section id="faq" className="relative z-10 pb-16 px-4 sm:px-6" aria-labelledby="faq-heading">
          <div className="max-w-3xl mx-auto">
            <h2 id="faq-heading" className="text-3xl font-extrabold text-gray-900 mb-8 text-center">
              Questions people ask before signing up
            </h2>
            <dl className="space-y-4">
              {faqs.map((item) => (
                <div key={item.q} className="bg-white rounded-2xl border border-[#f0ece1] p-5">
                  <dt className="font-bold text-gray-900">{item.q}</dt>
                  <dd className="text-sm text-gray-600 mt-2 leading-relaxed">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="relative z-10 pb-24 px-4 text-center" aria-labelledby="cta-heading">
          <div className="max-w-2xl mx-auto bg-white p-10 sm:p-12 rounded-[40px] shadow-sm border border-[#f0ece1] space-y-5">
            <h2 id="cta-heading" className="text-3xl font-extrabold text-gray-900">Bring one book tonight</h2>
            <p className="text-gray-600">
              Make an account, upload the PDF, and try a short quiz on the first chapter. That is enough to know if it fits how you revise.
            </p>
            <button
              type="button"
              onClick={() => openAuth('register')}
              className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl bg-gray-900 text-white font-bold text-lg hover:bg-gray-800"
            >
              Create account
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <button type="button" onClick={() => openAuth('login')} className="font-bold text-teal-700 hover:underline">
                Sign in
              </button>
            </p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#e8e4db] bg-white/70 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-sm">
          <p className="flex items-center gap-2 font-extrabold text-gray-900">
            <Brain className="w-4 h-4 text-teal-600" aria-hidden="true" />
            Smooth Learn
          </p>
          <p className="text-gray-500">Textbook practice for students · <a href="https://www.smoothlearn.me" className="hover:underline">smoothlearn.me</a></p>
          <p className="text-gray-400">© {new Date().getFullYear()}</p>
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
