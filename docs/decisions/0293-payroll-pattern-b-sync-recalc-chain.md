---
id: ADR-0293
title: "Payroll Pattern B Sync-Recalc Chain — BFF Routes Synchronously Trigger recalculate-period After Supplement and Tip-Approval Writes"
status: accepted
created: 2026-05-08
updated: 2026-05-08
module: payroll
tags: [payroll, recalc, pattern-b, sync-chain, bff, tips, supplement]
---

# ADR-0293 — Payroll Pattern B Sync-Recalc Chain

## Context

Three DB triggers emit `engine_event` rows when payroll-affecting writes succeed:

| Trigger | event_kind | Source BFF |
|---------|-----------|------------|
| `payroll_manual_supplement_recalc_trg` (INSERT) | `payroll.recalc_triggered_by_supplement` | `add-manual-supplement` |
| `payroll_manual_supplement_recalc_trg` (DELETE) | `payroll.recalc_triggered_by_supplement` | `delete-manual-supplement` |
| `payroll_tip_distribution_recalc_trg` (INSERT, status='approved') | `payroll.recalc_triggered_by_tip_distribution` | `tips/approve-distribution` |

The Supabase Edge Function `engine-dispatch` has no registered handler for any of these event_kinds (T7.1 audit, 2026-05-08). This means the event row is an audit artifact only — no recalculation fires automatically (Pattern A gap).

Journeys J4 (supplement insert/delete → totals updated <2s) and J5 (tip approval → merge into payroll <2s) require immediate consistency without waiting for Pattern A infrastructure to ship.

ADR-0292 established Pattern B for the approve-proposal surface: after the primary write, the BFF route synchronously calls a second internal route. This ADR extends Pattern B to the three supplement/tip surfaces.

## Decision

Each BFF route that makes a payroll-affecting write for which no Pattern A engine_dispatch handler exists MUST:

1. Complete the primary write (insert, delete, or status flip).
2. Emit telemetry (ADR-0134).
3. Synchronously POST to `/api/payroll/recalculate-period` with the affected `period_id`.
4. If recalc returns non-200: log the error and return 200 to the caller with a `recalc_warning` field. **The primary write is canonical — recalc failure must not roll back or mask the primary operation.**

### Period resolution

- **Supplement routes:** `period_id` is carried in the request body (add) or resolved via `schedule_shift.start_time → payroll.period` (delete).
- **Tips approve-distribution:** `period_id` is resolved via `department_session.session_date → payroll.period`.
- If period resolution fails (shift deleted, session missing, period locked/approved): skip recalc silently (period already frozen or shift data missing — no recalc is correct behaviour).

### Auth forwarding

The sync-chain call forwards the original request's `cookie` and `authorization` headers so `resolvePayrollAuth` succeeds in the child route (same pattern as `approve-proposal → apply-line-override`).

## Consequences

**Good:**
- J4 and J5 journeys work end-to-end without Pattern A infrastructure.
- Primary write is never blocked or rolled back by recalc latency.
- `recalc_warning` in the response body gives the caller a diagnostic signal without a 500.
- Audit trail is preserved — engine_event rows still land for future Pattern A migration.

**Bad / Risks:**
- Synchronous chain adds latency to the primary BFF route (~200-800 ms for a full recalc). Acceptable for UI-triggered manager actions; not suitable for high-frequency batch writes.
- Pattern B is a temporary bridge. When Pattern A ships (engine_dispatch handler for these event_kinds), the sync-chain steps must be removed to avoid double-recalc.

## Migration Path to Pattern A

When T7.1 Pattern A workers ship for `payroll.recalc_triggered_by_supplement` and `payroll.recalc_triggered_by_tip_distribution`:

1. Register handlers in `supabase/functions/engine-dispatch/index.ts`.
2. Remove the sync-chain fetch blocks from the three BFF routes (`add-manual-supplement`, `delete-manual-supplement`, `tips/approve-distribution`).
3. The engine_event row idempotency key prevents double-recalc during the transition window.
4. Update this ADR status to `superseded` and reference the Pattern A ADR.

## Affected Files

- `apps/web/src/app/api/payroll/add-manual-supplement/route.ts`
- `apps/web/src/app/api/payroll/delete-manual-supplement/route.ts` (new in T7.3)
- `apps/web/src/app/api/tips/approve-distribution/route.ts`
- `packages/ai/src/capabilities/payroll/tools.ts` (delete_manual_supplement tool, T7.3)
- `packages/ai/src/capabilities/payroll/index.ts` (registration, T7.3)

## Related ADRs

- ADR-0292 — established Pattern B for approve-proposal → apply-line-override (precedent)
- ADR-0099 — gate_action before write (unchanged by this ADR)
- ADR-0134 — telemetry contract (emit before sync-chain, not inside it)
- ADR-0151 — workspace_id server-derived (unchanged)
- ADR-0229 — tips BFF owns writes (unchanged)
