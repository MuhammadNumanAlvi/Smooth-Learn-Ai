import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, FileText, X, AlertCircle, File, CheckCircle2, ChevronRight, Zap, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { auth, ensureSignedIn } from '../lib/firebase';
import { DocumentItem } from '../types';
import { saveDocumentToFirestore, syncUserToFirestore } from '../lib/firestoreClient';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (doc: DocumentItem) => void;
}

const AI_FACTS = [
  "Active recall boosts memory retention by up to 50%.",
  "Spaced repetition is the most effective way to learn.",
  "AI can analyze a 100-page book in under a minute.",
  "Learning in short bursts is better than cramming.",
  "Teaching a concept to others (or AI) solidifies understanding."
];

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({ isOpen, onClose, onUploaded }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [factIndex, setFactIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isProcessing) {
      interval = setInterval(() => {
        setFactIndex((prev) => (prev + 1) % AI_FACTS.length);
        setProgress((prev) => Math.min(prev + Math.random() * 8 + 2, 98));
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) validateAndSetFile(selected);
  };

  const validateAndSetFile = (selected: File) => {
    setError(null);
    if (selected.type !== 'application/pdf') {
      setError('Only PDF files are supported currently.');
      return;
    }
    if (selected.size > 100 * 1024 * 1024) {
      setError('File size must be less than 100MB.');
      return;
    }
    setFile(selected);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) validateAndSetFile(dropped);
  };

  const handleProcess = async () => {
    if (!file) return;
    setError(null);
    setIsProcessing(true);
    setProgress(5);
    try {
      let user = auth.currentUser;
      if (!user) user = await ensureSignedIn();
      if (user) await syncUserToFirestore(user).catch(console.error);

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;
      setProgress(20);

      const created = await api.analyzeDocument({
        fileName: file.name,
        fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        pdfBase64: base64,
      });
      setProgress(40);
      await saveDocumentToFirestore(created).catch(console.error);

      onUploaded(created);
      setFile(null);
      setIsProcessing(false);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to upload document.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-teal-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-[500px] bg-[#FAF8F3] rounded-[32px] shadow-2xl border border-white overflow-hidden p-8"
        >
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Add Study Material</h3>
                <p className="text-xs text-gray-500">Upload a PDF to generate quizzes & flashcards</p>
              </div>
            </div>
            {!isProcessing && (
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 flex gap-3 text-rose-700 items-start">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {!file && !isProcessing && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 rounded-[24px] border-2 border-dashed border-teal-200 bg-white hover:bg-teal-50/50 hover:border-teal-400 transition-all cursor-pointer flex flex-col items-center justify-center group"
            >
              <input type="file" className="hidden" accept=".pdf" ref={fileInputRef} onChange={handleFileSelect} />
              <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-6 h-6 text-teal-500" />
              </div>
              <p className="text-sm font-bold text-gray-700">Click or drag PDF here</p>
              <p className="text-xs text-gray-400 mt-1">Max file size: 100MB</p>
            </div>
          )}

          {file && !isProcessing && (
            <div className="space-y-6">
              <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button onClick={() => setFile(null)} className="text-xs text-rose-500 hover:text-rose-700 font-medium px-3 py-1.5 rounded-full hover:bg-rose-50">
                  Remove
                </button>
              </div>
              <button
                onClick={handleProcess}
                className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-bold shadow-md hover:bg-gray-800 flex justify-center items-center gap-2 transition-all"
              >
                Start Processing <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="py-8 flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 border-4 border-teal-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin"></div>
                <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center z-10 relative shadow-sm border border-gray-100">
                  <Zap className="w-8 h-8 text-teal-500" />
                </div>
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Analyzing Document...</h4>
              <p className="text-sm text-gray-500 mb-6 max-w-[280px]">
                <AnimatePresence mode="wait">
                  <motion.span key={factIndex} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="block">
                    {AI_FACTS[factIndex]}
                  </motion.span>
                </AnimatePresence>
              </p>
              <div className="flex items-center gap-3 w-full">
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex-1">
                  <motion.div
                    className="h-full bg-teal-500 rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'linear', duration: 0.5 }}
                  />
                </div>
                <span className="text-xs font-bold text-teal-600 min-w-[32px] text-right">{Math.round(progress)}%</span>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
