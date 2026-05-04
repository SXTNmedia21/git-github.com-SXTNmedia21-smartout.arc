---
title: "Audit Slice 4 — Schedule + Cascade Architecture"
status: complete
created: 2026-05-02
updated: 2026-05-02
module: schedule, cascade
tags: [audit, cascade, schedule, adr-compliance]
---

# Audit Slice 4: Schedule + Cascade Architecture

**Scope:** `apps/web/src/app/dashboard/schedule/`, `apps/web/src/lib/cascade/`, `packages/ai/src/industry/`, `apps/web/src/lib/season-calculations.ts`, `apps/web/src/components/day/WebDayControl.tsx`

**ADRs checked:** ADR-0032, ADR-0047, ADR-0091, ADR-0156, ADR-0204

---

## Summary — Top 5 Findings

1. **ADR-0204 compliance: SS-4 complete, SS-5 gap open.** `shift-lifecycle/gate.ts` delegates to `gatedMutation()` correctly via the composition orchestrator. However, the domain write (supabase insert/update) still occurs OUTSIDE the orchestrator's `execute` callback — `gate.ts:93` explicitly documents this as a sentinel no-op. The real write stays in `tools.ts` as a caller-side side-effect. SS-5 ("move domain write INTO the orchestrator") is documented but not landed. This means the `gate_evaluation` audit row and the domain write are not in the same transaction. **Not a blocker today** (ADR-0204 §Rollout describes SS-4/SS-5 phases), but is a live correctness gap.

2. **ADR-0091 TanStack write path bypasses cascade_gate_write.** All six `use-shifts.ts` mutations (`useCreateShift`, `useUpdateShift`, `useDeleteShift`, `useMoveShift`, `usePublishShifts`) write directly to `schedule_shift` via `supabase.from("schedule_shift").insert/update/delete()` with no `cascade_gate_write` RPC call. ADR-0047 explicitly grandfathered direct supabase-js writes for the dashboard TanStack path, and ADR-0156 grandfathers existing TanStack hooks per ADR-0157. However, ADR-0091 WP4 call-site migration is still pending for this surface. The `smartout/no-direct-supabase-write` ESLint rule was supposed to escalate to `error` post-WP3 but schedule hooks are evidently not yet in scope.

3. **useRoster department filter — fixed in code, still a memory trap.** Previous memory flagged `useRoster` filtering `.eq("department_id", ...)` directly on `schedule_shift`. Current code at `apps/web/src/app/dashboard/_hooks/use-roster.ts:55-66` has been corrected: uses `position!inner(department_id)` join, recovering shifts where `schedule_shift.department_id IS NULL`. The comment at line 51-54 acknowledges the prior bug explicitly. **Memory is stale on this specific file; bug is resolved.** However, the fix introduces a new gap: shifts with no `position_id` set are now excluded (the `!inner` join filters them). This is likely intentional (unpositioned shifts should not appear on a roster), but no ADR documents this interpretation.

4. **ADR-0156 implemented correctly — OversiktView replaced.** `apps/web/src/app/dashboard/page.tsx:71` routes `adminView === "oversikt"` to `<WebDayControl />` with `next/dynamic` lazy load (comment explicitly references ADR-0156 PR 4). `WebDayControl.tsx` imports `derivePhase` from `@smartout/utils` and applies it at line 115 with `reconQuery.data` for the `locked` phase derivation. Phase enum gap (5 DB states → 6 UI states) is resolved via helper as specified. Schedule page additionally uses `DayControlSheet` (local to schedule) for the day-panel in the week grid — this is a separate surface from `WebDayControl` (the dashboard root surface). Both coexist, no authority conflict.

5. **Riksavtalen rates in hospitality.ts are now labelled "Correct" — but the fallback chain still trusts them.** `hospitality.ts:16` declares `HOSPITALITY_TARIFF_RATES` as "Correct Riksavtalen tariff rates (2024 satser)". Memory flagged these as wrong; current code labels them correct. Loader fallback tier 3 returns this hardcoded package when DB is empty. Runtime tariff resolution (`resolveTariffRate.ts`) uses `tariff_rate_table` from DB (Tier 1/2), not the hardcoded values. The hardcoded values are only the bootstrap seed and fallback — they are not used at runtime if DB is seeded. **Risk:** if `tariff_rate_table` is not seeded for a workspace, the hardcoded fallback silently applies without any alert. No validation or warning is emitted when falling back to tier 3.

---

## Dimension Compliance Table

| Dimension | Tables | Code Surface | Verdict |
|-----------|--------|-------------|---------|
| D1 Envelope | `department`, `department_operating_hours`, `department_hours_override`, `planning_cycle` | `cascade/resolve-hours.ts`, `cascade/compute-anchored-shift.ts` | COMPLIANT — pure functions, no hardcoded hours |
| D2 Resource | `profile`, `employment_contract` | `schedule/_hooks/use-employees.ts` queries `profile` with workspace_id scoping | COMPLIANT |
| D3 Rules | `framework_rule`, `framework_trigger`, `tariff_rate_table` | `cascade/evaluate-framework-rules.ts` (pure), `cascade/resolve-tariff-rate.ts` (pure), `cascade/get-tariff-context.ts` | COMPLIANT — rules are declarative; no hardcoded jurisdiction logic in service code |
| D4 Demand | `season_budget`, `day_factor`, `hour_factor` | `season-calculations.ts` (pure math), `cascade/propagate-budget-targets.ts` | COMPLIANT — pure calculation, DB-sourced inputs |
| D5 Concept | workspace config, niche parameters | Not directly visible in audited surfaces — parameterizes coefficients in loader | COMPLIANT (no violations observed) |
| D6 Production | `department_session`, `session_hook`, `session_task`, `schedule_shift`, `deviation` | `WebDayControl.tsx`, `schedule/page.tsx`, `shift-lifecycle/tools.ts` | PARTIAL — D6 authority gate (ADR-0204 SS-5) not landed; domain writes outside orchestrator transaction |
| C1 Calibration | `daily_reconciliation`, `workspace_kpi_target` | `use-daily-reconciliation.ts` feeds `derivePhase()` | COMPLIANT |
| C2 Interaction | Agent voice bridge | `schedule-voice-tools-bridge.tsx`, `ScheduleVoiceToolsBridge` | COMPLIANT (read path; write path through shift-lifecycle capability) |
| C3 Commercial | `shift_cost_snapshot` | Not audited in this surface | NOT AUDITED |
| C4 Governance | `engine_authority_config`, `change_proposal` | `shift-lifecycle/gate.ts` → `gatedMutation()` → `cascade_gate_write` + `gate_action` | CONDITIONAL — authority gate fires; domain write outside orchestrator (SS-5 pending) |

---

## Per-ADR Rollup

| ADR | Title | Verdict | Evidence |
|-----|-------|---------|---------|
| ADR-0032 | Schedule local-state architecture (useReducer → TanStack) | COMPLIANT | No Zustand imports found in `schedule/`. `useShifts`, `useCreateShift` etc. are TanStack Query hooks. `ScheduleUIProvider` handles UI-only selection state with React Context (as specified). |
| ADR-0047 | Schedule DB persistence with TanStack Query | COMPLIANT | `use-shifts.ts` uses `useQuery`/`useMutation` with optimistic updates and `queryClient.invalidateQueries`. Direct supabase-js writes are per the ADR's chosen architecture. |
| ADR-0091 | Governance gate — Postgres RPC | GAP (call-site migration pending) | WP2 (function) shipped, WP3 (TS wrapper) shipped. WP4 (call-site migration) not applied to schedule TanStack hooks. Direct `.from("schedule_shift").insert/update/delete()` in `use-shifts.ts` is outside the gate. ADR-0047 + ADR-0156/ADR-0157 grandfather this; WP4 migration is still required. |
| ADR-0156 | WebDayControl as canonical D6 admin surface | COMPLIANT | `dashboard/page.tsx:71` routes `oversikt` → `<WebDayControl />`. `derivePhase()` used for 6-state phase derivation. KPI source labeling visible in OverviewTab. `DayControlSheet` in schedule page is a sibling surface, not a competing admin surface. |
| ADR-0204 | Gated mutation composition orchestrator | CONDITIONAL PASS | `shift-lifecycle/gate.ts` delegates to `gatedMutation()` (confirmed at line 73). SS-4 landed. SS-5 (domain write inside orchestrator `execute` callback, same transaction) is documented but not implemented. `gate.ts:93`: `execute: async () => ({ ok: true })` is a sentinel no-op. |

---

## Critical Violations + Cascade Boundary Breaches

### V1 — ADR-0204 SS-5 Transaction Gap (MEDIUM, not a blocker today)

**File:** `packages/ai/src/capabilities/shift-lifecycle/gate.ts:93`

The `gatedMutation()` `execute` callback is a sentinel no-op. The real domain write happens in `tools.ts` AFTER `callGateAction()` returns. The `gate_evaluation` row and the domain write are in separate database transactions. This violates the transactional atomicity requirement stated in ADR-0091 Decision Drivers: "the gate decision and the write it governs must live in the same transaction." ADR-0204 §Rollout explicitly defers this to SS-5, so the gap is documented and planned, but it is not resolved.

**Risk:** A gate that passes followed by a domain write failure leaves a stale `gate_evaluation` row with no matching domain write. Audit readers see "allowed" with no effect.

### V2 — ADR-0091 Call-Site Migration Not Applied to Schedule TanStack Path (LOW, grandfathered but flagged)

**Files:** `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts` (all 6 mutations)

Direct `supabase.from("schedule_shift").insert/update/delete()` calls are outside `cascade_gate_write`. Per ADR-0047 and ADR-0157, these are grandfathered. Per ADR-0091 WP4, migration is pending. The `smartout/no-direct-supabase-write` ESLint rule should flag these when escalated from `warn` → `error`.

**Action required:** Track in ADR-0091 WP4 scope. Confirm ESLint rule is not suppressed for schedule hooks.

### V3 — Tariff Fallback Tier 3 Silent (LOW, observability gap)

**File:** `packages/ai/src/industry/loader.ts:69-72`

When both K1b (workspace) and K1a (platform NULL workspace_id) tariff rows are missing, loader falls back to hardcoded values with no `emit()` call and no warning. A workspace with empty `tariff_rate_table` will silently use hardcoded rates. `hospitality.ts` labels these as "Correct (2024 satser)" but the comment in memory flagged them as wrong — the current code says correct, memory is likely stale, but the lack of observability when using the fallback remains a gap regardless of rate accuracy.

**Action required:** Add a `console.warn` or `emit()` call at tier 3 fallback to surface when hardcoded rates are applied.

### V4 — DayControlSheet vs WebDayControl Surface Split (INFO, not a violation)

The schedule page uses `DayControlSheet` (local barrel at `schedule/_components/day-control/`) while the dashboard root uses `WebDayControl` from `components/day/`. These appear to be separate UX surfaces (week-grid day panel vs full D6 oversight surface). ADR-0156 mandates WebDayControl as canonical D6 admin surface. Confirm that `DayControlSheet` does not duplicate any D6 admin logic that should live exclusively in `WebDayControl` — this was not verified in this audit.

---

## Cascade Boundary Check

No cascade boundary breaches found. The cascade lib (`apps/web/src/lib/cascade/`) is pure functions only — no DB access, no side effects. Domain writes flow through TanStack mutations (direct supabase) for the web path, and through `callGateAction()` + caller-side insert for the capability/agent path. The Event Engine consumes cascade outcomes rather than hosting cascade pipeline logic — no violations observed. The `season-calculations.ts` is pure math with no DB coupling.
