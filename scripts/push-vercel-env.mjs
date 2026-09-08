import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = parseEnv(readFileSync(resolve('.env'), 'utf8'));
const firebase = JSON.parse(readFileSync(resolve('firebase-applet-config.json'), 'utf8'));

const vars = {
  GEMINI_API_KEY: env.GEMINI_API_KEY,
  GROQ_API_KEY: env.GROQ_API_KEY,
  AI_PROVIDER: 'groq',
  GROQ_MODEL: 'openai/gpt-oss-20b',
  GEMINI_MODEL: env.GEMINI_GENERATION_MODEL || 'gemini-3.6-flash',
  GEMINI_GENERATION_MODEL: env.GEMINI_GENERATION_MODEL || 'gemini-3.6-flash',
  GEMINI_EMBEDDING_MODEL: env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
  VITE_FIREBASE_API_KEY: firebase.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebase.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebase.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: firebase.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: firebase.messagingSenderId,
  VITE_FIREBASE_APP_ID: firebase.appId,
  VITE_FIREBASE_DATABASE_ID: firebase.firestoreDatabaseId,
};

const secretKeys = new Set(['GEMINI_API_KEY', 'GROQ_API_KEY']);

function addEnv(name, value) {
  return new Promise((resolvePromise, reject) => {
    const args = [
      'vercel',
      'env',
      'add',
      name,
      'production,preview,development',
      '--yes',
      '--force',
      secretKeys.has(name) ? '--sensitive' : '--no-sensitive',
    ];
    const child = spawn('npx', args, { stdio: ['pipe', 'pipe', 'pipe'], shell: true });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.stdout.on('data', () => {});
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`SET ${name}`);
        resolvePromise();
      } else {
        reject(new Error(`${name} failed (${code}): ${stderr.trim()}`));
      }
    });
    child.stdin.write(value ?? '');
    child.stdin.end();
  });
}

for (const [name, value] of Object.entries(vars)) {
  if (!value) {
    console.log(`SKIP ${name} (empty)`);
    continue;
  }
  await addEnv(name, value);
}
console.log('DONE');
