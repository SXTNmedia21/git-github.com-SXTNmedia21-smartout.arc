---
title: "Ultrareview Correctness Sprint — Implementation Plan"
status: draft
updated: 2026-04-17
created: 2026-04-17
module: meta
tags: [bugfix, correctness, ops-monitor, engine-dispatch, briefing, notifications, ultrareview]
source: ultrareview task rp6ofqyfv 2026-04-17
---

# Ultrareview Correctness Sprint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Ship the 5 non-blocker correctness / orchestration bugs from ultrareview `rp6ofqyfv` — each customer-visible or silent-drift, none blocking production promotion but all requiring dedicated fixes.

**Architecture:** 5 small fixes, each with dedicated verification. Bugs 007 and 016 are migration-level (new `CREATE OR REPLACE FUNCTION` migrations); 017 and 013 are single-file code fixes; 014 is a multi-site timezone refactor in one Edge Function.

**Tech Stack:** Postgres triggers + RPCs, Deno Edge Functions, TypeScript (packages/ai), pgTAP.

**Scope:** 5 tasks, ~28 steps. Estimated: 0.5–1 engineer-day.

---

## Task 1 — bug_017: `briefing.ts` day-of-week JS(Sun=0) vs DB(Mon=0)

**File:** `packages/ai/src/capabilities/communication/briefing.ts:70`

**Fix:** reuse the existing engine-dispatch pattern:

```ts
// BEFORE (line 70)
const dayOfWeek = new Date(shiftDate).getDay(); // 0=Sun..6=Sat

// AFTER — matches engine-dispatch/index.ts:524-526 exactly
const jsDay = new Date(shiftDate + 'T12:00:00Z').getUTCDay();
const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..6=Sun (ISO)
```

**Why:** `department_operating_hours.day_of_week` migration declares `0=Mon..6=Sun (ISO)` (migration `20260422400000:15`). Current code uses JS native which makes **every day wrong**. The `T12:00:00Z` pin also guards against TZ rollover on bare date strings.

**Steps:**
- [ ] 1.1 Read briefing.ts:65-120 to confirm current pattern
- [ ] 1.2 Apply the two-line fix at line 70
- [ ] 1.3 `pnpm turbo typecheck --filter=@smartout/ai` — expect 0 errors
- [ ] 1.4 Add a unit test asserting `dayOfWeek` for `2026-04-19` (Sunday) = 6 and `2026-04-20` (Monday) = 0
- [ ] 1.5 Commit: `fix(briefing): use ISO day-of-week (Mon=0) to match department_operating_hours`

---

## Task 2 — bug_013: engine-dispatch `update_entity` wrong PK for change_proposal / observer_request

**File:** `supabase/functions/engine-dispatch/index.ts`

**Fix (two parts):**

Part A — extend `ENTITY_PK` map at lines 492-497:

```ts
const ENTITY_PK: Record<string, string> = {
  daily_reconciliation: 'id',
  department_session: 'department_session_id',
  profile: 'profile_id',
  protocol_assignment: 'assignment_id',
  change_proposal: 'change_proposal_id',      // NEW — matches migration 20260421100200
  observer_request: 'observer_request_id',    // NEW — matches migration 20260415120300:15
};
```

Part B — destructure the update result and block on error (mirrors `gate_action` pattern at lines 615-624):

```ts
// Replace lines 724-730
const { error: updateError } = await supabase
  .from(entity)
  .update({ ...setValues, updated_at: new Date().toISOString() })
  .eq(pkColumn, state.entity_id);

if (updateError) {
  await supabase.from('engine_state').update({
    status: 'blocked',
    last_error: updateError.message,
  }).eq('id', state.id);
  return;
}
```

**Why:** current code falls back to `pkColumn='id'` for the new allowlist entries (`change_proposal` + `observer_request`), neither of which has an `id` column. Update silently matches 0 rows; `advanceToNextStep` at line 732 runs unconditionally → silent forward progression with untouched domain row. Worst failure mode.

**Steps:**
- [ ] 2.1 Read engine-dispatch/index.ts:485-735 to confirm current pattern
- [ ] 2.2 Apply ENTITY_PK map extension (2 lines added)
- [ ] 2.3 Apply error-handling change at update call (lines 724-730)
- [ ] 2.4 `deno check supabase/functions/engine-dispatch/index.ts` (if Deno available locally — otherwise preview-gated)
- [ ] 2.5 Commit: `fix(engine-dispatch): correct PK for change_proposal + observer_request; fail on update error`

---

## Task 3 — bug_016: `notify_swap_result` trigger unreachable approval branch

**File:** NEW migration `supabase/migrations/20260417140000_fix_swap_notification_approval_branch.sql`

**Fix:** `CREATE OR REPLACE FUNCTION notify_swap_result` with corrected status branch:

```sql
-- BEFORE (migration 20260504100006:47)
IF v_status = 'approved' AND v_old_status = 'pending_requester_confirm' THEN

-- AFTER — matches the actual state machine (approve_shift_swap writes 'executed')
IF v_status = 'executed' AND v_old_status = 'pending_manager' THEN
```

**Why:** `approve_shift_swap` RPC (migration `20260413123343:295` and fix migration `20260413132826:135`) writes `context.status = 'executed'`. The state machine has NO `'approved'` or `'pending_requester_confirm'` value — `grep` confirms 0 occurrences outside this trigger. The reject and cancel branches at lines 68/80 of the predecessor migration use the correct values and remain intact. Every approved swap currently drops its notification silently.

**Steps:**
- [ ] 3.1 Read migration 20260504100006 to get the complete trigger body verbatim
- [ ] 3.2 Write new migration that `CREATE OR REPLACE FUNCTION` with the fixed branch condition — body otherwise identical
- [ ] 3.3 Add pgTAP test asserting that UPDATE on `engine_state` with context status transitioning `pending_manager → executed` inserts into `notification_outbox`
- [ ] 3.4 `npx supabase db reset` — verify migration applies cleanly
- [ ] 3.5 Run pgTAP test — expect PASS
- [ ] 3.6 Commit: `fix(notifications): notify_swap_result fires on executed status (matches state machine)`

---

## Task 4 — bug_007: `check_contract_intake_completion` / `decline_contract_intake` filter on non-existent `engine_state.status='running'`

**File:** NEW migration `supabase/migrations/20260417141000_fix_contract_intake_engine_state_filter.sql`

**Fix:** `CREATE OR REPLACE FUNCTION` for both RPCs with corrected status filter:

```sql
-- BEFORE (migration 20260505100000:84-89 and :157-162)
UPDATE public.engine_state
SET status = 'complete', updated_at = now()
WHERE entity_type = 'employment_contract'
  AND entity_id = v_contract.contract_id::text
  AND status = 'running';  -- <-- not in CHECK constraint

-- AFTER
UPDATE public.engine_state
SET status = 'complete', updated_at = now()
WHERE entity_type = 'employment_contract'
  AND entity_id = v_contract.contract_id::text
  AND status IN ('active', 'waiting');
```

**Why:** `engine_state.status` CHECK constraint allows `('pending','active','waiting','complete','failed','escalated','blocked')` only — migration `20260304100000:138` + `20260505110000:19`. `'running'` has never been valid. Both RPCs silently match 0 rows; domain row transitions but engine_state remains stuck `active`/`waiting` forever → observability shows run as live, wait-on-state downstream never fires.

**Steps:**
- [ ] 4.1 Read migration 20260505100000 to get both function bodies verbatim
- [ ] 4.2 Write new migration with both `CREATE OR REPLACE FUNCTION` calls, only status filter changed
- [ ] 4.3 Add pgTAP test: dispatch contract_intake engine_state, complete via check_contract_intake_completion, assert engine_state.status = 'complete' (not 'active')
- [ ] 4.4 `npx supabase db reset` — verify migration applies
- [ ] 4.5 Run pgTAP test — expect PASS
- [ ] 4.6 Commit: `fix(contract-intake): engine_state transition uses valid status filter (active,waiting)`

---

## Task 5 — bug_014: `ops-monitor` UTC vs workspace-local timezone

**File:** `supabase/functions/ops-monitor/index.ts`

**Fix:** thread `workspace.timezone` into every time comparison. Pattern precedent at `supabase/migrations/20260428130000_schedule_shift_temporal_lock.sql:26` (reads `workspace.timezone` with `'Europe/Oslo'` default).

Preferred approach: push comparisons into Postgres with `AT TIME ZONE workspace.timezone` so the timezone-aware logic lives in one authoritative place. Fallback: use `Intl.DateTimeFormat` on the Edge side.

Affected sites (5):
1. Line 85 — `today = now.toISOString().slice(0,10)` → use workspace-local calendar date
2. Line 97 — `new Date(\`${today}T${shift.start_time}\`)` → interpret as workspace-local
3. Line 197 — `hhmm = now.toISOString().slice(11,16)` → workspace-local HH:MM
4. Line 248 — same pattern for `planned_close` lookahead
5. Line 291 — same pattern for close-approach alerting

**Steps:**
- [ ] 5.1 Read current ops-monitor/index.ts in full to understand the 4 rule functions
- [ ] 5.2 Add workspace-timezone resolution at the top of each rule's query — join through `department_session → workspace` or via shift's department
- [ ] 5.3 Rewrite late-punch-in rule using SQL `AT TIME ZONE` (cleanest — compares `start_time` as local TIME against `now() AT TIME ZONE ws.timezone`)
- [ ] 5.4 Rewrite understaffing rule (line 196-207) with same pattern
- [ ] 5.5 Rewrite approaching-close rule (lines 247 + 290) with same pattern
- [ ] 5.6 Add a pgTAP-style integration test: seed a Europe/Oslo workspace, set `now()` fixture to 08:30 Oslo (06:30 UTC in summer), assert late-punch-in alert fires for a shift starting 08:00
- [ ] 5.7 Deploy to preview and smoke-test by triggering a late-punch scenario
- [ ] 5.8 Commit: `fix(ops-monitor): use workspace.timezone for all time comparisons (not UTC)`

---

## Close-out

- [ ] 6.1 `pnpm turbo typecheck lint` — 0 errors
- [ ] 6.2 `npx supabase db reset` — all migrations apply, pgTAP tests pass
- [ ] 6.3 Push `fix/ultrareview-correctness`
- [ ] 6.4 Open PR with summary linking to ultrareview task `rp6ofqyfv`
- [ ] 6.5 Preview-gate checklist on PR: each bug requires a specific smoke-test (dashboard late-punch alert, briefing shows correct day, swap notification delivered, contract intake engine_state transitions, engine-dispatch blocks on failed update)

---

## Self-Review

- **Spec coverage:** 5 verified correctness bugs from ultrareview `rp6ofqyfv`, one Task each. ✓
- **Placeholder scan:** Task 5 (ops-monitor) has "preferred / fallback" language — that's an implementation choice for the worker, not a placeholder. Preview-gated smoke tests are listed with concrete success criteria. ✓
- **Type consistency:** ISO day-of-week convention is named `Mon=0..Sun=6` throughout. `engine_state.status` values always listed from the documented CHECK constraint. ✓
- **Known plan-time gap:** pgTAP tests in Tasks 3/4 require Supabase Local running. If the worker's environment has Supabase Local down, document the skip and rely on preview-gated verification per close-out 6.5.
