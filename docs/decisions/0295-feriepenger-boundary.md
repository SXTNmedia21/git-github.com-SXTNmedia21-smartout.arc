---
id: ADR-0295
title: "Feriepenger boundary — Smartout exposes basis, accountant computes accrual"
status: proposed
created: 2026-05-11
updated: 2026-05-11
module: payroll
tags: [payroll, feriepenger, lonnsgrunnlag, boundary, phase-3, phase-4]
---

# ADR-0295 — Feriepenger boundary

## Context and Problem Statement

Smartout's payroll module produces **lønnsgrunnlag** (wage basis) artifacts — CSV export, per-employee PDF, period aggregate. Four output routes (`generate-pdf-bundle`, `generate-pdf-single`, `export-period` × 2 branches) currently hardcode the value `feriepenger_accrued: 0` as a Phase 1 placeholder. The field shape ships across `packages/payroll-export/src/types.ts`, `csv.ts`, `pdf.ts`, and `pdf/components/TotalsBlock.tsx`.

Two problems surfaced when an external regnskapsfører reviewed the file:

1. **Field-name ambiguity.** "Accrued" suggested an accumulated liability tracked across periods. Smartout was never tracking that — only the per-period basis.
2. **Hardcoded zero looked like data corruption.** A null/zero value where the regnskapsfører expected a number caused the file to be rejected by hand on first review, before any computation was attempted.

The underlying question is not a numerical bug. It is a boundary question: **does Smartout own feriepenger calculation, or does the accountant?**

## Decision Drivers

- **Positioning lock-in (memory `feedback_lonnsgrunnlag_not_lonnsslipp.md`, 2026-05-08):** Pontus made this load-bearing — Smartout ships *wage basis* for accountants and Tripletex/Visma to consume, never a payslip. Every output field must answer to that frame.
- **Regulatory scope.** Feriepenger accrual under Ferieloven §11 involves rate selection (10.2 % default for FF/NHO, 12 % under Riksavtalen, 14.3 % for employees ≥ 60), 6G salary cap, multi-period liability tracking, June-payout scheduling, and A-melding kode 600 reporting. Each one has a regulatory owner. Smartout does not.
- **Prior boundary precedent.** ADR-0250 deferred Skatteetaten-rapportering using the exact same logic: Smartout is upstream of the tax/regnskap layer, not the layer itself. This ADR codifies the same boundary class for one more field.
- **Falsifiability.** A boundary is only enforceable if it lives in (a) field names and (b) UI labels. `feriepenger_accrued` fails this — `feriepenger_basis` passes it.

## Considered Options

1. **Smartout exposes basis only; accountant computes accrual.** Rename `feriepenger_accrued` → `feriepenger_basis` across types, CSV, PDF, UI. Compute basis as `sum(holiday_eligible_pay) × holiday_allowance_pct / 100`. Default pct = 12 % (Riksavtalen); admin can override per employee.
2. **Smartout computes accrual fully** (per-period basis × rate, accumulated across calendar year, 6G cap, age-rule, June-payout flag). Owns the calculation, the audit trail, and the disclosure to regnskapsfører.
3. **Keep the current `feriepenger_accrued: 0` placeholder and document it as "not yet implemented".** Defer the boundary question to Phase 5+.

## Decision Outcome

**Chosen: Option 1 — Smartout exposes basis; accountant computes accrual.**

### What Smartout DOES

- Compute **feriepenger basis** per period: `sum(holiday_eligible_pay) × holiday_allowance_pct / 100`.
- Expose the basis as the field `feriepenger_basis` (NOK, two decimals) in CSV, PDF, and the period-summary API response.
- Default `holiday_allowance_pct = 12.0` (Riksavtalen). Admin may override per `employee_payroll_profile` (e.g. 14.3 for over-60).
- UI label MUST read: **"Feriepenger-grunnlag (regnskapsfører beregner)"** with a tooltip explaining "Smartout viser grunnlaget. Regnskapsfører eller lønnssystem beregner og utbetaler."
- PDF + CSV header MUST include the disclaimer "Dette er et lønnsgrunnlag — ikke en lønnsslipp" (already established by ADR-0294).
- Emit `payroll.feriepenger_basis_computed` telemetry on each lønnsgrunnlag generation, payload `{ workspace_id, period_id, profile_id, basis_amount, pct_applied, channel: "system" }`.

### What Smartout does NOT do

- Compute the **accrued liability** across multiple periods (running ledger).
- Apply the **6G salary cap** (Folketrygdloven §6) on the holiday-pay base.
- Schedule **payout timing** (June for prior-year accrual, on-termination clearing).
- Submit **A-melding kode 600** (feriepenger til gode) to Skatteetaten.
- Apply **Skatteetaten-rapportering** for feriepenger payouts (out of scope per ADR-0250).
- Decide between the **10.2 % / 12 % / 14.3 %** rate tiers on the accrual side; admin selects the per-employee pct on the basis side, but the accountant decides what to actually apply at payout.

### Boundary verbatim

> Smartout = wage basis producer. Regnskapsfører = wage accrual + payout consumer. Feriepenger is no exception — basis is ours, accrual is theirs.

## Rules & Consequences

- **Good, because** the field rename `feriepenger_accrued → feriepenger_basis` removes the regnskapsfører's rejection trigger. The number is no longer "wrong"; it answers a different question than the regnskapsfører was reading it for.
- **Good, because** the boundary now matches ADR-0250 (Skatteetaten). One sentence — "Smartout is upstream of the regnskap layer" — covers both. Future fields can be classified by the same rule without a fresh ADR.
- **Good, because** the UI label "regnskapsfører beregner" is a falsifiable check: any tooltip that drops this clause violates the ADR and is caught by review.
- **Bad, because** a future Pontus or Pontus-customer may ask Smartout to compute accrued liability natively (Tripletex-style). That is an amendment path, not a refutation: write a successor ADR that explicitly extends the boundary inward, ships a migration for the accrual ledger, and updates this ADR's status to `superseded`. Do not extend the boundary silently by adding accrual logic to Phase 5+ without a successor ADR.
- **Bad, because** the rename touches 4 BFF routes, 1 types module, 1 CSV writer, 1 PDF document, and 1 PDF totals component (8 sites). The migration is mechanical but must land atomically — a half-renamed surface produces two field names for one number.

### Agent Impact

- **Phase 3 closure (Tasks 9–13 of `PLAN-payroll-mvp-blockers.md`):** the rename is authorized by this ADR. Agents implementing the rename cite ADR-0295 in commit messages and in the field comment in `types.ts`.
- **Capability authors:** any new payroll capability tool that emits a feriepenger value MUST emit it as `feriepenger_basis`, never `feriepenger_accrued`. No silent re-introduction of the old field.
- **PDF/CSV reviewers:** any artifact still showing "feriepenger_accrued" or a label without "regnskapsfører beregner" fails the next audit pass (`adr-contract-audit` will pick up ADR-0295 on next run).
- **Future Skatteetaten work:** when ADR-0250 lands accepted, this ADR's "Smartout does NOT" list aligns automatically — no second amendment required.

## References

- **Memory:** `feedback_lonnsgrunnlag_not_lonnsslipp.md` (Pontus, 2026-05-08) — the load-bearing positioning rule this ADR codifies for the feriepenger field
- **ADR-0250** — Skatteetaten Integration (same boundary class: Smartout produces basis, external system computes liability)
- **ADR-0294** — Payroll PDF library (header disclaimer "Dette er et lønnsgrunnlag — ikke en lønnsslipp" lives here; this ADR aligns label conventions)
- **Linear:** SMA-346 (Phase 3 ship), SMA-348 (this ADR)
- **Council:** 2026-05-10 PM payroll-mvp-blockers council (boundary approved in principle; Pontus accepts via merge to development)
- **Plan:** `docs/superpowers/plans/2026-05-10-payroll-mvp-blockers.md` Task 8 (lines 695–820)
- **Regulatory:** Ferieloven §11 (feriepenger accrual rules — owned by accountant, not Smartout)

---

> After acceptance: amend status to `accepted`, update `0000-decision-log.md` row.
