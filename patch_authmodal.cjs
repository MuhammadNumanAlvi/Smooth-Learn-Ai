const fs = require('fs');
let code = fs.readFileSync('src/components/AuthModal.tsx', 'utf8');

code = code.replace(/    let targetEmail = email\.trim\(\);\n    if \(targetEmail\.toLowerCase\(\) === 'saasproduct'\) \{\n      targetEmail = 'saasproduct@admin\.pk';\n    \} else if \(\!targetEmail\.includes\('@'\) && mode !== 'forgot'\) \{\n      setError\('Please enter a valid email address\.'\);\n      return;\n    \}/, `    let targetEmail = email.trim();
    
    // Server-side check for admin
    if (!targetEmail.includes('@') && mode !== 'forgot') {
      try {
        setLoading(true);
        const res = await fetch('/api/auth/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: targetEmail, password })
        });
        
        const data = await res.json();
        if (data.success) {
          targetEmail = data.email;
        } else {
          setError(data.message || 'Please enter a valid email address.');
          setLoading(false);
          return;
        }
      } catch (err) {
        setError('Server error during authentication.');
        setLoading(false);
        return;
      }
    }`);
fs.writeFileSync('src/components/AuthModal.tsx', code);
console.log('patched AuthModal.tsx');
