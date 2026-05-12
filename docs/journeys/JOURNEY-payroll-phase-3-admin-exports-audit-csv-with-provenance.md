---
title: "Journey — Admin exports audit CSV with provenance"
feature: payroll-phase-3
journey: admin-exports-audit-csv-with-provenance
status: verified
verified_at: 2026-05-08
e2e_test: null
created: 2026-05-08
updated: 2026-05-08
module: payroll
tags: [journey, payroll, phase-3, admin, csv-export, audit, provenance, bokforingsloven]
---

# Journey: Admin exports audit CSV with provenance

**Role:** admin

**Precondition:**
- Admin logged in at `/dashboard/payroll/[periodId]`
- Period `status = 'locked'`
- At least one `payroll.calculation` row with a `shift_pay_calculation_event` exists

## Happy Path

1. Admin clicks "Eksport" tab → ExportTab renders (same as aggregate journey step 1)
2. Admin selects "Audit (med provenance)" radio → `variant` state changes from `"aggregate"` to `"audit"`
3. Admin leaves "Inkluder upålitt PII" switch OFF (default)
4. Admin clicks "Last ned CSV"
5. `useExportPeriod` fires with `{ variant: "audit" }`:
   - Server action → BFF POST `/api/payroll/export-period` with `variant: "audit"`
   - BFF gate_action → period lock verify → audit rows query:
     - Fetches `payroll.calculation` rows joined with `schedule_shift_id` + `provenance` JSONB
     - For each calculation row: joins latest `shift_pay_calculation_event` (non-superseded, highest `derivation_version`) to extract `rule_type`, `source_text_applied`
     - Populates `rule_id`, `tariff_version`, `paragraf` from `provenance` JSONB or event fields
     - Result: one AuditRow per calculation row (not per profile)
   - `generateCsv(csvRows, { variant: "audit", ... })` → CSV with provenance columns
   - INSERT `payroll.export_event` (variant='audit', masked=true)
   - Emit `payroll.csv_exported`
   - Stream response with filename `{slug}-{yyyy-mm}-audit-{ts}.csv`
6. Browser downloads file; hook triggers blob download with audit filename
7. Admin opens CSV in Norwegian Excel:
   - More rows than aggregate (1 row per calculation_line, not 1 per profile)
   - Columns include: `Regel-ID`, `Tariff-versjon`, `Paragraf` (provenance columns)
   - `Paragraf` column contains tariff paragraph reference (e.g. `§6.1`) for overtime/evening supplement lines
   - Numbers still nb-NO formatted (comma decimal), BOM present, semicolon delimited
8. Eksporthistorikk shows new entry with "Audit" badge

**Postcondition:**
- `payroll.export_event` row: `variant='audit'`, `masked=true`, `status='completed'`
- `activity_trail` row: `payroll.csv_exported` event with `variant: "audit"`
- CSV file: 1 row per calculation line, provenance columns populated where event data exists
- Provenance columns empty for manual_supplement lines (no `shift_pay_calculation_event` linkage)

## Error Paths

- **Period not locked:** Same guard as aggregate journey — button disabled, helper text shown
- **No audit rows (no calculations):** BFF returns 404 `no_rows`; hook shows `toast.error`
- **Partial provenance:** Some rows may have null `rule_id` / `paragraf` if `shift_pay_calculation_event` has not been populated for that shift (pre-Phase 3 data). This is not an error — the CSV is generated with empty provenance cells for those rows.
- **Generator error:** BFF emits `payroll.csv_export_failed` → 500 → toast.error

## Verification

- [x] Audit radio button renders and can be selected (ExportTab variant radio group)
- [x] `variant: "audit"` propagates to BFF via hook mutation
- [x] BFF audit branch fetches calculation rows with `schedule_shift_id` + `provenance` JSONB
- [x] BFF joins `shift_pay_calculation_event` for provenance fields (rule_type, source_text_applied)
- [x] AuditRow shape satisfies `packages/payroll-export/src/types.ts` type definition
- [x] `generateCsv` with `variant: "audit"` produces 1 row per calculation row
- [x] Filename contains `audit` not `aggregate`
- [x] INSERT export_event has `variant='audit'`

## Verification — file:line references

| Step | Implementation |
|------|---------------|
| Step 2 — Audit radio | `apps/web/src/app/dashboard/payroll/[periodId]/_components/ExportTab.tsx:179` (RadioGroupItem value="audit") |
| Step 2 — variant state | `ExportTab.tsx:153` (RadioGroup onValueChange) |
| Step 5 — BFF audit branch entry | `apps/web/src/app/api/payroll/export-period/route.ts:196` (`else if body.variant === "audit"`) — audit block |
| Step 5 — Audit calculations query | `export-period/route.ts:228-252` (payroll.calculation select with schedule_shift_id + provenance) |
| Step 5 — shift_pay_calculation_event join | `export-period/route.ts:274-281` (shift event query, non-superseded, highest derivation_version) |
| Step 5 — AuditRow assembly | `export-period/route.ts:322-348` (map: rule_id, tariff_version, paragraf from provenance/event) |
| Step 5 — generateCsv audit variant | `packages/payroll-export/src/csv.ts` (audit path: `opts.variant === "audit"`) |
| Step 5 — INSERT export_event variant=audit | `export-period/route.ts:387-418` (same INSERT block, variant comes from body.variant) |
| Step 5 — emit payroll.csv_exported | `export-period/route.ts:426-440` |
| Step 5 — filename with "audit" | `export-period/route.ts:379` (`generateFilename(opts)` — opts.variant="audit") |
| AuditRow type definition | `packages/payroll-export/src/types.ts` (AuditRow shape with provenance fields) |
| Audit CSV column layout | `packages/payroll-export/src/csv.ts` (audit header row + row mapper) |
