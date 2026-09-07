const fs = require('fs');
let code = fs.readFileSync('server/rag.ts', 'utf8');

const target = `  // Check if chunks exist
  if (!chunks || chunks.length === 0) {
    return {
      chunks: [],
      sourceReferences: [],
      contextText: '',
      hasSufficientMaterial: false,
    };
  }`;

const replacement = `  // Check if chunks exist
  if (!chunks || chunks.length === 0) {
    console.warn(\`[QuizMind RAG] retrieveRelevantContext: No chunks found for book \${params.bookId} (chapterId: \${params.chapterId}, chapterTitle: \${params.chapterTitle})\`);
    return {
      chunks: [],
      sourceReferences: [],
      contextText: '',
      hasSufficientMaterial: false,
    };
  } else {
    console.log(\`[QuizMind RAG] retrieveRelevantContext: Found \${chunks.length} chunks for book \${params.bookId}\`);
  }`;

code = code.replace(target, replacement);

const target2 = `  const hasSufficientMaterial = topChunks.length > 0;`;
const replacement2 = `  const hasSufficientMaterial = topChunks.length > 0;
  console.log(\`[QuizMind RAG] topChunks length: \${topChunks.length}, hasSufficientMaterial: \${hasSufficientMaterial}\`);`;

code = code.replace(target2, replacement2);
fs.writeFileSync('server/rag.ts', code);
console.log('patched rag.ts logging');
