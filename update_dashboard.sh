#!/bin/bash
cat << 'INNEREOF' > src/pages/Dashboard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, Loader2, Sparkles, LogOut } from 'lucide-react';
import { DocumentItem, Quiz, ChapterItem } from '../types';
import { api } from '../lib/api';
import { auth, logoutUser } from '../lib/firebase';
import { ActiveQuizView } from '../components/ActiveQuizView';

export function Dashboard() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  
  const [apiKey, setApiKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  
  const [uploading, setUploading] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  
  const [questionsCount, setQuestionsCount] = useState('20');
  const [difficulty, setDifficulty] = useState('Medium');
  const [questionStyle, setQuestionStyle] = useState('Conceptual');
  
  const [generating, setGenerating] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) {
      setApiKey(saved);
      setKeySaved(true);
    }
    
    // Fetch docs
    api.getDocuments().then(docs => {
      setDocuments(docs);
      if (docs.length > 0) {
        setSelectedDoc(docs[0]);
      }
    }).catch(console.error);
  }, []);

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 3000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // In a real app we'd convert to Base64 or use FormData.
      // Our API uses pdfBase64 for analyze.
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        try {
          const doc = await api.analyzeDocument({
            fileName: file.name,
            fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            pdfBase64: base64,
          });
          setDocuments(prev => [doc, ...prev]);
          setSelectedDoc(doc);
        } catch (err: any) {
          alert('Upload failed: ' + err.message);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedDoc) return;
    setGenerating(true);
    setErrorMsg('');
    try {
      const res = await api.generateQuiz({
        documentId: selectedDoc.id,
        chapterTitle: selectedChapter || undefined,
        count: parseInt(questionsCount),
        difficulty,
        questionStyle,
      });
      setActiveQuiz(res.quiz);
    } catch (err: any) {
      setErrorMsg(err.message || 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  if (activeQuiz) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 py-4 px-6 flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveQuiz(null)}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">L</div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-slate-900">Learn More</div>
              <div className="text-[10px] font-bold text-slate-400 tracking-wider">AI MCQ MAKER</div>
            </div>
          </div>
          <button onClick={() => setActiveQuiz(null)} className="text-sm font-bold text-slate-500 hover:text-slate-900">Back to Dashboard</button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <ActiveQuizView
            quiz={activeQuiz}
            session={null}
            onFinish={() => setActiveQuiz(null)}
            onSaveAndExit={() => setActiveQuiz(null)}
            onExplainQuestion={() => Promise.resolve({ style: 'more', explanation: 'Explanation not available in simple mode.', keyTakeaway: '', citations: [] })}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] font-sans">
      {/* Navbar */}
      <header className="bg-white px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
            L
          </div>
          <div className="leading-tight">
            <div className="text-base font-extrabold text-slate-900">Learn More</div>
            <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">AI MCQ MAKER</div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="px-5 py-2 bg-slate-50 border border-slate-100 rounded-full text-sm font-bold text-slate-700 shadow-sm">
            {auth.currentUser?.displayName || 'User'}
          </div>
          <button onClick={() => logoutUser()} className="p-2 text-slate-400 hover:text-slate-600">
             <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto py-16 px-4 sm:px-6 pb-32">
        {/* Hero */}
        <div className="mb-12 flex justify-between items-end">
          <div>
            <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-[0.2em] mb-3">Welcome Back</h2>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Ready to learn, {auth.currentUser?.displayName?.split(' ')[0] || 'User'}?</h1>
            <p className="text-slate-500 mt-2 text-lg">Upload a textbook PDF and build a focused quiz.</p>
          </div>
          <button className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
            Change name
          </button>
        </div>

        <div className="space-y-6">
          
          {/* Step 1: Upload */}
          <div className="bg-white rounded-[24px] p-8 shadow-sm border border-slate-200/60 relative">
            <h3 className="text-xl font-bold text-slate-900 mb-6">1. Upload your PDF</h3>
            <span className="absolute top-8 right-8 bg-indigo-50 text-indigo-700 font-extrabold px-3 py-1 rounded-lg text-xs tracking-wide">01</span>
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-[1.5px] border-dashed border-indigo-200 bg-indigo-50/30 rounded-2xl p-10 text-center cursor-pointer hover:bg-indigo-50/80 transition-colors"
            >
               <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
               <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                 {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
               </div>
               <p className="font-bold text-slate-900 text-lg mb-1">Drop PDF here or browse</p>
               <p className="text-slate-500 text-sm">Chapter-based books work best</p>
               
               {selectedDoc && !uploading && (
                 <div className="mt-4 pt-4 border-t border-indigo-100/50 flex flex-col items-center">
                    <p className="text-sm font-semibold text-slate-700">{selectedDoc.title}</p>
                    <p className="text-xs text-slate-500 mt-1">Found {selectedDoc.chapters?.length || 0} chapters.</p>
                 </div>
               )}
            </div>
          </div>

          {/* Step 2: Gemini Key */}
          <div className="bg-white rounded-[24px] p-8 shadow-sm border border-slate-200/60 relative">
            <h3 className="text-xl font-bold text-slate-900 mb-6">2. Connect Gemini</h3>
            <span className="absolute top-8 right-8 bg-indigo-50 text-indigo-700 font-extrabold px-3 py-1 rounded-lg text-xs tracking-wide">02</span>
            
            <div className="space-y-4 max-w-xl">
              <label className="block text-sm font-bold text-slate-900">Gemini API key</label>
              <input 
                type="password" 
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Paste your Gemini API key" 
                className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:outline-none transition-all shadow-sm" 
              />
              <p className="text-xs text-slate-500">For a real deployment, keep API keys on a server—not in public frontend code.</p>
              <div className="flex items-center space-x-4 pt-2">
                <button onClick={handleSaveKey} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors">
                  Save on this device
                </button>
                {keySaved && (
                  <span className="text-emerald-600 text-sm font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" /> <span>Saved locally</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Choose Chapter */}
          <div className="bg-white rounded-[24px] p-8 shadow-sm border border-slate-200/60 relative">
            <h3 className="text-xl font-bold text-slate-900 mb-2">3. Choose a chapter</h3>
            <p className="text-sm text-slate-500 mb-6">Pick the chapter before questions are generated.</p>
            <span className="absolute top-8 right-8 bg-indigo-50 text-indigo-700 font-extrabold px-3 py-1 rounded-lg text-xs tracking-wide">03</span>
            
            {!selectedDoc ? (
               <div className="py-8 text-center text-sm font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl">
                 Upload a PDF first to see chapters
               </div>
            ) : (
               <div>
                  <div className="flex overflow-x-auto space-x-4 pb-6 snap-x hide-scrollbar">
                    {selectedDoc.chapters?.map((ch, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedChapter(ch.title)}
                        className={`min-w-[240px] max-w-[240px] flex-shrink-0 snap-start p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col ${
                          selectedChapter === ch.title 
                            ? 'border-indigo-600 bg-indigo-50/30 shadow-sm' 
                            : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                      >
                        <div className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider mb-2">CHAPTER {idx + 1}</div>
                        <h4 className="text-sm font-bold text-slate-900 leading-snug mb-2 line-clamp-3">{ch.title}</h4>
                        <div className="mt-auto text-xs text-slate-400 font-medium">Pages {ch.pageRange?.[0]}-{ch.pageRange?.[1]}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center space-x-4 mt-2">
                    <button className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors">
                      Scan chapters again
                    </button>
                    {selectedChapter && (
                      <span className="text-sm text-slate-500">
                        Selected: <span className="font-semibold text-slate-700">{selectedChapter}</span>
                      </span>
                    )}
                  </div>
               </div>
            )}
          </div>

          {/* Step 4: Quiz Settings */}
          <div className="bg-white rounded-[24px] p-8 shadow-sm border border-slate-200/60 relative">
            <h3 className="text-xl font-bold text-slate-900 mb-2">4. Quiz settings</h3>
            <p className="text-sm text-slate-500 mb-6">Make your quiz exactly how you want it.</p>
            <span className="absolute top-8 right-8 bg-indigo-50 text-indigo-700 font-extrabold px-3 py-1 rounded-lg text-xs tracking-wide">04</span>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-900">Questions</label>
                <select value={questionsCount} onChange={e => setQuestionsCount(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 appearance-none shadow-sm">
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="20">20</option>
                  <option value="30">30</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-900">Difficulty</label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 appearance-none shadow-sm">
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-900">Question style</label>
                <select value={questionStyle} onChange={e => setQuestionStyle(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 appearance-none shadow-sm">
                  <option value="Conceptual">Conceptual</option>
                  <option value="Factual">Factual</option>
                  <option value="Application">Application</option>
                </select>
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={generating || !selectedDoc}
              className="w-full py-4 bg-[#635BFF] hover:bg-indigo-600 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center space-x-2 text-lg"
            >
              {generating ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                <>
                  <span>Generate MCQs</span>
                  <Sparkles className="w-5 h-5" />
                </>
              )}
            </button>
            {errorMsg && (
              <p className="text-red-500 text-sm font-semibold mt-4 text-center">{errorMsg}</p>
            )}
            {!selectedDoc && !errorMsg && (
              <p className="text-slate-400 text-sm font-medium mt-4 text-center">Chapter selected. Choose your quiz settings and generate questions.</p>
            )}
          </div>
        </div>
      </main>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
INNEREOF
chmod +x update_dashboard.sh
./update_dashboard.sh
