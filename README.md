# Lab@Home

Home laboratory testing platform for Oman (student business concept).
Patients book tests, licensed nurses collect samples at home, couriers move them to partner labs, labs publish verified reports.

- Front end: vanilla HTML/CSS/JS, no build step, installable as a PWA (`manifest.webmanifest`, `sw.js`).
- Back end: Supabase Postgres. Tables are locked with row level security; the app only calls `SECURITY DEFINER` functions that check a session token and the caller's role.
- Roles: patient, nurse, courier (logistics), lab, company sponsor, admin.
- Languages: English and Arabic (RTL).

Demo accounts (password `Demo@2026`): patient@, nurse@, courier@, lab@, company@, admin@ `demo.labathome.om`.

Concept by Ansam Al Noumani, Jokha Al Rawahi and Bilarab Al Musallami, supervised by Dr. Salim Al-Rashdi.
Prices, partners and demo data are illustrative. The platform coordinates home sample collection and does not provide medical diagnosis.
