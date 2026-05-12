---
title: "Journey — Admin exports aggregate CSV"
feature: payroll-phase-3
journey: admin-exports-aggregate-csv
status: verified
verified_at: 2026-05-08
e2e_test: apps/e2e/tests/payroll-phase-3-aggregate-export.spec.ts (Group A running; Group B skipped pending locked-period seed)
created: 2026-05-08
updated: 2026-05-08
module: payroll
tags: [journey, payroll, phase-3, admin, csv-export, aggregate, nb-NO]
---

# Journey: Admin exports aggregate CSV

**Role:** admin

**Precondition:**
- Admin logged in at `/dashboard/payroll/[periodId]`
- Period `status = 'locked'` (export requires locked period)
- At least one `payroll.calculation` row exists for the period

## Happy Path

1. Admin clicks "Eksport" tab in PeriodDetailClient → System renders ExportTab with "CSV-eksport" heading
2. Admin sees variant radio group — "Aggregert" is selected by default (state initialized to `"aggregate"`)
3. Admin sees "Inkluder upålitt PII" switch is OFF (default state `includeUnmasked = false`)
4. Admin sees "Last ned CSV" button is ENABLED (period is locked, `isLocked = true`)
5. Admin clicks "Last ned CSV" → System calls `exportPeriod({ periodId, variant: "aggregate", includeUnmasked: false })`
6. `useExportPeriod` mutation fires:
   - Step 1: Calls server action `exportPeriodCsv(periodId, "aggregate", false)` → returns `{ ok: true, downloadUrl: "/api/payroll/export-period", eventId: "pending-..." }`
   - Step 2: POSTs to `/api/payroll/export-period` with `{ period_id, variant: "aggregate", include_unmasked: false }`
   - BFF: gate_action verifies authority → period lock guard → fetch aggregate calculation rows → generateCsv → INSERT `payroll.export_event` → emits `payroll.csv_exported` → returns 200 with CSV stream + `Content-Type: text/csv`
   - Step 3: Extracts filename from `Content-Disposition: attachment; filename="{slug}-{yyyy-mm}-aggregate-{ts}.csv"`
   - Step 4: `triggerBlobDownload(blob, filename)` → browser downloads file
7. Toast: "Eksport klar — nedlasting starter."
8. `useRecentExports` invalidated → Eksporthistorikk list updates with new export event row (timestamp, "Aggregert" badge, row count)
9. Admin opens CSV in Norwegian Excel → File opens cleanly: semicolon delimiter, BOM-UTF-8, nb-NO decimal comma, no encoding prompt
10. Aggregate shape: 1 row per employee, with columns for navn, personnummer (masked: last 4 visible), bankkonto (masked), grunnlonn, tillegg, trekk, total

**Postcondition:**
- `payroll.export_event` row inserted: `variant='aggregate'`, `masked=true`, `status='completed'`, `row_count=N`, `file_hash=SHA256-of-csv`
- `activity_trail` audit row from `payroll.csv_exported` emit: non-null `workspace_id` + `actor_id`
- CSV file downloaded in browser: BOM + semicolon + nb-NO numbers, 1 row per profile
- Eksporthistorikk shows new entry

## Error Paths

- **Period not locked:** Button disabled, helper text "Lås perioden først for å aktivere CSV-eksport." visible (`ExportTab.tsx:214-220`); BFF also rejects with HTTP 409 if reached directly
- **Unauthorized (not logged in):** BFF returns 401 `unauthorized` (`export-period/route.ts:70`)
- **Gate denied:** BFF returns 403 `forbidden: <reason>` (`export-period/route.ts:94`)
- **Period not found in workspace:** BFF returns 404 `period_not_found` (`export-period/route.ts:113`)
- **No calculation rows:** BFF returns 404 `no_rows` — UI shows `toast.error` via hook error handler
- **generateCsv throws:** BFF emits `payroll.csv_export_failed` + returns 500; hook shows `toast.error`
- **DB write error on INSERT export_event:** BFF emits `payroll.csv_export_failed` + returns 500

## Verification

- [x] ExportTab renders with Aggregert radio checked by default
- [x] isLocked guard disables button and shows helper text when period status !== 'locked'
- [x] Server action `exportPeriodCsv` returns BFF URL (not bytes — blob cannot be returned from server action)
- [x] Hook POSTs to BFF with cookie credentials and derives filename from Content-Disposition
- [x] BFF gate_action before write (ADR-0204)
- [x] BFF workspace_id derived server-side via resolvePayrollAuth (ADR-0151 + L-0177)
- [x] BFF emits payroll.csv_exported with non-null workspaceId + actorId (ADR-0134)
- [x] payroll.export_event INSERT is append-only (Bokføringsloven §13 RLS)
- [x] generateCsv uses BOM prefix + semicolons + nb-NO formatter (packages/payroll-export)
- [x] Eksporthistorikk list invalidated on success via TanStack Query invalidation

## Verification — file:line references

| Step | Implementation |
|------|---------------|
| Step 1 — Eksport tab trigger in PeriodDetailClient | `apps/web/src/app/dashboard/payroll/[periodId]/_components/PeriodDetailClient.tsx:170` (TabsTrigger value="export") |
| Step 1 — ExportTab mounted in PeriodDetailClient | `PeriodDetailClient.tsx:199-201` (TabsContent value="export" → ExportTab) |
| Step 2 — Aggregate radio default state | `apps/web/src/app/dashboard/payroll/[periodId]/_components/ExportTab.tsx:100` (`useState<ExportVariant>("aggregate")`) |
| Step 3 — PII toggle default OFF | `ExportTab.tsx:101` (`useState(false)`) |
| Step 4 — isLocked guard on button | `ExportTab.tsx:107` (`const isLocked = periodStatus === "locked"`) |
| Step 4 — Button disabled when not locked | `ExportTab.tsx:224` (`disabled={!isLocked || isExporting}`) |
| Step 4 — Helper text "Lås perioden først" | `ExportTab.tsx:214-220` (lock guard div rendered when `!isLocked`) |
| Step 5 — Download handler | `ExportTab.tsx:131-133` (`handleDownload` calls `exportPeriod(...)`) |
| Step 6 — useExportPeriod mutation | `apps/web/src/app/dashboard/payroll/[periodId]/_hooks/use-payroll-exports.ts:139-155` |
| Step 6 — Server action call | `use-payroll-exports.ts:93` (`exportPeriodCsv(...)`) |
| Step 6 — Server action body | `apps/web/src/app/dashboard/payroll/[periodId]/_actions/export-actions.ts:45-67` |
| Step 6 — BFF POST with credentials | `use-payroll-exports.ts:102-111` (`fetch(actionResult.downloadUrl, { credentials: "same-origin" })`) |
| Step 6 — BFF gate_action | `apps/web/src/app/api/payroll/export-period/route.ts:84-98` (`gateAction(...)`) |
| Step 6 — BFF period lock guard | `export-period/route.ts:117-127` (`period.status !== "locked"` → 409) |
| Step 6 — BFF aggregate rows fetch | `export-period/route.ts:147-182` (aggregate calculation query + de-duplication) |
| Step 6 — BFF generateCsv call | `export-period/route.ts:362` (`generateCsv(csvRows, opts)`) |
| Step 6 — BFF INSERT export_event | `export-period/route.ts:387-418` (INSERT with variant, masked, file_hash, row_count) |
| Step 6 — BFF emit payroll.csv_exported | `export-period/route.ts:426-440` (emit with non-null wsId + actorId) |
| Step 6 — BFF Content-Type + filename | `export-period/route.ts:462-473` (Response headers) |
| Step 6 — triggerBlobDownload | `use-payroll-exports.ts:79-88` (blob → anchor click) |
| Step 7 — Toast on success | `use-payroll-exports.ts:145` (`toast.success("Eksport klar — nedlasting starter.")`) |
| Step 8 — Eksporthistorikk invalidation | `use-payroll-exports.ts:147-149` (`queryClient.invalidateQueries(exportKeys.recentExports)`) |
| generateCsv BOM + nb-NO | `packages/payroll-export/src/csv.ts` + `packages/payroll-export/src/format.ts` |
| Masking (personnummer, bankkonto) | `packages/payroll-export/src/mask.ts` + `csv.ts:63-64` |
