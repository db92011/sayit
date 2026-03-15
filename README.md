# SayIt!

SayIt! is a first-build communication translator that turns a messy draft into a calmer, clearer message and gives the user a teleprompter mode to deliver it out loud.

## What is built

- Full intake flow for audience, relationship, situation, outcome, barrier, tone, before state, after state, and proof of success
- Browser voice capture using `SpeechRecognition` / `webkitSpeechRecognition` when available
- Translation output with a primary rewrite, short version, conversation map, tone translation map, delivery notes, and teleprompter script
- Local draft persistence with `localStorage`
- A Cloudflare Pages Function at `/api/translate` that creates a real backend boundary for future OpenAI integration
- Static-first fallback behavior so the app still works when the API route is unavailable during simple local development
- Node tests covering the rewrite engine and the API handler

## Project shape

- [`site/`](/Users/dannybrooking/Documents/GitHub = master copy/amp-sayit/site): static frontend shipped to Cloudflare Pages
- [`functions/api/translate.js`](/Users/dannybrooking/Documents/GitHub = master copy/amp-sayit/functions/api/translate.js): Pages Function translation endpoint
- [`site/src/rewrite-engine.js`](/Users/dannybrooking/Documents/GitHub = master copy/amp-sayit/site/src/rewrite-engine.js): rule-based translation engine used by both frontend fallback and server endpoint

## Commands

```bash
npm run dev
npm test
```

`npm run dev` serves the static site at `http://localhost:4173`.

For full Cloudflare-style local verification, run Pages dev separately if `wrangler` is installed in the operator environment:

```bash
wrangler pages dev site
```

## Current assumptions

- This MVP is intentionally rule-based today so the product is usable without waiting on OpenAI, Stripe, smart-link email auth, or D1.
- The frontend calls `/api/translate` first and falls back to the local engine if the API route is not present.
- `OPENAI_API_KEY` is treated as a future configuration signal only; the function does not call OpenAI yet.
- Billing, subscription enforcement, email validation, and persistent accounts are not implemented in this build.

## Recommended next steps

1. Replace the function's rule-based translator with an OpenAI-backed prompt pipeline and keep the current engine as a fallback path.
2. Add identity, subscription state, and smart-link email flows before gating premium usage.
3. Persist drafts, saved rewrites, and teleprompter sessions in D1.
4. Run a browser pass in Cloudflare Pages dev before publish.
