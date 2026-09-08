import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { ChapterItem } from '../types';
import { auth, firestore } from './firebase';

const IDB_NAME = 'smooth-learn-books';
const IDB_STORE = 'texts';
const FIRESTORE_CHUNK = 180000;

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function guessChapters(text: string): ChapterItem[] {
  const matches = [...text.matchAll(/(?:^|\n)\s*((?:chapter|unit|lesson)\s+\d+[:.\s][^\n]{0,90})/gi)];
  const titles = [...new Set(matches.map((m) => m[1].replace(/\s+/g, ' ').trim()))].slice(0, 40);
  if (titles.length < 2) {
    return [
      {
        id: 'ch-full',
        title: 'Full book',
        summary: text.slice(0, 240),
        keyPoints: [],
        estimatedReadTime: '30 min',
      },
    ];
  }
  return titles.map((title, i) => ({
    id: `ch-${i + 1}`,
    title,
    summary: '',
    keyPoints: [],
    estimatedReadTime: '15 min',
  }));
}

export function textForChapter(full: string, chapterTitle?: string, max = 70000): string {
  if (!full) return '';
  if (!chapterTitle || /^full book$/i.test(chapterTitle)) return full.slice(0, max);
  const needle = chapterTitle.slice(0, 48).toLowerCase();
  const idx = full.toLowerCase().indexOf(needle);
  const start = idx >= 0 ? idx : 0;
  return full.slice(start, start + max);
}

export async function saveBookText(docId: string, text: string): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(text, docId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  const user = auth.currentUser;
  if (!user) return;
  try {
    const parts = Math.max(1, Math.ceil(text.length / FIRESTORE_CHUNK));
    for (let i = 0; i < parts; i++) {
      const piece = text.slice(i * FIRESTORE_CHUNK, (i + 1) * FIRESTORE_CHUNK);
      await setDoc(doc(firestore, `documents/${docId}/chunks/txt-${i}`), {
        userId: user.uid,
        index: i,
        text: piece,
      });
    }
  } catch (err) {
    console.warn('Cloud book backup skipped:', err);
  }
}

export async function loadBookText(docId: string): Promise<string> {
  try {
    const db = await openIdb();
    const local = await new Promise<string>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(docId);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : '');
      req.onerror = () => reject(req.error);
    });
    if (local.trim()) return local;
  } catch {
    // fall through to Firestore
  }

  try {
    const snap = await getDocs(collection(firestore, `documents/${docId}/chunks`));
    const parts = snap.docs
      .filter((d) => d.id.startsWith('txt-'))
      .sort((a, b) => Number(a.id.slice(4)) - Number(b.id.slice(4)))
      .map((d) => String(d.data().text || ''));
    return parts.join('');
  } catch {
    return '';
  }
}
