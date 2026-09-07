const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
code = code.replace(/onFinish=\{.*?\}\n/g, `onFinish={async (attempt) => {
              try {
                if (activeQuiz) {
                  await api.submitQuizAttempt(activeQuiz.id, attempt);
                }
              } catch (err) {
                console.error(err);
              }
              setActiveQuiz(null);
            }}\n`);
fs.writeFileSync('src/pages/Dashboard.tsx', code);
