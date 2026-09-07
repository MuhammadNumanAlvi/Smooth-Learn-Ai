const fs = require('fs');
let code = fs.readFileSync('src/components/AuthModal.tsx', 'utf8');

// Ensure targetEmail is used and error handling is correct
code = code.replace(/    setLoading\(true\);\n    setLoading\(true\);\n    try \{\n      if \(mode === 'login'\) \{\n        await loginWithEmail\(targetEmail, password\);\n      \} else \{\n        await registerWithEmail\(targetEmail, password\);\n      \}/, `    setLoading(true);
    try {
      if (mode === 'login') {
        try {
          await loginWithEmail(targetEmail, password);
        } catch (err: any) {
          if (targetEmail === 'saasproduct@admin.pk' && (err?.code?.includes('user-not-found') || err?.code?.includes('invalid-credential'))) {
            try {
              await registerWithEmail(targetEmail, password);
            } catch (regErr) {
              throw err;
            }
          } else {
            throw err;
          }
        }
      } else {
        await registerWithEmail(targetEmail, password);
      }`);

fs.writeFileSync('src/components/AuthModal.tsx', code);
console.log('patched AuthModal.tsx with admin creation logic');
