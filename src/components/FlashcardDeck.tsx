import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, RefreshCw, Layers, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { saveFlashcardsToFirestore } from '../lib/firestoreClient';
import { ChapterItem, DocumentItem, Flashcard } from '../types';

interface FlashcardDeckProps {
  document: DocumentItem;
}

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({ document }) => {
  const chapters = document.chapters || [];
  const [selectedChapterId, setSelectedChapterId] = useState<string>(chapters[0]?.id || '');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId) || chapters[0],
    [chapters, selectedChapterId]
  );

  useEffect(() => {
    setSelectedChapterId(chapters[0]?.id || '');
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [document.id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!document.id) return;
      setLoading(true);
      setIsFlipped(false);
      setCurrentIndex(0);
      try {
        const fetched = await api.getFlashcards(document.id, selectedChapter
          ? { chapterId: selectedChapter.id, chapterTitle: selectedChapter.title }
          : undefined);
        if (!cancelled) {
          setCards(fetched);
          await saveFlashcardsToFirestore(fetched).catch(() => {});
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setCards([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [document.id, selectedChapter?.id, selectedChapter?.title]);

  const handleSelectChapter = (chapter: ChapterItem) => {
    if (chapter.id === selectedChapterId) return;
    setSelectedChapterId(chapter.id);
  };

  const handleNext = () => {
    if (cards.length === 0) return;
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    if (cards.length === 0) return;
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const card = cards[currentIndex];

  return (
    <div className="flex h-full gap-6 min-h-[520px]">
      <aside className="w-[280px] shrink-0 bg-white rounded-[28px] border border-[#f0ece1] shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Selected book</p>
          <h3 className="text-sm font-bold text-gray-900 mt-1 leading-snug line-clamp-2">{document.title}</h3>
          <p className="text-[11px] text-gray-400 mt-1">{chapters.length} chapters</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {chapters.length === 0 && (
            <p className="text-xs text-gray-400 p-3">No chapters found for this book.</p>
          )}
          {chapters.map((chapter, idx) => {
            const active = chapter.id === selectedChapter?.id;
            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => handleSelectChapter(chapter)}
                className={`w-full text-left px-3 py-3 rounded-2xl border transition-all ${
                  active
                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : 'bg-[#FAF8F3] text-gray-700 border-[#e8e4db] hover:border-teal-300 hover:bg-teal-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-[10px] font-black mt-0.5 ${active ? 'text-teal-300' : 'text-gray-400'}`}>
                    {chapter.id.match(/^ch-(\d+)$/)?.[1] || String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-bold leading-snug line-clamp-2">{chapter.title}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-14 h-14 rounded-full border-4 border-teal-100 border-t-teal-500 animate-spin" />
            <p className="text-sm font-bold text-gray-700">
              Loading cards{selectedChapter ? ` for ${selectedChapter.title}` : ''}...
            </p>
          </div>
        ) : cards.length === 0 || !card ? (
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-[24px] bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No cards in this chapter</h3>
            <p className="text-sm text-gray-500">
              {selectedChapter
                ? `We could not generate flashcards for "${selectedChapter.title}" yet.`
                : 'Select a chapter from the left to study its cards.'}
            </p>
          </div>
        ) : (
          <>
            <div className="w-full max-w-2xl flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-teal-500" /> {selectedChapter?.title || 'Study Deck'}
                </h2>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  {document.title}
                </p>
              </div>
              <div className="bg-white px-4 py-2 rounded-full border border-gray-100 shadow-sm">
                <span className="text-xs font-bold text-gray-700">
                  Card {currentIndex + 1} of {cards.length}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsFlipped((prev) => !prev)}
              className="w-full max-w-2xl aspect-[3/2] cursor-pointer group text-left"
            >
              <div className="relative w-full h-full">
                <div
                  className={`absolute inset-0 rounded-[40px] border p-10 flex flex-col items-center justify-center text-center shadow-xl transition-opacity duration-200 ${
                    isFlipped
                      ? 'opacity-0 pointer-events-none'
                      : 'opacity-100 bg-white border-gray-100 shadow-gray-200/50'
                  }`}
                >
                  <div className="absolute top-6 left-6 px-3 py-1.5 bg-teal-50 text-teal-700 text-[10px] font-bold uppercase tracking-wider rounded-full border border-teal-100">
                    {card.topic}
                  </div>
                  <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                    <Sparkles className="w-4 h-4 text-gray-400" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight px-4">
                    {card.front}
                  </h3>
                  <p className="absolute bottom-8 text-[11px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-teal-500 transition-colors">
                    Click to reveal answer
                  </p>
                </div>

                <div
                  className={`absolute inset-0 rounded-[40px] border p-10 flex flex-col items-center justify-center text-center shadow-xl transition-opacity duration-200 ${
                    isFlipped
                      ? 'opacity-100 bg-gray-900 border-gray-800 shadow-gray-900/20'
                      : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="absolute top-6 left-6 px-3 py-1.5 bg-white/10 text-white/90 text-[10px] font-bold uppercase tracking-wider rounded-full border border-white/10">
                    Answer
                  </div>
                  <p className="text-xl sm:text-2xl font-semibold text-white leading-relaxed px-4">
                    {card.back}
                  </p>
                  <p className="absolute bottom-8 text-[11px] font-bold uppercase tracking-widest text-white/40">
                    Click to see question
                  </p>
                </div>
              </div>
            </button>

            <div className="w-full max-w-2xl mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrev}
                className="w-14 h-14 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-sm hover:border-teal-200 hover:bg-teal-50"
              >
                <ChevronLeft className="w-6 h-6 text-gray-400" />
              </button>
              <button
                type="button"
                onClick={() => setIsFlipped((prev) => !prev)}
                className="px-8 py-4 rounded-full bg-white border border-gray-100 shadow-sm hover:border-gray-300 font-bold text-sm text-gray-700 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4 text-gray-400" />
                Flip Card
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="w-14 h-14 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-sm hover:border-teal-200 hover:bg-teal-50"
              >
                <ChevronRight className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {card.id && (
              <div className="w-full max-w-2xl mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    await api.updateFlashcardStatus(card.id, 'learning').catch(() => {});
                    handleNext();
                  }}
                  className="px-4 py-2 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100"
                >
                  Still learning
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await api.updateFlashcardStatus(card.id, 'mastered').catch(() => {});
                    handleNext();
                  }}
                  className="px-4 py-2 rounded-full bg-teal-50 text-teal-700 text-xs font-bold border border-teal-100"
                >
                  I know this
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
