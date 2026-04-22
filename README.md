# SayIt!

SayIt! is the standalone SayIt app. It now follows Finch's flat Cloudflare Pages app shape:

- `pages/index.html`: public install and marketing surface
- `pages/app.html`: gated standalone app shell
- `pages/app.js`: app entry module
- `pages/src/`: SayIt runtime modules
- `functions/api/`: same-origin API routes for translation, billing, plan checks, and device management

## Product boundaries

- Marketing page: `https://circlethepeople.com/sayit`
- Standalone app runtime: `https://sayitapp.pages.dev`
- SayIt branding, copy, API routes, billing flow, and runtime live in this repo
- `CircleThePeopleSite` hosts the SayIt marketing page and hands off into the standalone app

## Commands

```bash
npm run dev
npm run dev:static
npm test
```

`npm run dev` serves the app through Cloudflare Pages at `http://127.0.0.1:4173`.

`npm run dev:static` serves only the `pages/` output for layout work.

## Notes

- The install surface is `/`.
- The app shell is `/app.html`.
- The PWA manifest launches into `/app.html?source=pwa`.
- Frontend API calls stay same-origin by default.
- Cloudflare Pages config is intentionally flat: one `wrangler.toml`, one `pages/` output directory, one `functions/` runtime.
- If `OPENAI_API_KEY` is missing, SayIt falls back to the local rewrite engine in [`pages/src/rewrite-engine.js`](/Users/dannybrooking/Documents/GitHub = master copy/SayIt/pages/src/rewrite-engine.js).
- `SAYIT_FREE_ACCESS_EMAILS` can hold a comma/newline-separated pool of approved emails that should unlock SayIt without going through Stripe. Those emails still use the normal device-seat rules.

## Stripe Key Master

SayIt now uses one clean billing path:

- users enter their email to start the 3-day trial
- that email becomes their restore/login identity later
- after the trial, SayIt checks Stripe for that same email

The billing runtime reads these variables:

- `SAYIT_STRIPE_PRICE_ID`
  The recurring Stripe price for SayIt Pro.
- `STRIPE_SECRET_KEY` or `Stripe_Secret_Key_SayIt`
  Use one secret key. `STRIPE_SECRET_KEY` is the preferred name.
- `SAYIT_STRIPE_URL`
  Optional direct payment link. If present, SayIt uses this instead of creating a hosted checkout session.
- `SAYIT_APP_URL`
  The app runtime URL used for successful and canceled return paths.
- `SAYIT_MARKETING_URL`
  The marketing URL for SayIt.
- `STRIPE_PUBLISHABLE_KEY`
  Optional for future client-side billing surfaces. Not required for the current modal flow.

Recommended setup:

1. Create one recurring monthly Stripe price for SayIt Pro.
2. Put that price id in `SAYIT_STRIPE_PRICE_ID`.
3. Decide whether you want:
   - hosted checkout: set `STRIPE_SECRET_KEY`
   - direct payment link: set `SAYIT_STRIPE_URL`
4. Keep production secrets in Cloudflare Pages / Workers secrets, not committed repo files.

The local reference file is [`/.dev.vars.example`](/Users/dannybrooking/Documents/GitHub = master copy/SayIt/.dev.vars.example).
