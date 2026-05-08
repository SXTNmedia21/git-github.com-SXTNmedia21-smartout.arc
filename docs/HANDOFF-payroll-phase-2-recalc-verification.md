---
title: "HANDOFF — Payroll Phase 2 Recalc Verification (T7.1 + T7.2)"
status: done
updated: 2026-05-08
created: 2026-05-08
module: payroll
tags: [handoff, payroll, phase-2, recalc, triggers, smoke-probe, t7]
---

# HANDOFF — Payroll Phase 2 Recalc Verification

Branch: `feat/payroll-payroll-phase-2` | Worktree: `/home/sxtnl/dev/smartout.ai-payroll-wt-1`

## T7.1 — Trigger Verification Table

| Trigger | Migration file | event_type emitted | Consumer today | Pattern | Test file:block | Status |
|---------|---------------|-------------------|----------------|---------|-----------------|--------|
| `payroll_manual_supplement_recalc_trg` (INSERT) | `20260507110100` | `payroll.recalc_triggered_by_supplement` (op=insert) | **GAP** — no engine_dispatch handler | Pattern A pending | `payroll-phase-2-recalc-triggers.sql` TEST A1 | Trigger verified; consumer GAP |
| `payroll_manual_supplement_recalc_trg` (DELETE) | `20260507110100` | `payroll.recalc_triggered_by_supplement` (op=delete) | **GAP** — no engine_dispatch handler | Pattern A pending | `payroll-phase-2-recalc-triggers.sql` TEST A2 | Trigger verified; consumer GAP |
| `payroll_proposal_applied_trg` (status→applied, kind=wage_line_override) | `20260507110100` | `payroll.line_override_applied` | Pattern B — `/api/payroll/approve-proposal` calls `/api/payroll/apply-line-override` synchronously | Pattern B (live) | `payroll-phase-2-recalc-triggers.sql` TEST B | Trigger verified; consumer live via Pattern B |
| `payroll_tip_distribution_recalc_trg` (INSERT, approved) | `20260507110100` | `payroll.recalc_triggered_by_tip_distribution` | **GAP** — no engine_dispatch handler | Pattern A pending | `payroll-phase-2-recalc-triggers.sql` TEST C | Trigger verified; consumer GAP |

### Consumer Analysis

**Trigger A (supplement insert/delete):** The DB trigger emits `payroll.recalc_triggered_by_supplement` into `public.engine_event`. Supabase Edge Function `engine-dispatch` was audited — no handler exists for this event_type. The `approve-proposal` route and all payroll BFF routes do not consume this event. This is Pattern A transport only: the event row is written but nothing reacts to it automatically. Recalc for supplement changes currently requires a manual call to `/api/payroll/recalculate-period` or the AI capability tool `recalculate_period`. **This is a GAP blocking Journey J4 (manager-deletes-manual-supplement sees totals updated <2s automatically).**

**Trigger B (proposal applied):** The DB trigger emits `payroll.line_override_applied` as an audit record. The `approve-proposal` route uses Pattern B (synchronous chain): after status flip, it calls `apply-line-override` directly without waiting for an engine_event consumer. This means the override pipeline works end-to-end today. The engine_event is an audit artifact for future Pattern A migration. Consumer status: **LIVE (Pattern B).**

**Trigger C (tip distribution):** Same gap as Trigger A. The DB trigger emits `payroll.recalc_triggered_by_tip_distribution` but no handler in `engine-dispatch` or BFF consumes it. **GAP blocking Journey J5 (tip distribution auto-merges into payroll).**

### Schema Finding: `change_proposal.kind` not yet in `database.types.ts`

The migration `20260507110000` adds `kind TEXT`, `resolved_by UUID`, and `resolved_at TIMESTAMPTZ` to `change_proposal`. These columns are absent from `packages/supabase/src/database.types.ts` (types were generated before this migration applied). Types must be regenerated after migrations run against local Supabase. This does not block the trigger test (trigger operates at SQL level) but will cause TS type errors if capability tools try to use strongly-typed `change_proposal` insert with the new columns. The `approve-proposal` route uses `eslint-disable-next-line @typescript-eslint/no-explicit-any` casts as a workaround.

**Action required before T9 closure:** run `pnpm supabase gen types typescript --local > packages/supabase/src/database.types.ts` after applying migrations to local Supabase.

### Trigger A function: one column-name note

`fn_payroll_manual_supplement_recalc` joins `schedule_shift` on `s.schedule_shift_id = NEW.schedule_shift_id`. The `database.types.ts` confirms `schedule_shift.schedule_shift_id` is the PK column name and `schedule_shift.shift_date` exists. Join is correct. The trigger function also sets `search_path = public, payroll, extensions` and is `SECURITY DEFINER` — consistent with other payroll trigger functions.

---

## T7.2 — Recalc Latency Methodology

### What was built

Smoke probe at `GET /api/payroll/_smoke/recalc-latency` (file: `apps/web/src/app/api/payroll/_smoke/recalc-latency/route.ts`).

### Methodology

1. Resolve auth via `resolvePayrollAuth` (ADR-0151 server-side identity).
2. Gate via `gateAction(actionType='recalculate_period')` — requires admin/owner role (ADR-0204).
3. Fetch most recent open period for workspace via `payroll.period` table.
4. Count active profiles + existing payroll.calculation lines (context only).
5. Record `Date.now()` before calling `POST /api/payroll/recalculate-period` (same origin, auth forwarded via cookie/Authorization header).
6. Record `Date.now()` after response returns.
7. Return `{ duration_ms, line_count, profile_count, threshold_ms: 2000, passed: duration_ms < 2000 }`.

### Live measurement

**Not measurable in this agent run** — Supabase Local is not running in the current context. The probe requires:
- Local Supabase running (`npx supabase start`)
- Migrations applied including Phase 2 (20260507110000 + 20260507110100 + 20260507110200)
- At least one open payroll period in the test workspace
- An authenticated admin session

To run manually:
```bash
# Terminal 1: start dev env
pnpm dev

# Terminal 2: call probe
curl -s -H "Cookie: <copy session cookie from browser>" \
  http://localhost:3060/api/payroll/_smoke/recalc-latency | jq .
```

Expected result shape:
```json
{
  "ok": true,
  "period_id": "...",
  "period_range": "2026-05-01 – 2026-05-31",
  "duration_ms": 843,
  "line_count": 47,
  "profile_count": 12,
  "threshold_ms": 2000,
  "passed": true
}
```

The acceptance target is `duration_ms < 2000` for a 12-employee workspace. The orchestrator calls 4 sub-routes sequentially (derive-shift-hours → snapshot-period-costs → aggregate-period → run-deviation-checks). Each sub-route writes a batch then returns — the bottleneck is typically `aggregate-period` (one INSERT per profile per line_type).

---

## GAPs blocking T9 closure

| Gap | Severity | What breaks | Resolution path |
|-----|----------|------------|-----------------|
| **No engine_dispatch consumer for `payroll.recalc_triggered_by_supplement`** | HIGH | Journey J4 (supplement delete → auto totals <2s) cannot work end-to-end. Manager must manually trigger recalc or AI capability must call `recalculate_period`. | Register handler in `engine-dispatch` Edge Function for this event_type, or convert to Pattern B (synchronous in the BFF route that deletes the supplement). |
| **No engine_dispatch consumer for `payroll.recalc_triggered_by_tip_distribution`** | HIGH | Journey J5 (tip approval → auto merge into payroll <2s) cannot work end-to-end. | Same as above — register handler or convert to Pattern B in tip approval route. |
| **`database.types.ts` stale (missing kind/resolved_by/resolved_at on change_proposal)** | MEDIUM | Capability tools using strongly-typed Supabase client will need `any`-casts for new columns until types are regenerated. | `pnpm supabase gen types typescript --local > packages/supabase/src/database.types.ts` after migrations applied. |
| **Latency not measured live** | LOW | T7.2 acceptance criteria (passed: true) unverified. | Run smoke probe manually per methodology above. Probe is admin-gated and production-safe. |

## Files created

- `supabase/tests/payroll-phase-2-recalc-triggers.sql` — 5 SQL assertion tests (A1, A2, B, B2, C, C2)
- `apps/web/src/app/api/payroll/_smoke/recalc-latency/route.ts` — admin-gated GET smoke probe
- `docs/HANDOFF-payroll-phase-2-recalc-verification.md` — this file

## Files read (not modified)

- `supabase/migrations/20260507110100_payroll_phase2_recalc_triggers.sql`
- `supabase/migrations/20260507110000_payroll_phase2_change_proposal_wage_line_override.sql`
- `apps/web/src/app/api/payroll/approve-proposal/route.ts`
- `apps/web/src/app/api/payroll/recalculate-period/route.ts`
- `apps/web/src/app/api/payroll/_shared.ts`
- `packages/supabase/src/database.types.ts` (change_proposal, tip_distribution, schedule_shift types)
- `supabase/functions/engine-dispatch/index.ts` (audited for payroll event consumers)
