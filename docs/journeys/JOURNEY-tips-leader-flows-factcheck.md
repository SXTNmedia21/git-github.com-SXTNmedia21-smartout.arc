---
title: "Phase 0 fact-check — tips-leader-flows vs Sortie 1 schema"
feature: tips-leader-flows
status: review
verified_at: null
created: 2026-04-29
updated: 2026-04-29
module: payroll
tags: [factcheck, schema, tips, payroll]
---

# Phase 0 fact-check — Sortie 2 vs Sortie 1 reality

Verify journey docs + plan against actual migrations + telemetry registry + capability skeletons that landed in Sortie 1. Update journeys before Phase 1 starts.

## Method

1. Read all 8 tips migrations (`20260428220000–220007`).
2. Read `packages/ai/src/capabilities/tips/{tools.ts,gate.ts,calculate.ts}`.
3. Read `packages/telemetry/src/registry.ts` tip-section.
4. Compare to JOURNEY-tips-leader-flows-* + PLAN-tips-leader-flows.md.
5. Identify deltas. Update journey docs. Lock plan to real schema.

## Confirmed (matches plan)

- `tip_pool.id UUID PK` + `workspace_id` + `department_session_id UNIQUE` (kveldsgrense, not kalenderdag).
- `tip_distribution(pool_id, profile_id) UNIQUE` per pool.
- `tip_adjustment_log` is INSERT-only audit (no UPDATE/DELETE policy).
- `tip_distribution.shift_id → schedule_shift(schedule_shift_id)`.
- RLS dual JWT + API-key + service-role on all 5 tables, gated via `get_workspace_ids_for_user(auth.uid())`.
- 4 capability rows seeded via CROSS JOIN VALUES (matches `scripts/authority-seed-parity.ts`).
- `engine_authority_config.capability` is TEXT with CHECK (NOT enum); `level` is TEXT.
- `tips.set_pot=suggest/manager`, `tips.adjust_share=confirm/manager`, `tips.approve_distribution=confirm/manager`, `tips.query_own_share=read_only/employee`.
- All capabilities chat-only (ADR-0078) — set in `packages/ai/src/capabilities/tips/index.ts`.
- 4 telemetry events registered: `tip_pool created`, `tip_distribution calculated`, `tip_distribution adjusted`, `tip_pool approved` (space form, NOT dot form).
- `callTipsGate` fail-CLOSED on RPC error (`gate.ts:73`), marker `@authority-gate-ungated` on the wrapper definition.
- Skeletons return `{ok:false, error:"not_implemented"}` — no `run_started` emit (ADR-0196 invariant 11).

## Deltas — journey docs MUST be corrected

### Delta 1 — `tip_pool.status` enum values

**Journey docs claim:** `draft → calculated → approved → paid`.
**Reality:** `recorded → approved → paid → voided` (`20260428220000_tips_enums.sql:9-14`).

- No `draft` status. INSERT goes straight to `recorded`.
- No `calculated` status on pool. Calculation = inserting `tip_distribution` rows in same transaction; pool stays `recorded` until approval.
- `voided` exists for "leader confirmed no tips that evening" — not in journeys yet, defer to later sortie.

### Delta 2 — `tip_distribution.status` enum

**Reality:** `calculated → approved → paid` (`20260428220000_tips_enums.sql:16-20`).

- Adjustment does NOT change `status` — it updates `adjusted_amount` + `adjustment_reason` while status stays `calculated`.
- `approved` set via UPDATE-cascade when parent pool transitions to `approved`.
- `paid` set by future payroll-campaign only.

### Delta 3 — money columns

**Journey docs claim:** `amount_ore` (integer øre).
**Reality:** `amount_nok NUMERIC(10,2)` on tip_pool, `calculated_amount`/`adjusted_amount NUMERIC(10,2)` on tip_distribution, `old_amount`/`new_amount NUMERIC(10,2)` on tip_adjustment_log (`20260428220003:14`, `20260428220004:19-20`, `20260428220005:15-16`).

Plan + journeys must use NOK 2dp (matches spec + telemetry payloads `amount_nok: number`).

### Delta 4 — actor columns

**Journey docs claim:** `actor_id`, `created_by`.
**Reality:**
- `tip_pool.recorded_by + recorded_at` (set on INSERT) and `approved_by + approved_at` (set on approval) (`20260428220003:17-20`).
- `tip_distribution` has no actor column directly — provenance is via `tip_adjustment_log.changed_by`.
- `tip_adjustment_log.changed_by + changed_at` (`20260428220005:13-14`).
- `tip_policy.created_by` (admin who authored).

### Delta 5 — `tip_pool.policy_id` REQUIRED at INSERT

**Reality:** `policy_id UUID NOT NULL REFERENCES tip_policy(id)` (`20260428220003:13`).

`tips.set_pot` MUST resolve the active `tip_policy` for `department_id` (derived from `department_session.department_id`) at the pool's date. If no active policy exists, set_pot returns `{ok:false, error:'no_active_policy'}`. Admin must create a policy first via separate UI (out-of-scope for Sortie 2 — assume policy exists).

### Delta 6 — algorithm lives on policy, not pool

**Journey docs claim:** "leder velger algoritme i modal".
**Reality:** Algorithm is `tip_policy.method` (`20260428220001:14`). Pool inherits via `policy_id`.

Modal in OkonomiTab does NOT pick algorithm. It only takes `amount_nok` (+ optional `notes`). Algorithm is shown as read-only badge ("by_hours"). Changing algorithm = creating new policy version (separate flow, defer).

### Delta 7 — `tip_pool` UPDATE-policy is on status, not pool_lifecycle

**Reality:** RLS UPDATE allows when `status != 'approved'` (`20260428220003:50-53`). Same for `tip_distribution` UPDATE: `pool_id IN (SELECT id FROM tip_pool WHERE status != 'approved')` (`20260428220004:60`).

`pool_locked` error in adjust-share journey is correct, but trigger condition is `pool.status='approved'` (not "approved or beyond" — `paid`/`voided` also block UPDATE).

### Delta 8 — adjustment writes BOTH distribution + log

**Reality:**
- UPDATE `tip_distribution.adjusted_amount + adjustment_reason` (NUMERIC, TEXT min 5 chars per CHECK on adjustment_reason `20260428220004:21`).
- INSERT `tip_adjustment_log (distribution_id, changed_by, old_amount, new_amount, reason)`.

Both happen in same transaction. Telemetry event `tip_distribution adjusted` is emitted ONCE after both DB writes succeed.

Reason length constraint = **min 5 chars** (DB CHECK `length(reason) >= 5`), not min 10 as journey claimed.

### Delta 9 — telemetry naming + payloads

**Reality (registry.ts:5734–5805):** events use SPACE form, NOT dot form.
- `tip_pool created` (4 destinations: posthog + logger + activity_trail + engine_event)
- `tip_distribution calculated` (2 destinations: logger + engine_event — high-volume, no posthog)
- `tip_distribution adjusted` (4 destinations)
- `tip_pool approved` (4 destinations)

Payloads:
- `tip_pool created`: `{pool_id, department_session_id, amount_nok, distribution_count, algorithm}`
- `tip_distribution calculated`: `{pool_id, distribution_id, profile_id, calculated_amount, weight_applied}`
- `tip_distribution adjusted`: `{distribution_id, pool_id, profile_id, old_amount, new_amount, reason}`
- `tip_pool approved`: `{pool_id, department_session_id, total_distributed, distribution_count, adjustment_count}`

Plan task list MUST reference these payload field names verbatim.

### Delta 10 — set_pot emits TWO event types

**Implication:** Within `tips.set_pot.execute()`:
1. `INSERT tip_pool (status='recorded')` → emit `tip_pool created`.
2. Loop `INSERT tip_distribution` for each shift's calculated row → emit one `tip_distribution calculated` per row.

Both must complete before any emit (ADR-0196 invariant 11). Plan currently lists only `tip_pool created`. Update to include both.

### Delta 11 — four-eyes placeholder

**Journey docs claim:** "if requires_four_eyes: returnerer error".
**Reality:** `gate.ts` returns `requiresFourEyes: boolean` + `approversNeeded: number` from RPC. Tools must check `result.requiresFourEyes && result.approversPresent.length < result.approversNeeded` and return `{ok:false, error:'four_eyes_required', approversNeeded}` to UI.

Authority seed sets `requires_four_eyes: false` for all 4 tips capabilities — so this branch is reachable only if admin updates the row post-deploy. Sortie 2 implements the check + returns the error (no second-leader UI flow yet — that's Sortie 4 hardening).

### Delta 12 — adjustment_reason CHECK constraint

**Reality:** `tip_distribution.adjustment_reason CHECK (adjustment_reason IS NULL OR length(adjustment_reason) >= 5)` AND `tip_adjustment_log.reason CHECK (length(reason) >= 5)` (`20260428220004:21`, `20260428220005:17`).

Capability schema (`tools.ts:67`) already enforces `z.string().min(5)`. Journey doc said "min 10 tegn" — wrong. Lock to **min 5 chars** end-to-end.

## Phase 1 (BFF) prerequisites surfaced by fact-check

Before BFF routes can be written:

1. **`tips.set_pot` body** must call `default_active_policy_for_department(department_id, on_date)` OR raw SELECT against `tip_policy WHERE department_id=? AND active_from <= on_date AND (active_to IS NULL OR active_to >= on_date) ORDER BY active_from DESC LIMIT 1`. Verify helper exists or write inline.
2. **`department_session.department_id`** must be derivable — verify `department_session` table schema before set_pot writes the join.
3. **`schedule_shift` query** for distribution: must filter by `department_session_id` to find shifts that worked the session. Verify `schedule_shift.department_session_id` exists (or alternative join path: `schedule_shift.department_id` + date overlap).
4. **`tip_pool.algorithm_version_at_approval`** is set ONLY at approval time (TEXT, opaque). Set to e.g. `policy.method` snapshot at that moment.

## Action items

- [ ] Update `JOURNEY-tips-leader-flows-leder-setter-pot.md` — pool.status `recorded` not `draft`, `amount_nok` not `amount_ore`, no algorithm picker (read-only from policy), `policy_id` required, two-event emit
- [ ] Update `JOURNEY-tips-leader-flows-leder-justerer-andel.md` — distribution stays `status=calculated` post-adjust, separate `adjusted_amount`/`adjustment_reason` columns, INSERT log row in same tx, reason min 5 chars (not 10), four-eyes returns error code
- [ ] Update `JOURNEY-tips-leader-flows-leder-godkjenner-distribusjon.md` — pool transitions `recorded → approved` (no `calculated` intermediate), `algorithm_version_at_approval` set, no separate "Beregn distribusjon" step (calculation happened at set_pot)
- [ ] Update `PLAN-tips-leader-flows.md` — Phase 2 task list with correct event names + payload fields
- [ ] Verify `department_session.department_id` + `schedule_shift.department_session_id` exist (or document alternative join)

## Verification (post-update)

- [ ] All 3 journey docs grep-clean for `draft`, `calculated.*pool`, `amount_ore`, `actor_id` (in tip context), "10 tegn"
- [ ] Plan references the 4 telemetry event names verbatim
- [ ] Phase 1 task list maps each tool body to its full event set + DB writes
