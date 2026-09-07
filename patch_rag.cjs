const fs = require('fs');
let code = fs.readFileSync('server/rag.ts', 'utf8');

// The original condition is: const hasSufficientMaterial = totalLength > 150 && topChunks.length > 0;
// We will lower the threshold or remove it to avoid throwing errors too aggressively.
code = code.replace(/const hasSufficientMaterial = totalLength > 150 && topChunks\.length > 0;/, 'const hasSufficientMaterial = topChunks.length > 0;');

fs.writeFileSync('server/rag.ts', code);
console.log('patched rag.ts hasSufficientMaterial threshold');
