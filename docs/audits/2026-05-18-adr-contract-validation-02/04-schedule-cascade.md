---
title: Schedule-Cascade Audit — Slice 04
status: done
updated: 2026-05-18
created: 2026-05-18
module: schedule
tags: [audit, cascade, adr-compliance, schedule]
---

# Schedule-Cascade Audit — Slice 04

**Date:** 2026-05-18
**Scope:** `apps/web/src/app/dashboard/schedule/`, `apps/web/src/lib/cascade/`,
`apps/web/src/components/day/WebDayControl.tsx` + `apps/web/src/components/day/**`
**ADRs checked:** 0032, 0047, 0091, 0156, 0204, 0366, 0367
**Method:** code-trace, no inferred claims

---

## 1. Cascade Pipeline Boundary (I1 + D1–D6 + 4C)

**PASS.** The cascade lib (`apps/web/src/lib/cascade/`) contains pure functions only — no DB access, no side effects. Every function receives pre-loaded data from the caller. The boundary between cascade derivation and Event Engine consumption is respected: no domain reasoning appears in event handlers, and `change_proposal` mutations route through BFF (`/api/scheduler/accept-bundle`, `/api/scheduler/reject-bundle`) per ADR-0099.

Dimension separation is intact:
- `resolve-hours.ts` reads `department_operating_hours` + `department_hours_override` (D1 envelope). No D2 or D4 data co-mingled.
- `resolve-tariff-rate.ts` reads `tariff_rate_table` (D3 rules). Base rate comes from `employment_contract` context passed by caller, not hardcoded.
- `evaluate-framework-rules.ts` reads `framework_rule` rows (D3). No hardcoded rates found.
- `compute-proposal-preview.ts` operates on `change_proposal`-layer inputs (C4). Pure impact computation.
- `derive-day-line-status.ts` operates on D6 `day_line` + `daily_reconciliation` (C1 signal). No permission flag mixed in.

---

## 2. ADR-0367 Tri-Layer D6 Wiring

**PARTIAL PASS — shift_session layer absent from UI.**

ADR-0367 defines a tri-layer D6 model: `department_session` → `day_line` → `shift_session`.

- `department_session`: wired. `useDepartmentSessions` feeds `WebDayControl`; session status drives `derivePhase`.
- `day_line`: wired. `useDayLines` (`apps/web/src/components/day/_hooks/use-day-lines.ts`) queries the `day_line` table with workspace-scoped filter, joined to `location` and `department`. `DayLineStrip` + `DayLineStripHeader` render it. `TimelineTab` composes strips in a multi-strip layout.
- `shift_session`: schema exists (`database.types.ts:18763`). Zero query or render call-sites found in `apps/web/src/` outside the schema file.

**Gap:** The third layer (`shift_session`) is schema-present but UI-absent. The ADR was council-approved as "multi-strip wiring + dialogs" in-flight today. This is an expected in-progress state, not a regression — but it must not be described as fully wired.

---

## 3. C1 / C4 Separation

**PASS.** `derive-day-line-status.ts` is documented and implemented as a pure read-time derivation. Status is not stored in `day_line`. `reconciliationLocked` (C1 belief) is a separate boolean input from `daily_reconciliation.locked_at`. Permission gates (C4) live in the BFF and Server Actions, not in cascade derivation functions.

`WebDayControl` derives `phase` via `derivePhase({ status: session.status }, reconQuery.data)` — C1 signal feeds UI phase, and `OversiktToolsBridge` props receive `phase` read-only. No C4 mutation initiated from within cascade pure functions.

---

## 4. Telemetry Coverage

**PASS with one warning.**

- `use-shifts.ts`: 8 `emit()` calls covering create, update, delete, assign, batch, publish, republish, swap — all in `onSuccess`.
- `use-day-content.ts`: 6 `emit()` calls covering day tasks.
- `agent-proposals-context.tsx`: 3 `emit()` calls on proposal approve/reject/create.

**Warning — OversiktTab `updateDutyLeaderMutation`:** The mutation at line 105 carries a comment "duty_leader writes routed through Server Action (gate + emit)" but the `useMutation` body shows no inline `emit()`. The comment implies emit lives in the Server Action. This claim is not verified here — the Server Action file was not read. If the Server Action does not call `emit()`, this is an L-0176 docstring drift pattern. Recommend verifying `pinDayControlContextAction` or the duty-leader Server Action file.

---

## 5. ADR-0366 — oklch() Literal Ban

**FAIL — multiple violations across day components.**

ADR-0366 bans raw `oklch()` literals; all color must go through CSS variables or `color-mix(in oklch, var(--token) ...)`.

Violations found (Tailwind arbitrary-value syntax counts as literal):
- `apps/web/src/components/day/SaveTemplateDialog.tsx` lines 43, 49, 54
- `apps/web/src/components/day/SavedTimelinesDropdown.tsx` lines 61, 67, 72
- `apps/web/src/components/day/ApplyTemplateDialog.tsx` lines 49, 55, 60
- `apps/web/src/components/day/SlotPicker.tsx` lines 85, 93, 100, 107, 118, 128
- `apps/web/src/components/day/tabs/TimelineTab.tsx` line 293
- `apps/web/src/app/dashboard/schedule/_components/shift-employee-tag.tsx` lines 26–53 (6 color pairs in JS object literals)
- `apps/web/src/app/dashboard/schedule/_components/shift-task-tag.tsx` lines 23, 27–28, 32–33
- `apps/web/src/app/dashboard/schedule/_components/week-grid.tsx` line 430 (shadow value)
- `apps/web/src/app/dashboard/schedule/_components/shift-ghost-tag.tsx` line 21

`WebDayControl.tsx` itself is clean: it uses `color-mix(in oklch, var(--brand-orange) ...)` correctly.

---

## 6. Framework Rule Completeness

**Advisory — two stub cases.**

In `evaluate-framework-rules.ts`:
- `sunday_holiday_shift` (line 128): only checks Sunday; the holiday check is commented out ("For now, just check Sunday"). Public holiday data is loaded by the caller but the case does not use `ctx` for holidays.
- `split_shift_gap` (line 140): returns `null` unconditionally with a comment "requires multi-shift context". This is an intentional stub.

Neither is a cascade boundary violation (pure function, no side effects), but `sunday_holiday_shift` produces a false negative for holiday shifts. The stub is undocumented as intentional; it should carry an explicit `// ADR-XXXX: deferred to Phase X` note to prevent future accidental reliance.

---

## Summary

| Check | Verdict |
|---|---|
| Cascade pipeline boundary (I1+D1–D6+4C) | PASS |
| No D2 data in D4 tables | PASS |
| C1/C4 separation in derive-day-line-status | PASS |
| ADR-0367 day_line layer wired | PASS |
| ADR-0367 shift_session layer wired | PARTIAL — schema present, UI absent (in-progress) |
| Tariff rates from tariff_rate_table, not hardcoded | PASS |
| Telemetry emit() on mutations | PASS with warning (duty_leader SA unverified) |
| ADR-0366 oklch() literal ban | FAIL — 9 files, ~20 occurrences |
| Framework rule stubs documented | ADVISORY — 2 stubs lack ADR-phase annotation |

**Blocking findings:**
1. ADR-0366 violations in 9 files across `components/day/` and `schedule/_components/`. These predate today's ADR-0367 work and must be remediated before any polish pass closes on these components.

**Non-blocking findings:**
2. `shift_session` UI layer absent — expected in-flight per council approval.
3. `OversiktTab` duty-leader emit unverified in Server Action body — verify `emit()` exists in the action, not just the comment.
4. `sunday_holiday_shift` and `split_shift_gap` rule stubs need explicit deferral annotation.
