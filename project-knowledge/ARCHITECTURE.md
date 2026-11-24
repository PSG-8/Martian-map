# Architecture

## Front end (no build step, PWA)
- `index.html` loads `css/app.css` and `js/*.js` with `?v=<N>` cache-busting.
- `js/app.js` (~2300 lines, one IIFE): router (hash routes like `#/`, `#/how`, `#/new`, `#/about`, `#/register`, `#/app/...`), all views, i18n additions via `Object.assign(I18N.en/ar, {...})`. New code goes **before** `async function boot(){`.
- `js/i18n.js` EN/AR strings (Arabic is RTL). `js/api.js` calls Supabase RPCs. `js/art.js` logo/illustrations. `js/hero3d.js` three.js banners (vendor three r160 in `js/vendor/`). `js/qr.js` QR codes. `js/pdf.js` result reports. `js/guide.js` result levels (normal / review / urgent).
- v28 sections at the end of app.js: consultations (`viewConsultPublic`, `viewConsultNew`, `viewConsults`, `viewConsult`), `viewBusiness`, `viewBrand`, `vanStrip`. Routes `#/consult`, `#/dental`, `#/business`, `#/brand`, `#/app/consult[/new|/<id>]`.
- Results: `prA()` picks the person's range (adult women `f`, children under 16 `k`), `flagFor()` / `resFlag()` add the "slightly" marker; `LAHGUIDE.assess` matches the database rules.
- `api.js`: every call has a time limit (reads 9 s + one retry, writes 20 s). Catalog and signed-in profile are cached in localStorage (`lah_cat_v2`, `lah_user`) and refreshed in the background.
- `sw.js` service worker: network-first for pages; versioned assets cached; skips `/media/` and Range requests (video).
- `img/hero/h{0-4}{d,m}.jpg` pre-rendered banners (d = desktop 1920x760, m = mobile 780x1200).

## Back end
- Supabase Postgres, every table has RLS on; the app only calls `SECURITY DEFINER` RPCs that check a session token + role.
- Tables: consults (v28), app_users, sessions, login_attempts, tests, packages, programs, orders, order_events, notifications, waitlist, settings, support_tickets, private_config, push_subs, email_tokens, reset_tokens, kit_items, nurse_kit, kit_requests.
- Roles: patient, nurse, courier, lab, company, doctor, admin. Demo accounts `<role>@demo.labathome.om` / `Demo@2026`.
- Analyte fields: lo/hi normal, rlo/rhi "slightly outside" band, clo/chi critical, `f` female and `k` child overrides, `nod` = never random-positive in demo. Trigger `_orders_severity` writes f/m/c/r per result and the order severity. SQL of v28 in `project-knowledge/sql/`.
- Consult RPCs: doctors_list, consult_create, consult_list, consult_get, consult_action; business_public (money settings).
- Vercel functions in `api/`: `mail.js` (email + password reset), `push.js` (web push), `google.js` (Google sign-in), `chat.js` (AI assistant via AI Gateway).
- Env var NAMES (values only in Vercel): MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM, VAPID_PUBLIC, VAPID_PRIVATE, PUSH_SECRET, GOOGLE_CLIENT_ID, AI_GATEWAY_API_KEY.

## Other pages
- `present/index.html` — fixed 1600x900 stage scaled to the window; keyboard/swipe; N notes, F fullscreen.
- `questions/index.html` — same engine, 9 slides.
