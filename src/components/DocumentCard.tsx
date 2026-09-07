import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Trash2, Play, Sparkles, Brain, BookOpen, Clock,
  AlertCircle, CheckCircle2, Loader2, MoreVertical, Zap, Target,
} from 'lucide-react';
import { DocumentItem } from '../types';

interface DocumentCardProps {
  document: DocumentItem;
  isSelected: boolean;
  onSelect: () => void;
  onStartQuiz: () => void;
  onOpenFlashcards: () => void;
  onOpenTutor: () => void;
  onDelete: () => void;
}

const PROCESSING_STAGES = [
  'Extracting text...',
  'Analyzing chapters...',
  'Building knowledge base...',
  'Indexing content...',
  'Almost ready...',
];

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document: doc,
  isSelected,
  onSelect,
  onStartQuiz,
  onOpenFlashcards,
  onOpenTutor,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stageIdx] = useState(() => Math.floor(Math.random() * PROCESSING_STAGES.length));

  const isProcessing = doc.processingStatus === 'processing';
  const isFailed = doc.processingStatus === 'failed';
  const isReady = doc.processingStatus === 'ready' || (!doc.processingStatus);

  const progress = doc.progress || 0;
  const difficultyColor = {
    Beginner: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    Intermediate: 'text-amber-600 bg-amber-50 border-amber-200',
    Advanced: 'text-rose-600 bg-rose-50 border-rose-200',
  }[doc.overallDifficulty || 'Intermediate'] || 'text-indigo-600 bg-indigo-50 border-indigo-200';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300 }}
      onClick={onSelect}
      className={`relative bg-white rounded-2xl border transition-all shadow-sm cursor-pointer overflow-hidden ${
        isSelected ? 'border-indigo-300 ring-2 ring-indigo-100 shadow-md' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
      }`}
    >
      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 space-y-4">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
            className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center"
          >
            <Brain className="w-6 h-6 text-indigo-500" />
          </motion.div>
          <div className="text-center space-y-1">
            <p className="text-xs font-bold text-gray-800">AI Processing</p>
            <motion.p
              key={stageIdx}
              animate={{ opacity: [0, 1] }}
              className="text-[11px] text-gray-400"
            >
              {PROCESSING_STAGES[stageIdx]}
            </motion.p>
          </div>
          <div className="w-full max-w-[140px] space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Progress</span>
              <span className="text-indigo-500 font-semibold">{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="absolute inset-0 z-10 bg-white/95 rounded-2xl flex flex-col items-center justify-center p-6 space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-400" />
          <p className="text-xs font-semibold text-gray-700 text-center">Processing failed</p>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-xs text-rose-500 hover:text-rose-700 font-medium">Remove</button>
        </div>
      )}

      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex items-center space-x-1.5">
            {isSelected && (
              <span className="flex items-center space-x-1 px-2 py-0.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 rounded-full border border-indigo-200">
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>Active</span>
              </span>
            )}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 top-8 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30"
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Book</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2">{doc.title}</h3>
          <p className="text-[11px] text-gray-400 mt-1 truncate">{doc.fileName}</p>
        </div>

        {doc.overallDifficulty && (
          <div className="mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${difficultyColor}`}>
              {doc.overallDifficulty}
            </span>
          </div>
        )}

        {/* Progress bar if studying */}
        {isReady && doc.progress !== undefined && doc.progress > 0 && doc.progress < 100 && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Progress</span>
              <span>{doc.progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${doc.progress}%` }} />
            </div>
          </div>
        )}

        {/* Stats row */}
        {isReady && (
          <div className="mt-4 flex items-center space-x-4 text-[11px] text-gray-400">
            <span className="flex items-center space-x-1">
              <BookOpen className="w-3 h-3" />
              <span>{doc.chapters?.length || 0} chapters</span>
            </span>
            <span className="flex items-center space-x-1">
              <Target className="w-3 h-3" />
              <span>{doc.keyTerms?.length || 0} terms</span>
            </span>
            {doc.lastStudiedAt && (
              <span className="flex items-center space-x-1 ml-auto">
                <Clock className="w-3 h-3" />
                <span>{new Date(doc.lastStudiedAt).toLocaleDateString()}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {isReady && (
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onStartQuiz(); }}
            className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-500 transition-colors cursor-pointer shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Quiz</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenFlashcards(); }}
            className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-gray-50 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cards</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenTutor(); }}
            className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-gray-50 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors cursor-pointer"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Tutor</span>
          </button>
        </div>
      )}
    </motion.div>
  );
};
