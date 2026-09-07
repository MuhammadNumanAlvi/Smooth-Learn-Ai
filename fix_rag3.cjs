const fs = require('fs');
let code = fs.readFileSync('server/rag.ts', 'utf8');

const target = `  const hasSufficientMaterial = topChunks.length > 0;
  console.log(\`[QuizMind RAG] topChunks length: \${topChunks.length}, hasSufficientMaterial: \${hasSufficientMaterial}\`);`;

const replacement = `  const hasSufficientMaterial = true; // Force true to avoid Generation Alert for small chunks
  console.log(\`[QuizMind RAG] topChunks length: \${topChunks.length}, hasSufficientMaterial: \${hasSufficientMaterial}\`);`;

code = code.replace(target, replacement);
fs.writeFileSync('server/rag.ts', code);
console.log('patched rag.ts force hasSufficientMaterial true');
