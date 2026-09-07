# Smooth Learn AI

Book-based learning platform: upload a textbook, then study with chapter quizzes, flashcards, and an AI tutor.

## Local

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000

## Vercel (GitHub)

1. Import [MuhammadNumanAlvi/Smooth-Learn-Ai](https://github.com/MuhammadNumanAlvi/Smooth-Learn-Ai) in Vercel.
2. Framework preset: **Other**. Build command and output directory come from `vercel.json`.
3. Add environment variables (Production + Preview), then redeploy:

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Yes (or Groq) | Quiz, flashcards, tutor, embeddings |
| `GROQ_API_KEY` | Yes (or Gemini) | Same features; used for failover |
| `AI_PROVIDER` | Recommended | `groq` or `gemini` |
| `GROQ_MODEL` | Optional | Default `openai/gpt-oss-20b` |
| `GEMINI_MODEL` | Optional | Default `gemini-3.6-flash` |
| `ADMIN_EMAIL` | Optional | Admin Firebase email |
| `ADMIN_USERNAME` | Optional | Username login |
| `ADMIN_PASSWORD` | Optional | Username login password |
| `VITE_FIREBASE_*` | Optional | Overrides `firebase-applet-config.json` |

4. In Firebase Console → Authentication → Settings → Authorized domains, add your `*.vercel.app` domain (and custom domain if any).

Do not commit `.env` or `data/quizmind.json`. Those hold API keys and student data.

On Vercel the JSON store lives in `/tmp` (ephemeral). Auth still uses Firebase. For large PDFs, Vercel hobby has a request-body limit (~4.5MB).
