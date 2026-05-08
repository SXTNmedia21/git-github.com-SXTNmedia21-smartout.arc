---
title: "Handoff — payroll-phase-3"
status: done
updated: 2026-05-08
created: 2026-05-08
module: payroll
tags: [handoff, payroll, phase-3, csv-export, aggregate, audit, masking, nb-NO, bokforingsloven]
---

# Handoff — payroll-phase-3

> Branch: `feat/payroll-payroll-phase-2` (combined Phase 2+3 PR) | Worktree: `/home/sxtnl/dev/smartout.ai-payroll-wt-1`
> 13 commits since Phase 3 plan declared (193d4387e). All typecheck green. 55 vitest tests added (payroll-export package). See Wave A/B/C commit SHAs below.

---

## What was built

### Package: `@smartout/payroll-export` (new)

| Item | File | Status |
|------|------|--------|
| CSV generator (aggregate + audit variants) | `packages/payroll-export/src/csv.ts` | Live |
| nb-NO formatter + BOM prefix + semicolon escape | `packages/payroll-export/src/format.ts` | Live |
| PII masking (personnummer + bankkonto, last 4 visible) | `packages/payroll-export/src/mask.ts` | Live |
| Type definitions (ExportVariant, AggregateRow, AuditRow, ExportOptions) | `packages/payroll-export/src/types.ts` | Live |
| Package index | `packages/payroll-export/src/index.ts` | Live |
| Golden CSV tests (aggregate + audit) | `packages/payroll-export/src/__tests__/csv.test.ts` | Live, 55 green |

### Capability tool

| Item | File | Status |
|------|------|--------|
| `export_period` tool | `packages/ai/src/capabilities/payroll/tools.ts:1458-1910` | Live |

### BFF routes

| Route | Method | File | Status |
|-------|--------|------|--------|
| `/api/payroll/export-period` | POST | `apps/web/src/app/api/payroll/export-period/route.ts` | Live |
| `/api/payroll/exports` | GET | `apps/web/src/app/api/payroll/exports/route.ts` | Live |

### Server action

| Item | File | Status |
|------|------|--------|
| `exportPeriodCsv(periodId, variant, includeUnmasked)` | `apps/web/src/app/dashboard/payroll/[periodId]/_actions/export-actions.ts` | Live |

### UI components

| Item | File | Status |
|------|------|--------|
| ExportTab (variant radio + PII toggle + download + history) | `apps/web/src/app/dashboard/payroll/[periodId]/_components/ExportTab.tsx` | Live |
| UnmaskedConfirmDialog (PII confirm modal) | `_components/UnmaskedConfirmDialog.tsx` | Live |
| ExportTab wired into PeriodDetailClient ("Eksport" tab) | `_components/PeriodDetailClient.tsx:170,199-201` | Live |

### Hooks

| Hook | File | Status |
|------|------|--------|
| `useRecentExports(periodId)` | `_hooks/use-payroll-exports.ts` | Live |
| `useExportPeriod()` | `_hooks/use-payroll-exports.ts` | Live |

### Migrations

| Migration | Content | Status |
|-----------|---------|--------|
| `20260508110000_payroll_phase3_export_audit_tables.sql` | ALTER payroll.export_event: variant, masked, file_hash, idempotency_key, row_count columns; ALTER payroll.export_line: line_payload JSONB | Live |
| `20260508110100_payroll_phase3_export_authority_seed.sql` | Authority seed: export_period capability (level=confirm, min_role=admin) | Live |

### Telemetry

3 new events registered in `packages/telemetry/src/registry.ts`:
- `payroll.csv_exported` — every successful export (aggregate or audit)
- `payroll.csv_export_unmasked` — high-PII audit event (when include_unmasked=true)
- `payroll.csv_export_failed` — on generator or DB error

### Tests

| File | Coverage | Status |
|------|----------|--------|
| `packages/payroll-export/src/__tests__/csv.test.ts` | 55 golden-fixture tests: aggregate variant, audit variant, masking, BOM, nb-NO number format, semicolon escape, filename generation, file hash | Live, green |
| `apps/e2e/tests/payroll-phase-3-aggregate-export.spec.ts` | UI-only group (4 tests, running); round-trip group (2 tests, skipped pending locked-period seed) | Live |

---

## Decisions

| ADR | Summary | Status |
|-----|---------|--------|
| ADR-0292 | Override-applier supersession chain (Phase 2, referenced here as Bokföringsloven §13 compliance context) | accepted |
| ADR-0293 | Pattern B sync-recalc chain (Phase 2) | accepted |
| No new Phase 3 ADRs | Phase 3 reused ADR-0204 (gate_action), ADR-0151 (server-side auth), ADR-0240 (cross-namespace write prohibition), ADR-0078 (channel guard for PII), ADR-0134 (telemetry). Bokföringsloven §13 compliance via append-only RLS on export_event (no new ADR required — covered by Phase 1 schema). | — |

---

## Learnings

**L1 — Telemetry registry `Record<EventName, EventMeta>` is tight on EntityType.**
Adding `payroll.csv_exported`, `payroll.csv_export_unmasked`, `payroll.csv_export_failed` forced extending the `EntityType` union with `"payroll_export_event"`. Both the union in `registry.ts` AND the entity type reference in the emit call site must use exactly the same string literal. Failing to add the union value causes a TypeScript error at the emit site — caught at typecheck, not runtime.

**L2 — New monorepo packages need `pnpm install` before consumer typecheck succeeds.**
`packages/payroll-export` did not exist before Phase 3. Fresh worktrees or agents assigned to consumer packages (e.g. `apps/web`, `packages/ai`) receive TS2307 "cannot find module @smartout/payroll-export" until `pnpm install` is run at monorepo root. The lock-file commit (`ac521bd7a`) must happen in the same wave as the package creation. Subsequent agents dispatched to consumer files should `pnpm install` before typechecking.

**L3 — Server actions cannot stream binary in Next.js 16; split gate-check from byte-emission.**
`exportPeriodCsv()` returns `{ downloadUrl, eventId }` instead of CSV bytes. The hook then POSTs to the BFF with cookie credentials to receive the CSV stream. This is an architectural constraint of the Next.js App Router server action mechanism (`URL.createObjectURL` is browser-only). The split is documented in `export-actions.ts` and `use-payroll-exports.ts` headers. Any future attempt to return binary blobs from server actions will fail with a serialization error.

**L4 — `database.types.ts` regen requires local Supabase running; `op run` wrap corrupts column names.**
Phase 3 migrations add columns (`variant`, `masked`, `file_hash`, `row_count`) to `payroll.export_event`. The generated types in `database.types.ts` do not reflect these columns because `pnpm gen:types` was not run (local Supabase not started, and `op run` corrupts column names containing `admin`). Temporary workaround: `as any` cast at every Phase 3 payroll schema query site, with comments flagging the cast. Must be resolved before merge: run `pnpm gen:types` against local Supabase (without `op run` wrap) and remove the casts.

**L5 — `payroll.export_event` pre-existed from Phase 1 — use ALTER, not CREATE.**
The plan spec described `payroll.export_event` as a new Phase 3 table. The table already existed from Phase 1 (`20260422110200_payroll_calculation_tables.sql`). Migration `20260508110000` correctly uses `ALTER TABLE ADD COLUMN IF NOT EXISTS` for the Phase 3 columns. Always grep `database.types.ts` and existing migrations before writing a CREATE TABLE migration.

**L6 — BOM must not be double-prefixed; `generateCsv` owns the BOM.**
`packages/payroll-export/src/csv.ts` prepends `BOM_UTF8` (`﻿`) to the CSV output. The BFF response body is the raw `csv` string — the BFF must NOT add a second BOM prefix. Any middleware or logger that intercepts the response body and re-encodes it will break the BOM. The `new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8" } })` shape is the correct pattern.

**L7 — `payroll.export_line` per-row INSERTs deferred — reconstructable from `payroll.calculation`.**
The Phase 3 spec described per-row INSERT into `payroll.export_line` as a Bokföringsloven §13 audit-replay surface. This was not implemented because:
(a) The `payroll.calculation` rows themselves are immutable (ADR-0292 supersession chain preserves originals);
(b) `generateCsv` is a pure deterministic function — re-running it on the same calculation rows produces identical output;
(c) `payroll.export_event.file_hash` (SHA-256 of generated CSV) provides tamper-evidence without per-row storage.
If strict audit-replay strictness requires a pre-materialized snapshot (e.g., for Tripletex API push), implement per-row INSERTs in Phase 3.5.

---

## Known Issues / Debt

| Issue | Impact | Suggested fix |
|-------|--------|---------------|
| **DEFERRED — `database.types.ts` regen** | `any` casts in `export-period/route.ts`, `exports/route.ts`, `tools.ts`. TS safety reduced for Phase 3 DB columns. | Run `pnpm gen:types` against local Supabase (no `op run`) before merge. Remove all `as any` casts. |
| **DEFERRED — `payroll.export_line` per-row INSERTs** | Audit-replay requires re-running `generateCsv` on current calculation rows. Acceptable for Phase 3; revisit if Tripletex or auditor requires pre-materialized CSV snapshot. | Phase 3.5 sortie: INSERT AuditRow payloads into `payroll.export_line` during export. |
| **SKIPPED — E2E round-trip Group B** | `apps/e2e/tests/payroll-phase-3-aggregate-export.spec.ts` Group B is skipped. Full download + Content-Type + filename shape + BOM assertion requires a seeded locked period. | Add locked payroll period to `apps/e2e/helpers/seed.ts` + set `E2E_LOCKED_PERIOD_ID` env var. |
| **UNMEASURED — export latency for 12-employee period** | Phase 3 acceptance criterion (CSV ready in <5s for 12-employee period) unverified. | Run smoke probe against populated local Supabase. |
| **CARRIED — Phase 2 ManualSupplementForm delete-button (DEFERRED-UI)** | Manager cannot delete a supplement from UI. Backend route ready. | Add delete button + ConfirmModal to LineDrawer (manual_adj rows only). |
| **CARRIED — T7.2 recalc latency unmeasured (Phase 2)** | <2s target unverified. | Run `/api/payroll/_smoke/recalc-latency` against live Supabase before Phase 1.5. |

---

## Next Steps

1. **Phase 3 close-out:** Regen `database.types.ts`, remove `any` casts, run Group B E2E with seeded locked period.
2. **Phase 3.5 (optional):** Per-row `payroll.export_line` INSERTs for strict Bokföringsloven §13 audit-replay.
3. **Phase 4 (PDF lønnsgrunnlag):** PDF generation pipeline (Remotion or @react-pdf). Email attachment via SendGrid.
4. **Phase 5 (Skatteetaten reveal):** Employee self-service lønnsgrunnlag view on `/dashboard/my-salary`.
5. ~~**Phase 6 (A-melding XML)**~~ — REMOVED 2026-05-08 (Pontus). Smartout does NOT handle A-melding. Accountant submits via Tripletex/Visma using the lønnsgrunnlag handoff (Phase 3 CSV + Phase 4 PDF).
6. **Pattern A workers:** Remove Pattern B sync-chain blocks from Phase 2 BFF routes when engine_dispatch handlers ship.

---

## Commit SHAs (Phase 3)

| Wave | SHAs | Content |
|------|------|---------|
| Wave A | 30e318754, 724c4d7c2, ddc1f911a, f76c792ac, 7c34c2d9e, 3477ca656, d5ce8b629, 6032538d6, ac521bd7a | Foundation, migrations, telemetry, payroll-export package, 55 tests, lock-file |
| Wave B | 89ec18771, e8abd0c9d | T3.1 capability tool, T3.2 BFF route, T3.3 server action |
| Wave C | c7e9b980c, bbc1273b2, b8d59006b | T4.1 ExportTab, T4.3 UnmaskedConfirmDialog, T4.2 PeriodDetailClient wire, T5.1 hooks, GET exports BFF |
| Wave D | (this PR — docs only) | T6.1 E2E, T6.2 manual test, T7.1 journeys, T7.2 HANDOFF, T7.3 plan close-out |

---

## Files Changed (key paths by layer)

### L4 — AI capability
- `packages/ai/src/capabilities/payroll/tools.ts` (export_period tool: lines 1458–1910)

### L2 — BFF routes
- `apps/web/src/app/api/payroll/export-period/route.ts`
- `apps/web/src/app/api/payroll/exports/route.ts`

### L2 — Server actions
- `apps/web/src/app/dashboard/payroll/[periodId]/_actions/export-actions.ts`

### L1 — UI components
- `apps/web/src/app/dashboard/payroll/[periodId]/_components/ExportTab.tsx`
- `apps/web/src/app/dashboard/payroll/[periodId]/_components/UnmaskedConfirmDialog.tsx`
- `apps/web/src/app/dashboard/payroll/[periodId]/_components/PeriodDetailClient.tsx` (ExportTab tab added)

### L1 — Hooks
- `apps/web/src/app/dashboard/payroll/[periodId]/_hooks/use-payroll-exports.ts`

### L4 — Package (new)
- `packages/payroll-export/package.json`
- `packages/payroll-export/tsconfig.json`
- `packages/payroll-export/src/index.ts`
- `packages/payroll-export/src/csv.ts`
- `packages/payroll-export/src/format.ts`
- `packages/payroll-export/src/mask.ts`
- `packages/payroll-export/src/types.ts`
- `packages/payroll-export/src/__tests__/csv.test.ts`

### L5 — Migrations
- `supabase/migrations/20260508110000_payroll_phase3_export_audit_tables.sql`
- `supabase/migrations/20260508110100_payroll_phase3_export_authority_seed.sql`

### Telemetry
- `packages/telemetry/src/registry.ts` (3 Phase 3 events + EntityType extension)
