/**
 * Provider metadata for the Admin AI Configuration screen:
 * live model discovery, credential resolution and connection testing.
 */
import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import { AISettings } from '../src/types';
import { db } from './db';

export type Provider = 'groq' | 'gemini';

export interface ModelOption {
  id: string;
  label: string;
  recommended?: boolean;
}

const GROQ_FALLBACK_MODELS: ModelOption[] = [
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B — fastest', recommended: true },
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B — highest quality' },
  { id: 'qwen/qwen3.6-27b', label: 'Qwen3.6 27B — reasoning' },
];

const GEMINI_FALLBACK_MODELS: ModelOption[] = [
  { id: 'gemini-3.6-flash', label: 'gemini-3.6-flash', recommended: true },
  { id: 'gemini-3.7-flash', label: 'gemini-3.7-flash' },
  { id: 'gemini-flash-latest', label: 'gemini-flash-latest' },
];

/** Chat-capable Groq models only: skip audio, speech and moderation models. */
const GROQ_EXCLUDE = /whisper|orpheus|tts|prompt-guard|safeguard/i;
/** Text generation Gemini models only: skip image, audio, video and research agents. */
const GEMINI_EXCLUDE = /image|tts|transcribe|robotics|computer-use|lyria|banana|deep-research|omni|antigravity|embedding/i;

export function resolveGroqKey(settings?: AISettings): string {
  const s = settings || db.getAISettings();
  return (process.env.GROQ_API_KEY || s.groqKey || '').trim();
}

export function resolveGeminiKey(settings?: AISettings): string {
  const s = settings || db.getAISettings();
  return (process.env.GEMINI_API_KEY || s.geminiKey || '').trim();
}

/** Show enough of a key to recognise it without exposing the secret. */
export function maskKey(key?: string): string {
  const k = (key || '').trim();
  if (!k) return '';
  if (k.length <= 10) return `${k.slice(0, 2)}${'•'.repeat(6)}`;
  return `${k.slice(0, 6)}${'•'.repeat(8)}${k.slice(-4)}`;
}

async function listGroqModels(apiKey: string): Promise<ModelOption[]> {
  if (!apiKey) return GROQ_FALLBACK_MODELS;
  try {
    const groq = new Groq({ apiKey });
    const res = await groq.models.list();
    const ids = (res.data || [])
      .map((m: any) => String(m.id))
      .filter((id) => !GROQ_EXCLUDE.test(id))
      .sort();
    if (ids.length === 0) return GROQ_FALLBACK_MODELS;
    return ids.map((id) => ({
      id,
      label: id,
      recommended: id === 'openai/gpt-oss-20b',
    }));
  } catch (err) {
    console.warn('[QuizMind AI] Groq model list failed, using fallback:', (err as Error).message);
    return GROQ_FALLBACK_MODELS;
  }
}

async function listGeminiModels(apiKey: string): Promise<ModelOption[]> {
  if (!apiKey) return GEMINI_FALLBACK_MODELS;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) return GEMINI_FALLBACK_MODELS;
    const json: any = await res.json();
    const ids = (json.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => String(m.name).replace(/^models\//, ''))
      .filter((id: string) => id.startsWith('gemini') && !GEMINI_EXCLUDE.test(id))
      .sort();
    if (ids.length === 0) return GEMINI_FALLBACK_MODELS;
    return ids.map((id: string) => ({
      id,
      label: id,
      recommended: id === 'gemini-3.6-flash',
    }));
  } catch (err) {
    console.warn('[QuizMind AI] Gemini model list failed, using fallback:', (err as Error).message);
    return GEMINI_FALLBACK_MODELS;
  }
}

export async function listAvailableModels(settings?: AISettings): Promise<{
  groq: ModelOption[];
  gemini: ModelOption[];
}> {
  const s = settings || db.getAISettings();
  const [groq, gemini] = await Promise.all([
    listGroqModels(resolveGroqKey(s)),
    listGeminiModels(resolveGeminiKey(s)),
  ]);
  return { groq, gemini };
}

export interface ConnectionTestResult {
  ok: boolean;
  provider: Provider;
  model: string;
  latencyMs: number;
  message: string;
}

/** Round-trip a tiny completion so the admin knows the saved config really works. */
export async function testProviderConnection(params: {
  provider: Provider;
  model?: string;
  apiKey?: string;
}): Promise<ConnectionTestResult> {
  const settings = db.getAISettings();
  const startedAt = Date.now();

  if (params.provider === 'groq') {
    const apiKey = (params.apiKey || '').trim() || resolveGroqKey(settings);
    const model = (params.model || '').trim() || settings.groqModel || 'openai/gpt-oss-20b';
    if (!apiKey) {
      return { ok: false, provider: 'groq', model, latencyMs: 0, message: 'No Groq API key configured.' };
    }
    try {
      const groq = new Groq({ apiKey });
      const resp = await groq.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
        temperature: 0,
        max_tokens: 128,
      });
      const text = resp.choices[0]?.message?.content?.trim() || '';
      return {
        ok: true,
        provider: 'groq',
        model,
        latencyMs: Date.now() - startedAt,
        message: text ? `Model replied "${text.slice(0, 40)}".` : 'Model accepted the request.',
      };
    } catch (err: any) {
      return {
        ok: false,
        provider: 'groq',
        model,
        latencyMs: Date.now() - startedAt,
        message: describeProviderError(err),
      };
    }
  }

  const apiKey = (params.apiKey || '').trim() || resolveGeminiKey(settings);
  const model = (params.model || '').trim() || settings.geminiModel || 'gemini-3.6-flash';
  if (!apiKey) {
    return { ok: false, provider: 'gemini', model, latencyMs: 0, message: 'No Gemini API key configured.' };
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const resp = await ai.models.generateContent({
      model,
      contents: 'Reply with the single word: OK',
    });
    const text = (resp.text || '').trim();
    return {
      ok: true,
      provider: 'gemini',
      model,
      latencyMs: Date.now() - startedAt,
      message: text ? `Model replied "${text.slice(0, 40)}".` : 'Model accepted the request.',
    };
  } catch (err: any) {
    return {
      ok: false,
      provider: 'gemini',
      model,
      latencyMs: Date.now() - startedAt,
      message: describeProviderError(err),
    };
  }
}

function describeProviderError(err: any): string {
  const status = err?.status || err?.code;
  const raw = String(err?.message || 'Unknown error');

  // Providers often name the replacement model in the body — pass that through.
  let detail = '';
  const match = raw.match(/"message"\s*:\s*"([^"]+)"/);
  if (match) detail = match[1];

  if (status === 401 || /api key|unauthor|invalid_api_key/i.test(raw)) {
    return 'Authentication failed — check the API key.';
  }
  if (status === 404 || /model_not_found|no longer available|does not exist/i.test(raw)) {
    return detail || 'That model is not available for this key. Pick another model.';
  }
  if (status === 429 || /rate limit|quota/i.test(raw)) {
    return 'Rate limit or quota exceeded — try again shortly.';
  }
  if (status === 503 || /high demand|overloaded|unavailable/i.test(raw)) {
    return 'That model is temporarily overloaded — try again or pick another model.';
  }
  return (detail || raw).slice(0, 220);
}
