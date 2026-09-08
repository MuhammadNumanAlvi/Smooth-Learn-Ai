# Smooth Learn

A study app for school and college students. Upload your own textbook PDF, then practise chapter by chapter with quizzes, flashcards, and a tutor that stays on that book.

**Live:** [https://www.smoothlearn.me](https://www.smoothlearn.me)

---

## What it does

- Student accounts (email + password)
- Upload a syllabus PDF (up to 25MB, text-based files work best)
- Automatic chapter list from the book
- Chapter quizzes and flashcards
- Book-based tutor (answers from the uploaded material)
- Score history and a simple admin console for platform settings

Books stay on the student’s account. Other students do not see your PDFs or scores.

---

## Stack

| Layer | Choice |
|---|---|
| Web app | Vite, React, TypeScript |
| API | Express (Vercel serverless) |
| Auth | Firebase Authentication |
| Profiles / book metadata | Cloud Firestore |
| AI | Groq and/or Google Gemini (configured in the host environment) |

---

## Run locally

You need Node.js 20+ and accounts for Firebase plus at least one AI provider.

```bash
npm install
cp .env.example .env
```

Fill `.env` with **your** keys. Never put real secrets in git.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment

Copy names from `.env.example`. Typical groups:

- **AI** — `GROQ_API_KEY` and/or `GEMINI_API_KEY`, plus `AI_PROVIDER` (`groq` or `gemini`)
- **Admin** — `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `VITE_ADMIN_EMAIL` (placeholders only in the example file)
- **Firebase web** — `VITE_FIREBASE_*` (public client config; still do not commit a filled `.env`)

Set the same names in your host (for example Vercel → Project → Settings → Environment Variables) for Production and Preview, then redeploy.

Do **not** write real passwords, API keys, or admin emails in this README or in committed files.

---

## Deploy

The production app is already on Vercel with a custom domain.

For a new environment:

1. Connect this GitHub repo to Vercel (framework preset: **Other**; build settings come from `vercel.json`).
2. Add environment variables there — not in the repo.
3. In Firebase Console → Authentication → Settings → Authorized domains, add your Vercel domain and custom domain.

---

## What must stay out of git

- `.env` and any `.env.local` / `.env.production`
- `data/quizmind.json` and other local student data
- Admin passwords, AI keys, and service-account JSON

`.env.example` lists variable **names** only.

---

## Notes

- Prefer a PDF with selectable text. Scanned image-only books will not extract well.
- Server-side JSON on Vercel lives in ephemeral storage. Auth and book metadata use Firebase.
- Admin sign-in is configured through environment variables on the host, not through hardcoded credentials in source.
