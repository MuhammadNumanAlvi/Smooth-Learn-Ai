import { db } from './db';
import { resolveGeminiKey, resolveGroqKey } from './aiProviders';
import * as groqAI from './groq';
import * as geminiAI from './gemini';

type Provider = 'groq' | 'gemini';

const RETRY_DELAY_MS = 700;

function activeProvider(): Provider {
  return db.getAISettings().provider === 'gemini' ? 'gemini' : 'groq';
}

function providerHasKey(provider: Provider): boolean {
  const settings = db.getAISettings();
  return provider === 'gemini' ? Boolean(resolveGeminiKey(settings)) : Boolean(resolveGroqKey(settings));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Providers routinely return transient 429/503s. Retry the active provider once,
 * then fail over to the other configured provider so a spike never dead-ends the user.
 */
async function callWithFailover<T>(
  label: string,
  handlers: Record<Provider, () => Promise<T>>
): Promise<T> {
  const primary = activeProvider();
  const secondary: Provider = primary === 'groq' ? 'gemini' : 'groq';

  try {
    return await handlers[primary]();
  } catch (primaryErr: any) {
    console.warn(`[QuizMind AI] ${label} failed on ${primary}: ${primaryErr?.message}`);

    await sleep(RETRY_DELAY_MS);
    try {
      return await handlers[primary]();
    } catch (retryErr: any) {
      console.warn(`[QuizMind AI] ${label} retry failed on ${primary}: ${retryErr?.message}`);

      if (!providerHasKey(secondary)) throw retryErr;

      console.warn(`[QuizMind AI] ${label} falling back to ${secondary}`);
      try {
        return await handlers[secondary]();
      } catch (fallbackErr: any) {
        console.error(`[QuizMind AI] ${label} failed on both providers: ${fallbackErr?.message}`);
        throw fallbackErr;
      }
    }
  }
}

export async function analyzeDocumentContent(params: any) {
  return callWithFailover('analyzeDocument', {
    gemini: () => geminiAI.analyzeDocumentContent(params),
    groq: () => groqAI.groqAnalyzeDocument(params),
  });
}

export async function generateQuizQuestions(params: any) {
  return callWithFailover('generateQuiz', {
    gemini: () => geminiAI.generateRagQuizQuestions(params),
    groq: () => groqAI.groqGenerateQuizQuestions(params),
  });
}

export async function explainConcept(params: any) {
  return callWithFailover('explainConcept', {
    gemini: () => geminiAI.explainQuestionConcept(params),
    groq: () => groqAI.groqExplainConcept(params),
  });
}

export async function generateFlashcards(params: any) {
  return callWithFailover('generateFlashcards', {
    gemini: () => geminiAI.generateFlashcards(params),
    groq: () => groqAI.groqGenerateFlashcards(params),
  });
}

export async function answerTutorQuestion(params: any) {
  return callWithFailover('answerTutorQuestion', {
    gemini: () => geminiAI.answerTutorQuestion(params),
    groq: () => groqAI.groqAnswerTutorQuestion(params),
  });
}
