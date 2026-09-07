const fs = require('fs');
let code = fs.readFileSync('src/lib/firestoreClient.ts', 'utf8');

code = code.replace(/    \} else \{\n      await setDoc\(userRef, \{\n        lastLoginAt: new Date\(\)\.toISOString\(\),\n        \.\.\.\(user\.email === 'saasproduct@admin\.pk' \? \{ role: 'admin' \} : \{\}\)\n      \}, \{ merge: true \}\);\n    \}/, `    } else {
      // Just update login time, only force admin if it's the super admin email
      await setDoc(userRef, {
        lastLoginAt: new Date().toISOString(),
        ...(user.email === 'saasproduct@admin.pk' ? { role: 'admin' } : {})
      }, { merge: true });
    }`);

fs.writeFileSync('src/lib/firestoreClient.ts', code);
console.log('patched syncUserToFirestore');
