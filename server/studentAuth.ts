import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import firebaseConfig from '../firebase-applet-config.json';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'saasproduct@admin.pk').toLowerCase();
const otpMemory = new Map<string, { hash: string; exp: number; attempts: number }>();
const unlockMemory = new Map<string, string>();
const UNLOCK_FILE = process.env.VERCEL
  ? path.join('/tmp', 'student-unlock.json')
  : path.join(process.cwd(), 'data', 'student-unlock.json');

function readUnlockFile(): Record<string, string> {
  try {
    if (!fs.existsSync(UNLOCK_FILE)) return {};
    return JSON.parse(fs.readFileSync(UNLOCK_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeUnlockFile(emailId: string, enc: string) {
  const all = readUnlockFile();
  all[emailId] = enc;
  fs.mkdirSync(path.dirname(UNLOCK_FILE), { recursive: true });
  fs.writeFileSync(UNLOCK_FILE, JSON.stringify(all), 'utf8');
}

function vaultKey() {
  return crypto
    .createHash('sha256')
    .update(process.env.ADMIN_PASSWORD || process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || 'smooth-learn-vault')
    .digest();
}

export function emailKey(email: string) {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 32);
}

export function hashOtp(email: string, code: string) {
  return crypto.createHash('sha256').update(`${email.trim().toLowerCase()}:${code.trim()}`).digest('hex');
}

export function encryptSecret(text: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(payload: string) {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

async function adminIdToken(): Promise<string | null> {
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password) return null;
  const key = firebaseConfig.apiKey;
  const body = { email: ADMIN_EMAIL, password, returnSecureToken: true };
  let res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  if (!res.ok) return null;
  const data = await res.json();
  return data.idToken || null;
}

function firestoreDocUrl(collectionName: string, id: string) {
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents/${collectionName}/${id}`;
}

function fromFields(fields: any) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields || {})) {
    const val = v as any;
    out[k] = val.stringValue || val.integerValue || '';
  }
  return out;
}

async function writeDoc(collectionName: string, id: string, data: Record<string, string>) {
  const token = await adminIdToken();
  if (!token) return false;
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = { stringValue: String(v) };
  const res = await fetch(firestoreDocUrl(collectionName, id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields }),
  });
  return res.ok;
}

async function readDoc(collectionName: string, id: string) {
  const token = await adminIdToken();
  if (!token) return null;
  const res = await fetch(firestoreDocUrl(collectionName, id), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return fromFields(data.fields);
}

export async function saveStudentUnlock(email: string, password: string, profile: Record<string, string>) {
  const enc = encryptSecret(password);
  const key = emailKey(email);
  unlockMemory.set(key, enc);
  writeUnlockFile(key, enc);
  await writeDoc('studentUnlock', key, { enc, email: email.trim().toLowerCase(), ...profile });
  return enc;
}

export async function storeOtp(email: string, code: string) {
  const rec = {
    hash: hashOtp(email, code),
    exp: String(Date.now() + 10 * 60 * 1000),
    attempts: '0',
  };
  otpMemory.set(emailKey(email), { hash: rec.hash, exp: Number(rec.exp), attempts: 0 });
  await writeDoc('otpCodes', emailKey(email), rec);
}

export async function verifyStoredOtp(email: string, code: string) {
  const key = emailKey(email);
  let rec = otpMemory.get(key);
  if (!rec) {
    const remote = await readDoc('otpCodes', key);
    if (remote?.hash) rec = { hash: remote.hash, exp: Number(remote.exp), attempts: Number(remote.attempts || 0) };
  }
  if (!rec) return { ok: false, error: 'No login code found. Request a new one.' };
  if (Date.now() > rec.exp) return { ok: false, error: 'That code has expired. Request a new one.' };
  if (rec.attempts >= 5) return { ok: false, error: 'Too many attempts. Request a new code.' };
  if (rec.hash !== hashOtp(email, code)) {
    rec.attempts += 1;
    otpMemory.set(key, rec);
    return { ok: false, error: 'Incorrect code. Check the email and try again.' };
  }
  otpMemory.delete(key);
  return { ok: true };
}

export async function unlockStudentPassword(email: string) {
  const key = emailKey(email);
  const mem = unlockMemory.get(key) || readUnlockFile()[key];
  if (mem) {
    try {
      return decryptSecret(mem);
    } catch {
      /* fall through */
    }
  }
  const remote = await readDoc('studentUnlock', emailKey(email));
  if (!remote?.enc) return null;
  try {
    return decryptSecret(remote.enc);
  } catch {
    return null;
  }
}

export async function sendLoginCodeEmail(to: string, code: string, name?: string) {
  const subject = 'Your Smooth Learn login code';
  const text = `Hi ${name || 'there'},\n\nYour Smooth Learn login code is ${code}.\nIt expires in 10 minutes.\n\nIf you did not request this, ignore this email.`;
  const html = `<p>Hi ${name || 'there'},</p><p>Your Smooth Learn login code is <strong style="font-size:22px;letter-spacing:3px">${code}</strong>.</p><p>It expires in 10 minutes.</p>`;

  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Smooth Learn <noreply@smoothlearn.me>',
        to: [to],
        subject,
        text,
        html,
      }),
    });
    if (res.ok) return;
  }

  const resendFallback = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      _subject: subject,
      name: 'Smooth Learn',
      message: text,
    }),
  });
  if (resendFallback.ok) return;
  if (!process.env.VERCEL) {
    console.log(`[Smooth Learn] Login code for ${to}: ${code}`);
    return;
  }
  throw new Error('Could not send the login code email.');
}

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function isAdminEmail(email: string) {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}
