import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  getDocFromServer,
  deleteDoc,
} from 'firebase/firestore';
import { auth, firestore } from './firebase';
import { QuizSession, QuizAttempt, Quiz, DocumentItem, Flashcard } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection validation per Firebase Skill
export async function validateFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(firestore, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

// Client-side persistent quiz session storage with authenticated user
export async function saveSessionToFirestore(session: QuizSession): Promise<void> {
  if (!auth.currentUser || session.userId !== auth.currentUser.uid) {
    return;
  }
  const path = `users/${session.userId}/quizSessions/${session.id}`;
  try {
    const sessionRef = doc(firestore, path);
    await setDoc(sessionRef, session, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getActiveSessionFromFirestore(userId: string): Promise<QuizSession | null> {
  if (!auth.currentUser || userId !== auth.currentUser.uid) {
    return null;
  }
  const path = `users/${userId}/quizSessions`;
  try {
    const sessionsRef = collection(firestore, path);
    const q = query(sessionsRef, where('status', '==', 'in_progress'), limit(5));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const sessions = snap.docs.map((d) => d.data() as QuizSession);
      sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return sessions[0];
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveAttemptToFirestore(attempt: QuizAttempt): Promise<void> {
  if (!auth.currentUser || attempt.userId !== auth.currentUser.uid) {
    return;
  }
  const path = `attempts/${attempt.id}`;
  try {
    const attemptRef = doc(firestore, path);
    await setDoc(attemptRef, attempt, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveQuizToFirestore(quiz: Quiz): Promise<void> {
  if (!auth.currentUser || quiz.userId !== auth.currentUser.uid) {
    return;
  }
  const path = `quizzes/${quiz.id}`;
  try {
    const quizRef = doc(firestore, path);
    await setDoc(quizRef, quiz, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncUserToFirestore(user: any): Promise<void> {
  if (!user || user.isAnonymous) return;
  const userRef = doc(firestore, 'users', user.uid);
  
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        role: user.email === 'saasproduct@admin.pk' ? 'admin' : 'user',
      });
    } else {
      // Just update login time, only force admin if it's the super admin email
      await setDoc(userRef, {
        lastLoginAt: new Date().toISOString(),
        ...(user.email === 'saasproduct@admin.pk' ? { role: 'admin' } : {})
      }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export function toDocumentMeta(docItem: DocumentItem) {
  return {
    id: docItem.id,
    userId: docItem.userId || auth.currentUser?.uid || '',
    ownerEmail: auth.currentUser?.email || '',
    title: docItem.title,
    fileName: docItem.fileName,
    fileSize: docItem.fileSize,
    uploadDate: docItem.uploadDate,
    pageCount: docItem.pageCount || 0,
    summary: (docItem.summary || '').slice(0, 500),
    chapterCount: docItem.chapters?.length || 0,
    keyTermCount: docItem.keyTerms?.length || 0,
    chapters: (docItem.chapters || []).map((c) => ({ id: c.id, title: c.title })),
    overallDifficulty: docItem.overallDifficulty,
    processingStatus: docItem.processingStatus || 'ready',
    progress: docItem.progress || 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function saveDocumentToFirestore(docItem: DocumentItem): Promise<void> {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  if (docItem.userId && docItem.userId !== uid) return;
  const payload = toDocumentMeta({ ...docItem, userId: uid });
  try {
    await setDoc(doc(firestore, `documents/${docItem.id}`), payload, { merge: true });
    await setDoc(doc(firestore, `users/${uid}/documents/${docItem.id}`), payload, { merge: true });
  } catch (error) {
    console.error('Firestore document sync failed:', error);
  }
}

export async function deleteDocumentFromFirestore(documentId: string): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await deleteDoc(doc(firestore, `documents/${documentId}`));
    await deleteDoc(doc(firestore, `users/${auth.currentUser.uid}/documents/${documentId}`));
  } catch (error) {
    console.error('Firestore document delete failed:', error);
  }
}

export async function saveFlashcardsToFirestore(cards: Flashcard[]): Promise<void> {
  if (!auth.currentUser || cards.length === 0) return;
  const uid = auth.currentUser.uid;
  try {
    const batchId = cards[0].documentId;
    await setDoc(
      doc(firestore, `users/${uid}/flashcards/${batchId}`),
      {
        documentId: batchId,
        userId: uid,
        count: cards.length,
        cards: cards.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
          topic: c.topic,
          masteryLevel: c.masteryLevel,
        })),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Firestore flashcard sync failed:', error);
  }
}

export async function getUserRole(uid: string): Promise<string> {
  try {
    const snap = await getDoc(doc(firestore, 'users', uid));
    if (snap.exists()) {
      return snap.data().role || 'user';
    }
  } catch (error) {
    console.error('Failed to get user role:', error);
  }
  return 'user';
}
