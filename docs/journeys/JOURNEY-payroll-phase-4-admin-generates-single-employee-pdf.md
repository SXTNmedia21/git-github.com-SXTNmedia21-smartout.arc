---
title: "Journey — Admin generates single-employee PDF lønnsgrunnlag"
feature: payroll-phase-4
journey: admin-generates-single-employee-pdf
status: verified
verified_at: 2026-05-08
e2e_test: apps/e2e/tests/payroll-phase-4-pdf-bundle.spec.ts (Group A covers Eksport tab render; LineDrawer single-PDF path is manual-test Flow 2)
created: 2026-05-08
updated: 2026-05-08
module: payroll
tags: [journey, payroll, phase-4, admin, pdf, lonnsgrunnlag, single, line-drawer]
---

# Journey: Admin generates single-employee PDF lønnsgrunnlag

**Role:** admin

**Precondition:**
- Admin logged in at `/dashboard/payroll/[periodId]`
- Period `status = 'locked'`
- At least one `payroll.calculation` row exists for the target profile
- Target profile has an `employee_payroll_profile` row (personnummer + bankkonto data)

## Happy Path

1. Admin opens a locked period → clicks "Linjer" tab in PeriodDetailClient → LinesTable renders with employee rows
2. Admin clicks a row for a specific employee → LineDrawer slides in with that profile's calculation detail
3. Admin sees "Last ned PDF" button at the bottom of the drawer (visible only when `showPdfAction=true` and period is locked)
4. Admin clicks "Last ned PDF" → Button shows "Genererer…" loading state
5. `useGenerateSingle` mutation fires:
   - POSTs to `/api/payroll/generate-pdf-single` with `{ period_id, profile_id }` (credentials: same-origin)
   - BFF Step 1: `rejectCrossOrigin` → `resolvePayrollAuth` (server-derived workspaceId + profileId — ADR-0151)
   - BFF Step 2: `gateAction` (capability=payroll, actionType=generate_pdf_single, ADR-0204)
   - BFF Step 3: Role check — admin path (isAdmin=true), so body `profile_id` can differ from session profile_id
   - BFF Step 4: Verify target profile belongs to same workspace (ADR-0151 forgery defence: `route.ts:121-132`)
   - BFF Step 5: Verify period belongs to workspace + period.status === 'locked' (L-0177)
   - BFF Step 6: Fetch latest calculation row for target profile (MAX calculation_version)
   - BFF Step 7: Fetch PII (`employee_payroll_profile`) + `display_name`
   - BFF Step 8: `generateLonnsgrunnlagPdf(aggregateRow, pdfOpts)` → single PDF buffer
   - BFF Step 9: Upload to `payroll-lonnsgrunnlag` bucket at `{workspaceId}/{periodId}/{profileId}.pdf` (upsert=true)
   - BFF Step 10: INSERT `payroll.export_event` (`row_count=1`, `export_format='pdf'`)
   - BFF Step 11: Pre-sign URL with 24h admin expiry (`expiresInSeconds=86400`)
   - BFF Step 12: `emit("payroll.lonnsgrunnlag_generated", {...})` + `emit("payroll.lonnsgrunnlag_url_granted", {...})` (ADR-0134)
   - BFF returns `{ ok: true, event_id, signed_url, expires_at, profile_id }`
6. Hook triggers browser download via the returned signed URL or navigates to it
7. PDF opens in viewer: single employee's lønnsgrunnlag with full name, personnummer, bankkonto, hours, totals
8. PDF header reads "Lønnsgrunnlag"; footer contains disclaimer + SHA-256 hash

**Postcondition:**
- `payroll.export_event` row inserted: `export_format='pdf'`, `row_count=1`, `exported_by=<admin_profile_id>` (Bokföringsloven §13)
- PDF uploaded to `payroll-lonnsgrunnlag/{workspaceId}/{periodId}/{profileId}.pdf`
- `activity_trail` contains both `payroll.lonnsgrunnlag_generated` and `payroll.lonnsgrunnlag_url_granted` events

## Error Paths

- **Period not locked:** LineDrawer "Last ned PDF" button disabled (`LineDrawer.tsx:274-287` — `showPdfAction` prop logic); BFF returns 409 if reached directly (`route.ts:147-156`)
- **Employee self-access cross-profile:** Employee trying another profile's PDF → BFF returns 403 `access_denied` (`route.ts:109-118`)
- **Target profile not in workspace:** Admin tries cross-workspace UUID → BFF returns 404 `profile_not_found` (`route.ts:128-131`)
- **Unauthorized (not logged in):** BFF returns 401 `unauthorized` (`route.ts:64-66`)
- **Gate denied:** BFF returns 403 `forbidden: <reason>` (`route.ts:87-92`)
- **No calculation rows for profile:** BFF returns 404 `no_rows` (`route.ts:198-201`)
- **Render error:** BFF returns 500 `render_error` (`route.ts:272-274`)
- **Storage upload failure:** BFF returns 500 `storage_upload_failed` (`route.ts:285-293`)

## Verification

- [x] LineDrawer renders "Last ned PDF" button when showPdfAction=true and period is locked
- [x] useGenerateSingle fires POST to /api/payroll/generate-pdf-single with period_id + profile_id
- [x] BFF derives workspaceId + profileId server-side (ADR-0151)
- [x] BFF verifies target profile is in workspace (ADR-0151 forgery defence)
- [x] Employee cannot access another profile's PDF (403 on mismatch)
- [x] BFF calls gateAction before any write (ADR-0204)
- [x] Admin gets 24h URL; employee gets 1h URL (expiresInSeconds role-switch at route.ts:329)
- [x] Both lonnsgrunnlag_generated and lonnsgrunnlag_url_granted emitted (ADR-0134)
- [x] export_event INSERT is append-only (Bokföringsloven §13 RLS)
- [x] PDF content identical to bundle for same profile (same AggregateRow shape)

## Verification — file:line references

| Step | Implementation |
|------|---------------|
| Step 2 — LineDrawer "Last ned PDF" button | `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx:264-287` |
| Step 4 — Button loading label | `LineDrawer.tsx:287` ("Genererer…" when `isGeneratingSingle`) |
| Step 5 — useGenerateSingle mutation | `apps/web/src/app/dashboard/payroll/[periodId]/_hooks/use-payroll-lonnsgrunnlag.ts:154-170` |
| Step 5 — BFF rejectCrossOrigin + resolvePayrollAuth | `apps/web/src/app/api/payroll/generate-pdf-single/route.ts:60-66` |
| Step 5 — BFF gateAction | `route.ts:79-92` |
| Step 5 — BFF caller role check | `route.ts:97-118` |
| Step 5 — BFF target profile workspace verify | `route.ts:121-132` |
| Step 5 — BFF period lock guard | `route.ts:136-156` |
| Step 5 — BFF single profile calc fetch | `route.ts:171-201` |
| Step 5 — BFF PII + display_name | `route.ts:212-231` |
| Step 5 — BFF generateLonnsgrunnlagPdf | `route.ts:269` |
| Step 5 — BFF storage upload | `route.ts:276-294` |
| Step 5 — BFF INSERT export_event | `route.ts:301-326` |
| Step 5 — BFF signed URL (admin 24h / employee 1h) | `route.ts:329-337` |
| Step 5 — BFF emit lonnsgrunnlag_generated | `route.ts:345-358` |
| Step 5 — BFF emit lonnsgrunnlag_url_granted | `route.ts:361-374` |
| PDF generateLonnsgrunnlagPdf function | `packages/payroll-export/src/pdf.ts` |
