---
title: "Manual Test — payroll-phase-4 (PDF Lønnsgrunnlag)"
status: done
updated: 2026-05-08
created: 2026-05-08
module: payroll
tags: [manual-test, payroll, phase-4, pdf, lonnsgrunnlag, signed-url, mobile]
---

# Manual Test — payroll-phase-4

> Branch: `feat/payroll-payroll-phase-2` (combined Phase 2+3+4 PR) | Worktree: `/home/sxtnl/dev/smartout.ai-payroll-wt-1`
> Prerequisite: a locked payroll period with at least one payroll.calculation row.

---

## Prerequisite: Create or lock a period

If no locked period exists in local Supabase:

1. Log in as admin → `/dashboard/payroll`
2. Create a period if none exists (or use the seeded demo period)
3. Add at least one employee calculation row:
   - Click Beregn (recalculate) on an open period with shift data, OR
   - Manually insert a `payroll.calculation` row via Supabase Studio
4. Lock the period: click "Lås periode" → confirm in modal
5. Verify period badge shows "Låst" before proceeding

Also required for mobile flows:
- Employee test account (status=active, role=employee) with a `payroll.export_event` row (format='pdf') for the locked period

---

## Flow 1 — Admin generates PDF bundle from locked period

**Goal:** Admin generates a PDF lønnsgrunnlag for all employees in a locked period; each PDF header reads "Lønnsgrunnlag" and footer contains the disclaimer.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as admin → `/dashboard/payroll` | Period list renders |
| 2 | Click a locked period row | Opens `/dashboard/payroll/<uuid>` |
| 3 | Click "Eksport" tab | ExportTab renders with CSV section and PDF section |
| 4 | Scroll to "PDF lønnsgrunnlag (per ansatt)" section | Section heading visible; subtitle shows path pattern `{workspace_id}/{period_id}/{profile_id}.pdf` |
| 5 | Verify "Generer PDF for alle ansatte" button is ENABLED | Period is locked — button active |
| 6 | Click "Generer PDF for alle ansatte" | Button shows "Genererer PDFer…" (loading state) |
| 7 | Wait for success (up to 30s for 12-employee workspace) | "N PDFer generert" label appears; list of per-employee rows renders |
| 8 | Click the download link for one employee | Browser opens / downloads PDF |
| 9 | Open PDF in Adobe Reader, Preview, or browser | PDF opens without error |
| 10 | Check PDF header area | Text reads "Lønnsgrunnlag" — NEVER "Lønnsslipp" |
| 11 | Check PDF footer | "Dette er et lønnsgrunnlag — ikke en lønnsslipp" disclaimer present |
| 12 | Check footer metadata | SHA-256 hash printed; `generatedAt` timestamp visible |
| 13 | Check Supabase Studio → `payroll.export_event` | New row: `export_format='pdf'`, `masked=false`, `row_count=N`, `file_hash=<combinedHash>` |
| 14 | Check `activity_trail` | `payroll.lonnsgrunnlag_generated` event with non-null `workspace_id` + `actor_id` |

### PDF content checklist

- [ ] Header text is "Lønnsgrunnlag" (not "Lønnsslipp")
- [ ] Workspace name + org number in header block
- [ ] Period start_date — end_date range displayed
- [ ] Employee name visible in EmployeeBlock
- [ ] Personnummer visible (full, not masked — this is a lønnsgrunnlag, not public data)
- [ ] Bankkonto visible
- [ ] HoursTable: regular hours, overtime, absence
- [ ] TotalsBlock: brutto total
- [ ] Footer disclaimer: "Dette er et lønnsgrunnlag — ikke en lønnsslipp"
- [ ] Footer SHA-256 hash present
- [ ] NO net pay (trekk), NO skatt, NO A-melding inntektskoder — out of scope

---

## Flow 2 — Admin generates single PDF via LineDrawer

**Goal:** Admin opens the LineDrawer for one employee and triggers a single-profile PDF download.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as admin → locked period detail page | Period detail open |
| 2 | Click "Linjer" tab | LinesTable renders with employee rows |
| 3 | Click a row to open LineDrawer | Drawer slides in with employee details |
| 4 | Verify "Last ned PDF" button visible in drawer | Button rendered; `LineDrawer.tsx:287` |
| 5 | Verify button label | "Last ned PDF" (not "Last ned lønnsslipp") |
| 6 | Click "Last ned PDF" | Button shows "Genererer…" (loading state) |
| 7 | Wait for success | Button resets; drawer may close or remain open |
| 8 | Locate the downloaded PDF | Browser download bar or Downloads folder |
| 9 | Open PDF | Same content checks as Flow 1 — single-profile PDF |
| 10 | Verify this is only one employee's data | EmployeeBlock shows only the selected profile |
| 11 | Check Supabase Studio → `payroll.export_event` | New row: `row_count=1`, `exported_by=<admin_profile_id>` |

---

## Flow 3 — Employee views own lønnsgrunnlag on mobile

**Goal:** Employee uses the mobile app (PWA on localhost:8083) to view their own signed PDF.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Ensure a `payroll.export_event` row exists for the employee's profile (format='pdf') | Row created by admin bundle or single-PDF flow |
| 2 | Log in as employee on mobile PWA (port 8083) | App opens, bottom nav visible |
| 3 | Navigate to Me → Payroll (or follow route to `(me)/payroll`) | Payroll list renders |
| 4 | Tap the lønnsgrunnlag item for the locked period | Navigates to `lonnsgrunnlag-detail.tsx` |
| 5 | Wait for loading to complete | Document card appears; "Last ned" button visible |
| 6 | Verify document card title | "Lønnsgrunnlag — {periodLabel}" |
| 7 | Verify "Signert dokument" badge | ShieldCheck icon + badge text visible |
| 8 | Tap "Last ned" | Haptic feedback; system browser or Files app opens |
| 9 | Verify PDF opens in system viewer (iOS Files / Android Downloads) | No error; no inline render (by design — expo-linking, no WebView) |
| 10 | Check footer disclaimer visible in PDF | Same disclaimer as web Flow 1 |
| 11 | Return to app → tap "Oppdater" | useLonnsgrunnlagUrl refetches; new signed URL returned |

**Note:** Mobile viewer uses `expo-linking` (system browser / Files app). There is no inline rendering. The user momentarily leaves the app — this is the expected behaviour per the Wave D trade-off (no `react-native-webview` dependency).

---

## Flow 4 — Signed URL expiry rejects access

**Goal:** Verify that an expired signed URL returns a 403 and the error state is surfaced.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Obtain a signed URL for an employee PDF | Retrieve from `payroll.export_event` or `/api/payroll/lonnsgrunnlag-url` |
| 2 | Wait >1 hour (employee URL: 3600s expiry) OR manually edit Supabase Storage bucket policy to reduce expiry for testing | URL becomes invalid |
| 3 | Attempt to fetch the signed URL directly in a browser or with curl | HTTP 403 response from Supabase Storage |
| 4 | In the mobile app: tap "Last ned" on an expired URL | `isUrlExpired()` check triggers → `refetch()` is called automatically |
| 5 | In the web viewer: navigate to `/dashboard/my-salary/<eventId>` with an expired URL | Error state surfaced; toast with retry option |
| 6 | Request a new URL via the app "Oppdater" button | New signed URL fetched from BFF; expiry resets |
| 7 | Verify new URL is accessible | PDF opens correctly |

**Admin URL expiry:** 24h (86400s). Employee URL: 1h (3600s). Configured in:
- `generate-pdf-single/route.ts:329` — `expiresInSeconds = isAdmin ? 86400 : 3600`
- `view_lonnsgrunnlag` tool in `packages/ai/src/capabilities/payroll/tools.ts`

---

## Flow 5 — Cross-validation: PDF numbers match CSV

**Goal:** Verify that the brutto total in a generated PDF matches the corresponding CSV export for the same period and profile, to ±0.01 NOK.

| Step | Action | Expected |
|------|--------|----------|
| 1 | On a locked period → Eksport tab | Both CSV and PDF sections visible |
| 2 | Download aggregate CSV (Phase 3 flow) | CSV downloaded with brutto total per employee |
| 3 | Generate PDF bundle (Phase 4) | PDFs generated for same period |
| 4 | Open CSV in Excel — note brutto total for one employee (e.g. 28 500,00) | Decimal comma format |
| 5 | Open that employee's PDF | TotalsBlock visible |
| 6 | Compare brutto total in PDF vs CSV row | Values match ±0.01 NOK |
| 7 | Repeat for 2-3 employees | All values match |

**Basis for parity:** Both CSV (`generateCsv`) and PDF (`generateLonnsgrunnlagPdf`) read from the same `payroll.calculation` rows filtered by `MAX(calculation_version)` per profile. The `AggregateRow` type is shared. Divergence would indicate a bug in either generator.

---

## Flow 6 — Locked-period guard: PDF generation blocked on open period

**Goal:** Verify that "Generer PDF for alle ansatte" is disabled when the period is open.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to an OPEN period (status='open') | Period detail loads with "Beregn" and "Lås" buttons |
| 2 | Click Eksport tab | ExportTab renders |
| 3 | Scroll to "PDF lønnsgrunnlag (per ansatt)" | Helper text "Lås perioden først for å aktivere PDF-generering." visible |
| 4 | Check "Generer PDF for alle ansatte" button | Button is DISABLED (greyed out) |
| 5 | Attempt to bypass via API: POST `/api/payroll/generate-pdf-bundle` with the open period_id | Returns HTTP 409 `{ ok: false, error: "period_not_locked", detail: "Periode er open — PDF-generering krever låst periode." }` |

---

## Flow 7 — Header/footer text verification across platforms

**Goal:** Verify "Lønnsgrunnlag" (not "Lønnsslipp") appears on all platforms.

| Step | Platform | Action | Expected |
|------|----------|--------|----------|
| 1 | Adobe Reader (Windows) | Open admin bundle PDF | Header: "Lønnsgrunnlag"; Footer: disclaimer |
| 2 | Preview (macOS) | Open same PDF | Same; no garbled characters |
| 3 | iOS Files app | Open from mobile lonnsgrunnlag-detail | Same |
| 4 | Browser PDF viewer (Chrome/Firefox) | Open from signed URL | Same |
| 5 | Any platform | Search PDF text for "Lønnsslipp" | ZERO occurrences |
| 6 | Any platform | Search for "payslip" | ZERO occurrences |

---

## Notes for operator

- **Local Supabase required:** Run `npx supabase start` before this test. Do NOT use `op run` wrap for `supabase` commands.
- **Mobile testing is PWA on port 8083.** Never propose QR scan / Expo Go / iOS simulator unless testing native-only feature. Run `pnpm --filter @smartout/mobile dev` to start the PWA.
- **PDF render time:** Target <5s for a 12-employee bundle. If render exceeds 5s, note the employee count and log it — this is an acceptance criterion (currently unmeasured in automated e2e).
- **Personnummer/bankkonto visible by design:** The lønnsgrunnlag IS the PII-bearing document. Admin-generated PDFs always include full PII (`includeUnmasked: true`). This is correct — the accountant needs the data.
- **Unmasked note:** Contrast with CSV Phase 3 which has a masked-by-default toggle. For PDF, there is no masking option — it would defeat the purpose of the document.
- **database.types.ts regen carry:** The `any` casts in BFF routes are carry-debt from Phase 3. If columns appear as `undefined`, run `pnpm gen:types` against local Supabase (without `op run`).
