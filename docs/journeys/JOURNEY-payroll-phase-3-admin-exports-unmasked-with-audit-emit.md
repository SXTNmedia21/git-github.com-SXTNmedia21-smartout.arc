---
title: "Journey — Admin exports unmasked PII with audit emit"
feature: payroll-phase-3
journey: admin-exports-unmasked-with-audit-emit
status: verified
verified_at: 2026-05-08
e2e_test: null
created: 2026-05-08
updated: 2026-05-08
module: payroll
tags: [journey, payroll, phase-3, admin, csv-export, unmasked, pii, audit-emit, gdpr, adr-0078]
---

# Journey: Admin exports unmasked PII with audit emit

**Role:** admin (only — `isAdmin` prop gates the UI; BFF re-checks authority)

**Precondition:**
- Admin logged in at `/dashboard/payroll/[periodId]`
- Period `status = 'locked'`
- `isAdmin = true` (ExportTab receives this from PeriodDetailClient)
- At least one `payroll.calculation` row exists

## Happy Path

1. Admin navigates to Eksport tab on a locked period — "Inkluder upålitt PII" switch is visible (admin-only via `{isAdmin && ...}`)
2. Admin clicks the "Inkluder upålitt PII" switch → `handleUnmaskedToggle(true)` fires → switch does NOT flip ON immediately → `confirmDialogOpen` state set to `true`
3. `UnmaskedConfirmDialog` opens with:
   - Title: warning about raw PII export
   - Description: consequences (personnummer + bankkonto in cleartext, logged to revision trail)
   - ShieldAlert icon
   - "Avbryt" (cancel) and "Bekreft" (confirm) buttons
4. Admin clicks "Avbryt" → `handleCancelUnmasked()` → `includeUnmasked` stays `false`, dialog closes
5. Admin clicks switch again → dialog opens again → admin clicks "Bekreft" → `handleConfirmUnmasked()`:
   - `setIncludeUnmasked(true)`
   - `setConfirmDialogOpen(false)`
   - Switch is now visually ON
6. Admin clicks "Last ned CSV"
7. `useExportPeriod` fires with `{ includeUnmasked: true }`:
   - BFF POST `/api/payroll/export-period` with `include_unmasked: true`
   - BFF gate_action → period lock verify → fetch rows → mask bypass:
     - `generateCsv(csvRows, { includeUnmasked: true, ... })` → `csv.ts:63-64` bypasses `maskPersonnummer` + `maskBankkonto`
     - Personnummer column: raw 11-digit number
     - Bankkonto column: full account number
   - INSERT `payroll.export_event` (masked=false)
   - Emit `payroll.csv_exported` (always)
   - Emit `payroll.csv_export_unmasked` (only when include_unmasked=true) — high-PII audit event
   - Stream response
8. Browser downloads unmasked CSV
9. Toast: "Eksport klar — nedlasting starter."
10. Eksporthistorikk shows new entry with "Upålitt PII" badge (red `destructive` variant) + "Aggregert" or "Audit" depending on selected variant
11. Operator checks `activity_trail` — two rows for this export: one for `payroll.csv_exported` and one for `payroll.csv_export_unmasked`

**Postcondition:**
- `payroll.export_event` row: `masked = false`
- `activity_trail` contains `payroll.csv_export_unmasked` event for this export event ID
- CSV: personnummer and bankkonto in cleartext
- ExportHistoryRow badge: `<Badge variant="destructive">Upålitt PII</Badge>` visible for masked=false row

## Error Paths

- **Admin cancels confirm dialog:** Toggle stays OFF; no download initiated; no audit event emitted
- **Switch visible only for admin:** If `isAdmin = false`, the switch is not rendered at all (conditional render `{isAdmin && ...}`)
- **include_unmasked=true from non-admin:** BFF gate_action checks authority (level=confirm, min_role=admin) — returns 403 if actor is not admin; no CSV generated, no audit emit
- **Voice channel attempt:** Not applicable — ExportTab is web-only (ADR-0133); capability tool rejects voice channel at execute() level (ADR-0078)
- **Period not locked:** Button disabled regardless of PII toggle state

## Verification

- [x] "Inkluder upålitt PII" switch rendered only when `isAdmin=true` (ExportTab conditional render)
- [x] Switch click opens UnmaskedConfirmDialog without flipping toggle
- [x] Cancel does not flip toggle
- [x] Confirm flips toggle + closes dialog
- [x] `includeUnmasked: true` propagates to BFF
- [x] BFF `include_unmasked: true` → `generateCsv(csvRows, { includeUnmasked: true })` bypasses mask
- [x] BFF always emits `payroll.csv_exported`
- [x] BFF emits `payroll.csv_export_unmasked` ONLY when `include_unmasked=true`
- [x] INSERT export_event has `masked = false`
- [x] ExportHistoryRow renders `<Badge variant="destructive">Upålitt PII</Badge>` for `masked=false` rows

## Verification — file:line references

| Step | Implementation |
|------|---------------|
| Step 1 — Admin-only toggle conditional | `apps/web/src/app/dashboard/payroll/[periodId]/_components/ExportTab.tsx:193` (`{isAdmin && (...)}>`) |
| Step 1 — isAdmin prop wiring | `apps/web/src/app/dashboard/payroll/[periodId]/_components/PeriodDetailClient.tsx:200` (`isAdmin={true}`) |
| Step 2 — handleUnmaskedToggle (no immediate flip) | `ExportTab.tsx:110-117` (`handleUnmaskedToggle` → sets confirmDialogOpen, does not set includeUnmasked) |
| Step 3 — UnmaskedConfirmDialog rendered | `ExportTab.tsx:258-262` (dialog rendered at bottom of JSX) |
| Step 3 — UnmaskedConfirmDialog implementation | `apps/web/src/app/dashboard/payroll/[periodId]/_components/UnmaskedConfirmDialog.tsx` |
| Step 4 — Cancel handler | `ExportTab.tsx:124-127` (`handleCancelUnmasked` → sets both to false) |
| Step 5 — Confirm handler | `ExportTab.tsx:119-122` (`handleConfirmUnmasked` → sets includeUnmasked=true, closes dialog) |
| Step 7 — BFF include_unmasked → mask bypass | `packages/payroll-export/src/csv.ts:63-64` (`opts.includeUnmasked ? row.personnummer : maskPersonnummer(...)`) |
| Step 7 — BFF INSERT masked=false | `apps/web/src/app/api/payroll/export-period/route.ts:398` (`masked: !body.include_unmasked`) |
| Step 7 — BFF emit csv_exported | `export-period/route.ts:426-440` |
| Step 7 — BFF emit csv_export_unmasked (conditional) | `export-period/route.ts:442-457` (`if (body.include_unmasked)`) |
| Step 10 — ExportHistoryRow badge for masked=false | `ExportTab.tsx:72-75` (`{row.masked === false && <Badge variant="destructive">Upålitt PII</Badge>}`) |
| mask.ts (personnummer + bankkonto) | `packages/payroll-export/src/mask.ts` (maskPersonnummer + maskBankkonto) |
