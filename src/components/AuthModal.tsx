import React, { useState } from 'react';
import { X, Mail, Lock, Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { loginWithEmail, registerWithEmail, resetPassword, loginWithGoogle } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const getFriendlyErrorMessage = (err: any): string => {
    const code = err?.code || '';
    if (code.includes('user-not-found')) return 'No account found with this email. Please sign up.';
    if (code.includes('wrong-password') || code.includes('invalid-credential'))
      return 'Incorrect email or password. Please verify and try again.';
    if (code.includes('email-already-in-use')) return 'An account already exists with this email. Try logging in.';
    if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (code.includes('invalid-email')) return 'Please enter a valid email address.';
    if (code.includes('popup-closed-by-user')) return 'Google sign-in popup was closed.';
    return err?.message || 'Authentication failed. Please try again.';
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email) {
      setError('Email/Username is required.');
      return;
    }

    let targetEmail = email.trim();
    
    // Server-side check for admin
    if (!targetEmail.includes('@') && mode !== 'forgot') {
      try {
        setLoading(true);
        const res = await fetch('/api/auth/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: targetEmail, password })
        });
        
        const data = await res.json();
        if (data.success) {
          targetEmail = data.email;
        } else {
          setError(data.message || 'Please enter a valid email address.');
          setLoading(false);
          return;
        }
      } catch (err) {
        setError('Server error during authentication.');
        setLoading(false);
        return;
      }
    }

    if (mode === 'forgot') {
      setLoading(true);
      try {
        await resetPassword(targetEmail);
        setMessage('Password reset instructions sent to your email.');
        setLoading(false);
      } catch (err) {
        setError(getFriendlyErrorMessage(err));
        setLoading(false);
      }
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        try {
          await loginWithEmail(targetEmail, password);
        } catch (err: any) {
          if (targetEmail === 'saasproduct@admin.pk' && (err?.code?.includes('user-not-found') || err?.code?.includes('invalid-credential'))) {
            try {
              await registerWithEmail(targetEmail, password);
            } catch (regErr) {
              throw err;
            }
          } else {
            throw err;
          }
        }
      } else {
        await registerWithEmail(targetEmail, password);
      }
      setLoading(false);
      onClose();
      // Admin redirect
      if (targetEmail === 'saasproduct@admin.pk') {
        navigate('/admin');
      } else {
        onSuccess();
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      setLoading(false);
      onSuccess();
      onClose();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-teal-950/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#FAF8F3] rounded-[32px] shadow-2xl border border-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#e8e4db] bg-white/50 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">
              {mode === 'login' && 'Sign In to QuizMind AI'}
              {mode === 'register' && 'Create Your Account'}
              {mode === 'forgot' && 'Reset Password'}
            </h3>
          </div>
          <button
            id="close-auth-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {/* Google Sign-in button */}
          {mode !== 'forgot' && (
            <>
              <button
                id="auth-google-btn"
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full py-3 px-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl font-bold text-sm text-gray-700 shadow-sm flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-60"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-[#e8e4db] w-full" />
                <span className="bg-[#FAF8F3] px-3 text-xs text-gray-400 uppercase tracking-wider font-bold">
                  or
                </span>
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Email or Username</label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                <input
                  id="auth-email-input"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.edu"
                  className="w-full pl-10 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm text-gray-900 font-medium placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-sm"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                  <input
                    id="auth-password-input"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm text-gray-900 font-medium placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-sm"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                  <input
                    id="auth-confirm-password-input"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm text-gray-900 font-medium placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-sm"
                  />
                </div>
              </div>
            )}

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {mode === 'login' && 'Sign In with Email'}
                {mode === 'register' && 'Create Account'}
                {mode === 'forgot' && 'Send Reset Link'}
              </span>
            </button>
          </form>

          {/* Footer toggle */}
          <div className="pt-4 text-center text-xs text-gray-500 space-y-1">
            {mode === 'login' && (
              <>
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="font-bold text-teal-600 hover:underline cursor-pointer"
                  >
                    Sign up
                  </button>
                </p>
                <p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 hover:underline cursor-pointer font-medium"
                  >
                    Forgot your password?
                  </button>
                </p>
              </>
            )}

            {mode === 'register' && (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="font-semibold text-indigo-600 hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            )}

            {mode === 'forgot' && (
              <p>
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="font-semibold text-indigo-600 hover:underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
