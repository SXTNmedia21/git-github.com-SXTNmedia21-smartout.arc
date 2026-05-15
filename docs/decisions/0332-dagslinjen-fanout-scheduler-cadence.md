---
id: ADR-0332
title: "Scheduled Note Fanout — pg_cron → Edge Function Cadence"
status: proposed
date: 2026-05-15
deciders: [pontus, council]
tags: [communication, scheduling, edge-functions, pg-cron]
supersedes: null
superseded_by: null
layer: decision
created: 2026-05-15
updated: 2026-05-15
---

# ADR-0332: Scheduled Note Fanout — pg_cron → Edge Function Cadence

## Context and Problem Statement

`dagslinjen-quickadd` extends `session_note` with `audience JSONB` + `notify_at TIMESTAMPTZ` + `delivered_at TIMESTAMPTZ` so managers can create notes that fan out to a resolved recipient set at a future time (Journey 3 + 4 in `docs/superpowers/specs/2026-05-15-dagslinjen-quickadd-design.md`). A scheduler must wake periodically, query `session_note WHERE notify_at <= now() AND delivered_at IS NULL`, resolve the audience JSONB into a deduplicated `profile_ids[]` (via JOINs on `team_member`, `schedule_shift_assignment`, `profile.primary_department_id`), emit notifications per recipient, and set `delivered_at = now()` idempotently. The question: where does the cadence live, and what runs the resolver?

## Decision Drivers

- **Pattern consistency** — the codebase has 23 pg_cron migrations and an exact-fit reference at `supabase/functions/session-hook-executor/index.ts` (5-min cadence, idempotency, audit emit). Diverging requires justification.
- **Resolver complexity** — audience resolution is 4 sub-resolvers across 4 tables with dedup. plpgsql is workable but hostile to unit tests, type checking, and reuse from other future fanout features (broadcast, role-based digests).
- **Local dev DX** — Supabase local does not ship pg_cron. The codebase already solves this with the `IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')` guard (used in all 23 cron migrations).
- **Failure-mode visibility** — Pontus needs to see "scheduler is stuck" without digging into Postgres internals. Edge Function logs surface in Supabase Dashboard → Functions → Logs; cron job runs are visible via `cron.job_run_details` + activity_trail event from the handler.
- **Cadence floor vs UX promise** — Spec § R3 documents `notify_at ±5 min`. UI shows "Påminner ca 18:00 (±5 min)" so the cadence is part of the product contract, not a hidden tradeoff.
- **No new infrastructure** — ADR-0048 explicitly chose "pg_cron + Edge Functions, not a separate service" for scheduled engine work. n8n is reserved for cross-system orchestration per `~/dev/smartout.ai/CLAUDE.md` n8n section.

## Considered Options

1. **Option A — pg_cron → Edge Function `note-fanout-scheduler` at `*/5 * * * *`** (recommendation)
   - Mirror of `session-hook-executor`. pg_cron triggers `net.http_post` to the Edge Function with bearer auth (`WATCHDOG_CRON_SECRET` pattern). TS handler queries pending rows, resolves audience, emits notifications, sets `delivered_at`. Resolver is a pure module unit-testable in isolation.
2. **Option B — pg_cron with inline plpgsql resolver + `notification_outbox` INSERT-from-SELECT**
   - Same pattern as `shift_reminder_crons` (2026-05-04). All logic in SQL. Faster (no HTTP roundtrip), but the audience resolver is materially more complex than the shift_reminder UNION (4 sub-resolvers with dedup + JSONB array unnesting). plpgsql tests require pgtap; resolver cannot be reused from `note-broadcast` or similar future tools.
3. **Option C — n8n cron workflow on the droplet (`100.115.242.65:5678`)**
   - n8n triggers HTTPS call into Supabase, runs resolver as JavaScript, writes notifications. UI is visible. But adds availability dependency (droplet outage = no notes delivered); adds network hop; violates ADR-0048 + the operational rule that n8n is for cross-system orchestration only.

## Decision Outcome

Chosen option: **Option A — pg_cron → Edge Function `note-fanout-scheduler`, cadence `*/5 * * * *`**.

**Cadence value justification.** 5-min matches `session-hook-executor` (same operational class: in-workspace fanout, no external SLA). The UX surface in spec § R3 promises "Påminner ca 18:00 (±5 min)" — the cadence IS the contract; tightening to 1-min adds 5× pg_cron load with no product benefit (managers don't author notes for "fire in 90 seconds"). Loosening to 15-min breaks the "notify_at 18:00, fires 17:55–18:05" expectation. If a Phase 2 surface demands sub-minute precision (e.g. "fire-now broadcast"), build it as a separate write-path that bypasses the scheduler, not by tightening this cron.

**Transport justification.** Edge Function over inline plpgsql because:
1. Audience resolver is 4 sub-resolvers + JSONB array unnest + dedup — translates to ~80 lines of TS with three unit tests vs ~150 lines of plpgsql with pgtap fixtures.
2. The resolver becomes reusable: future `broadcast-resolver`, `digest-resolver`, `targeted-task-resolver` all share the same audience shape per Q1 outcome.
3. Failure-mode introspection is materially better — `console.error` + JSON response body show up in Supabase Functions logs, vs hunting in `cron.job_run_details.return_message`.

**Transport-NOT-justified-by-test-only-reasons.** If `delivered_at`-write-after-emit splits into two failure modes (notification sent, UPDATE failed → next tick re-fires), the Edge Function MUST wrap the per-note unit in a try/catch with explicit ordering: emit notification first, UPDATE delivered_at on success, log dedup-key for human review on partial failure. This is identical to the constraint in `session-hook-executor:172-187` (insert tasks, then insert engine_event).

## Rationale

- **Matches `session-hook-executor` 1:1** — same auth (`WATCHDOG_CRON_SECRET`), same gating (`IF EXISTS pg_extension pg_cron`), same idempotency primitive (existing-set check; here `delivered_at IS NULL`), same emit pattern (post-success engine_event).
- **ADR-0048 binding** — daily-close engine spec accepts pg_cron + Edge Functions as the canonical scheduled-work mechanism. Diverging would require a superseding ADR.
- **Local dev unblocked** — pg_cron-gated migration is a no-op in local Supabase; the Edge Function itself runs locally via `supabase functions serve note-fanout-scheduler`. Operator can manually trigger the HTTP endpoint with curl + WATCHDOG_CRON_SECRET to exercise the resolver during development without waiting 5 min.
- **Resolver reuse** — the audience JSONB shape (Q1) becomes a contract; the resolver module (`audience-resolver.ts`) becomes its sole owner. Future tools that need "expand audience JSONB → profile_ids[]" import the same module, with its tests.

## Alternatives Rejected

**Option B (inline plpgsql).** Rejected because resolver complexity outweighs HTTP overhead savings. Once you write the 4-resolver UNION + dedup + JSONB unnest in plpgsql, you've also signed up for: (a) no shared resolver if `note-broadcast` ships later, (b) pgtap test setup for any nontrivial coverage, (c) re-doing the same work the next time an audience-fanout feature lands. 5-min cadence × ~100ms HTTP overhead = 1.2 seconds/hour of overhead — irrelevant.

**Option C (n8n).** Rejected because (a) violates ADR-0048 + n8n-scope rule, (b) adds droplet as a hard dependency for in-workspace messaging (droplet outage = no daily-notes fire), (c) n8n's UI advantage is moot here because the Edge Function emits its own audit-trail rows that show up in `activity_trail` already.

## Consequences

**Good.**
- Reuses an already-deployed pattern (`session-hook-executor`) — operators recognize the shape instantly.
- Resolver is testable in Deno test runner; CI catches regressions before merge.
- No new infrastructure, no new secrets, no new failure modes vs the existing cron family.
- Audience resolver becomes a reusable module for future fanout features.
- Local dev unblocked via `supabase functions serve` + manual curl trigger.

**Bad.**
- pg_cron 5-min granularity means worst-case `notify_at = 17:56` fires at 18:00 (4 min late). Mitigated by UX label "ca 18:00 (±5 min)".
- HTTP overhead per tick (~100ms) is wasted when there are zero pending rows. Mitigated by partial index `idx_session_note_fanout_pending` keeping the query sub-millisecond.
- Two failure-mode surfaces (cron + Edge Function) — operator must check both for "scheduler stuck". Mitigated by adding `comm.scheduled_note.delivered` activity_trail event on every successful tick; absence = alert candidate (followup ADR for heartbeat-watchdog if needed).
- Local-dev parity gap remains — pg_cron does NOT run locally; developer testing the timer behavior must manually invoke the Edge Function. Acceptable per existing 23-migration precedent.

## Failure-mode handling

| Failure | Detection | Recovery |
|---|---|---|
| Edge Function 5xx | `cron.job_run_details.return_message`; Supabase Functions log | Next tick re-runs same query; `delivered_at IS NULL` predicate guards re-emit |
| Notification emitted but `UPDATE delivered_at` fails | Log line with `note_id`, `recipient_count`, `tick_id`; next tick re-fires (idempotency violation) | Wrap per-note (emit + UPDATE) in single try block; on UPDATE failure log dedup-key + alert; do not catch silently |
| Audience JSONB malformed (Q1 contract violation) | Resolver throws on Zod parse | Skip the note, log error with `note_id`; next tick re-attempts; operator can patch row or `UPDATE delivered_at = now()` to suppress |
| `notify_at` in the past at write time (clock skew) | Server Action validates `notify_at > now()` before insert | Reject at write — no scheduler impact |
| Cron job not registered (pg_cron not installed) | Migration is no-op; no rows progress past `notify_at` | Operator enables pg_cron in Supabase Cloud dashboard + re-runs migration |
| Pending row queue exceeds 100 (LIMIT 100 in spec § 4 Journey 4) | Each tick processes 100; backlog drains 100 per 5 min = 1200/hour | Acceptable for Phase 1 (median backlog: 0-3). If backlog regularly exceeds 100, raise LIMIT or tighten cadence in a follow-up ADR |

**Idempotency contract.** The `delivered_at IS NULL` predicate is the sole guard against double-fire. Any code path that emits notifications MUST set `delivered_at` in the same Edge Function invocation. No external worker may consume the pending-notes queue. No retry handler may re-emit without first checking `delivered_at`.

**Retry semantics.** None at the Edge Function level for Phase 1. If a notification emit fails per-recipient, the row stays in pending state (delivered_at NULL) and the next tick will re-emit to ALL recipients (not just the failed one) — acceptable because at-least-once on a 5-min cadence is the product promise. Phase 2 may introduce per-recipient delivery tracking if Q1 outcome is migrated to a junction table.

## Test Strategy

1. **Unit (audience-resolver.ts)** — `supabase/functions/note-fanout-scheduler/_tests/audience-resolver.test.ts`. Fixtures for each sub-resolver (dept_ids only / team_ids only / shift_ids only / profile_ids only / all four / empty arrays / dedup-required overlap). Assert returned `profile_ids[]` is deduped and stable-ordered.
2. **Integration (Edge Function)** — Deno test runs Edge Function handler against local Supabase with seeded session_note rows; asserts `delivered_at` set, `engine_event` row inserted, recipient count matches resolved audience.
3. **E2E (Playwright)** — `apps/web/e2e/dagslinjen-quickadd/target-note-fanout.spec.ts` (Journey 3 write side) + `apps/web/e2e/dagslinjen-quickadd/employee-receives-note.spec.ts` (Journey 4 read side). Journey 4 calls the Edge Function directly via supabase.functions.invoke after seeding a row with `notify_at = now() - interval '1 minute'`; asserts notification appears in recipient's `notification_outbox`.
4. **Manual smoke** — operator runs `curl -X POST $SUPABASE_URL/functions/v1/note-fanout-scheduler -H "Authorization: Bearer $WATCHDOG_CRON_SECRET"` after seeding a pending row; verifies 200 response + activity_trail event + delivered_at set.
5. **Cron registration smoke** — post-deploy: `SELECT * FROM cron.job WHERE jobname = 'note-fanout-scheduler';` on prod returns one row with `schedule = '*/5 * * * *'`.

## Acceptance Criteria

- [ ] Migration `<TS>_note_fanout_scheduler_cron.sql` registered with pg_cron via the `IF EXISTS pg_extension` guard, identical pattern to `20260428100300_session_hook_executor_cron.sql`.
- [ ] Edge Function `supabase/functions/note-fanout-scheduler/index.ts` deployed; bearer auth via `WATCHDOG_CRON_SECRET`; returns JSON `{ message, notes_processed, recipients_notified }` on success.
- [ ] Resolver module `audience-resolver.ts` exports pure `resolveAudience(audience: AudienceShape, supabase: SupabaseClient): Promise<string[]>` with Zod-validated input and deduped output.
- [ ] `delivered_at` set in same Edge Function invocation as notification emit; `delivered_at IS NULL` partial index `idx_session_note_fanout_pending` exists per spec § 5.
- [ ] Three telemetry events registered: `comm.scheduled_note.created`, `comm.scheduled_note.delivered`, `comm.scheduled_note.deleted` per spec § 7.
- [ ] All four test layers (unit / integration / Playwright × 2 / manual smoke) green before merge.
- [ ] HANDOFF documents the 5-min cadence floor + UX label ("ca 18:00 ±5 min") as a deliberate contract, not a workaround.

## Agent Impact

- **smartout-edge-function-guide skill** picks up `note-fanout-scheduler` as the second cron-only Edge Function reference (after `session-hook-executor`). Its `WATCHDOG_CRON_SECRET` pattern is now load-bearing precedent — do not invent a new bearer-auth scheme for the next scheduled fanout.
- **adr-contract-audit skill** must verify (when run post-merge) that `note-fanout-scheduler` matches the canonical cron-Edge-Function shape: bearer-secret auth, no JWT verification, idempotency predicate on a dedicated column, audit emit on success.
- **smartout-database-guide skill** must enforce that any future scheduled-fanout feature reuses the partial-index pattern (`WHERE delivered_at IS NULL AND notify_at IS NOT NULL`) rather than full-table scans.

---

> Registered in `docs/decisions/0000-decision-log.md`. Cross-refs: ADR-0048 (daily-close engine), ADR-0069 (engine_event emit on hook fire), ADR-0099 (authority audit). Spec source: `docs/superpowers/specs/2026-05-15-dagslinjen-quickadd-design.md` § 9 Q2 + § 4 Journey 4.
