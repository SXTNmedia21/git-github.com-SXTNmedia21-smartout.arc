---
title: Implementation Plan — Lonn Telemetry Wiring
status: draft
created: 2026-05-31
updated: 2026-05-31
module: payroll
tags: [telemetry, lonn, payroll, plan]
---

# Implementation Plan — Lonn Telemetry Wiring

Gate status: **FAIL** — 8 missing mutations (see TELEMETRY-MAP.md). This plan
addresses each blocker in priority order before the gate can pass.

---

## P0 — Critical: wire existing mutations to existing hooks

These mutations exist in design but are disconnected from the already-built hooks.

### P0-A: Wire SupplementForm submit → `useManualSupplements`

- File: `lonn-overlays.jsx` element #63 (Button: Legg til linje)
- Hook exists: `apps/web/src/app/dashboard/payroll/[periodId]/_hooks/use-manual-supplements.ts`
- Action: pass mutation down via props from `LonnPage` → `SupplementForm.onSubmit`; remove local-only `submitSupplement` stub
- Event: `payroll.manual_supplement_added` (already in registry, emitted server-side by BFF)
- Validation: after wire-up, confirm toast fires and query invalidates

### P0-B: Wire Rule toggle Switch → `useUpdateSupplementRule`

- File: `lonn-config.jsx` element #44 (Switch per rule)
- Hook exists: `use-supplement-rules.ts → useUpdateSupplementRule()`
- Action: replace `onToggle(r.code)` (local state) with a mutation that patches `is_active` on `payroll.supplement_rule`
- Event: use `supplement_rule updated` (already emitted by `useUpdateSupplementRule`)
- Trap: must use `.schema("payroll")` — already correct in existing hook

### P0-C: Wire Employee sign → deviation acknowledge

- File: `min-lonn.jsx` element #65 (Signér tillegg)
- Nearest hook: `use-acknowledge-deviation.ts → useAcknowledgeDeviation()` with `is_self=true` path
- Action: replace local `sign()` with mutation call; the BFF already handles `deviation_acknowledged` with `is_self` flag
- Risk: min-lonn does not have `periodId` or `deviationId` in scope from mock data — need to thread real IDs from `ML_PAY.pending`

---

## P1 — Important: new hooks needed for UI actions that have no hook at all

### P1-A: Innstillinger save — `useUpdatePayrollSettings`

- File: `lonn-config.jsx` elements #46 + #47
- Event: registry has `"payroll_settings updated"` (event string has space, not dot — **fix event name to `payroll.settings_updated`** in registry and emit site)
- Action: create `apps/web/src/app/dashboard/payroll/[periodId]/_hooks/use-payroll-settings.ts`
  - Reads/writes `payroll.period` (or a settings table — confirm schema)
  - Emits `payroll.settings_updated` (renamed)
- Schema trap: use `.schema("payroll")`

### P1-B: DevRow "Avvis vakten" — new event + hook

- File: `lonn-views.jsx` element #41
- No registry event exists for rejecting a shift deviation
- Action:
  1. Add event `payroll.deviation_rejected` to `packages/telemetry/src/registry.ts`
  2. Create mutation hook (or extend `use-acknowledge-deviation.ts` with a `reject` action)
  3. Wire button in `DevRow`

### P1-C: "Be om avspasering" — new event + hook (min-lonn)

- File: `min-lonn.jsx` element #71
- No registry event for employee time-off request
- Action:
  1. Add event `payroll.timebank_withdrawal_requested` (or reuse `payroll.timebank_withdrawn` if it covers employee requests)
  2. Check `payroll.timebank_withdrawn` registry shape — if it only covers admin forced-payout, a new employee-facing event is needed
  3. Create mutation hook in `apps/web/src/hooks/` (employee surface, not admin payroll path)

---

## P2 — Supplement rule test runner

- File: `lonn-config.jsx` element #42 (Test mot april)
- Event: `payroll.supplement_rule_test_run` — already in registry
- Action: create `useSupplementRuleTestRun()` mutation hook that POSTs to a BFF test endpoint; hook does not yet exist
- This is a non-blocking UI feature (toast-only in design) — implement after P0/P1

---

## P3 — Botsson bulk supplement tip

- File: `lonn-overlays.jsx` element #61 (Legg til 2 til)
- No event, no hook
- This is a convenience feature — scoped out of MVP gate. Flag as tech debt with a TODO comment in the component.

---

## Critical infrastructure notes

### `.schema("payroll")` enforcement

Every new hook that touches `payroll.*` tables MUST use `.schema("payroll")` or
the Supabase client will silently query `public.supplement_rule` / `public.period`
(returns empty, no error). Add a linting rule or code comment at every new hook site.

### min-lonn open-period seed gap (F0.4)

The employee live-preview (`ML_PAY.current.net`) will be 0 for open periods
because `payroll.calculation` has no rows until the calc-engine runs.
This is a data-seeding gap, not a UI bug. Fix: seed F0.4 mock calc rows for the
open period in the dev environment before testing the employee surface.

### `payroll_settings updated` event name fix

Registry event string `"payroll_settings updated"` (with space) is inconsistent
with the `domain.verb_noun` convention. Rename to `"payroll.settings_updated"`
before wiring any Innstillinger save path.

---

## Execution order

```
P0-A  Wire SupplementForm submit          (unblocks manager add-supplement)
P0-B  Wire rule toggle Switch             (unblocks Regler tab mutations)
P0-C  Wire employee sign                  (unblocks employee sign-off flow)
P1-A  useUpdatePayrollSettings            (unblocks Innstillinger save)
P1-B  payroll.deviation_rejected + hook   (unblocks DevRow reject action)
P1-C  timebank withdrawal request         (unblocks Be om avspasering)
P2    Supplement rule test runner          (non-blocking, after gate passes)
P3    Botsson bulk supplement             (tech debt, post-MVP)
```

Gate passes when P0 + P1 are done and `control.json` `control_points` all true.
