import React from 'react';
import { DocumentItem } from '../types';
import { BookOpen, Clock, CheckCircle2, ChevronRight, Bookmark } from 'lucide-react';

interface ChapterExplorerProps {
  document: DocumentItem;
  onStartChapterQuiz?: (chapterId: string, chapterTitle: string) => void;
}

export const ChapterExplorer: React.FC<ChapterExplorerProps> = ({ document, onStartChapterQuiz }) => {
  if (!document.chapters || document.chapters.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-[32px] border border-gray-100 shadow-sm flex flex-col items-center">
        <div className="w-16 h-16 bg-gray-50 rounded-[24px] flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-gray-500 text-sm">No chapter breakdown available for this document.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[32px] border border-[#f0ece1] shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-100 bg-white sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 leading-none">Table of Contents</h2>
        </div>
        <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
          {document.chapters.length} Chapters
        </span>
      </div>

      <div className="p-6 overflow-y-auto space-y-4">
        {document.chapters.map((chapter, idx) => (
          <div
            key={chapter.id}
            onClick={() => onStartChapterQuiz?.(chapter.id, chapter.title)}
            className="group relative p-5 bg-[#FAF8F3] rounded-[24px] border border-[#e8e4db] hover:border-teal-200 transition-all hover:shadow-md cursor-pointer flex gap-4"
          >
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 border border-gray-200 text-gray-500 font-bold text-sm shadow-sm group-hover:text-teal-600 group-hover:border-teal-200 transition-colors">
              {idx + 1}
            </div>
            
            <div className="flex-1 space-y-3 min-w-0">
              <div>
                <h3 className="font-bold text-gray-900 text-[15px] leading-snug group-hover:text-teal-700 transition-colors">
                  {chapter.title}
                </h3>
                <div className="flex items-center gap-4 mt-1.5 text-xs font-semibold text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-300" /> {chapter.estimatedReadTime}
                  </span>
                  {chapter.keyPoints && chapter.keyPoints.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Bookmark className="w-3.5 h-3.5 text-gray-300" /> {chapter.keyPoints.length} Key Concepts
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed">
                {chapter.summary}
              </p>

              {chapter.keyPoints && chapter.keyPoints.length > 0 && (
                <div className="pt-3 border-t border-gray-200/50">
                  <ul className="space-y-2">
                    {chapter.keyPoints.slice(0, 2).map((point, i) => (
                      <li key={i} className="text-[12px] text-gray-500 flex gap-2 items-start">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                        <span className="leading-tight">{point}</span>
                      </li>
                    ))}
                    {chapter.keyPoints.length > 2 && (
                      <li className="text-[11px] font-bold text-teal-600 pl-5">
                        + {chapter.keyPoints.length - 2} more points
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                <ChevronRight className="w-4 h-4 text-teal-600" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
