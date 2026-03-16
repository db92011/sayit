# SayIt!

SayIt! is a first-build communication translator that turns a messy draft into a calmer, clearer message and gives the user a teleprompter mode to deliver it out loud.

## What is built

- Full intake flow for audience, relationship, situation, outcome, barrier, tone, before state, after state, and proof of success
- Browser voice capture using `SpeechRecognition` / `webkitSpeechRecognition` when available
- Translation output with a primary rewrite, short version, conversation map, tone translation map, delivery notes, and a full-screen teleprompter overlay
- Local draft persistence with `localStorage`
- A Cloudflare Pages Function at `/api/translate` that creates a real backend boundary for future OpenAI integration
- Optional OpenAI-backed translation through the Pages Function when `OPENAI_API_KEY` is configured
- Static-first fallback behavior so the app still works when the API route is unavailable during simple local development
- Node tests covering the rewrite engine and the API handler

## Project shape

- [`site/`](/Users/dannybrooking/Documents/GitHub%20=%20master%20copy/projects/SayIt/site): static frontend shipped to Cloudflare Pages
- [`functions/api/translate.js`](/Users/dannybrooking/Documents/GitHub%20=%20master%20copy/projects/SayIt/functions/api/translate.js): Pages Function translation endpoint
- [`site/src/rewrite-engine.js`](/Users/dannybrooking/Documents/GitHub%20=%20master%20copy/projects/SayIt/site/src/rewrite-engine.js): rule-based translation engine used by both frontend fallback and server endpoint

## Commands

```bash
npm run dev
npm test
```

`npm run dev` serves the static site at `http://127.0.0.1:4173`.

For the mobile app-style review inside VS Code Simple Browser, use:

`http://127.0.0.1:4173/?preview=app-mobile`

For full Cloudflare-style local verification, run Pages dev separately if `wrangler` is installed in the operator environment:

```bash
wrangler pages dev site
```

## Environment

Copy `.dev.vars.example` to `.dev.vars` for local Pages-style development or set the same values in Cloudflare Pages:

- `OPENAI_API_KEY`
- `OpenAi_SayIt_Secret_Key` also works if that is the secret name already stored in Cloudflare
- `OPENAI_MODEL` default: `gpt-5-mini`
- `OPENAI_BEHAVIOR` optional system behavior override

## Current assumptions

- The app stays usable without OpenAI because the existing rule-based translator remains as the fallback path.
- The frontend calls `/api/translate` first and falls back to the local engine if the API route is not present.
- Billing, subscription enforcement, email validation, and persistent accounts are not implemented in this build.

## Recommended next steps

1. Add identity, subscription state, and smart-link email flows before gating premium usage inside the app itself.
2. Persist drafts, saved rewrites, and teleprompter sessions in D1.
3. Wire the production app hostname into the Circle the People marketing flow.
4. Run a browser pass in Cloudflare Pages dev before publish.
