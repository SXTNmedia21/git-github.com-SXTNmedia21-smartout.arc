---
title: "Journey — Export locked period only (guard)"
feature: payroll-phase-3
journey: export-locked-period-only
status: verified
verified_at: 2026-05-08
e2e_test: apps/e2e/tests/payroll-phase-3-aggregate-export.spec.ts ("should show 'Lås perioden først' helper when period is open")
created: 2026-05-08
updated: 2026-05-08
module: payroll
tags: [journey, payroll, phase-3, admin, csv-export, locked-period, guard]
---

# Journey: Export locked period only (guard)

**Role:** admin or manager

**Precondition:**
- User logged in at `/dashboard/payroll/[periodId]`
- Period `status = 'open'` (not locked)

## Happy Path (the guard working correctly)

1. User navigates to Eksport tab on an open period
2. ExportTab renders with `isLocked = false` (derived from `periodStatus !== "locked"`)
3. User sees:
   - Variant radio group (both radios visible, interaction allowed)
   - "Inkluder upålitt PII" toggle (admin only — visible but irrelevant since download is blocked)
   - Lock-guard helper text: "Lås perioden først for å aktivere CSV-eksport." with Lock icon
   - "Last ned CSV" button is DISABLED (`disabled={!isLocked || isExporting}`)
4. User cannot click the disabled button
5. User reads the helper text and understands they must lock the period before exporting
6. User navigates to period header → clicks "Lås periode" → confirms lock in modal → period transitions to `status='locked'`
7. After lock, user returns to Eksport tab:
   - Helper text is gone
   - Download button is now ENABLED
   - User downloads CSV normally (see aggregate/audit journey)

## Rejected path (API bypass attempt)

1. Attacker directly POSTs to `/api/payroll/export-period` with `period_id` of an open period
2. BFF: `resolvePayrollAuth` → verify period exists in workspace → `period.status !== "locked"` → returns HTTP 409:
   ```json
   {
     "ok": false,
     "error": "period_not_locked",
     "detail": "Periode er open — eksport krever låst periode."
   }
   ```
3. No export_event inserted, no telemetry emitted for the rejected attempt

## Error Paths

- **Period in 'approved' or other non-locked status:** Same guard applies — ExportTab checks `periodStatus === "locked"` exactly
- **Period not found (wrong workspace):** BFF returns 404 `period_not_found` before reaching lock check (L-0177 fail-fast)
- **Period locked between page load and click:** BFF accepts it correctly (period.status is re-read at request time)
- **Period reverted to 'open' (future feature):** If a locked period is unlocked, the UI would reflect the new status on next period data reload

## Verification

- [x] ExportTab reads `periodStatus` prop and derives `isLocked = periodStatus === "locked"` exactly
- [x] Helper text "Lås perioden først" rendered conditionally when `!isLocked`
- [x] Download button `disabled={!isLocked || isExporting}` — cannot be clicked when not locked
- [x] BFF lock guard at `route.ts:117-127` rejects non-locked period with 409 + detail message
- [x] BFF guard runs AFTER workspace scope verification (L-0177 — no silent fallback)
- [x] Hook error handler converts `period_not_locked` to human-readable toast message
- [x] E2E Group A test covers the open-period UI guard

## Verification — file:line references

| Step | Implementation |
|------|---------------|
| Step 2 — isLocked derivation | `apps/web/src/app/dashboard/payroll/[periodId]/_components/ExportTab.tsx:107` (`const isLocked = periodStatus === "locked"`) |
| Step 3 — Helper text conditional render | `ExportTab.tsx:214-220` (`{!isLocked && <div>...Lås perioden først...</div>}`) |
| Step 3 — Helper text content | `ExportTab.tsx:217-219` (Lock icon + "Lås perioden først for å aktivere CSV-eksport.") |
| Step 3 — Button disabled state | `ExportTab.tsx:224` (`disabled={!isLocked || isExporting}`) |
| Step 2 (BFF) — Period lock guard | `apps/web/src/app/api/payroll/export-period/route.ts:117-127` (`if (period.status !== "locked") → 409`) |
| Step 2 (BFF) — 409 detail message | `export-period/route.ts:121-124` (`error: "period_not_locked"`, `detail: "Periode er ${status}..."`) |
| Step 2 (BFF) — Workspace scope verify before lock check | `export-period/route.ts:103-115` (period fetch with `.eq("workspace_id", auth.workspaceId)` → 404 on missing) |
| Hook error message for period_not_locked | `apps/web/src/app/dashboard/payroll/[periodId]/_hooks/use-payroll-exports.ts:116-118` (`errorBody.error === "period_not_locked"` → human message) |
| E2E test (Group A) | `apps/e2e/tests/payroll-phase-3-aggregate-export.spec.ts` ("should show 'Lås perioden først' helper when period is open") |
