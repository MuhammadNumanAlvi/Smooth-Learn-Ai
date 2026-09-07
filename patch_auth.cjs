const fs = require('fs');
let code = fs.readFileSync('src/components/AuthModal.tsx', 'utf8');

code = code.replace(/const handleEmailSubmit = async \(e: React.FormEvent\) => \{\n    e.preventDefault\(\);\n    setError\(null\);\n    setMessage\(null\);\n\n    if \(\!email\) \{\n      setError\('Email address is required.'\);\n      return;\n    \}/, `const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email) {
      setError('Email/Username is required.');
      return;
    }

    let targetEmail = email.trim();
    if (targetEmail === 'Saasproduct') {
      targetEmail = 'saasproduct@admin.pk';
    } else if (!targetEmail.includes('@') && mode !== 'forgot') {
      setError('Please enter a valid email address.');
      return;
    }`);

code = code.replace(/    if \(mode === 'forgot'\) \{\n      setLoading\(true\);\n      try \{\n        await resetPassword\(email\);/, `    if (mode === 'forgot') {
      setLoading(true);
      try {
        await resetPassword(targetEmail);`);

code = code.replace(/    try \{\n      if \(mode === 'login'\) \{\n        await loginWithEmail\(email, password\);\n      \} else \{\n        await registerWithEmail\(email, password\);\n      \}\n      setLoading\(false\);\n      onSuccess\(\);\n    \} catch \(err\) \{/, `    try {
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
      }
      setLoading(false);
      onSuccess();
    } catch (err) {`);

code = code.replace(/<label className="block text-xs font-semibold text-slate-700 mb-1">Email Address<\/label>/, '<label className="block text-xs font-semibold text-slate-700 mb-1">Email or Username</label>');

code = code.replace(/type="email"\n                  required\n                  value=\{email\}/, 'type="text"\n                  required\n                  value={email}');

code = code.replace(/placeholder="student@university.edu"/, 'placeholder="student@university.edu or Saasproduct"');

fs.writeFileSync('src/components/AuthModal.tsx', code);
console.log("Patched AuthModal.tsx");
