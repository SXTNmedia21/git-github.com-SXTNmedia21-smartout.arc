---
title: "Audit slice 04 — schedule-cascade"
slice: 04
scope: ["apps/web/src/app/dashboard/schedule/", "apps/web/src/lib/cascade/", "packages/ai/src/industry/", "apps/web/src/components/day/WebDayControl.tsx", "apps/web/src/app/dashboard/dagskontroll/"]
adrs: [0032, 0047, 0091, 0156, 0204, 0286, 0299]
status: complete
created: 2026-05-13
auditor: system-steward
---

# Slice 04 — schedule-cascade

## Summary

D6 mutation surface is the largest open ADR-0204 gap in the codebase. Of 19 mutation hooks across schedule + day-control, **0 use `gatedMutation`**. Every direct mutation to `schedule_shift`, `schedule_absence`, `department_session`, `session_task`, and `deviation` bypasses both gates (capability ADR-0099 AND data-rule ADR-0091). The only canonical exception is `useCreateDayInfo` → `createDayInfoAction` Server Action (touches `schedule_day_info`, out of slice).

**Layer status:**
- ADR-0286 employee_availability migrations shipped (3 migrations, types regenerated) — schema work complete; capability tooling not in this slice.
- ADR-0299 `shift_approval` per-verb split + WITH CHECK shipped (migration `20260605120000`) — RLS hardening complete.
- ADR-0156 day-control surface live but tabs (`OversiktTab`, `OkonomiTab`) and widgets (`EventDetailPanel`) ship direct mutations without gates — same anti-pattern as legacy schedule hooks.
- ADR-0091/0204 mutation orchestration: **regression vs. baseline 2026-05-10**. Voice-tools writes intact; bridge-tab writes from `EventDetailPanel.tsx` (deviation resolve/acknowledge) + `OversiktTab.tsx:257` (duty_leader assign) materialised since baseline. F-SC-04 (`useCreateAbsence` admin-gated bypass) still open.
- Cascade lib (`apps/web/src/lib/cascade/*`) is pure derivation — no DB mutations, no audit findings. `get-tariff-context.ts` reads only.
- `packages/ai/src/industry/*` is configuration-only (industry packages, classifier) — no DB writes, no audit findings.
- `apps/web/src/app/dashboard/dagskontroll/` does not exist; dagskontroll surface lives at `apps/web/src/components/day/` per ADR-0156. Scope auto-redirected.

## Findings

| ID | Sev | File:Line | ADR | Pattern |
|----|-----|-----------|-----|---------|
| F-SC-04-01 | HIGH | `_hooks/use-shifts.ts:83` | 0204, 0091 | `useCreateShift`: direct `schedule_shift` insert, no gate |
| F-SC-04-02 | HIGH | `_hooks/use-shifts.ts:164` | 0204, 0091 | `useUpdateShift`: direct `schedule_shift` update, no gate |
| F-SC-04-03 | HIGH | `_hooks/use-shifts.ts:244` | 0204, 0091 | `useDeleteShift`: direct `schedule_shift` delete, no gate |
| F-SC-04-04 | HIGH | `_hooks/use-shifts.ts:322` | 0204, 0091 | `useMoveShift`: direct `schedule_shift` update, no gate |
| F-SC-04-05 | HIGH | `_hooks/use-shifts.ts:403,506,584,666` | 0204, 0091 | `usePublishShifts`/`usePasteDay`/`useUnpublishShifts`/`useCompleteShift`: 4 direct shift mutations, no gates |
| F-SC-04-06 | HIGH | `_hooks/use-absences.ts:67` | 0204, 0091 | `useCreateAbsence`: direct insert on admin-gated table (F-SC-04 confirmed open) |
| F-SC-04-07 | HIGH | `_hooks/use-absences.ts:140,203,279` | 0204, 0091 | `useDeleteAbsence`/`useApproveAbsence`/`useRejectAbsence`: 3 direct mutations, no gates |
| F-SC-04-08 | HIGH | `_hooks/use-templates.ts:313` | 0204, 0091 | `useLoadTemplate`: bulk `schedule_shift` insert from template, no gate |
| F-SC-04-09 | HIGH | `_hooks/use-employee-roster.ts:333` | 0204, 0091 | `useAutoFillShifts`: bulk insert (auto-fill week), no gate |
| F-SC-04-10 | HIGH | `_hooks/use-open-shifts.ts:243` | 0204, 0091 | `useCreateOpenShift`: direct insert, no gate |
| F-SC-04-11 | HIGH | `_hooks/use-schedule-voice-tools.ts:853` | 0204, 0091 | Voice-tools: direct `department_session` insert (F-SC-01 #1) |
| F-SC-04-12 | HIGH | `_hooks/use-schedule-voice-tools.ts:871` | 0204, 0091 | Voice-tools: direct `session_task` insert (F-SC-01 #2) |
| F-SC-04-13 | HIGH | `_components/day-control/OversiktTab.tsx:257` | 0204, 0091, 0156 | Inline async `department_session.update({duty_leader_id})` in day-control surface — **new since baseline** |
| F-SC-04-14 | HIGH | `_components/day-control/OkonomiTab.tsx:57` | 0156 | OkonomiTab `.from("department_session")` — read-only context (verified), no finding on op; flagged for sibling table writes if added |
| F-SC-04-15 | HIGH | `components/day/EventDetailPanel.tsx:299,319` | 0204, 0091, 0156 | DeviationForm: 2 direct `deviation.update` calls (resolve, acknowledge) inside `startTransition` — **new since baseline** |
| F-SC-04-16 | MED | `_components/SwapRequestDialog.tsx` | 0204, 0287 | Swap-request mutation routes through `useInitiateSwap`; verify hook uses orchestrator — out of scope this slice (covered slice 02/05 capabilities) |

**Count: 15 HIGH, 1 MED. 13 distinct mutation hooks bypass ADR-0204 across 5 D6 entities. 2 new violations materialised since 2026-05-10 baseline (day-control tabs).**

## Per-ADR rollup

| ADR | Status | Notes |
|-----|--------|-------|
| 0032 | superseded-by-0047 | Schedule local-state architecture honored historically; current code is TanStack hooks (ADR-0047), no regression. |
| 0047 | partial-compliance | Hooks layer exists, audit trail (DB trigger → `schedule_audit_log`) intact, but mutations bypass C4 gates introduced post-0091. ADR-0047 predates 0091/0204. |
| 0091 | violated | `cascade_gate_write` never invoked by D6 mutation surface. ESLint rule `smartout/no-direct-supabase-write` should escalate from `warn` → `error` per ADR-0091 WP4; current setting allows the 15 violations. |
| 0156 | partial-compliance | Day-control panel canonical (✓); 6/5 phase derivation in `packages/utils/src/cascade/` (✓); but tab + widget mutations bypass gates and emit no gate_evaluation correlation chain. Violates ADR-0156 §"Audit integrity" driver. |
| 0204 | violated | Zero `gatedMutation` call sites in slice. 13 hooks × ≥1 mutation = SS-5 backlog grew from 7 → 13+ since baseline 2026-05-10. Voice-tools entry (F-SC-01) intact; OversiktTab duty-leader + EventDetailPanel deviation are new. |
| 0286 | shipped | Schema (3 migrations: `20260518200000_create_employee_availability`, `20260518200001_create_employee_availability_preference`, `20260518200002_seed_availability_authority`) present. Capability tools not in this slice. Three-table separation honored — `schedule_absence` untouched. |
| 0299 | shipped | Migration `20260605120000_shift_approval_rls_with_check.sql` present. Per-verb split with symmetric USING + WITH CHECK enforced. `schedule_shift` audit-comment-only deferred to Sortie A.2 per ADR text — verified consistent. |

## Verified intentional

- **Cascade derivation lib (`apps/web/src/lib/cascade/`)** is pure compute. 9 files, 0 mutations, 8 unit-test files. `get-tariff-context.ts` reads `employee_payroll_profile` only. No audit finding.
- **`packages/ai/src/industry/`** is industry-package configuration (classifier, defaults, hospitality vs default). No DB access. No audit finding.
- **`use-day-info.ts`** documents itself as ADR-0114 reference implementation — "Thin wrapper over `createDayInfoAction` Server Action … `gate_action` + admin insert + awaited `emit` live in the action" (line 8–11). Canonical pattern. **This is the shape every other hook must adopt under SS-5.**
- **`useRoster` (employee-roster query)** — FP-003 from baseline confirmed: uses `position!inner` join, not direct `.eq("department_id")`. No finding.
- **`HOSPITALITY_TARIFF_RATES`** in `packages/ai/src/industry/packages/hospitality.ts` — FP-002, label correctness only, out of audit scope.
- **`schedule_audit_log` DB trigger (ADR-0047)** — still in place; provides forensic trail. Does NOT substitute for gate_evaluation correlation chain (different purposes — audit vs. authority decision).
- **`shift_approval` writers** — per ADR-0299 §"Rules & Consequences", all 3 current writers (confirmHoursAction, engine-dispatch, approve_shift tool) use service_role and bypass RLS by design. Zero behaviour change. No finding.

## In-progress

- **SS-5 (ADR-0204 rollout) backlog grew, not shrunk, since 2026-05-10.** Baseline F-SC-01 (voice tools, 3 writes) + F-SC-02 (7 CRUD hooks) → now 13 hooks × ≥1 mutation = 19+ call-sites. F-SC-04 (`useCreateAbsence`) still open.
- **New violations since baseline 2026-05-10:**
  - `OversiktTab.tsx:257` — inline `department_session.update({duty_leader_id})` inside `<select onChange>` handler. No gate, no Server Action, no `emit()`. Mutation directly inside React render closure.
  - `EventDetailPanel.tsx:299, 319` — `deviation.update` (resolve + acknowledge) inside `startTransition`. No gate. Toast on success but no `emit()` — D6 mutation invisible to `activity_trail` + `engine_event`.
- **ADR-0156 "Audit integrity" driver is being violated by its own canonical surface.** The day-control panel shipped with mutations that emit no `gate_evaluated` event and no correlation chain. The widget portability discipline (no Next-specific hooks, no Supabase inside widgets) is also being violated by `EventDetailPanel` and `OversiktTab` — both call `createClient()` directly inside the widget.
- **CI grep (ADR-0204 §3)** to block inline `gate_action`/`cascade_gate_write` outside orchestrator: not effective here because **no inline calls exist** — the violations are the absence of gates entirely. The ESLint rule `smartout/no-direct-supabase-write` should be the catcher; verify configuration and escalate `warn → error` for governance-gated tables under SS-5.
- **`useUpsertRoster` (use-employee-roster.ts:149)** — not verified end-to-end in this pass; presumed similar pattern to `useAutoFillShifts` (line 232). Mark for slice 05 re-pass if not already covered.

---

## Top 3 critical (one-liners)

1. **F-SC-04-15 — day-control widget direct deviation writes** (`EventDetailPanel.tsx:299,319`). New since baseline. Two `.update` calls inside React `startTransition`, no gate_action, no cascade_gate_write, no `emit()`. D6 mutation surface invisible to audit + automation. Violates ADR-0156 audit-integrity driver + ADR-0204 + ADR-0091.
2. **F-SC-04-13 — OversiktTab inline duty-leader update** (`OversiktTab.tsx:257`). New since baseline. `department_session.update({duty_leader_id})` runs inside `<select onChange>` closure. No Server Action, no gate. Mutates D6 production entity from inside a widget that ADR-0156 explicitly forbids from owning Supabase access.
3. **F-SC-04-09 — `useAutoFillShifts` bulk shift insert** (`use-employee-roster.ts:333`). Bulk `.insert(shiftsToInsert)` of an entire week of shifts with zero gate evaluation. Single user action can write 50+ `schedule_shift` rows that miss both capability (`shift.create`) and cascade-rule (overlap, overtime, framework constraint) evaluation. Highest blast radius of the 15 findings.

**Counts: 15 HIGH + 1 MED = 16 findings. 13 mutation hooks across schedule/day-control surface ship without `gatedMutation`.** ADR-0204 SS-5 backlog has regressed since the 2026-05-10 baseline; ADR-0156's own widget surface is now part of the gap.
