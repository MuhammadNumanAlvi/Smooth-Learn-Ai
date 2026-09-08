import React, { useState, useEffect } from 'react';
import { X, HelpCircle, Sparkles, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DocumentItem, Quiz, QuizDifficulty, QuestionStyle, QuizSession } from '../types';
import { api } from '../lib/api';

interface QuizConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentItem[];
  selectedDoc: DocumentItem | null;
  initialChapterTitle?: string;
  onQuizGenerated: (quiz: Quiz, session?: QuizSession) => void;
}

export const QuizConfigModal: React.FC<QuizConfigModalProps> = ({
  isOpen,
  onClose,
  documents,
  selectedDoc,
  initialChapterTitle,
  onQuizGenerated,
}) => {
  const [docId, setDocId] = useState<string>(selectedDoc?.id || documents[0]?.id || '');
  const [chapterTitle, setChapterTitle] = useState<string>(initialChapterTitle || '');
  const [topic, setTopic] = useState<string>('');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('Medium');
  const [questionStyle, setQuestionStyle] = useState<QuestionStyle>('Mixed');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<string>('Retrieving material...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDocId(selectedDoc?.id || documents[0]?.id || '');
    setChapterTitle(initialChapterTitle || '');
    setError(null);
  }, [isOpen, selectedDoc?.id, initialChapterTitle, documents]);

  if (!isOpen) return null;

  const activeDoc = documents.find((d) => d.id === docId) || selectedDoc || documents[0];

  const handleGenerate = async () => {
    if (!activeDoc) {
      setError('Please select a study material first.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerationStage('Retrieving study material with RAG...');

    const stageTimer1 = setTimeout(() => setGenerationStage('Synthesizing questions...'), 2000);
    const stageTimer2 = setTimeout(() => setGenerationStage('Validating citations...'), 4000);

    try {
      const { loadBookText, textForChapter } = await import('../lib/bookText');
      const bookText = await loadBookText(activeDoc.id);
      const { quiz, session } = await api.generateQuiz({
        documentId: activeDoc.id,
        chapterTitle: chapterTitle || undefined,
        topic: topic.trim() || undefined,
        questionType: 'multiple_choice',
        difficulty,
        questionStyle,
        count: questionCount,
        sourceText: textForChapter(bookText, chapterTitle),
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setIsGenerating(false);
      onQuizGenerated(quiz, session);
      onClose();
    } catch (err: any) {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setIsGenerating(false);
      setError(err.message || 'Failed to generate quiz. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-teal-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-[#FAF8F3] rounded-[32px] shadow-2xl border border-white overflow-hidden p-8"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center shadow-sm">
                <HelpCircle className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Quiz Configuration</h3>
                <p className="text-xs text-gray-500">Fine-tune your AI-generated assessment</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <div className="space-y-6">
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3 text-rose-700">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            {isGenerating ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 border-4 border-teal-100 rounded-full" />
                  <div className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin" />
                  <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 relative z-10">
                    <Sparkles className="w-10 h-10 text-teal-500" />
                  </div>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">{generationStage}</h4>
                <p className="text-sm text-gray-500 max-w-sm">
                  We are reading your document and generating high-quality questions with verified citations.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Column */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                      Source Material
                    </label>
                    <select
                      value={docId}
                      onChange={(e) => { setDocId(e.target.value); setChapterTitle(''); }}
                      className="w-full px-4 py-3 bg-white text-sm font-medium text-gray-800 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-sm appearance-none"
                    >
                      {documents.map((d) => (
                        <option key={d.id} value={d.id}>{d.title}</option>
                      ))}
                    </select>
                  </div>

                  {activeDoc?.chapters && activeDoc.chapters.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                        Study Scope
                      </label>
                      <select
                        value={chapterTitle}
                        onChange={(e) => setChapterTitle(e.target.value)}
                        className="w-full px-4 py-3 bg-white text-sm font-medium text-gray-800 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-sm appearance-none"
                      >
                        <option value="">Full Document (Comprehensive)</option>
                        {activeDoc.chapters.map((ch, idx) => (
                          <option key={ch.id || idx} value={ch.title}>Chapter {idx + 1}: {ch.title}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                      Focus Topic (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Thermodynamics, Supply Chain"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full px-4 py-3 bg-white text-sm font-medium text-gray-800 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-sm placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                      Question Count: <span className="text-teal-600">{questionCount}</span>
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 10, 15, 20].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setQuestionCount(count)}
                          className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                            questionCount === count
                              ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                      Difficulty
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Easy', 'Medium', 'Hard', 'Mixed'] as QuizDifficulty[]).map((diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => setDifficulty(diff)}
                          className={`py-2.5 px-3 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-2 ${
                            difficulty === diff
                              ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-sm'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {difficulty === diff && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                      Question Style
                    </label>
                    <select
                      value={questionStyle}
                      onChange={(e) => setQuestionStyle(e.target.value as QuestionStyle)}
                      className="w-full px-4 py-3 bg-white text-sm font-medium text-gray-800 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-sm appearance-none"
                    >
                      <option value="Mixed">Mixed Styles</option>
                      <option value="Conceptual">Conceptual & Theory</option>
                      <option value="Factual">Factual Definitions</option>
                      <option value="Application Based">Application & Scenarios</option>
                    </select>
                  </div>
                </div>

              </div>
            )}

            {/* Footer */}
            {!isGenerating && (
              <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 rounded-2xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="px-8 py-3 rounded-2xl text-sm font-bold bg-gray-900 text-white shadow-lg hover:bg-gray-800 transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Generate Quiz
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
