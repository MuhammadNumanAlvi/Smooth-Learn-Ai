const fs = require('fs');
let code = fs.readFileSync('src/components/AuthModal.tsx', 'utf8');
code = code.replace(/if \(targetEmail === 'Saasproduct'\) \{/, "if (targetEmail.toLowerCase() === 'saasproduct') {");
fs.writeFileSync('src/components/AuthModal.tsx', code);
console.log('patched');
