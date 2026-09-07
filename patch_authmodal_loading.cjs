const fs = require('fs');
let code = fs.readFileSync('src/components/AuthModal.tsx', 'utf8');

// Ensure setLoading is handled properly for the normal Firebase flow too.
code = code.replace(/    if \(mode === 'forgot'\) \{\n      setLoading\(true\);\n      try \{\n        await resetPassword\(targetEmail\);/, `    if (mode === 'forgot') {
      setLoading(true);
      try {
        await resetPassword(targetEmail);`);

code = code.replace(/    try \{\n      if \(mode === 'login'\) \{/, `    setLoading(true);
    try {
      if (mode === 'login') {`);

fs.writeFileSync('src/components/AuthModal.tsx', code);
console.log('patched AuthModal.tsx');
