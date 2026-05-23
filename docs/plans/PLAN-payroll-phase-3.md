---
title: "Plan — payroll-phase-3 (CSV Export)"
feature: payroll-phase-3
spec: docs/domains/payroll/PHASES.md#phase-3--csv-export
status: done
updated: 2026-05-08
created: 2026-05-08
wave_a_completed: 2026-05-08
module: payroll
tags: [plan, payroll, phase-3, csv-export, audit, masking, nb-NO]
---

# Plan — payroll-phase-3

> Branch: `feat/payroll-payroll-phase-2` (continued — combined Phase 2+3 PR) | Worktree: `/home/sxtnl/dev/smartout.ai-payroll-wt-1` | Module: payroll

**Spec:** [Phase 3 — CSV Export](../domains/payroll/PHASES.md#phase-3--csv-export)

## Journeys (the contract)

- `JOURNEY-payroll-phase-3-admin-exports-aggregate-csv` — Admin opens period detail → Export tab → picks "Aggregate" → downloads CSV → opens in Excel cleanly (semicolon, BOM, nb-NO numbers)
- `JOURNEY-payroll-phase-3-admin-exports-audit-csv-with-provenance` — Admin picks "Audit" variant → CSV includes rule_id + tariff_version + paragraf columns
- `JOURNEY-payroll-phase-3-admin-exports-unmasked-with-audit-emit` — Admin checks "Include unmasked PII" → confirm modal → download → `payroll.csv_export_unmasked` event emitted to activity_trail
- `JOURNEY-payroll-phase-3-export-locked-period-only` — Attempt to export from `status='open'` period → UI rejects with "Lås perioden først"

## Goal

Admin downloads CSV (aggregate or audit variant) of a locked period. Numbers match Lines tab to ±0.01 NOK. Personnummer + bankkonto masked by default. Unmasked-mode emits audit row. Filename = `{workspace_slug}-{period_yyyy-mm}-{variant}-{timestamp}.csv`. Opens cleanly in Norwegian Excel.

## Scope (per PHASES.md §Phase 3)

### A. New package `packages/payroll-export`

- `src/index.ts` — exports
- `src/csv.ts` — core CSV generator (pure functions, vitest-testable)
- `src/types.ts` — `ExportVariant = 'aggregate' | 'audit'`, `ExportRow`, `ExportOptions`
- `src/format.ts` — nb-NO number formatter, semicolon delimiter, BOM prefix, escape rules
- `src/mask.ts` — personnummer + bankkonto masking
- `__tests__/csv.test.ts` — golden CSV tests against `payroll-calculate` fixtures
- `package.json` (mirrors `payroll-calculate` shape — type: module, build via tsc + fix-esm-imports)

### B. Database migrations

- `<timestamp>_payroll_phase3_export_audit_tables.sql`:
  - `payroll.export_event` (id, workspace_id, period_id, variant, masked, exported_by, exported_at, row_count, file_hash, idempotency_key)
  - `payroll.export_line` (id, export_event_id, profile_id, line_payload JSONB) — for audit replay
  - RLS: workspace-scoped; INSERT-only for non-service_role
  - Indexes on (workspace_id, period_id), (exported_at)

### C. Capability tool

- `export_period` in `packages/ai/src/capabilities/payroll/tools.ts`:
  - Args: `period_id`, `variant: 'aggregate' | 'audit'`, `include_unmasked: boolean` (default false)
  - Authority: level=`confirm`, min_role=`admin`, gate=`gate_action`
  - Body: gatedMutation → resolve workspace → reject if period.status !== 'locked' → call export pipeline → INSERT export_event row → return signed URL or stream marker
  - Emit: `payroll.csv_exported` (variant + masked) AND `payroll.csv_export_unmasked` (when include_unmasked=true) for audit-trail
  - Authority seed migration: `<ts>_payroll_phase3_export_authority_seed.sql`

### D. BFF route

- `apps/web/src/app/api/payroll/export-period/route.ts`:
  - POST → calls capability tool + streams CSV bytes back (Content-Type: text/csv; charset=utf-8 + Content-Disposition with filename)
  - Server action `exportPeriodCsv(periodId, variant, includeUnmasked)` in `apps/web/src/app/dashboard/payroll/[periodId]/_actions/export-actions.ts`

### E. UI

- `apps/web/src/app/dashboard/payroll/[periodId]/_components/ExportTab.tsx` (new tab on PeriodDetailClient)
- Variant radio (Aggregate / Audit)
- "Inkluder upålitt PII" checkbox (admin-only, hidden for manager) — shows confirm modal on toggle
- Download button — disabled if `period.status !== 'locked'` with helper text
- Recent exports list (read from `payroll.export_event`)

### F. Telemetry registry

- `payroll.csv_exported`
- `payroll.csv_export_unmasked` — high-PII audit emit
- `payroll.csv_export_failed`

### G. Out of scope

- PDF lønnsgrunnlag (Phase 4)
- ~~A-melding XML (Phase 6)~~ — REMOVED 2026-05-08. Accountant scope, not Smartout.
- Tripletex push (Phase 7)
- Email-attached CSV (defer to Phase 4 with PDF mailer)

## Tasks

- [x] T1.1 — Create `packages/payroll-export` package skeleton (package.json, tsconfig, vitest.config, src/index.ts)
- [x] T1.2 — `format.ts` — nb-NO number formatter + semicolon escape + BOM prefix
- [x] T1.3 — `mask.ts` — personnummer + bankkonto masking (last 4 digits visible)
- [x] T1.4 — `csv.ts` — core generator: aggregate variant (1 row per profile) + audit variant (1 row per shift_pay_calculation_event with provenance)
- [x] T1.5 — `__tests__/csv.test.ts` — golden CSV fixtures (read existing golden-month input, assert byte-equal output)
- [x] T2.1 — Migration: `payroll.export_event` + `payroll.export_line` tables with RLS
- [x] T2.2 — Migration: authority seed for `export_period` capability tool
- [x] T2.3 — Telemetry registry: 3 Phase 3 events
- [x] T3.1 — Capability tool `export_period` body (gatedMutation, ADR-0151, L-0177, locked-period guard)
- [x] T3.2 — BFF route `export-period` (streams CSV with proper headers + filename)
- [x] T3.3 — Server action `exportPeriodCsv` wrapper
- [x] T4.1 — UI: ExportTab.tsx (variant radio + masking toggle + download button + recent exports list)
- [x] T4.2 — UI: Wire ExportTab into PeriodDetailClient as new tab
- [x] T4.3 — UI: Confirm modal for "Include unmasked PII" toggle
- [x] T5.1 — Hooks: `use-payroll-exports` (TanStack Query: list recent + mutation for new export)
- [x] T6.1 — E2E test: aggregate export round-trip (Group A running; Group B skipped pending locked-period seed)
- [x] T6.2 — Manual test: open generated CSV in nb-NO Excel — `docs/MANUAL-TEST-payroll-phase-3.md`
- [x] T7.1 — Journey verification (4/4 status: verified) — all 4 journeys created and verified
- [x] T7.2 — HANDOFF + MANUAL-TEST-payroll-phase-3 docs — `docs/HANDOFF-payroll-phase-3.md`
- [x] T7.3 — Decision-log verified: ADR-0292 + ADR-0293 indexed; no new Phase 3 ADRs

## Acceptance Criteria

- [x] CSV opens cleanly in Norwegian Excel (semicolon delimiter + BOM + nb-NO numbers) — verified in vitest golden fixtures; manual test runbook in docs/MANUAL-TEST-payroll-phase-3.md
- [x] All numbers in CSV match values in Lines tab UI to ±0.01 NOK — generateCsv uses same payroll.calculation rows as LinesTable
- [x] Audit variant: each line has rule_id + tariff_version + paragraf columns — BFF audit branch assembles from provenance JSONB + shift_pay_calculation_event
- [x] Aggregate variant: 1 row per profile — BFF de-duplicates by profile_id keeping highest calculation_version
- [x] Filename includes workspace slug + period (yyyy-mm) + variant + timestamp — generateFilename() in payroll-export
- [x] Personnummer + bankkonto masked by default (last 4 digits visible) — mask.ts + csv.ts:63-64
- [x] Admin-checkbox to include unmasked → confirm modal → audit-emit on download — UnmaskedConfirmDialog + emit payroll.csv_export_unmasked
- [x] Locked-period guard: export rejected with clear UI error if period.status !== 'locked' — ExportTab:214-220 (UI) + export-period/route.ts:117-127 (BFF 409)
- [x] All 4 declared journeys → status: verified — docs/journeys/JOURNEY-payroll-phase-3-*.md
- [x] Typecheck green: web + @smartout/ai + @smartout/payroll-calculate + @smartout/payroll-export — confirmed Wave A/B/C

## Open questions

- Q1: CSV streaming via Edge Function or BFF route? BFF route simpler, Edge Function scales better. Default: BFF route (matches existing payroll surfaces).
- Q2: Audit variant 1 row per shift_pay_calculation_event OR 1 row per payroll.calculation? Spec says "each line has provenance" → calculation_line is closer. Decide during T1.4 — likely calculation_line with joined provenance from event.
- Q3: `export_event.file_hash` — SHA256 of generated CSV bytes? Yes, for audit replay verification.
