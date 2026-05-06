---
title: "ADR/Contract Audit — Slice 04: Schedule-Cascade"
status: done
updated: 2026-05-06
created: 2026-05-06
module: cascade
tags: [audit, schedule, cascade, adr-0032, adr-0047, adr-0091, adr-0156, adr-0204]
---

# Slice 04 — Schedule-Cascade Audit

**Date:** 2026-05-06
**Auditor:** system-steward
**Surfaces covered:**
- `apps/web/src/app/dashboard/schedule/`
- `apps/web/src/lib/cascade/`
- `packages/ai/src/industry/`
- `apps/web/src/components/day/WebDayControl.tsx`

**ADRs checked:** 0032, 0047, 0091, 0156, 0204
**Anchor:** `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`

---

## Findings

### FINDING-S04-01 — HIGH — ADR-0204 §3 Merge-Blocker: Inline `gate_action` RPC in `_shared.ts`

**File:** `apps/web/src/app/dashboard/_actions/_shared.ts:101`

```ts
const { data, error } = await admin.rpc("gate_action", {
  p_workspace_id: args.workspaceId,
  ...
});
```

ADR-0204 §3 mandates that the only legal call sites for inline `supabase.rpc("gate_action", ...)` are `packages/ai/src/gate/gatedMutation.ts` (the orchestrator) and `packages/supabase/src/gate-client.ts` (the thin delegation wrapper). All other call sites are merge blockers.

`_shared.ts` is imported by every Server Action in `apps/web/src/app/dashboard/_actions/`, including `transition-session-action.ts`, which drives the `WebDayControl` session lifecycle. The `gateAction()` helper calls `gate_action` directly via the admin client, bypassing the ADR-0204 composition orchestrator and its correlated `gate_evaluation` audit chain.

**Impact:** Session transition mutations (active/pending_signoff/closed/missed) cross only one gate (Pathway A authority, no Pathway B cascade data-rule), with no correlated `gate_evaluation` pair and no `correlation_id`. The merge-blocker CI grep for this pattern (`scripts/ci/no-inline-gate-rpc.sh`) is NOT wired into `.github/workflows/ci.yml` — only the `check-gate-action-singleton.ts` invariant (Invariant I6) runs, which checks for direct `.from("engine_authority_config")` reads, not for inline RPC calls. The violation is invisible to CI.

Additionally, two Route Handlers are also affected:
- `apps/web/src/app/api/observer-requests/route.ts:93`
- `apps/web/src/app/api/observer-requests/[id]/route.ts:107`
- `apps/web/src/app/api/employment-contracts/bulk/route.ts:133`

These are outside the strict scope of this slice but confirm the same pattern exists beyond schedule-cascade.

**Delta vs 2026-05-02:** Not previously flagged. New finding.

---

### FINDING-S04-02 — HIGH — ADR-0204 SS-5 Atomicity Gap Persists (Baseline Confirmed Open)

**File:** `packages/ai/src/capabilities/shift-lifecycle/gate.ts`

The baseline reported that `gate.ts:93` `execute` is a sentinel no-op. Code confirmed at lines 91–93:

```ts
// Shadow-style no-op execute. Legacy callers perform their own
// domain write AFTER callGateAction() returns — this wrapper only
// owns the authority decision. SS-5 eliminates this seam.
execute: async () => ({ ok: true as const }),
```

The sentinel pattern means the domain write (`supabase.from("schedule_shift").update(...)` in `tools.ts`) occurs AFTER `callGateAction()` returns, outside any orchestrator transaction. The gate decision and the domain write are NOT in the same database transaction. This is the core SS-5 atomicity gap documented in ADR-0204 §Rollout.

**Impact:** A gate that returns "allowed" at time T1 can be followed by a domain write at time T2 against a state that has changed in the interval. For `publish_shift` and `approve_shift`, this means: gate may say "allowed" but the shift's status, workspace, or framework may have changed before the write lands. This is a correctness bug when concurrent mutations race.

**Delta vs 2026-05-02:** Status unchanged — SS-5 not yet shipped. SS-4 shipped (default flag flipped ON); SS-5 is the next sub-sortie.

---

### FINDING-S04-03 — MEDIUM — Tier-3 Tariff Fallback Has No Observability Signal

**Files:**
- `packages/ai/src/industry/loader.ts:69–79`
- `apps/web/src/lib/cascade/resolve-tariff-rate.ts:124–128`

The loader's tier-3 fallback (hardcoded `hospitalityPackage` constants used when both workspace K1b and platform K1a rates are absent from DB) fires silently:

```ts
// Tier 3: no DB data available — return hardcoded package as-is
if (rates.length === 0) {
  return base;
}
```

No `emit()`, no `console.warn`, no logging call. A workspace running on hardcoded tier-3 rates produces no observable signal. The catch block (line 76: `catch { return base; }`) similarly swallows DB errors without observability.

`resolve-tariff-rate.ts` returns a `sourceTier` field (line 127: `"workspace" | "platform"`) — but there is no `"hardcoded"` tier-3 value and callers are not required to observe or emit on the tier-3 path.

**Delta vs 2026-05-02:** Baseline flagged "tariff rate observability gap — no warn/emit when tier-3 fallback fires." Status unchanged — still open.

---

### FINDING-S04-04 — MEDIUM — ADR-0156 Phase 1 Portability Violation: `next/navigation` in `OverviewTab.tsx`

**File:** `apps/web/src/components/day/tabs/OverviewTab.tsx:7`

```ts
import { useRouter } from "next/navigation";
```

ADR-0156 §Decision Outcome "Widget placement" Phase 1 rule: widgets at `apps/web/src/components/day/` must enforce portability discipline — **no `next/image`, no `next/link`, no Next-specific hooks**. This discipline is the precondition for Phase 2 extraction to `packages/ui/day-control/` when mobile lands.

`useRouter` from `next/navigation` is a Next.js-specific hook unavailable in React Native. `OverviewTab` using it is a Phase 2 extraction blocker.

**Delta vs 2026-05-02:** Not previously flagged. New finding.

---

### FINDING-S04-05 — LOW — ADR-0204 §3 CI Enforcement Not Wired

**File:** `.github/workflows/ci.yml`

ADR-0204 §3 specifies a CI grep script `scripts/ci/no-inline-gate-rpc.sh` that fails the build if any `.ts/.tsx` file outside the two allowed call sites contains a direct `supabase.rpc('gate_action', ...)` or `supabase.rpc('cascade_gate_write', ...)`. This script does not exist on disk and is not referenced in any CI workflow. The `invariants:gate-singleton` step (line 220 of `ci.yml`) checks `engine_authority_config` direct reads only — it does not catch inline RPC calls.

As a result, `_shared.ts:101` (FINDING-S04-01) and the two Route Handlers pass CI green despite ADR-0204 merge-blocker status.

**Delta vs 2026-05-02:** Not previously flagged. New finding.

---

## False Positive Resolution

**FP-002 (HOSPITALITY_TARIFF_RATES labeling):** Confirmed out-of-scope per brief. `hospitality.ts` label comment (`/** Correct Riksavtalen tariff rates (2024 satser) */`) is accurate as a bootstrap-seed label; numeric verification not performed.

**FP-003 (`useRoster` department filter NULL):** Verified as resolved. `use-roster.ts` is not present in the `_hooks/` directory listing; the prior violation referenced a hook that no longer handles `schedule_shift` filtering directly. The `position!inner` join fix is in effect.

---

## Verified as Conforming

- **ADR-0032 / ADR-0047:** Schedule module TanStack Query hooks (`use-shifts.ts`, etc.) exist as intended. The migration from `useReducer` local state is complete; hooks use `supabase-js` direct calls per ADR-0047 architecture. No persistence via old Context pattern found.
- **ADR-0091 (Pathway B, WP2):** `cascade_gate_write` RPC is called correctly from `gatedMutation.ts` (the orchestrator). The SQL function exists per migration `20260512100000_cascade_gate_write.sql`. `assert_gate_caller()` is called as the RPC's first statement per ADR-0091 role check contract.
- **ADR-0156 D6 production verbs only:** `WebDayControl` mounts on `department_session` data (D6). No authoring widgets (schedule drag-drop, season editing, year-wheel) are present. `derivePhase()` from `@smartout/utils` is used correctly — no stored UI-only state.
- **ADR-0156 broadcast persistence:** `SessionActionsBar.tsx` routes session transitions through `transitionSessionAction` (Server Action) per ADR-0114. Broadcast is wired via existing `komm` channel pattern per ADR-0156 §Decision Outcome.
- **Cascade lib dimension boundaries:** `evaluate-framework-rules.ts` and `resolve-tariff-rate.ts` are pure functions operating on pre-loaded inputs — no cross-dimension DB queries, no D2 data in D3 evaluation context.
- **`evaluateFrameworkRules` D3 resolution:** Six rule types implemented (`daily_hours`, `weekly_hours`, `gap_between_shifts`, `night_work_age`, `daily_hours_age`, `overtime_agreement`, `sunday_holiday_shift`). Override resolution calls `resolveOutcome()` which respects `rule.outcomeOverridable` before applying workspace override — declarative, not hardcoded.
- **Industry package tier resolution:** Loader correctly resolves workspace K1b → platform K1a → hardcoded tier-3 fallback chain. The `resolveTariffRate` function correctly uses `Intl.DateTimeFormat` for workspace-local time (ADR-0262 compliance — UTC bug fixed).
- **`shift-lifecycle/gate.ts` SS-4 delegation:** Confirmed delegating to `gatedMutation()` orchestrator, not calling `supabase.rpc("gate_action", ...)` directly. SS-4 is complete.
- **`shift-lifecycle/tools.ts` emit coverage:** All four tools (`publish_shift`, `approve_shift`, `interpret_shift`, `settle_shift`) call `emit()` — both on allow and deny paths. The dual-emit pattern in `publish_shift` (one `shift_lifecycle published` + one `shift published`) is intentional per ADR-0100 Phase 4 comment.
- **Channel guards (ADR-0078):** `publish_shift` blocks `voice` channel. `approve_shift` blocks all non-`chat` channels. `interpret_shift` and `settle_shift` are `system` only. All enforced at the tool entry point before any gate or DB call.

---

## Delta Summary vs 2026-05-02 Baseline

| Baseline Item | Status |
|---|---|
| ADR-0204 SS-5 transactional atomicity gap (`gate.ts:93` sentinel no-op) | OPEN — SS-5 not shipped |
| Tariff rate observability gap (no warn/emit on tier-3 fallback) | OPEN — unchanged |
| ADR-0091 violation: `shift-lifecycle/tools.ts` direct write outside Server Action | RESOLVED — gate.ts now delegates to `gatedMutation()`; tools.ts calls `callGateAction()` which wraps the orchestrator |

**New findings this run (3):**
- FINDING-S04-01 (HIGH): `_shared.ts:101` inline `gate_action` RPC — ADR-0204 §3 merge-blocker not caught by CI
- FINDING-S04-04 (MEDIUM): `OverviewTab.tsx:7` `next/navigation` portability violation — ADR-0156 Phase 2 extraction blocker
- FINDING-S04-05 (LOW): `no-inline-gate-rpc.sh` CI script not implemented — ADR-0204 §3 enforcement gap

---

## Summary Table

| ID | Severity | File | ADR | Description |
|---|---|---|---|---|
| S04-01 | HIGH | `apps/web/src/app/dashboard/_actions/_shared.ts:101` | 0204 | Inline `gate_action` RPC outside orchestrator — merge blocker, CI blind |
| S04-02 | HIGH | `packages/ai/src/capabilities/shift-lifecycle/gate.ts` | 0204 | SS-5 atomicity gap: sentinel execute, gate and domain write not transactional |
| S04-03 | MEDIUM | `packages/ai/src/industry/loader.ts:69–79` | cascade spec | Tier-3 tariff fallback silent — no emit/warn on fallback or catch |
| S04-04 | MEDIUM | `apps/web/src/components/day/tabs/OverviewTab.tsx:7` | 0156 | `next/navigation` import violates Phase 1 portability discipline |
| S04-05 | LOW | `.github/workflows/ci.yml` | 0204 | `no-inline-gate-rpc.sh` not implemented — ADR-0204 §3 not enforced in CI |
