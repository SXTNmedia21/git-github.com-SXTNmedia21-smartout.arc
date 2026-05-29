---
id: L-0371
title: A synthesized read-surface projection must never be restored as a stored column to fix a failing seed
status: accepted
updated: 2026-05-29
created: 2026-05-29
module: task
tags: [task-ontology, adr-0298, schema, e2e, column-drift, l-0348]
---

# L-0371 — Synthesized projection ≠ stored column

## Context

CI `e2e-task` failed: `seedSessionTask`/`seedTask` inserted `priority: "normal"` into
`session_task` → `Could not find the 'priority' column of 'session_task' in the schema cache`
(6+ cascade failures in `beforeAll`). The tempting "fix" is to add a `session_task.priority`
migration so the seed succeeds.

## Discovery

`session_task` has **no** `priority` column **by design**. `fn_list_my_tasks` exposes a
`priority TEXT` column on its read surface, but **synthesizes** it per source
(`20260607100100_fn_list_my_tasks_v2_hook_links.sql`):

| Source | Table | priority produced | Line |
|---|---|---|---|
| session | `session_task` | `CASE WHEN is_compliance_required THEN 'high' ELSE 'normal' END` | 75 |
| day_ad_hoc | `schedule_day_task` | `CASE WHEN highlight THEN 'high' ELSE 'normal' END` | 123 |
| personal | `personal_task` | `fn_normalize_priority(priority)` — **real column** | 166 |
| emma | `emma_task` | constant `'normal'` | 207 |

Priority is a **read-surface projection** unified across heterogeneous sources, not a stored
attribute each source must carry. `session_task` stores the *causal fact*
(`is_compliance_required`); priority is *derived*. The capability tool mirrors this exactly —
`packages/ai/src/capabilities/task/tools.ts:198` synthesizes on the fallback read path, and
the `create_session` insert writes no `priority` key.

## Rule

**When a seed/insert fails on a column that exists only as a synthesized projection in the
union RPC, the fix is ALWAYS "remove the key from the seed", NEVER "add a migration".**
Restoring the column as stored creates a second source of truth that can drift from its causal
driver (`is_compliance_required`). Only `personal_task` legitimately stores `priority`.

## Companion finding — L-0348 4th occurrence (PostgREST one-per-request)

PostgREST reports missing columns **one per request**. The session_task seed also carried a
phantom `task_type: "general"` — removing only `priority` would have shifted CI-red to
`task_type` on the next run. Both phantom keys (`priority`, `task_type`) had to go. Static
review + typecheck do not catch column drift; only a live invoke (or live CI) does. **Do not
mark a column-drift fix `done` until live `e2e-task` CI is green** — land `in_progress`.

## Caught by

Council 2026-05-29 — supervisor's NEEDS-CHANGES (task_type), grep-verified at Phase 5 per
ADR-0437 §1.6 dissent-amplification. Steward + agent-coord PASSed on priority alone and missed
task_type — the per-file vs full-column-list gap is the signature.
