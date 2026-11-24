---
name: software-architecture
description: Use when designing or changing the structure of a system - choosing a stack, splitting modules, designing data models and APIs, planning a new product or a big feature, or deciding build-vs-buy. Produces a short decision record, not a lecture.
---

# Software architecture

Goal: the simplest structure that meets today's needs and can grow, written down so the next person (or session) understands why.

## Steps
1. **Pin the requirements first.** Users, main flows, data, scale (users/day, data size), latency, budget, team size, deadline, compliance (health data → privacy, audit log). Ask only for what changes the design.
2. **Read what exists.** `project-knowledge/ARCHITECTURE.md`, `DECISIONS.md`, the code map. Never redesign what you have not read.
3. **Pick boring defaults** unless a requirement forces otherwise:
   - Web app: static front end on a CDN + managed Postgres (Supabase) + serverless functions (Vercel). No build step until it pays for itself.
   - Business rules and permissions live in the database (RLS + `SECURITY DEFINER` RPCs) or one server layer — never only in the browser.
   - One source of truth per piece of data; derived values are computed, not stored twice.
4. **Design the data model before screens.** Tables, keys, ownership (who can read/write each row), status fields as explicit enums, timestamps, soft delete where history matters.
5. **Design the API as verbs on that model** (`order_create`, `consult_send`). Inputs validated server side, errors as stable codes (`NOT_FOUND`, `BAD_INPUT`), every call idempotent or safe to retry.
6. **Name the risks**: single points of failure, slow queries, cost growth, vendor lock-in, data loss. Give each a mitigation or accept it explicitly.
7. **Write a decision record** (append to `DECISIONS.md`): context → options (2–3) → decision → consequences. Five to fifteen lines.

## Checklist before saying "done"
- [ ] Every table has an owner rule (RLS) and an index for its main query.
- [ ] No secret in the front end; public keys only.
- [ ] Failure of each external service degrades gracefully (timeouts, retry once, clear message).
- [ ] Migration is reversible or has a backup step.
- [ ] Diagram or code map updated.

## Anti-patterns
- Microservices, queues or Kubernetes for a product with no users yet.
- Copying business rules into both client and server.
- "We'll add auth/permissions later."
