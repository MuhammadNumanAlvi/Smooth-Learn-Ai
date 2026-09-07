import React, { useState } from 'react';
import { X, Mail, Lock, Sparkles, Loader2, AlertCircle, User, Phone, GraduationCap, Building2, MapPin } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { isAdminEmail } from '../lib/admin';
import { auth, loginWithEmail, registerWithEmail, loginWithGoogle, setRememberMe } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { saveStudentProfile } from '../lib/firestoreClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'login' | 'register';
}

const fieldClass =
  'w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-gray-900 font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-sm';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, initialMode = 'register' }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMeChecked] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const identifier = email.trim();
  const isAdminLogin =
    mode === 'login' && identifier.length > 0 && (!identifier.includes('@') || isAdminEmail(identifier));

  const getFriendlyErrorMessage = (err: any): string => {
    const errCode = err?.code || '';
    if (errCode.includes('user-not-found')) return 'No account found with this email. Please sign up.';
    if (errCode.includes('wrong-password') || errCode.includes('invalid-credential'))
      return 'Incorrect email or password. Please verify and try again.';
    if (errCode.includes('email-already-in-use')) return 'An account already exists with this email. Try signing in.';
    if (errCode.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (errCode.includes('invalid-email')) return 'Please enter a valid email address.';
    if (errCode.includes('popup-closed-by-user')) return 'Google sign-in popup was closed.';
    return err?.message || 'Something went wrong. Please try again.';
  };

  const finishStudent = () => {
    onClose();
    onSuccess();
  };

  const signInAdminFirebase = async (adminEmail: string) => {
    await setRememberMe(rememberMe);
    try {
      await loginWithEmail(adminEmail, password);
    } catch (err: any) {
      if (err?.code?.includes('user-not-found') || err?.code?.includes('invalid-credential')) {
        try {
          await registerWithEmail(adminEmail, password);
        } catch (registerErr: any) {
          if (registerErr?.code?.includes('email-already-in-use')) {
            throw new Error('Admin account exists with a different password. Use the current admin password.');
          }
          throw registerErr;
        }
      } else {
        throw err;
      }
    }
    onClose();
    navigate('/admin');
  };

  const handleAdminLogin = async () => {
    if (isAdminEmail(identifier)) {
      await signInAdminFirebase(identifier);
      return;
    }

    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: identifier, password }),
    });
    const data = await res.json();
    if (!data.success || !data.email) {
      throw new Error(data.message || 'Invalid admin credentials.');
    }
    await signInAdminFirebase(data.email);
  };

  const handleStudentLogin = async () => {
    if (!identifier.includes('@')) {
      throw new Error('Enter your email address.');
    }
    await setRememberMe(rememberMe);
    await loginWithEmail(identifier, password);
    finishStudent();
  };

  const handleRegister = async () => {
    if (isAdminEmail(identifier)) {
      throw new Error('This email is reserved for admin. Use Sign In instead.');
    }
    if (!fullName.trim() || !identifier.includes('@') || !phone.trim() || !school.trim() || !grade.trim()) {
      throw new Error('Please fill in all required student details.');
    }
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');
    if (password !== confirmPassword) throw new Error('Passwords do not match.');

    await registerWithEmail(identifier, password);
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: fullName.trim() });
    }
    const details = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      school: school.trim(),
      grade: grade.trim(),
      city: city.trim(),
      email: identifier,
    };
    await api.saveStudentAccount(details);
    await saveStudentProfile(details);
    await api.syncCurrentUser();
    finishStudent();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier) {
      setError(mode === 'login' ? 'Email or username is required.' : 'Email is required.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') await handleRegister();
      else if (isAdminLogin) await handleAdminLogin();
      else await handleStudentLogin();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      finishStudent();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-teal-950/40 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#FAF8F3] rounded-[32px] shadow-2xl border border-white overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-8 py-5 border-b border-[#e8e4db] bg-white/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">
              {mode === 'login' ? 'Sign in to Smooth Learn' : 'Create your student account'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full py-3 px-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl font-bold text-sm text-gray-700 shadow-sm disabled:opacity-60"
            >
              Continue with Google
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <label className="block text-xs font-bold text-gray-700 uppercase">Full name</label>
                <div className="relative">
                  <User className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                  <input className={fieldClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ali Khan" required />
                </div>
              </>
            )}

            <label className="block text-xs font-bold text-gray-700 uppercase">{mode === 'login' ? 'Email' : 'Email'}</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              <input
                className={fieldClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
                required
              />
            </div>

            {mode === 'register' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Phone</label>
                    <div className="relative">
                      <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                      <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx xxxxxxx" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Class / grade</label>
                    <div className="relative">
                      <GraduationCap className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                      <input className={fieldClass} value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade 10" required />
                    </div>
                  </div>
                </div>
                <label className="block text-xs font-bold text-gray-700 uppercase">School / college</label>
                <div className="relative">
                  <Building2 className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                  <input className={fieldClass} value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Your school name" required />
                </div>
                <label className="block text-xs font-bold text-gray-700 uppercase">City (optional)</label>
                <div className="relative">
                  <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                  <input className={fieldClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lahore" />
                </div>
              </>
            )}

            <label className="block text-xs font-bold text-gray-700 uppercase">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              <input
                type="password"
                className={fieldClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                required
              />
            </div>

            {mode === 'register' && (
              <>
                <label className="block text-xs font-bold text-gray-700 uppercase">Confirm password</label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                  <input type="password" className={fieldClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" required />
                </div>
              </>
            )}

            {mode === 'login' && (
              <label className="flex items-center gap-2 text-sm text-gray-600 font-medium pt-1">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMeChecked(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-teal-600"
                />
                Remember me on this device
              </label>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center space-x-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{mode === 'register' ? 'Create student account' : 'Sign in'}</span>
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-gray-500">
            {mode === 'login' ? (
              <p>
                New here?{' '}
                <button type="button" onClick={() => { setMode('register'); setError(null); }} className="font-bold text-teal-600 hover:underline">
                  Create an account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button type="button" onClick={() => { setMode('login'); setError(null); }} className="font-semibold text-teal-700 hover:underline">
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
