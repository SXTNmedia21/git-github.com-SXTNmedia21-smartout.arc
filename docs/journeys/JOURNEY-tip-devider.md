---
title: JOURNEY — tip-devider (Sortie 1)
status: done
created: 2026-04-28
updated: 2026-04-29
module: payroll
tags: [journey, tips, sortie-1]
---

# JOURNEY — tip-devider

Sortie 1 is foundation-only. Schema + scaffolding + capability skeleton + telemetry registry. No user-facing flows yet — those land in Sortie 2 (web/leader) and Sortie 3 (mobile/employee).

## Journey: Capability tool invoked from stage-engine (skeleton state)

**Precondition:** Sortie 1 capability tools are skeletons. Any direct invocation must NOT emit `*_started` and must NOT mutate DB (per ADR-0196 phantom-emit prevention).

1. Caller (stage-engine, BFF route, or test) invokes `tips.set_pot` (or any of the 4 tools) via the capability registry
   → System resolves capability via `packages/ai/src/capabilities/registry.ts` → `tipsCapability`
   → Tool's Zod schema validates input
   → If invalid: returns Zod error
   → If valid: tool body runs `execute()` which immediately returns `{ ok: false, error: "not_implemented", note: "Skeleton — body lands in Sortie 2 tips-leader-flows" }`
2. **Postcondition:** Zero DB mutations. Zero telemetry emits. Caller sees `not_implemented` error.

**Why:** ADR-0196 Invariant 11 forbids `emit("*_started") + return ok:true + no write`. Skeleton MUST return `not_implemented` BEFORE emitting anything. Sortie 2 fills bodies AND adds `gate_action` + `emit()` in lock-step.

## Journey: Pure calculate() function called

**Precondition:** Caller has pool amount, shift list, policy.

1. Caller imports `calculate` from `@smartout/ai/capabilities/tips`
2. Calls `calculate(amountNok, shifts, policy)` with one of three policies (`equal | by_hours | by_role`)
3. Function runs synchronously, returns `Distribution[]` array
4. **Sum invariant:** `sum(distribution.calculated_amount) === amountNok` (rounding remainder allocated to highest-points employee)
5. **Postcondition:** Pure return value. No side effects. No DB.

**Verified:** 9 unit tests cover all three algorithms × edge cases (empty shifts, zero hours, single employee, rounding remainder, unknown role default weight).

## Journey: Admin views/queries tips_workspace_settings

**Precondition:** Workspace has no row yet in `tips_workspace_settings` (default opt-in).

1. Future hook (Sortie 2) reads `tips_workspace_settings` for the workspace
   → `maybeSingle()` returns `null` (no row)
   → Hook returns `enabled: false` (default)
2. **Postcondition:** Tips UI hidden. No surfaces render.

**Future-flow (Sortie 2 admin toggle):**
1. Admin navigates to settings page
2. Clicks toggle ON
3. Server Action UPSERTs row `(workspace_id, tips_enabled=true)`
4. Hook re-fetches → `enabled: true`
5. Tips UI surfaces become visible (in Sortie 2-3 wiring)

## Journey: Migration apply via db reset

**Precondition:** Clean DB, Docker running.

1. Run `npx supabase db reset`
2. Migrations apply in chronological order:
   - 20260428220000: 3 enums created (`tip_pool_status`, `tip_distribution_status`, `tip_algorithm`)
   - 20260428220001: `tip_policy` + RLS
   - 20260428220002: `tip_role_weight` + RLS
   - 20260428220003: `tip_pool` + RLS lifecycle locks
   - 20260428220004: `tip_distribution` + employee SELECT policy + UPDATE lock when pool approved
   - 20260428220005: `tip_adjustment_log` INSERT-only
   - 20260428220006: `tips_workspace_settings` opt-in
   - 20260428220007: `engine_authority_config` seed (CROSS JOIN VALUES, 4 capabilities × N workspaces)
3. **Postcondition:** 6 tables, 3 enums, RLS enabled all tables, authority rows for `tips.set_pot|adjust_share|approve_distribution|query_own_share` per workspace.

**Error path:** If `schedule_shift(schedule_shift_id)` FK in 220004 was wrong (`shift_id`), migration fails with "column shift_id does not exist". Fixed in commit `2731a57c`.

## Journey: Authority-seed-parity scanner check

**Precondition:** Tips code committed.

1. Run `pnpm tsx scripts/authority-seed-parity.ts`
2. Scanner walks `apps/` + `packages/` for `gate_action` literal capability strings
3. For each literal, looks up matching seed row in `engine_authority_config`
4. **Tips outcome:** All 4 tips capability literals in `seededCapabilities` array. Tips green.
5. Pre-existing fails (`contract` from employment-contracts, `x` from test fixture) — NOT tips' scope.

## Error paths

- **Migration FK error:** `schedule_shift(shift_id)` does not exist → fix to `schedule_shift_id` (seen, fixed)
- **Migration timestamp collision:** Two files with same timestamp violate `schema_migrations_pkey` → bump second file by +1 minute (seen, 3 pairs fixed)
- **Capability tool invoked before Sortie 2 wires bodies:** Returns `not_implemented` (intentional — guards against premature production deploy)
- **Workspace has no `tips_workspace_settings` row:** Hook returns `enabled: false` default (intentional opt-in)
- **gate_action RPC error:** `gate.ts` callGateAction returns `ok: false` (fail-CLOSED — never permits on RPC error)

## Verification

| Test | Outcome |
|---|---|
| `pnpm vitest run packages/ai/src/capabilities/tips/calculate.test.ts` | 9/9 PASS |
| Phantom-emit grep | 0 matches in tips/ |
| Authority-seed-parity (tips capabilities) | 4 in seededCapabilities |
| db reset (Tips migrations only) | 6 tables + 3 enums + 4 auth rows |
| typecheck (full repo, post-regen) | 0 errors except pre-existing mobile `channel_type.ai` (unrelated, db-state issue) |
