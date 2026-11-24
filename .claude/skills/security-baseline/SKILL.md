---
name: security-baseline
description: Use when touching auth, permissions, database functions, payments, personal/health data, secrets, file uploads or deployment config - and before every release. Security baseline for web apps (examples use Postgres/Supabase + Vercel), strict enough for public repos. In Claude Code also run /security-review on the diff.
---

# Security baseline

## Non-negotiables
1. **Assume the repo is or will become public.** No secrets in code, docs, commits, screenshots or test files. Only publishable/anon keys may appear in the front end. Real secrets live in the host's env vars / secret store; refer to them by name only.
2. **Never print credentials** in chat or logs, and never write account passwords into files; hand them to the owner directly.
3. **Database:** RLS enabled on every table. Clients call `SECURITY DEFINER` functions that resolve the caller from the session/token and check the role before reading/writing; internal helpers are revoked from `anon`. Every RPC rejects other users' rows (`NOT_FOUND`, not "forbidden", to avoid leaking existence).
4. **Input:** validate type, length and enum server side; parameterised SQL only; escape all user text before inserting into HTML.
5. **Auth:** hashed passwords (bcrypt/crypt), session tokens with expiry, rate-limit login and sign-up, generic error on bad login.
6. **Health data:** minimum necessary; partners see only their assigned orders; audit who opened a report; consent stored with timestamp.
7. **Payments:** amounts computed server side; never trust a client price; webhooks verified by signature.

## Release checklist
- [ ] `git diff` scanned for keys (a pre-commit secret scan if the project has one; also eyeball it).
- [ ] Database security advisors/linters (e.g. Supabase advisors) show no new errors.
- [ ] New RPCs tested as: owner, other user, anon, wrong role.
- [ ] Headers: CSP or at least `X-Content-Type-Options`, `Referrer-Policy`, HTTPS only.
- [ ] Dependencies loaded from pinned versions/CDNs with SRI where possible.
- [ ] Demo or shared test accounts cannot reach real customer data or admin money screens.

## If a secret leaks
Rotate it first (in the provider's dashboard), then remove it from the code, then tell the owner. Removing it from git history alone is not enough.
