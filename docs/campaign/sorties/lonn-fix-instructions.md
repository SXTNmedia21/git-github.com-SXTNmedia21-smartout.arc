---
title: "Lønn v2 — Fix Instructions + Definition of Done (architect)"
status: in_progress
created: 2026-06-05
updated: 2026-06-05
module: design-handoff
tags: [sortie, lonn, fix, definition-of-done, acceptance, architect, W3]
---

# Lønn v2 — Fix Instructions + Definition of Done

> **Architect deliverable.** I write the instructions and I define "done". I do NOT fix this.
> The orchestrator drives the builder + verifier against this. G8 = the human sees the screen match
> the design **with real data**. A green gate that does not match the screen is PHANTOM-GREEN, not done.

## Where we are

Lønn v2 was ported (`feat/lonn-v2`, commits e07fafe08 + 432ac5180) and reported PASS — but the actual
screens are broken: `my-lonn-v2` throws an error banner ("Kunne ikke laste lønnsinformasjon");
`payroll-v2` renders all `kr 0`. The prior "PASS" was hollow (L3 locked an empty period; E2E asserted
headings, not data). This sortie fixes the real defects and redefines done so it cannot be faked.

## Root causes (grounded on disk 2026-06-05 — NOT guesses)

1. **my-lonn crash = invalid enum.** `payroll.period_status` real values = `open | locked | approved
   | exported`. There is **no `closed`**. But `apps/web/src/app/dashboard/my-salary/_hooks/use-my-salary.ts:25`
   sets `SETTLED_STATUSES = ["closed", "exported"]`. The `.in("status", ["closed", ...])` query makes
   Postgres throw `invalid input value for enum period_status: "closed"` → the hook errors → MinLonnView
   renders the error state. This is a **pre-existing v1 bug** in the reused hook, inherited by v2.
   - Evidence: enum labels above; Anna (`f0000000-…-001`) has exactly 1 profile row (so `.single()` is
     not the throw) and 1 real `calculation` in period `c1000000-…-001`, status `locked`.
2. **payroll-v2 all-zeros = wrong default period.** `usePayrollPeriods` orders `end_date DESC`; the
   newest period (`c1000000-…-002`, 3–30 Jun) has **0 calculations**; the populated period
   (`c1000000-…-001`, 1–2 Jun, 8 calcs) is older. `PayrollV2View`'s default `activePeriodId` lands on
   the empty newest one → every figure is `kr 0`.

Both live in the hook/view layer. **Data exists; no seed change / DB-wall approval is required** to make
the screens show real numbers.

## Instructions (what the builder does — reuse-first, faithful to design, no fabricated data)

1. **Fix the settled-status set** in `use-my-salary.ts`. Replace the phantom `"closed"` with the real
   settled states for an employee payslip view. A `locked`/`approved`/`exported` period is finalized;
   `open` is not. Decide the exact set against the payroll model (load `payroll-engine-developer`) — at
   minimum it must include `locked` so Anna's real payslip shows. This fix corrects **v1 and v2** (shared
   hook) — note that in the commit.
2. **Fix the default active period** in `PayrollV2View` so the admin lands on a period **with data**
   (e.g. most-recent period whose calc-count > 0, falling back to most-recent if all empty). Keep the
   PeriodSwitcher; only change the default selection. Faithful to `lonn.jsx`.
3. **Address finding F1** (return-null blank-flash) while here: render the design's skeleton/loading
   state instead of `return null` between data-arrival and the effect that sets `activePeriodId`.
4. Do NOT fabricate data, do NOT hardcode numbers, do NOT invent a seed row. Real-or-honest-empty only.
   Token discipline (ADR-0366), `.schema('payroll')`, copy-not-rewrite all still apply.

## Definition of Done (the RESULT — every item is observable, no proxy metrics)

A reviewer (and the verifier) must be able to confirm each by **looking at the screen + matching the DB**:

- **DoD-1 — my-lonn-v2 loads real data.** Logged in as `anna@smartout.local`: no error banner; her real
  payslip (the 1 `calculation` in period `c1000000-…-001`) renders with the **real kr amount that
  matches the DB row**; balances/quotas show real values or an honest empty state. Faithful to
  `min-lonn.jsx`. Evidence: screenshot + the kr figure equals the DB `calculation` value.
- **DoD-2 — payroll-v2 shows real numbers.** Logged in as `admin@smartout.local`: the default view lands
  on the populated period; **Brutto / Netto / counts are non-zero and equal the DB aggregates** for that
  period (8 calcs); deviations + period list render. Faithful to `lonn.jsx`. Evidence: screenshot + the
  headline figures equal `select sum(...) from payroll.calculation where period_id = '…-001'`.
- **DoD-3 — L3 on a period WITH data.** A real mutation (e.g. acknowledge-deviation or a recalc) lands an
  `activity_trail` row whose payload is **non-trivial** (references real profiles/lines, not an empty
  period). The empty-period lock from the prior run does NOT count. Quote the row + its payload.
- **DoD-4 — verified through the real harness.** E2E runs via the project's real Playwright
  harness/global-setup (fix the `profile.location_id` fixture drift, finding F2 — `location_id` →
  `locations uuid[]`), not a bypass config. The verifier reports any trivial-subject gate as
  PHANTOM-GREEN, never PASS.
- **DoD-5 — static battery still green** (typecheck/eslint/tokens/polish) after the fixes.
- **DoD-6 — G8.** Pontus sees both screenshots, faithful to the design, with real numbers. Only then done.

## Open decisions for Pontus / PO (surface, do not assume)

- **Settled-status policy (DoD-1):** is an employee payslip visible at `locked`, or only `approved`/
  `exported`? Affects which periods Anna sees. Architect's read: `locked` = finalized for the employee
  → include it. Confirm with payroll/lovsen judgment.
- **Default-period policy (DoD-2):** does the design intend "most recent" or "most recent with data"?
  Architect proposes most-recent-with-data. Confirm.
- If either answer means the **seed** should carry an `approved`/`exported` current period with data,
  that is a seed change = DB-wall = your approval. Surface it; do not invent.

## Increment 2 — the 4 remaining blockers (verifier FAIL on commit a5a4fa5c4)

Increment 1 fixed the enum-crash + default-period + skeleton + profile-fixture, and L3 PASSED (activity_trail
2388, approve on populated period). But the screens still don't show real numbers. Four blockers remain,
**grounded on disk**:

- **BUG A — my-lønn ÷100 unit error.** `my-lonn-v2/_lib/to-design-shape.ts:100` does
  `Math.round(calculation.total_pay / 100)` with a comment claiming øre. WRONG: `total_pay` is **NOK** —
  v1 proves it (`PayslipDetail.tsx`, `PeriodList.tsx`, `LineDrawer.tsx` all do `formatNOK(total_pay)` with
  NO division). Fix: drop the `/100`; pass `total_pay` as NOK and format with the same `formatNOK` convention
  (1488.75 → "kr 1 489"). Audit the whole adapter for any other `/100`.
- **BUG B — payroll-v2 BRUTTO/NETTO = 0.** `payroll-v2/_lib/to-design-shape.ts:127` hardcodes `gross:0, net:0`,
  because `usePayrollPeriods` (`fetchPeriods`, select at line 58: `calculation: period_id, profile_id`) never
  fetches `total_pay`. Fix (additive, reuse-first): extend that select to include the gross (and net) pay
  columns, sum per period, add `totalPay` (+ net) to `PeriodSummary` (type at line 22, build at line 91), then
  the adapter sets `gross = summary.totalPay`. Golden: period `c1000000-…-001` sum(total_pay) = **11862.40**.
  Confirm the real column names for gross vs net on `payroll.calculation`; if there is no distinct net column,
  show Netto honestly (real column or an honest dash), never a fabricated value.
- **BUG C — prod Server-Component crash for the employee** (`Feilkode 1841798210`). Root cause unknown —
  **reproduce it** (prod build, log in as the employee user, open /dashboard/my-lonn-v2), find the actual
  throwing boundary (null handling in MinLonnView/adapter, a client/server component split, etc.), fix it.
  Do NOT guess — reproduce and root-cause. (Fixing BUG A may or may not resolve it; verify.)
- **BUG D — E2E fixture missing `department_id`.** `ensure-local-e2e-runtime-fixture.mjs:455-471` upserts
  `schedule_shift` without `department_id` (NOT NULL). The id already exists: `fixtureIds.departmentId`
  (`d0000000-…-000`, department upserted at line 241). Add `department_id: fixtureIds.departmentId` to that
  upsert. Mechanical.

**Corrected test user (architect's prior error):** the employee is **`employee@smartout.local`** (profile
`f0000000-…-001`) — `anna@smartout.local` has NO profile and redirects to onboarding. The calc `882efb8d`
belongs to `employee@…`. DoD-1 on-screen target: **"kr 1 489"** (formatNOK of 1488.75).

DoD-2 on-screen target: payroll-v2 BRUTTO shows the formatNOK of **11862.40** (≈ "kr 11 862").

## Lane note

Architect (this doc) defines done. Orchestrator drives builder + verifier (single writer per worktree,
real harness, real-data + screenshot evidence). Builder fixes; verifier grades and may NOT claim PASS on
a trivial subject. Pontus holds G8. See inbox proposals `agent-lane-boundary-enforcement` +
`wasted-time-is-the-catastrophe` for why this is now enforced, not trusted.
