---
name: ai-automation
description: Use when automating business workflows - scheduled jobs, notifications, webhooks, data syncs, report generation, AI steps inside a pipeline (n8n/Zapier-style or code with cron, Supabase functions, Vercel cron, GitHub Actions). Focus on reliability, idempotency and human approval points.
---

# AI automation

An automation is only good if it runs unattended for months and fails loudly, never silently.

## Design steps
1. **Map the workflow** as trigger → steps → outputs. Write who is affected if it misfires.
2. **Choose the runner** (simplest that fits):
   - Database event or schedule on data → Postgres trigger / `pg_cron` / Supabase Edge Function.
   - Time-based job for a site → Vercel Cron or GitHub Actions schedule.
   - Many SaaS apps glued together → n8n/Zapier/Make, with code steps where logic is non-trivial.
3. **Make every step idempotent**: unique keys, "insert if not exists", store processed IDs. Re-running must never double-charge, double-notify or duplicate rows.
4. **Add AI only where judgment is needed** (classify, summarise, extract). Use structured outputs and a confidence threshold; low confidence → human queue.
5. **Human-in-the-loop** for anything that spends money, messages customers, deletes data or publishes: draft → approve → send.
6. **Throttle and batch.** Respect API limits; throttle user notifications (e.g. max one per 3 minutes per thread).
7. **Observability.** Log each run (start, end, counts, errors) to a table; alert on failure or on "zero items processed" when items were expected.

## Checklist
- [ ] Secrets in the runner's secret store, never in the workflow file or repo.
- [ ] Retries with backoff; dead-letter list for items that keep failing.
- [ ] Dry-run mode tested before going live.
- [ ] Owner can pause it in one place.
- [ ] Documented in RUNBOOK: what it does, schedule, how to stop, how to replay.
