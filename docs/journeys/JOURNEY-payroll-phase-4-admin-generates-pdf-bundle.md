---
title: "Journey — Admin generates PDF lønnsgrunnlag bundle"
feature: payroll-phase-4
journey: admin-generates-pdf-bundle
status: verified
verified_at: 2026-05-08
e2e_test: apps/e2e/tests/payroll-phase-4-pdf-bundle.spec.ts (Group A running; Group B skipped pending locked-period seed)
created: 2026-05-08
updated: 2026-05-08
module: payroll
tags: [journey, payroll, phase-4, admin, pdf, lonnsgrunnlag, bundle]
---

# Journey: Admin generates PDF lønnsgrunnlag bundle

**Role:** admin

**Precondition:**
- Admin logged in at `/dashboard/payroll/[periodId]`
- Period `status = 'locked'`
- At least one `payroll.calculation` row exists for the period
- `employee_payroll_profile` rows with `personal_id_number` + `bank_account_number` for each profile

## Happy Path

1. Admin clicks "Eksport" tab in PeriodDetailClient → System renders ExportTab with both CSV section and "PDF lønnsgrunnlag (per ansatt)" section
2. Admin sees the PDF section heading and storage path convention subtitle (`{workspace_id}/{period_id}/{profile_id}.pdf`)
3. Admin sees "Generer PDF for alle ansatte" button is ENABLED (period is locked)
4. Admin clicks "Generer PDF for alle ansatte" → Button shows "Genererer PDFer…" loading state
5. `useGenerateBundle` mutation fires:
   - POSTs to `/api/payroll/generate-pdf-bundle` with `{ period_id }` (credentials: same-origin)
   - BFF Step 1: `rejectCrossOrigin` → `resolvePayrollAuth` (server-derived workspaceId + profileId — ADR-0151)
   - BFF Step 2: `gateAction` (capability=payroll, actionType=generate_pdf_bundle, ADR-0204)
   - BFF Step 3: Verify period exists in workspace + period.status === 'locked' (L-0177)
   - BFF Step 4: Fetch aggregate calculation rows (latest `calculation_version` per profile)
   - BFF Step 5: Fetch PII (`employee_payroll_profile`) + `display_name` (`profile`)
   - BFF Step 6: `generateBundlePdfs(aggregateRows, pdfOpts)` → renders one PDF per profile via `@react-pdf/renderer`
   - BFF Step 7: Uploads each PDF to `payroll-lonnsgrunnlag` bucket at `{workspaceId}/{periodId}/{profileId}.pdf` (upsert=true for idempotency)
   - BFF Step 8: `computeFileHash(pdfBundle.map(b => b.sha256).join("\n"))` → combined hash
   - BFF Step 9: INSERT `payroll.export_event` (`export_format='pdf'`, `masked=false`, `file_hash=combinedHash`, `row_count=N`, Bokføringsloven §13 append-only)
   - BFF Step 10: Pre-sign each URL with 24h admin expiry
   - BFF Step 11: `emit("payroll.lonnsgrunnlag_generated", { workspaceId, actorId, profile_count: N })` (ADR-0134)
   - BFF returns `{ ok: true, event_id, files: [{ profile_id, path, signed_url, sha256 }] }`
6. ExportTab renders "N PDFer generert" label + `PdfFileRow` list with per-employee download links
7. Admin clicks a per-employee download link → system browser opens the signed URL
8. PDF opens in viewer: header reads "Lønnsgrunnlag", footer contains "Dette er et lønnsgrunnlag — ikke en lønnsslipp" disclaimer + SHA-256 hash

**Postcondition:**
- `payroll.export_event` row inserted: `export_format='pdf'`, `masked=false`, `row_count=N`, `file_hash=<combinedHash>` (Bokføringsloven §13 append-only)
- N PDFs uploaded to `payroll-lonnsgrunnlag` bucket at convention paths
- `activity_trail` contains `payroll.lonnsgrunnlag_generated` emit with non-null `workspace_id` + `actor_id`
- Signed URLs valid for 24h (admin expiry)
- ExportTab shows inline list of generated file rows

## Error Paths

- **Period not locked:** Button disabled + "Lås perioden først for å aktivere PDF-generering." helper text (`ExportTab.tsx:305-312`); BFF returns HTTP 409 `period_not_locked` if reached directly (`generate-pdf-bundle/route.ts:107-116`)
- **Unauthorized (not logged in):** BFF returns 401 `unauthorized` (`route.ts:61-63`)
- **Gate denied:** BFF returns 403 `forbidden: <reason>` (`route.ts:83-88`)
- **Period not in workspace:** BFF returns 404 `period_not_found` (`route.ts:101-104`)
- **No calculation rows:** BFF returns 404 `no_rows` (`route.ts:163-165`)
- **Render error (react-pdf throws):** BFF emits `payroll.lonnsgrunnlag_generation_failed` + returns 500 `render_error` (`route.ts:239-243`)
- **Storage upload failure:** BFF emits `payroll.lonnsgrunnlag_generation_failed` + returns 500 `storage_upload_failed` (`route.ts:261-270`)
- **DB write failure:** BFF emits `payroll.lonnsgrunnlag_generation_failed` + returns 500 `db_write_failed` (`route.ts:318-321`)
- **Duplicate export (idempotency key conflict):** BFF returns 409 `duplicate_export` (`route.ts:315-317`)

## Verification

- [x] ExportTab renders "PDF lønnsgrunnlag (per ansatt)" section when Eksport tab is clicked
- [x] Button disabled + helper text when period is not locked
- [x] Button enabled and triggers `useGenerateBundle` mutation when period is locked
- [x] BFF rejects cross-origin requests (rejectCrossOrigin)
- [x] BFF derives workspaceId + profileId server-side (ADR-0151, resolvePayrollAuth)
- [x] BFF calls gateAction before any write (ADR-0204)
- [x] BFF fails fast on period not found or wrong workspace (L-0177)
- [x] BFF fails fast on period not locked (409, not silent fallback)
- [x] SHA-256 computed as combined hash of per-employee sha256 values (content-hash, not PDF-bytes)
- [x] export_event INSERT is append-only (Bokföringsloven §13 RLS)
- [x] emit() called with non-null workspaceId + actorId (ADR-0134)
- [x] PDF header reads "Lønnsgrunnlag" (golden test in packages/payroll-export asserts)
- [x] PDF footer contains disclaimer (golden test asserts)

## Verification — file:line references

| Step | Implementation |
|------|---------------|
| Step 1 — Eksport tab trigger | `apps/web/src/app/dashboard/payroll/[periodId]/_components/PeriodDetailClient.tsx:170` (TabsTrigger value="export") |
| Step 1 — ExportTab mounted | `PeriodDetailClient.tsx:199-201` (TabsContent value="export") |
| Step 2 — PDF section heading | `apps/web/src/app/dashboard/payroll/[periodId]/_components/ExportTab.tsx:298` |
| Step 3 — Button disabled guard | `ExportTab.tsx:305-312` (lock helper) + `ExportTab.tsx:316` (disabled={!isLocked}) |
| Step 4 — handleGenerateBundle + isGeneratingBundle loading label | `ExportTab.tsx:184-196` + `ExportTab.tsx:321` |
| Step 5 — useGenerateBundle mutation | `apps/web/src/app/dashboard/payroll/[periodId]/_hooks/use-payroll-lonnsgrunnlag.ts:105-127` |
| Step 5 — BFF POST rejectCrossOrigin | `apps/web/src/app/api/payroll/generate-pdf-bundle/route.ts:55-57` |
| Step 5 — BFF resolvePayrollAuth | `route.ts:59-62` |
| Step 5 — BFF gateAction | `route.ts:75-88` |
| Step 5 — BFF period workspace + lock guard | `route.ts:92-116` |
| Step 5 — BFF aggregate rows + de-duplicate | `route.ts:131-165` |
| Step 5 — BFF PII + display_name fetch | `route.ts:176-198` |
| Step 5 — BFF generateBundlePdfs call | `route.ts:238` |
| Step 5 — BFF storage upload loop | `route.ts:250-288` |
| Step 5 — BFF computeFileHash (combined) | `route.ts:291` |
| Step 5 — BFF INSERT export_event | `route.ts:295-321` |
| Step 5 — BFF emit lonnsgrunnlag_generated | `route.ts:328-342` |
| Step 6 — ExportTab file list render | `ExportTab.tsx:325-338` |
| PDF header "Lønnsgrunnlag" | `packages/payroll-export/src/pdf/components/Header.tsx` |
| PDF footer disclaimer | `packages/payroll-export/src/pdf/components/Footer.tsx` |
| PDF SHA-256 in footer | `packages/payroll-export/src/pdf/LonnsgrunnlagDocument.tsx` |
| Golden test — header + disclaimer | `packages/payroll-export/src/__tests__/pdf.test.ts` |
