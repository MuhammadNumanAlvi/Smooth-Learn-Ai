import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain, Bot, User, Loader2, Sparkles, AlertCircle, Sparkle } from 'lucide-react';
import { DocumentItem } from '../types';
import { api } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

interface TutorChatViewProps {
  document: DocumentItem;
}

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};
const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻',
};
const LATEX_SYMBOLS: Record<string, string> = {
  times: '×', cdot: '·', rightarrow: '→', to: '→', leftarrow: '←',
  approx: '≈', neq: '≠', leq: '≤', le: '≤', geq: '≥', ge: '≥',
  pm: '±', degree: '°', circ: '°', Delta: 'Δ', alpha: 'α', beta: 'β', gamma: 'γ',
};

/**
 * Models sometimes emit LaTeX, which react-markdown renders literally.
 * Convert the common cases to plain Unicode so formulas stay readable.
 */
function normalizeMathNotation(text: string): string {
  if (!text || !/[\\$]/.test(text)) return text;

  return text
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, body) => convertLatex(body))
    .replace(/\$([^$\n]+)\$/g, (_, body) => convertLatex(body))
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => convertLatex(body))
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => convertLatex(body));
}

function convertLatex(body: string): string {
  let out = body;
  out = out.replace(/\\(?:text|mathrm|mathbf|textbf|ce)\{([^{}]*)\}/g, '$1');
  out = out.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2');
  out = out.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  out = out.replace(/_\{([^{}]*)\}|_([a-z0-9])/gi, (_, braced, single) =>
    toScript(braced ?? single, SUBSCRIPTS)
  );
  out = out.replace(/\^\{([^{}]*)\}|\^([a-z0-9+-])/gi, (_, braced, single) =>
    toScript(braced ?? single, SUPERSCRIPTS)
  );
  out = out.replace(/\\([a-zA-Z]+)/g, (match, name) => LATEX_SYMBOLS[name] ?? '');
  out = out.replace(/[{}]/g, '');
  return out.replace(/\s{2,}/g, ' ').trim();
}

function toScript(value: string, map: Record<string, string>): string {
  const chars = String(value).split('');
  return chars.every((c) => map[c]) ? chars.map((c) => map[c]).join('') : String(value);
}

export const TutorChatView: React.FC<TutorChatViewProps> = ({ document }) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `Hi! I'm your AI Tutor for **${document.title}**. Ask me anything about the content, or ask me to explain a concept in simpler terms.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: `Hi! I'm your AI Tutor for **${document.title}**. Ask me anything about the content, or ask me to explain a concept in simpler terms.`,
      },
    ]);
    setInput('');
    setIsLoading(false);
  }, [document.id, document.title]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const { loadBookText, textForChapter } = await import('../lib/bookText');
      const bookText = await loadBookText(document.id);
      const response = await api.chatTutor({
        documentId: document.id,
        userQuestion: userMsg,
        messages: messages,
        action: 'standard',
        sourceText: textForChapter(bookText, undefined, 70000),
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: response.reply }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `**Error:** ${err.message || 'I encountered an issue answering that.'}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const QuickAction = ({ label, action }: { label: string; action: string }) => (
    <button
      onClick={() => {
        setInput(action);
        setTimeout(handleSend, 50);
      }}
      className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-full hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-all shadow-sm"
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-[32px] border border-[#f0ece1] shadow-sm overflow-hidden relative">
      
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
            <Sparkle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">AI Study Tutor</h2>
            <p className="text-[11px] font-semibold text-gray-400">Grounded in {document.title}</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FAF8F3] relative scroll-smooth" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 15, scale: 0.95, transformOrigin: isUser ? 'bottom right' : 'bottom left' }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, type: 'spring', bounce: 0.3 }}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}
              >
                <div className={`flex max-w-[85%] sm:max-w-[75%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${
                    isUser ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
                  }`}>
                    {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-indigo-600" />}
                  </div>

                  <div className={`px-5 py-4 rounded-3xl ${
                    isUser 
                      ? 'bg-gray-900 text-white rounded-tr-sm shadow-md' 
                      : 'bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100'
                  }`}>
                    <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert text-white' : 'text-gray-700'}`}>
                      <ReactMarkdown>{normalizeMathNotation(msg.content)}</ReactMarkdown>
                    </div>
                  </div>

                </div>
              </motion.div>
            );
          })}
          
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="flex justify-start w-full"
            >
              <div className="flex max-w-[80%] gap-3">
                <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="px-5 py-4 rounded-3xl bg-white rounded-tl-sm shadow-sm border border-gray-100 flex gap-1.5 items-center">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white border-t border-gray-100 shrink-0">
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <QuickAction label="Summarize chapter 1" action="Summarize the first chapter" />
            <QuickAction label="Explain key concepts" action="What are the main concepts in this book?" />
            <QuickAction label="Give an example" action="Give me a real-world example of the main topic." />
          </div>
        )}
        
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="relative flex items-center bg-gray-50 border border-gray-200 rounded-full p-1.5 shadow-inner focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-400 transition-all"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your AI tutor anything..."
            className="flex-1 bg-transparent px-4 py-2.5 text-sm outline-none text-gray-800 placeholder:text-gray-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              input.trim() && !isLoading
                ? 'bg-gray-900 text-white shadow-md hover:bg-gray-800'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
};
