# Architecture

## Front end (no build step, PWA)
- `index.html` loads `css/app.css` and `js/*.js` with `?v=<N>` cache-busting.
- `js/app.js` (~2000 lines, one IIFE): router (hash routes like `#/`, `#/how`, `#/new`, `#/about`, `#/register`, `#/app/...`), all views, i18n additions via `Object.assign(I18N.en/ar, {...})`. New code goes **before** `async function boot(){`.
- `js/i18n.js` EN/AR strings (Arabic is RTL). `js/api.js` calls Supabase RPCs. `js/art.js` logo/illustrations. `js/hero3d.js` three.js banners (vendor three r160 in `js/vendor/`). `js/qr.js` QR codes. `js/pdf.js` result reports. `js/guide.js` result levels (normal / review / urgent).
- `sw.js` service worker: network-first for pages; versioned assets cached; skips `/media/` and Range requests (video).
- `img/hero/h{0-4}{d,m}.jpg` pre-rendered banners (d = desktop 1920x760, m = mobile 780x1200).

## Back end
- Supabase Postgres, every table has RLS on; the app only calls `SECURITY DEFINER` RPCs that check a session token + role.
- Tables: app_users, sessions, login_attempts, tests, packages, programs, orders, order_events, notifications, waitlist, settings, support_tickets, private_config, push_subs, email_tokens, reset_tokens, kit_items, nurse_kit, kit_requests.
- Roles: patient, nurse, courier, lab, company, doctor, admin. Demo accounts `<role>@demo.labathome.om` / `Demo@2026`.
- Vercel functions in `api/`: `mail.js` (email + password reset), `push.js` (web push), `google.js` (Google sign-in), `chat.js` (AI assistant via AI Gateway).
- Env var NAMES (values only in Vercel): MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM, VAPID_PUBLIC, VAPID_PRIVATE, PUSH_SECRET, GOOGLE_CLIENT_ID, AI_GATEWAY_API_KEY.

## Other pages
- `present/index.html` — fixed 1600x900 stage scaled to the window; keyboard/swipe; N notes, F fullscreen.
- `questions/index.html` — same engine, 9 slides.
