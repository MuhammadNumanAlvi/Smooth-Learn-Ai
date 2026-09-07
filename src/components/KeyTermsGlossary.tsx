import React, { useState } from 'react';
import { DocumentItem } from '../types';
import { Book, Bookmark, Search } from 'lucide-react';
import { motion } from 'motion/react';

interface KeyTermsGlossaryProps {
  document: DocumentItem;
}

export const KeyTermsGlossary: React.FC<KeyTermsGlossaryProps> = ({ document }) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!document.keyTerms || document.keyTerms.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-[32px] border border-gray-100 shadow-sm flex flex-col items-center">
        <div className="w-16 h-16 bg-gray-50 rounded-[24px] flex items-center justify-center mb-4">
          <Book className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-gray-500 text-sm">No key vocabulary found for this document.</p>
      </div>
    );
  }

  const filteredTerms = document.keyTerms.filter(t => 
    t.term.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.definition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-[32px] border border-[#f0ece1] shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-100 bg-white sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Book className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-none mb-1">Key Terminology</h2>
            <p className="text-xs text-gray-500">Master the essential vocabulary</p>
          </div>
        </div>
        
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search terms..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
          />
        </div>
      </div>

      <div className="p-6 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTerms.length > 0 ? (
            filteredTerms.map((item, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={idx}
                className="bg-[#FAF8F3] p-5 rounded-[24px] border border-[#e8e4db] hover:border-indigo-200 hover:shadow-md transition-all group flex gap-4"
              >
                <div className="shrink-0">
                  <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm group-hover:border-indigo-300 group-hover:bg-indigo-50 transition-colors">
                    <Bookmark className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1.5 group-hover:text-indigo-700 transition-colors">{item.term}</h3>
                  <p className="text-[13px] text-gray-600 leading-relaxed">
                    {item.definition}
                  </p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-gray-400 text-sm">
              No terms match your search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
