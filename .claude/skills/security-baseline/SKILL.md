---
name: security-baseline
description: Use when touching auth, permissions, database functions, payments, personal/health data, secrets, file uploads or deployment config - and before every release. Project-level security rules for a public repo with Supabase + Vercel. For a full diff review also run the built-in /security-review.
---

# Security baseline

## Non-negotiables
1. **The repo is public.** No secrets in code, docs, commits, screenshots or test files. Only publishable/anon keys may appear in the front end. Real secrets live in Vercel/Supabase env vars; refer to them by name only.
2. **Never print credentials** in chat or logs. Passwords for team accounts are given to the owner in chat only, never written to files.
3. **Database:** RLS enabled on every table. Clients call `SECURITY DEFINER` RPCs that check the caller (`_uid(token)`) and role before reading/writing; internal helpers are revoked from `anon`. Every RPC rejects other users' rows (`NOT_FOUND`, not "forbidden", to avoid leaking existence).
4. **Input:** validate type, length and enum server side; parameterised SQL only; escape all user text before inserting into HTML.
5. **Auth:** hashed passwords (bcrypt/crypt), session tokens with expiry, rate-limit login and sign-up, generic error on bad login.
6. **Health data:** minimum necessary; partners see only their assigned orders; audit who opened a report; consent stored with timestamp.
7. **Payments:** amounts computed server side; never trust a client price; webhooks verified by signature.

## Release checklist
- [ ] `git diff` scanned for keys (the pre-commit hook does this; also eyeball it).
- [ ] Supabase advisors (security + performance) show no new errors.
- [ ] New RPCs tested as: owner, other user, anon, wrong role.
- [ ] Headers: CSP or at least `X-Content-Type-Options`, `Referrer-Policy`, HTTPS only.
- [ ] Dependencies loaded from pinned versions/CDNs with SRI where possible.
- [ ] Demo accounts (public password) cannot reach real data or admin money screens beyond the demo scope.

## If a secret leaks
Rotate it first (Supabase/Vercel/provider dashboard), then remove it from the code, then tell the owner. Removing it from git history alone is not enough.
