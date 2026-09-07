import { GoogleGenAI, Type } from '@google/genai';
import { CONFIG } from './config';
import { QuizQuestion, SourceReference, QuestionStyle, QuizDifficulty } from '../src/types';
import { isBroadChapterQuery, resolveChapterFromQuery, retrieveRelevantContext } from './rag';
import { db } from './db';

function getAiClient(): GoogleGenAI {
  const settings = db.getAISettings();
  const apiKey = process.env.GEMINI_API_KEY || settings.geminiKey;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in settings or environment');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getGeminiModel(): string {
  const settings = db.getAISettings();
  return settings.geminiModel || CONFIG.GEMINI_GENERATION_MODEL;
}

// Runtime validator for generated QuizQuestion
function validateQuizQuestion(q: any, retrievedSources: SourceReference[]): QuizQuestion | null {
  if (!q || typeof q !== 'object') return null;
  const question = typeof q.question === 'string' ? q.question.trim() : '';
  if (question.length < 5) return null;
  if (!Array.isArray(q.options) || q.options.length !== 4) return null;
  const options = q.options.map((opt: any) => (typeof opt === 'string' ? opt.trim() : '')).filter(Boolean);
  if (options.length !== 4) return null;

  // Check duplicate options
  const uniqueOptions = new Set(options.map((o) => o.toLowerCase()));
  if (uniqueOptions.size !== 4) return null;

  const correctAnswer = typeof q.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
  if (!correctAnswer) return null;

  // Ensure correctAnswer matches one of options
  const matchedOption = options.find(
    (opt) => opt.toLowerCase() === correctAnswer.toLowerCase() || opt === correctAnswer
  );
  if (!matchedOption) return null;

  const explanation = typeof q.explanation === 'string' && q.explanation.trim().length > 10
    ? q.explanation.trim()
    : `The correct answer is "${matchedOption}" as substantiated in the study material.`;

  const validDifficulties: Array<'Easy' | 'Medium' | 'Hard'> = ['Easy', 'Medium', 'Hard'];
  const difficulty = validDifficulties.includes(q.difficulty) ? q.difficulty : 'Medium';
  const topic = typeof q.topic === 'string' && q.topic.trim().length > 0 ? q.topic.trim() : 'Core Concept';

  // Ground source references in actual retrieved chunks
  let sourceReferences: SourceReference[] = [];
  if (Array.isArray(q.sourceReferences) && q.sourceReferences.length > 0) {
    sourceReferences = q.sourceReferences
      .filter((ref: any) => ref && (ref.chapter || ref.page || ref.chunkId))
      .map((ref: any) => ({
        chapter: ref.chapter || retrievedSources[0]?.chapter || 'Study Material',
        page: Number(ref.page) || retrievedSources[0]?.page || 1,
        chunkId: ref.chunkId || retrievedSources[0]?.chunkId,
        excerpt: ref.excerpt || retrievedSources[0]?.excerpt,
      }));
  }
  if (sourceReferences.length === 0 && retrievedSources.length > 0) {
    sourceReferences = [retrievedSources[0]];
  }

  return {
    id: q.id || `q-${Math.random().toString(36).substring(2, 9)}`,
    type: 'multiple_choice',
    question,
    options,
    correctAnswer: matchedOption,
    explanation,
    difficulty,
    topic,
    sourceReferences,
    hint: q.hint || 'Carefully recall the key definitions and processes outlined in this chapter.',
  };
}

// Filter near-duplicate questions
function deduplicateQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  const seen = new Set<string>();
  const result: QuizQuestion[] = [];
  for (const q of questions) {
    // Normalized question signature
    const sig = q.question.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
    if (!seen.has(sig)) {
      seen.add(sig);
      result.push(q);
    }
  }
  return result;
}

export async function analyzeDocumentContent(params: { apiKey?: string;
  text: string;
  fileName: string;
  pdfBase64?: string;
}): Promise<{
  title: string;
  summary: string;
  estimatedPages: number;
  chapters: Array<{
    id: string;
    title: string;
    summary: string;
    keyPoints: string[];
    estimatedReadTime: string;
  }>;
  keyTerms: Array<{ term: string; definition: string }>;
  overallDifficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}> {
  const ai = getAiClient();

  const prompt = `You are an expert academic study assistant tasked with analyzing an educational document or textbook.

CRITICAL INSTRUCTION FOR CHAPTER EXTRACTION:
You MUST locate the "Table of Contents" or "Outline" page in the document. Extract the exact chapters or major sections exactly as they are listed in that Table of Contents. Do NOT invent, summarize, or logically group chapters on your own. If the document has a Table of Contents listing 12 chapters, you must extract all 12 chapters with their exact titles. If there is no Table of Contents, extract the main headings as chapters.

File Name: ${params.fileName}

Document Text Sample / Content:
${params.text.slice(0, 30000)}

Please analyze this document deeply and return a structured JSON object with:
1. title: An accurate, professional title for the study material
2. summary: A thorough 2-3 paragraph executive summary of the document's core concepts, learning objectives, and practical implications
3. estimatedPages: Estimated page count based on depth (integer >= 1)
4. overallDifficulty: Either "Beginner", "Intermediate", or "Advanced"
5. chapters: Extract the ACTUAL chapters/sections strictly based on the Table of Contents. Each chapter must have:
   - id: unique string (e.g. "ch-1")
   - title: exact chapter title from the document outline
   - summary: concise summary of what this chapter covers
   - keyPoints: array of 3-5 high-yield bullet points
   - estimatedReadTime: estimated time to study (e.g. "8 mins")
6. keyTerms: An array of 6 to 12 crucial definitions, technical vocabulary, or key concepts (each with term and definition).

Format your response strictly as valid JSON matching this schema.`;

  try {
    const contents: any[] = [];
    if (params.pdfBase64) {
      contents.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: params.pdfBase64,
        },
      });
    }
    contents.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            estimatedPages: { type: Type.INTEGER },
            overallDifficulty: {
              type: Type.STRING,
              enum: ['Beginner', 'Intermediate', 'Advanced'],
            },
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  keyPoints: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  estimatedReadTime: { type: Type.STRING },
                },
                required: ['id', 'title', 'summary', 'keyPoints', 'estimatedReadTime'],
              },
            },
            keyTerms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  definition: { type: Type.STRING },
                },
                required: ['term', 'definition'],
              },
            },
          },
          required: ['title', 'summary', 'estimatedPages', 'overallDifficulty', 'chapters', 'keyTerms'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      title: parsed.title || params.fileName.replace(/\.[^/.]+$/, ''),
      summary: parsed.summary || 'Comprehensive academic study document.',
      estimatedPages: parsed.estimatedPages || Math.max(1, Math.round(params.text.length / 2500)),
      overallDifficulty: parsed.overallDifficulty || 'Intermediate',
      chapters: (parsed.chapters || []).map((ch: any, i: number) => ({
        id: ch.id || `ch-${i + 1}`,
        title: ch.title || `Chapter ${i + 1}`,
        summary: ch.summary || '',
        keyPoints: Array.isArray(ch.keyPoints) ? ch.keyPoints : [],
        estimatedReadTime: ch.estimatedReadTime || '10 mins',
      })),
      keyTerms: (parsed.keyTerms || []).map((kt: any) => ({
        term: kt.term,
        definition: kt.definition,
      })),
    };
  } catch (error) {
    console.error('Gemini analyzeDocumentContent failed:', error);
    const titleFallback = params.fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    return {
      title: titleFallback.charAt(0).toUpperCase() + titleFallback.slice(1),
      summary: `Document analysis for ${params.fileName}. Contains ${params.text.length} characters of educational content.`,
      estimatedPages: Math.max(1, Math.round(params.text.length / 2000)),
      overallDifficulty: 'Intermediate',
      chapters: [
        {
          id: 'ch-1',
          title: 'Core Fundamentals & Overview',
          summary: 'Introduction to primary concepts and thematic foundations.',
          keyPoints: ['Core definitions and primary scope', 'Key principles introduced in this document'],
          estimatedReadTime: '10 mins',
        },
        {
          id: 'ch-2',
          title: 'Applied Theory & Mechanics',
          summary: 'Detailed examination of core mechanisms and interactions.',
          keyPoints: ['Process flows and methodologies', 'Practical use cases and scenarios'],
          estimatedReadTime: '15 mins',
        },
      ],
      keyTerms: [
        { term: 'Foundational Concept', definition: 'The fundamental principle underlying the subject matter.' },
      ],
    };
  }
}

// Generate Real RAG-Grounded Multiple Choice Questions
export async function generateRagQuizQuestions(params: { apiKey?: string;
  userId: string;
  bookId: string;
  documentTitle: string;
  chapterId?: string;
  chapterTitle?: string;
  sectionId?: string;
  topic?: string;
  questionCount: number;
  difficulty: QuizDifficulty;
  questionStyle?: QuestionStyle;
}): Promise<{ questions: QuizQuestion[]; sourceReferences: SourceReference[] }> {
  // 1. Semantic RAG Retrieval respecting user scope & UID ownership
  const retrieval = await retrieveRelevantContext({
    userId: params.userId,
    bookId: params.bookId,
    query: `${params.topic || ''} ${params.chapterTitle || ''} key concepts exam questions`,
    chapterId: params.chapterId,
    chapterTitle: params.chapterTitle,
    sectionId: params.sectionId,
    topic: params.topic,
    topK: Math.min(10, Math.max(4, Math.ceil(params.questionCount * 1.5))),
  });

  if (!retrieval.hasSufficientMaterial) {
    throw new Error(
      'I could not find enough information about this in your uploaded material to generate the requested questions. Please select a broader scope or upload more material.'
    );
  }

  const ai = getAiClient();
  const count = Math.max(1, Math.min(25, params.questionCount));

  const prompt = `You are a master academic examiner designing rigorous multiple-choice questions for QuizMind AI.
Generate exactly ${count} multiple choice questions strictly grounded in the retrieved source material below.

SOURCE MATERIAL (Retrieved Chunks from Student's Uploaded Document):
${retrieval.contextText}

GENERATION PARAMETERS:
- Target Question Count: ${count}
- Focus Scope: ${params.chapterTitle ? `Chapter: ${params.chapterTitle}` : 'Entire Document'}
- Question Style: ${params.questionStyle || 'Mixed'} (Conceptual, Factual, Application Based, Scenario Based)
- Difficulty Level: ${params.difficulty || 'Medium'} (Easy, Medium, Hard, Mixed)

MANDATORY RULES:
1. Grounding: Every question MUST test authentic content directly present in the source material above. Do NOT hallucinate external facts or invent information not supported by the excerpts.
2. Structure: Each question must contain:
   - "question": Clear, challenging stem.
   - "options": An array of EXACTLY 4 distinct, plausible answer strings (no duplicates).
   - "correctAnswer": The exact string matching the single correct option in "options".
   - "explanation": In-depth educational rationale explaining why this answer is correct and citing the concept from the text.
   - "difficulty": "Easy", "Medium", or "Hard".
   - "topic": Specific academic subtopic or mechanism tested.
   - "sourceReferences": Array with objects containing "chapter", "page", and "chunkId" matching the source tags in the context.
   - "hint": A subtle study tip guiding thought process without spoiling the answer.
3. No duplicate questions or near-duplicate stems.
4. Return strictly valid JSON array matching the schema.`;

  try {
    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING },
              hint: { type: Type.STRING },
              difficulty: {
                type: Type.STRING,
                enum: ['Easy', 'Medium', 'Hard'],
              },
              topic: { type: Type.STRING },
              sourceReferences: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    chapter: { type: Type.STRING },
                    page: { type: Type.INTEGER },
                    chunkId: { type: Type.STRING },
                    excerpt: { type: Type.STRING },
                  },
                },
              },
            },
            required: ['question', 'options', 'correctAnswer', 'explanation', 'difficulty', 'topic'],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AI response was empty or malformed.');
    }

    // Runtime validation of every question
    const validQuestions: QuizQuestion[] = [];
    for (const rawQ of parsed) {
      const validated = validateQuizQuestion(rawQ, retrieval.sourceReferences);
      if (validated) {
        validQuestions.push(validated);
      }
    }

    const deduplicated = deduplicateQuestions(validQuestions);
    if (deduplicated.length === 0) {
      throw new Error('Generated questions did not pass quality validation. Retrying with clearer context.');
    }

    return {
      questions: deduplicated.slice(0, count),
      sourceReferences: retrieval.sourceReferences,
    };
  } catch (error: any) {
    console.error('Gemini generateRagQuizQuestions error:', error);
    throw new Error(error.message || 'Failed to generate grounded quiz questions using Gemini AI.');
  }
}

// Generate Deeper or Simpler Explanations grounded in the RAG chunks
export async function explainQuestionConcept(params: { apiKey?: string;
  userId: string;
  bookId: string;
  question: string;
  correctAnswer: string;
  userAnswer?: string;
  originalExplanation: string;
  style: 'more' | 'simpler';
}): Promise<{
  style: 'more' | 'simpler';
  explanation: string;
  keyTakeaway: string;
  citations: SourceReference[];
}> {
  const retrieval = await retrieveRelevantContext({
    userId: params.userId,
    bookId: params.bookId,
    query: `${params.question} ${params.correctAnswer}`,
    topK: 4,
  });

  const ai = getAiClient();
  const isSimpler = params.style === 'simpler';

  const prompt = isSimpler
    ? `You are an intuitive teacher explaining a concept in simple words (ELI5 / beginner friendly).

Question: "${params.question}"
Correct Answer: "${params.correctAnswer}"
${params.userAnswer ? `Student's Answer: "${params.userAnswer}"` : ''}

Original Textbook Context:
${retrieval.contextText}

Task:
1. Explain why the correct answer is right using clear everyday analogies, plain English, and zero confusing jargon.
2. Provide a single punchy "keyTakeaway" rule of thumb to remember it forever.

Return JSON.`
    : `You are a senior academic researcher providing an exhaustive, advanced conceptual breakdown ("Explain More").

Question: "${params.question}"
Correct Answer: "${params.correctAnswer}"

Original Textbook Context:
${retrieval.contextText}

Task:
1. Provide an in-depth academic explanation detailing underlying mechanisms, edge cases, theoretical principles, and practical implications.
2. Provide a concise "keyTakeaway" encapsulating the advanced principle.

Return JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            keyTakeaway: { type: Type.STRING },
          },
          required: ['explanation', 'keyTakeaway'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      style: params.style,
      explanation: parsed.explanation || params.originalExplanation,
      keyTakeaway: parsed.keyTakeaway || `Key principle: ${params.correctAnswer}`,
      citations: retrieval.sourceReferences,
    };
  } catch (err) {
    console.error('explainQuestionConcept error:', err);
    return {
      style: params.style,
      explanation: isSimpler
        ? `Simply put: ${params.correctAnswer} is correct because it directly matches the fundamental rule in your study notes.`
        : `${params.originalExplanation}\n\nFurthermore, this principle forms the foundation for more advanced applications in this domain.`,
      keyTakeaway: `Remember: ${params.correctAnswer}`,
      citations: retrieval.sourceReferences,
    };
  }
}

export async function generateFlashcards(params: { apiKey?: string;
  documentTitle: string;
  documentContent: string;
  count?: number;
}): Promise<Array<{ front: string; back: string; topic: string; hint?: string }>> {
  const ai = getAiClient();
  const count = params.count || 10;

  const prompt = `You are a memory specialist and learning scientist.
Generate ${count} high-retention spaced repetition flashcards for:

Document Title: ${params.documentTitle}

Content:
${params.documentContent.slice(0, 25000)}

Rules for great flashcards:
- Front: A clear, bite-sized prompt, question, scenario, or concept name (avoid vague one-word prompts)
- Back: Precise, punchy explanation with the core mnemonic or takeaway
- topic: The specific sub-topic or chapter
- hint: An optional subtle memory cue

Return strictly valid JSON array.`;

  try {
    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING },
              back: { type: Type.STRING },
              topic: { type: Type.STRING },
              hint: { type: Type.STRING },
            },
            required: ['front', 'back', 'topic'],
          },
        },
      },
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error('Generate flashcards error:', error);
    throw new Error('Failed to generate flashcards.');
  }
}

export async function answerTutorQuestion(params: { apiKey?: string;
  userId: string;
  bookId: string;
  documentTitle: string;
  userQuestion: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  action?: 'explain_simpler' | 'give_example' | 'standard';
}): Promise<{
  reply: string;
  citations: string[];
  sourceReferences: SourceReference[];
}> {
  const book = db.getDocumentById(params.bookId, params.userId);
  const chapters = book?.chapters || [];
  const resolvedChapter = resolveChapterFromQuery(params.userQuestion, chapters);
  const chapterMeta = resolvedChapter
    ? chapters.find((c) => c.id === resolvedChapter.id)
    : undefined;
  const wantsSummary = isBroadChapterQuery(params.userQuestion);

  const retrieval = await retrieveRelevantContext({
    userId: params.userId,
    bookId: params.bookId,
    query: params.userQuestion,
    chapterId: resolvedChapter?.id,
    chapterTitle: resolvedChapter?.title,
    chapters,
    topK: wantsSummary ? 12 : 6,
  });

  if (retrieval.chunks.length === 0 && !chapterMeta) {
    return {
      reply: 'I could not find enough information about this in your uploaded material. Please ask a question related to the topics, chapters, or concepts contained in this document.',
      citations: [],
      sourceReferences: [],
    };
  }

  const ai = getAiClient();

  // Filter history to last 4 turns for efficiency
  const conversationHistory = params.messages
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Student' : 'AI Tutor'}: ${m.content.slice(0, 400)}`)
    .join('\n');

  let actionDirective = '';
  if (params.action === 'explain_simpler') {
    actionDirective = 'INSTRUCTION: Break this down in ultra-clear, simple language (ELI5). Use an intuitive real-world analogy and avoid technical jargon.';
  } else if (params.action === 'give_example') {
    actionDirective = 'INSTRUCTION: Provide a concrete, vivid applied scenario or worked walkthrough illustrating this concept in action.';
  }

  const chapterOutline = chapters
    .map((c, i) => `${i + 1}. ${c.title}`)
    .join('\n');
  const resolvedNote = resolvedChapter
    ? `The student is asking about book chapter ${resolvedChapter.index + 1}: "${resolvedChapter.title}".`
    : 'No specific chapter number was detected; use the selected book as a whole.';
  const chapterFacts = chapterMeta
    ? `CHAPTER METADATA:\nTitle: ${chapterMeta.title}\nSummary: ${chapterMeta.summary || 'n/a'}\nKey points:\n${(chapterMeta.keyPoints || []).map((p) => `- ${p}`).join('\n')}`
    : '';

  const prompt = `You are the QuizMind AI Personal Academic Tutor.
You are helping a student master the selected book: "${params.documentTitle}".

SELECTED BOOK CHAPTERS:
${chapterOutline || '(chapter list unavailable)'}

${resolvedNote}

${chapterFacts}

CRITICAL GROUNDING RULES:
1. Answer ONLY from this selected book — chapter metadata and retrieved source chunks.
2. If they ask to summarize a chapter, write a real study summary from the chapter metadata and source chunks. Do NOT say you could not find enough information when that material is present.
3. Only say you could not find enough information if there is no chapter metadata AND the chunks are empty or unrelated.
4. Reference specific chapters and page numbers when available.
5. Write formulas in plain text (C4H10, H2O, PV = k, 25 °C). Never use LaTeX, dollar signs or backslash commands.
${actionDirective}

RETRIEVED SOURCE CHUNKS FROM STUDENT'S DOCUMENT:
${retrieval.contextText || '(no extra page excerpts; use chapter metadata above)'}

RECENT CONVERSATION:
${conversationHistory}

STUDENT'S QUESTION:
"${params.userQuestion}"

Return strictly a JSON object with:
- "reply": Markdown formatted educational explanation. Include bold terms and bullet points for readability.
- "citations": Array of 1 to 3 exact phrases or short sentences quoted directly from the retrieved chunks that prove your answer.`;

  try {
    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            citations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['reply', 'citations'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      reply: parsed.reply || 'I analyzed your study text regarding this topic.',
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      sourceReferences: retrieval.sourceReferences,
    };
  } catch (error) {
    console.error('answerTutorQuestion error:', error);
    throw new Error('Tutor AI encountered an issue generating a response.');
  }
}
