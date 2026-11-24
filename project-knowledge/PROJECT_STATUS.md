# Project status — last updated 2026-11-24

## Live now (v27)
- Site v27 on Vercel (branch `lab-at-home`). Phone-friendly home: pre-rendered banner images on phones/tablets, real-time 3D (three.js) only on capable desktops (`liteMode()` in app.js, override with `?lite=0` / `?lite=1`).
- Home page ends with: What's new (2 videos + latest updates) and the contact card (Instagram QR, WhatsApp, phone, email).
- Videos in `media/`: `iLabAtHome_HowItWorks.mp4` (explainer, male narrator, Kokoro TTS) and `iLabAtHome_Characters.mp4` (11 Pixar-style characters).
- `present/` — 8-slide animated presentation (English). Team slide: Bilarab first with a small star.
- `questions/` — standalone page: 7 questions for nurses & experts (we ask, they answer).
- About page: team with Tasnim Al Hasani added; Bilarab first, star + "Platform developer" chip.

## Open / next
1. Character film: only 3 of 9 scenes are real AI video (intro, Salim, Grandpa Hamad). The other 6 are camera moves on still images. Needs HeyGen paid credits (free plan used up) or Hugging Face "invoke" enabled. Source: branch `project-tools` → `films/characters/`.
2. Character film voice says "Saleem" instead of "Salim" — user asked to fix later (needs new TTS).
3. Google sign-in is built but waiting for the owner's GOOGLE_CLIENT_ID in Vercel.
4. Sentry is connected to the account but not installed on the site.
5. User wants: phone-first polish everywhere, smooth on desktop too.

## Where everything is
| Thing | Location |
|---|---|
| Site source (deployed) | branch `lab-at-home` (repo root = site) |
| Explainer video source + CI render | branch `film-ex` (workflow renders on push → branch `explainer-out`) |
| Character film source, test harness, hero-banner renderer, live-check, deploy script, SNMP keynote, Instagram logos | branch `project-tools` |
| Old three.js character film (replaced) | branch `film-cast` |
| Database | Supabase project `ufykiqxsegyuyablrjsq` |
| Hosting | Vercel project `lab-at-home` (team starseekers), domain labathome-oman.vercel.app |
