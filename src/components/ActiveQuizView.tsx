import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertCircle, Sparkles, Brain, Clock, HelpCircle, ChevronRight, BookOpen } from 'lucide-react';
import { Quiz, QuizQuestion, QuizSession, QuizAttempt } from '../types';

interface ActiveQuizViewProps {
  quiz: Quiz;
  session?: QuizSession;
  onComplete: (quiz: Quiz, attempt: QuizAttempt) => void;
  onExit: () => void;
}

export const ActiveQuizView: React.FC<ActiveQuizViewProps> = ({ quiz, session, onComplete, onExit }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(session?.currentQuestionIndex || 0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const raw = session?.answers;
    if (!raw) return {};
    return Object.fromEntries(
      Object.entries(raw).map(([id, value]) => [
        id,
        typeof value === 'string' ? value : value.userAnswer || '',
      ])
    );
  });
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTimeSpent((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const question = quiz.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;
  const isAnswered = !!answers[question.id];
  const currentAnswer = answers[question.id];
  const progressPercent = ((currentQuestionIndex) / quiz.questions.length) * 100;

  const handleSelectOption = (option: string) => {
    if (isAnswered) return;
    setAnswers({ ...answers, [question.id]: option });
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (!isLastQuestion) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setShowExplanation(false);
    } else {
      let correct = 0;
      quiz.questions.forEach((q) => { if (answers[q.id] === q.correctAnswer) correct++; });
      const attempt: QuizAttempt = {
        id: `att-local-${Date.now()}`,
        userId: quiz.userId,
        quizId: quiz.id,
        documentId: quiz.documentId,
        documentTitle: quiz.documentTitle,
        quizTitle: quiz.title,
        date: new Date().toISOString(),
        score: Math.round((correct / quiz.questions.length) * 100),
        correctCount: correct,
        totalCount: quiz.questions.length,
        timeSpentSeconds: timeSpent,
        userAnswers: answers,
        answers: [],
      };
      onComplete(quiz, attempt);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#cbede3] to-[#d6efe5] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-[1200px] h-[90vh] bg-[#FAF8F3] rounded-[36px] shadow-2xl overflow-hidden flex flex-col relative ring-[12px] ring-black/5 ring-inset">
        
        {/* Header */}
        <header className="h-[88px] px-8 flex items-center justify-between border-b border-[#e8e4db] shrink-0 bg-white/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center border border-teal-100">
              <Sparkles className="w-6 h-6 text-teal-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{quiz.title}</h1>
              <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mt-0.5">
                <BookOpen className="w-3.5 h-3.5" />
                {quiz.documentTitle}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-bold text-gray-700">
                {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <button
              onClick={onExit}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors shadow-sm border border-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-gray-200">
          <motion.div
            className="h-full bg-teal-500 rounded-r-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ ease: 'easeOut', duration: 0.5 }}
          />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
          <div className="w-full max-w-3xl">
            <div className="mb-6 flex justify-between items-center text-sm font-bold text-gray-400">
              <span>Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
              <span className="bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100 flex items-center gap-1.5 text-teal-600">
                <Brain className="w-4 h-4" />
                {question.difficulty}
              </span>
            </div>

            {/* Question Card */}
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 leading-snug mb-8">
                {question.question}
              </h2>

              <div className="space-y-3">
                {question.options.map((opt, idx) => {
                  const isSelected = currentAnswer === opt;
                  const isCorrect = opt === question.correctAnswer;
                  let stateClass = 'bg-[#FAF8F3] border-gray-200 hover:border-teal-300 hover:bg-teal-50/50 text-gray-700';
                  
                  if (showExplanation) {
                    if (isCorrect) stateClass = 'bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-500/20';
                    else if (isSelected) stateClass = 'bg-rose-50 border-rose-300 text-rose-900';
                    else stateClass = 'bg-[#FAF8F3] border-gray-200 opacity-50 text-gray-500';
                  } else if (isSelected) {
                    stateClass = 'bg-teal-50 border-teal-500 text-teal-900 shadow-sm';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(opt)}
                      disabled={showExplanation}
                      className={`w-full text-left p-5 rounded-2xl border-2 transition-all font-semibold flex items-center justify-between ${stateClass}`}
                    >
                      <span className="text-[15px]">{opt}</span>
                      {showExplanation && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
                      {showExplanation && isSelected && !isCorrect && <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Explanation Section */}
            <AnimatePresence>
              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 mb-20 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-400" />
                  <h3 className="font-bold text-gray-900 mb-2 text-sm flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-teal-500" />
                    Explanation
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {question.explanation}
                  </p>
                  
                  {question.sourceReferences && question.sourceReferences.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 mb-2">Sources:</p>
                      <ul className="space-y-1">
                        {question.sourceReferences.map((ref, i) => (
                          <li key={i} className="text-[11px] text-gray-500 flex gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                            {ref.chapter} (Page {ref.page})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Footer Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#FAF8F3] via-[#FAF8F3] to-transparent pointer-events-none flex justify-center">
          <div className="w-full max-w-3xl flex justify-end pointer-events-auto">
            <button
              onClick={handleNext}
              disabled={!isAnswered}
              className={`px-8 py-3.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all shadow-lg ${
                isAnswered
                  ? 'bg-gray-900 text-white hover:bg-gray-800 translate-y-0 opacity-100'
                  : 'bg-gray-200 text-gray-400 translate-y-4 opacity-0 cursor-default'
              }`}
            >
              {isLastQuestion ? 'Finish Quiz' : 'Next Question'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
