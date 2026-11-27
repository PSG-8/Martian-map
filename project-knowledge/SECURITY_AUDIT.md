# Security audit — 2026-11-27 (database v55/v55b, site v56)

Approved by the owner before work started. Rule followed: nothing deleted, database not reset, owner account not replaced,
no secrets printed or committed, no security switched off to make a test pass, no paid service added.
SQL: `sql/v55_security_hardening.sql` (applied as migrations `v55_security_hardening` and `v55b_logout_all_push`).

## What was checked
Supabase: every table's rights, row-level security, all `SECURITY DEFINER` functions, sign-in (password, Google, sessions),
owner/admin protection, Supabase security advisor. Vercel functions (`api/*.js`), headers (`vercel.json`), the front end, the public repo.

## Findings
| # | Finding | Level | Status |
|---|---|---|---|
| 1 | Google sign-in signed into **any existing account** with the same email, including team, staff and owner accounts on `labathome.om`, a domain we do not own. Whoever got a Google account on that address could take the account over. | Critical | **Fixed.** Google only signs in patient accounts; team/demo addresses and non-patient accounts get "use your password" (`USE_PASSWORD`). No Google accounts existed yet, so nobody was affected. |
| 2 | 15 tables still had table rights for the public (`anon`) and signed-in (`authenticated`) roles. Row security blocked reading rows, but `TRUNCATE` ignores row security. | High | **Fixed.** All table and sequence rights removed from both roles (also for future tables). The app only uses checked functions, so nothing else changed. Verified: direct table reads now get `42501 permission denied`. |
| 3 | "Owner" meant "any real admin". | Medium | **Fixed.** Owner = one internal account id kept in protected config. A database guard stops the owner account being deleted, demoted, suspended or turned into a demo account by any path, and stops a second real admin being created (staff is the limited admin role). |
| 4 | Changing the email needed no password. A stolen session could change the email, then reset the password. | Medium | **Fixed.** Team, staff and owner accounts must type their current password to change the email. Patients unchanged. |
| 5 | No way to end sessions on other devices. | Medium | **Fixed.** "Log out of all devices" (profile, and the owner's security card): ends every session and push subscription of that account, and is logged. |
| 6 | No record of who changed what. | Medium | **Fixed.** `security_audit` table: no app access, rows cannot be changed or deleted from the app. Records account created/deleted, role/status/demo/email/phone/password changes (never the values), settings, coupons, protected config keys (never values), log out of all devices, with who did it. The owner sees it on Safety & privacy, with failed sign-ins of the last 7 days (logins masked) and open sessions. |
| 7 | Two message helper functions had no fixed search path. | Low | **Fixed.** |
| 8 | `pg_net` extension sits in the public schema. | Low | Left as is: moving it can break push sending. |
| 9 | Functions callable by the public role; row security on with no policies. | Info | By design: every function checks the session token itself; tables are closed to direct access. |
| 10 | 27 foreign keys without an index. | Performance | Not changed (safe to add later). |

Already in place and re-checked: bcrypt password hashes, sign-in rate limit (`login_attempts`), sessions that expire,
staff signed out after 30 minutes idle, password change needs the old password, user management is owner-only and cannot touch admin accounts,
demo accounts read-only and kept apart from real data (v52 guard), secrets only in Vercel env vars, security headers (CSP, HSTS, frame block, nosniff).

## Owner powers (owner's request, `sql/v56_owner_all_powers.sql`)
The owner account can do everything every role can (each check got "or the owner"; nobody else gained anything):
run a real visit step by step, receive at the lab, enter/publish results, nurse kit and incident screens, company programmes and camps, fleet view.
Dry run on a real order (rolled back): assigned → on the way → arrived → collected → in transit → at lab → processing; publish with no values → `MISSING_RESULTS`; with values → completed.

## Tests (run on the live database inside a transaction that was rolled back; no data changed)
Owner delete / demote / suspend → `OWNER_PROTECTED`; editing the owner's name → allowed; demo admin made real or new admin → `ADMIN_LOCKED`;
doctor email change without password → `REAUTH_REQUIRED`, wrong password → `BAD_LOGIN`, right password → saved and logged with the doctor as actor;
Google with a team address or a doctor's email → `USE_PASSWORD`, Google for a patient → signed in; patient email change → works as before;
security page for a doctor or the demo admin → `FORBIDDEN`, for the owner → audit, failed sign-ins and sessions; log out of all devices → 0 sessions left;
editing an audit row → `AUDIT_READONLY`. Live API: demo patient/admin/doctor/nurse sign in and load their data as before.
Site: `tools/qa/v56sec.js` (Samsung S24, iPhone SE, laptop × Arabic/English) and the regular checker (`tools/qa/run-all.sh`).

## Needs the owner's decision (not done)
1. **Owner email:** the owner account uses an address on `labathome.om`, which receives no mail, so password-reset emails cannot reach it. Change it to a real email from Profile (now asks for the current password).
2. **Separate production database:** demo and real data share one Supabase project (kept apart by checks). A second project would separate them fully; moving real data needs a short planned pause.
3. **Backups:** depend on the Supabase plan. Check the plan's backup option before real patients join.
4. **Two-step sign-in (TOTP) for owner and staff:** next stage.
5. **Own domain + firewall (e.g. Cloudflare):** needs a bought domain.
6. **Sessions in HttpOnly cookies:** would need a server in front of every call (big change). Today the token sits in browser storage, protected by the CSP.
7. **Load test above about 100 users at once:** not run; it may hit free-tier limits.
8. Argon2id is not available in the database; bcrypt stays (still strong).

## Readiness
**Conditionally ready for a controlled pilot** (student project, a small number of known real users).
Before full public production: real owner email, backups, two-step sign-in for owner/staff, and ideally a separate production database.
