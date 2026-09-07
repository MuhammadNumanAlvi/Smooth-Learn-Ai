import React from 'react';
import { Trophy, Clock, Target, CheckCircle2, AlertCircle, ArrowRight, RotateCcw, Home, Sparkles, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { Quiz, QuizAttempt } from '../types';

interface QuizResultsViewProps {
  quiz: Quiz;
  attempt: QuizAttempt;
  onRetake: () => void;
  onDone: () => void;
}

export const QuizResultsView: React.FC<QuizResultsViewProps> = ({ quiz, attempt, onRetake, onDone }) => {
  const isPassing = attempt.score >= 70;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#cbede3] to-[#d6efe5] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-[1200px] h-[90vh] bg-[#FAF8F3] rounded-[36px] shadow-2xl overflow-hidden flex flex-col relative ring-[12px] ring-black/5 ring-inset">
        
        {/* Header */}
        <header className="h-[88px] px-8 flex items-center justify-between border-b border-[#e8e4db] shrink-0 bg-white/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center border border-teal-100">
              <Trophy className="w-6 h-6 text-teal-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Quiz Results</h1>
              <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mt-0.5">
                <BookOpen className="w-3.5 h-3.5" />
                {quiz.title}
              </p>
            </div>
          </div>
          <button onClick={onDone} className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors shadow-sm border border-gray-100">
            <Home className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
          <div className="w-full max-w-4xl space-y-8">
            
            {/* Score Overview Card */}
            <div className="bg-white rounded-[32px] border border-[#f0ece1] shadow-sm p-8 flex flex-col md:flex-row items-center gap-10">
              
              <div className="relative w-48 h-48 shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" stroke="#f3f4f6" strokeWidth="10" fill="none" />
                  <motion.circle 
                    cx="50" cy="50" r="42" 
                    stroke={isPassing ? '#2dd4bf' : '#f43f5e'} 
                    strokeWidth="10" fill="none" 
                    strokeDasharray="263.89" 
                    initial={{ strokeDashoffset: 263.89 }}
                    animate={{ strokeDashoffset: 263.89 - (263.89 * attempt.score) / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Score</span>
                  <span className={`text-4xl font-black ${isPassing ? 'text-teal-600' : 'text-rose-600'}`}>
                    {attempt.score}%
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {isPassing ? 'Excellent Work!' : 'Keep Practicing!'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {isPassing 
                      ? "You've mastered this material. Review any missed questions below."
                      : "You can do better. Review the explanations and try again."}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[#FAF8F3] p-4 rounded-2xl border border-[#e8e4db]">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <Target className="w-4 h-4" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Total</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900">{quiz.questions.length}</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <div className="flex items-center gap-2 text-emerald-600 mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Correct</span>
                    </div>
                    <p className="text-2xl font-black text-emerald-700">{attempt.correctCount}</p>
                  </div>
                  <div className="bg-[#FAF8F3] p-4 rounded-2xl border border-[#e8e4db]">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Time</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900">
                      {Math.floor(attempt.timeSpentSeconds / 60)}m {attempt.timeSpentSeconds % 60}s
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={onRetake} className="flex-1 bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-2xl font-bold text-sm hover:border-gray-300 hover:bg-gray-50 flex justify-center items-center gap-2 transition-all">
                    <RotateCcw className="w-4 h-4" /> Retake Quiz
                  </button>
                  <button onClick={onDone} className="flex-1 bg-gray-900 text-white py-3 rounded-2xl font-bold text-sm hover:bg-gray-800 shadow-md flex justify-center items-center gap-2 transition-all">
                    Return to Dashboard <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Detailed Review */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4 px-2">Detailed Review</h3>
              {quiz.questions.map((q, idx) => {
                const userAnswer = attempt.userAnswers[q.id];
                const isCorrect = userAnswer === q.correctAnswer;
                
                return (
                  <div key={q.id} className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 relative overflow-hidden">
                    <div className={`absolute left-0 top-0 w-1.5 h-full ${isCorrect ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    
                    <div className="flex gap-4">
                      <div className="shrink-0 mt-1">
                        {isCorrect ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-rose-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-4">
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Question {idx + 1}</span>
                          <h4 className="text-[15px] font-bold text-gray-900 leading-snug">{q.question}</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className={`p-4 rounded-xl border ${isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'}`}>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Your Answer</span>
                            <p className={`text-sm font-semibold ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                              {userAnswer || 'Skipped'}
                            </p>
                          </div>
                          {!isCorrect && (
                            <div className="p-4 rounded-xl border bg-emerald-50/50 border-emerald-200">
                              <span className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-wider mb-1 block">Correct Answer</span>
                              <p className="text-sm font-semibold text-emerald-800">
                                {q.correctAnswer}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="bg-[#FAF8F3] rounded-xl p-4 border border-[#e8e4db]">
                          <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" /> AI Explanation
                          </span>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {q.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};
