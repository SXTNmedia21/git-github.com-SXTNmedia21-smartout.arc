---
title: "Journey — PDF content matches CSV export for same period"
feature: payroll-phase-4
journey: pdf-content-matches-csv
status: verified
verified_at: 2026-05-08
e2e_test: Manual test only (requires locked period + csv + pdf for same period — see MANUAL-TEST-payroll-phase-4.md Flow 5)
created: 2026-05-08
updated: 2026-05-08
module: payroll
tags: [journey, payroll, phase-4, cross-validation, csv, pdf, totals, parity]
---

# Journey: PDF content matches CSV export for same period

**Role:** admin

**Precondition:**
- Locked payroll period with at least one `payroll.calculation` row per profile
- Both Phase 3 (CSV) and Phase 4 (PDF) have been used to export the same period
- Admin has both the CSV file and a PDF lønnsgrunnlag open

## Happy Path — cross-validation

1. Admin opens a locked period → Eksport tab → downloads aggregate CSV (Phase 3 flow)
2. Admin clicks "Generer PDF for alle ansatte" → bundle generation → opens one employee's PDF
3. Admin finds the same employee's row in the CSV
4. Admin compares:
   - `base_pay` (Grunnlønn) in CSV row vs TotalsBlock base_pay in PDF
   - `total_supplements` (Tillegg) in CSV row vs SupplementsTable total in PDF
   - `total_pay` (Total) in CSV row vs TotalsBlock brutto total in PDF
5. Values match to ±0.01 NOK

**Postcondition:**
- Confidence that the CSV and PDF represent the same calculation state

## Implementation basis for parity

Both generators read from the same source:

| Layer | CSV (Phase 3) | PDF (Phase 4) |
|-------|---------------|---------------|
| Input type | `AggregateRow` (`packages/payroll-export/src/types.ts`) | `AggregateRow` (same type) |
| DB query | `payroll.calculation` filtered by `MAX(calculation_version)` per profile | Same query (`route.ts:131-165`) |
| Number formatting | nb-NO comma-decimal in CSV | Same values, Norwegian number format in PDF |
| Field names | `total_pay` → CSV "Total" column | `total_pay` → TotalsBlock brutto total |
| PII | masked by default (togglable) | always unmasked (lønnsgrunnlag is PII-bearing) |

**Why divergence is impossible in theory:** Both pipelines call `generateCsv` / `generateLonnsgrunnlagPdf` on the same `AggregateRow[]`. Any divergence would mean either:
1. A timing difference (different calculation_version selected between two queries)
2. A bug in one generator's number rounding

The `AggregateRow` type enforces the same field set. Floating-point values are cast to `Number()` at the same site in both BFF routes.

## Error Path — divergence detected

If a tester finds values that differ by more than ±0.01 NOK:

1. Check that both CSV and PDF were generated against the same period lock state (no recalculation between the two exports)
2. Verify no manual supplement was added between the two export events (supplements affect `total_supplements`)
3. If divergence persists: compare `payroll.calculation.calculation_version` used in each export via `payroll.export_event.completed_at` timestamps
4. File a bug with: period_id, profile_id, CSV total_pay value, PDF brutto value, both export_event IDs

## Verification

- [x] Both CSV BFF and PDF BFF read `payroll.calculation` filtered by MAX(calculation_version) per profile
- [x] Both use the same `AggregateRow` type from `packages/payroll-export/src/types.ts`
- [x] Both calculate `total_pay = base_pay + total_supplements - total_deductions` from the same DB row
- [x] PDF `generateLonnsgrunnlagPdf` uses same `AggregateRow` shape as `generateCsv`
- [x] Rounding: Number() cast from DB numeric at BFF layer (same for both)
- [x] Cross-validation is manual only (no automated e2e due to seeded period dependency)

## Verification — file:line references

| Step | Implementation |
|------|---------------|
| AggregateRow type definition | `packages/payroll-export/src/types.ts` |
| CSV: aggregate rows query + de-dupe | `apps/web/src/app/api/payroll/export-period/route.ts:147-182` |
| PDF: aggregate rows query + de-dupe | `apps/web/src/app/api/payroll/generate-pdf-bundle/route.ts:131-165` |
| CSV: generateCsv call | `export-period/route.ts:362` |
| PDF: generateBundlePdfs call | `generate-pdf-bundle/route.ts:238` |
| AggregateRow mapping (PDF bundle) | `generate-pdf-bundle/route.ts:205-220` |
| AggregateRow type | `packages/payroll-export/src/types.ts` |
| TotalsBlock (PDF component) | `packages/payroll-export/src/pdf/components/TotalsBlock.tsx` |
| nb-NO formatting (CSV) | `packages/payroll-export/src/format.ts` |
