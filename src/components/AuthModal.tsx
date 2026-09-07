import React, { useState } from 'react';
import { X, Mail, Lock, Sparkles, Loader2, AlertCircle, CheckCircle2, User, Phone, GraduationCap, Building2, MapPin } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
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
  const [loginStep, setLoginStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [rememberMe, setRememberMeChecked] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setLoginStep('email');
    setError(null);
    setMessage(null);
    setPassword('');
    setConfirmPassword('');
    setCode('');
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const identifier = email.trim();
  const isAdminLogin = mode === 'login' && identifier.length > 0 && !identifier.includes('@');

  const getFriendlyErrorMessage = (err: any): string => {
    const errCode = err?.code || '';
    if (errCode.includes('user-not-found')) return 'No account found with this email. Please sign up.';
    if (errCode.includes('wrong-password') || errCode.includes('invalid-credential'))
      return 'Incorrect email or password. Please verify and try again.';
    if (errCode.includes('email-already-in-use')) return 'An account already exists with this email. Try signing in.';
    if (errCode.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (errCode.includes('invalid-email')) return 'Please enter a valid email address.';
    if (errCode.includes('popup-closed-by-user')) return 'Google sign-in popup was closed.';
    return err?.message || 'Authentication failed. Please try again.';
  };

  const finishStudentLogin = () => {
    onClose();
    onSuccess();
  };

  const handleAdminLogin = async () => {
    if (!password) {
      setError('Password is required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier, password }),
      });
      const data = await res.json();
      if (!data.success || !data.email) {
        setError(data.message || 'Invalid admin credentials.');
        setLoading(false);
        return;
      }
      try {
        await loginWithEmail(data.email, password);
      } catch (err: any) {
        if (err?.code?.includes('user-not-found') || err?.code?.includes('invalid-credential')) {
          await registerWithEmail(data.email, password);
        } else {
          throw err;
        }
      }
      setLoading(false);
      onClose();
      navigate('/admin');
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!identifier.includes('@')) {
      setError('Enter the student email you signed up with.');
      return;
    }
    setLoading(true);
    try {
      await api.sendStudentOtp(identifier);
      setLoginStep('code');
      setMessage(`We sent a 6-digit code to ${identifier}.`);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      const result = await api.verifyStudentOtp(identifier, code.trim());
      await setRememberMe(rememberMe);
      await loginWithEmail(identifier, result.password);
      setLoading(false);
      finishStudentLogin();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!fullName.trim() || !identifier.includes('@') || !phone.trim() || !school.trim() || !grade.trim()) {
      setError('Please fill in all required student details.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
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
        password,
      };
      await api.registerStudentVault(details);
      await saveStudentProfile(details);
      await api.syncCurrentUser();
      setLoading(false);
      finishStudentLogin();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!identifier) {
      setError(mode === 'login' ? 'Email or admin username is required.' : 'Email is required.');
      return;
    }
    if (mode === 'register') return handleRegister();
    if (isAdminLogin) return handleAdminLogin();
    if (loginStep === 'email') return handleSendCode();
    return handleVerifyCode();
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      setLoading(false);
      finishStudentLogin();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
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
          {message && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {mode === 'register' && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full py-3 px-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl font-bold text-sm text-gray-700 shadow-sm flex items-center justify-center space-x-2 disabled:opacity-60"
            >
              <span>Continue with Google</span>
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

            <label className="block text-xs font-bold text-gray-700 uppercase">
              {mode === 'login' ? 'Email or admin username' : 'Email'}
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              <input
                className={fieldClass}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setLoginStep('email');
                  setCode('');
                }}
                placeholder={mode === 'login' ? 'you@email.com' : 'you@email.com'}
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
                <label className="block text-xs font-bold text-gray-700 uppercase">Password</label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                  <input type="password" className={fieldClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required />
                </div>
                <label className="block text-xs font-bold text-gray-700 uppercase">Confirm password</label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                  <input type="password" className={fieldClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" required />
                </div>
              </>
            )}

            {mode === 'login' && isAdminLogin && (
              <>
                <label className="block text-xs font-bold text-gray-700 uppercase">Password</label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                  <input type="password" className={fieldClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                </div>
              </>
            )}

            {mode === 'login' && !isAdminLogin && loginStep === 'code' && (
              <>
                <label className="block text-xs font-bold text-gray-700 uppercase">Email code</label>
                <input
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-center text-lg tracking-[0.4em] font-bold"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  required
                />
              </>
            )}

            {mode === 'login' && !isAdminLogin && (
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
              <span>
                {mode === 'register' && 'Create student account'}
                {mode === 'login' && isAdminLogin && 'Sign in'}
                {mode === 'login' && !isAdminLogin && loginStep === 'email' && 'Send login code'}
                {mode === 'login' && !isAdminLogin && loginStep === 'code' && 'Verify code & sign in'}
              </span>
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-gray-500">
            {mode === 'login' ? (
              <p>
                New student?{' '}
                <button type="button" onClick={() => { setMode('register'); setError(null); }} className="font-bold text-teal-600 hover:underline">
                  Create an account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button type="button" onClick={() => { setMode('login'); setError(null); setLoginStep('email'); }} className="font-semibold text-indigo-600 hover:underline">
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
