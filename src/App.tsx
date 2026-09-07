import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { syncUserToFirestore } from './lib/firestoreClient';
import { api } from './lib/api';
import { Dashboard } from './pages/Dashboard';
import { LandingPage } from './pages/LandingPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { Brain } from 'lucide-react';

export function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    
    // Safety timeout just in case Firebase hangs
    const timeout = setTimeout(() => {
      if (isMounted && loading) setLoading(false);
    }, 3000);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!isMounted) return;
      setUser(currentUser);
      if (currentUser) {
        syncUserToFirestore(currentUser).catch(console.error);
        api.syncCurrentUser().catch(console.error);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 animate-pulse">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <p className="text-zinc-500 text-sm font-medium tracking-wide">Loading QuizMind AI...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            user
              ? user.email === 'saasproduct@admin.pk'
                ? <Navigate to="/admin" replace />
                : <Navigate to="/dashboard" replace />
              : <LandingPage />
          }
        />
        <Route
          path="/dashboard"
          element={
            user
              ? user.email === 'saasproduct@admin.pk'
                ? <Navigate to="/admin" replace />
                : <Dashboard />
              : <Navigate to="/" replace />
          }
        />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route
          path="/student"
          element={user ? <Dashboard /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
