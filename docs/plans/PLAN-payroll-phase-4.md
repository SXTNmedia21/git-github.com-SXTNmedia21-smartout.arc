---
title: "Plan — payroll-phase-4 (PDF Lønnsgrunnlag)"
feature: payroll-phase-4
spec: docs/modules/payroll/PHASES.md#phase-4--pdf-lønnsgrunnlag
status: in_progress
updated: 2026-05-08
created: 2026-05-08
module: payroll
tags: [plan, payroll, phase-4, pdf, lonnsgrunnlag, mobile-parity, signed-urls, pii-reveal]
---

# Plan — payroll-phase-4

> Branch: `feat/payroll-payroll-phase-2` (continued — combined Phase 2+3+4 PR) | Worktree: `/home/sxtnl/dev/smartout.ai-payroll-wt-1` | Module: payroll

**Spec:** [Phase 4 — PDF Lønnsgrunnlag](../modules/payroll/PHASES.md#phase-4--pdf-lønnsgrunnlag)

## Critical positioning (load-bearing)

- Smartout produces **lønnsgrunnlag** — wage basis document. NOT lønnsslipp.
- PDF header MUST read "Lønnsgrunnlag", never "Lønnsslipp".
- Out of scope inside the PDF: tabelltrekk, net pay, A-melding inntektskoder, OTP split. Accountant produces those downstream.
- See memory `feedback_lonnsgrunnlag_not_lonnsslipp.md` and ADR-0292/0293.

## Journeys (the contract)

- `JOURNEY-payroll-phase-4-admin-generates-pdf-bundle` — Admin opens locked period → Eksport tab → "PDF lønnsgrunnlag (alle ansatte)" → bundle ZIP/multi-PDF generated → download triggered
- `JOURNEY-payroll-phase-4-admin-generates-single-employee-pdf` — Admin opens LineDrawer for one profile → "Last ned PDF" → single PDF generated with that profile's lønnsgrunnlag
- `JOURNEY-payroll-phase-4-employee-views-own-lonnsgrunnlag-mobile` — Employee on mobile opens `(me)/payroll/lonnsgrunnlag-detail` → signed URL fetched → PDF renders inline
- `JOURNEY-payroll-phase-4-signed-url-expiry-rejects` — Expired URL accessed → 403 + clear error toast → user prompts admin for new link
- `JOURNEY-payroll-phase-4-pdf-content-matches-csv` — Numbers in PDF for any profile match Lines tab + CSV export to ±0.01 NOK

## Goal

Per-employee PDF lønnsgrunnlag generated from same calculation rows that drive CSV. Bundle (one PDF per profile) for admin handoff to accountant. Single-employee PDF for self-service via mobile + web. Signed-URL gated. Render <5s for 12-employee workspace. Header reads "Lønnsgrunnlag", never "Lønnsslipp".

## Scope

### A. ADR — PDF library choice

Draft `docs/decisions/0294-payroll-pdf-library.md` (verify next free ADR ID first):
- Decision: `@react-pdf/renderer` (vs Remotion vs Puppeteer)
- Rationale: server-side render, no headless browser, deterministic, small footprint, JSX-based templating works with Nordic Split tokens via inline styles
- Trade-off: limited CSS subset, no flexbox-gap, but covers receipt-style layouts cleanly
- Consequence: PDF templates live in `packages/payroll-export/src/pdf/` as React components; rendered server-side via `renderToBuffer` in BFF route

### B. Package `@smartout/payroll-export` extension

NEW files in existing package:
- `src/pdf.ts` — `generateLonnsgrunnlagPdf(rows, opts): Promise<Buffer>` + `generateBundlePdfs(rows, opts): Promise<{ profile_id, buffer, filename }[]>`
- `src/pdf/LonnsgrunnlagDocument.tsx` — root template (header "Lønnsgrunnlag", footer with SHA-256 hash)
- `src/pdf/components/Header.tsx` — workspace orgnr + period range + provenance
- `src/pdf/components/EmployeeBlock.tsx` — name + personnummer + bankkonto (mask-aware)
- `src/pdf/components/HoursTable.tsx` — regular / overtime / absence-adjusted
- `src/pdf/components/SupplementsTable.tsx` — per tariff code lines
- `src/pdf/components/TipsTable.tsx` — tip distribution (conditional)
- `src/pdf/components/TotalsBlock.tsx` — brutto total + breakdown
- `src/pdf/components/Footer.tsx` — provenance, SHA-256, "Dette er et lønnsgrunnlag — ikke en lønnsslipp" disclaimer
- `__tests__/pdf.test.ts` — render-to-buffer tests; assert header text, brutto match input, SHA-256 stable

### C. Storage bucket

NEW Supabase storage bucket `payroll-lonnsgrunnlag/` (private). Migration `<ts>_payroll_phase4_storage_bucket.sql`:
- CREATE bucket via `storage.buckets` insert (or `supabase storage` setup)
- RLS: workspace-scoped read; admin can list, employee can read only their own profile_id path
- Path convention: `{workspace_id}/{period_id}/{profile_id}.pdf`

### D. Capability tool extension

`export_period` already exists (Phase 3). Extend args:
- `format: 'csv' | 'pdf'` (was `variant: 'aggregate' | 'audit'` — keep variant for CSV; add format dimension)
- For PDF, variant is N/A (always per-employee). For CSV, format is implicit `csv`.
- Authority unchanged: level=`confirm`, min_role=`admin`, gate=`gate_action`
- Body: when `format='pdf'`, generate bundle, upload each PDF to bucket, return signed-URL list, INSERT export_event with `format='pdf'`

`view_lonnsgrunnlag` (NEW, employee-facing read-only tool):
- Args: `lonnsgrunnlag_id` (= export_event_id)
- Authority: level=`read_only`, min_role=`employee`
- Body: verify employee owns the period (matches their profile_id) OR admin role; fetch signed URL with 1h expiry for employee, 24h for admin
- Emit `payroll.lonnsgrunnlag_url_granted`

### E. BFF routes

- `apps/web/src/app/api/payroll/generate-pdf-bundle/route.ts` (POST) — admin triggers bundle generation, returns array of `{ profile_id, signed_url, filename }`
- `apps/web/src/app/api/payroll/generate-pdf-single/route.ts` (POST) — single profile PDF
- `apps/web/src/app/api/payroll/lonnsgrunnlag-url/route.ts` (GET ?lonnsgrunnlagId=...) — fetches signed URL (auth-checked + expiry-aware)

### F. UI — Web

- `apps/web/src/app/dashboard/payroll/[periodId]/_components/ExportTab.tsx` — extend with "PDF lønnsgrunnlag" section: button "Generer PDF for alle (ZIP/bundle)" + per-row "Last ned PDF" actions in LineDrawer
- `apps/web/src/app/dashboard/my-salary/[lonnsgrunnlagId]/page.tsx` (NEW) — server component, resolves signed URL, renders inline `<iframe>` or PDF.js viewer
- `apps/web/src/app/dashboard/my-salary/page.tsx` (NEW) — list of own historical lønnsgrunnlag entries

### G. UI — Mobile

- `apps/mobile/app/(app)/(me)/payroll/lonnsgrunnlag-detail.tsx` (NEW) — signed URL fetch + native PDF viewer (Expo `expo-print` or web-view fallback)
- `apps/mobile/app/(app)/(me)/payroll/index.tsx` extension — list view of own lønnsgrunnlag

### H. Telemetry

- `payroll.lonnsgrunnlag_generated` — bundle or single, with profile_count + variant
- `payroll.lonnsgrunnlag_url_granted` — signed URL issued (audit-emit, includes expiry)
- `payroll.lonnsgrunnlag_generation_failed`

### I. Out of scope

- Email-attached PDF (defer; SendGrid integration separate)
- Direct Tripletex push of PDF (Phase 7)
- A-melding (out of Smartout scope per 2026-05-08)
- Tax/net pay / lønnsslipp content (accountant)

## Tasks

- [ ] T0.1 — ADR-0294 (or next free ID): PDF library choice + scope
- [ ] T1.1 — `pdf.ts` + `LonnsgrunnlagDocument.tsx` skeleton (header/footer/disclaimer)
- [ ] T1.2 — Sub-components: Header, EmployeeBlock, HoursTable, SupplementsTable, TipsTable, TotalsBlock, Footer
- [ ] T1.3 — `generateLonnsgrunnlagPdf` + `generateBundlePdfs` core
- [ ] T1.4 — SHA-256 footer + provenance block
- [ ] T1.5 — Tests: golden render-to-buffer fixtures (assert header text "Lønnsgrunnlag", footer disclaimer, brutto match, SHA-256 stable across runs with same input)
- [ ] T2.1 — Migration: storage bucket `payroll-lonnsgrunnlag` + RLS
- [ ] T2.2 — Telemetry registry: 3 phase-4 events
- [ ] T3.1 — Capability tool: extend `export_period` for `format='pdf'` + bundle handling
- [ ] T3.2 — Capability tool: NEW `view_lonnsgrunnlag` read-only employee tool
- [ ] T3.3 — BFF route: `/api/payroll/generate-pdf-bundle`
- [ ] T3.4 — BFF route: `/api/payroll/generate-pdf-single`
- [ ] T3.5 — BFF route: `/api/payroll/lonnsgrunnlag-url` (signed URL)
- [ ] T4.1 — Hook: `use-payroll-lonnsgrunnlag` (TanStack mutation: bundle / single, query: signed URL)
- [ ] T4.2 — UI Web: ExportTab extension — "PDF lønnsgrunnlag" section
- [ ] T4.3 — UI Web: LineDrawer per-profile "Last ned PDF" action
- [ ] T4.4 — UI Web: `/dashboard/my-salary/page.tsx` list + `[lonnsgrunnlagId]/page.tsx` detail (PDF viewer)
- [ ] T5.1 — UI Mobile: `(me)/payroll/lonnsgrunnlag-detail.tsx` (native PDF view)
- [ ] T5.2 — UI Mobile: `(me)/payroll/index.tsx` extension (list)
- [ ] T6.1 — E2E: admin bundle round-trip
- [ ] T6.2 — Manual test: open PDF in Adobe Reader + Preview + iOS Files
- [ ] T7.1 — Journey verification (5/5 status: verified)
- [ ] T7.2 — HANDOFF + MANUAL-TEST-payroll-phase-4
- [ ] T7.3 — Decision-log update for ADR-0294

## Acceptance Criteria

- [ ] Render time <5s for 12-employee workspace bundle
- [ ] PDF header reads "Lønnsgrunnlag" — NOT "Lønnsslipp" (golden test asserts)
- [ ] Footer disclaimer "Dette er et lønnsgrunnlag — ikke en lønnsslipp" present
- [ ] PDF renders correctly on iOS/Android mobile + Chrome/Safari/Firefox web
- [ ] Norwegian formatting throughout (numbers, dates, currency)
- [ ] Personnummer + bankkonto visible by default (it IS lønnsgrunnlag content per spec); audit-emit on each generation
- [ ] SHA-256 verification footer present on every PDF
- [ ] Storage signed URLs expire correctly; expired URL returns 403
- [ ] Numbers in PDF match Lines tab + CSV ±0.01 NOK (cross-validated)
- [ ] Locked-period guard: PDF generation rejected if period.status !== 'locked'
- [ ] All 5 declared journeys → status: verified
- [ ] Typecheck green: web + mobile + @smartout/ai + @smartout/payroll-calculate + @smartout/payroll-export

## Open questions

- Q1: Bundle as ZIP, multi-PDF download, or single concatenated PDF? Default: ZIP via `jszip` for clean per-profile separation. Decide during T1.3.
- Q2: Mobile PDF viewer — Expo `expo-print` (native) vs WebView fallback? Native preferred for offline cache; verify Expo SDK supports.
- Q3: View-only tool `view_lonnsgrunnlag` — does employee mobile app already have a payroll capability registered? Check `packages/ai/src/capabilities/payroll/index.ts` registration; if not, add capability binding for employee role.
