---
title: "Plan — avstemming-pages (M7c)"
status: done
updated: 2026-05-02
created: 2026-05-02
module: billing
tags: [plan, billing, admin-ui, settlement, order-system]
---

# Plan — avstemming-pages (M7c)

> Branch: `feat/order-system-avstemming-pages` | Worktree: `/home/sxtnl/dev/smartout.ai-order-system-wt-9` | Base: `campaign/order-system` | Module: billing | Completed: 2026-05-02

## Goal

Build the four-page admin UI on top of M7a/M7b's settlement engine so accountant Erik can launch a monthly settlement run, view its detail, download four artifacts, and see history — all from `admin.smartout.ai`.

---

## Context

This is **M7c** in the order-system campaign milestone sequence:

| Milestone | Scope | Status |
|---|---|---|
| M7a | billing schema — `settlement_run`, `settlement_artifact` | done |
| M7b | `runSettlement` server action + 4 artifact renderers + telemetry | done |
| **M7c** | Admin UI pages (this plan) | **done** |
| M8 | UAT — accountant seed + E2E execution | pending |

5 commits, 15 files, +1697 lines. Typecheck passes.

---

## Tasks

- [x] **Dashboard `/`** — Server Component, 3 cards: `DashboardCTA` (period summary + "Kjør avstemming" CTA), `QuickTasks` (count of pending invoices), `RecentSettlement` (last succeeded run with status + timestamp)
- [x] **`/avstemming/run`** — Server Component fetches all workspaces + last-month default period; renders `RunConfirmation` client form (workspace checkboxes, date pickers, calls `runSettlement` server action, `router.push` to `/avstemming/[run_id]` on success)
- [x] **`/avstemming/[run_id]`** — Server Component; parallel fetches run + artifacts; defense-in-depth ownership check (`initiated_by !== userId` → `notFound()`); renders `SettlementSummaryView` + `ArtifactDownloads`
- [x] **`/avstemming/historikk`** — Server Component, last 50 succeeded/failed runs; `HistoryTable` with "Vis pakke" links per run
- [x] **Sidebar nav** — `AdminSidebarNav` extended with Dashboard and Historikk entries
- [x] **API route `/api/avstemming/[run_id]/artifact/[type]/route.ts`** — auth + RLS ownership check + 60 s signed Supabase Storage URL + telemetry `emit()` + 302 redirect to signed URL
- [x] **Read-side fetchers** in `apps/admin/src/lib/avstemming/fetchers.ts`: `fetchLastSuccessfulRun`, `fetchSettlementRun`, `fetchSettlementArtifacts`, `fetchSettlementHistory`, `countPendingOrders`, `fetchPeriodPreview` (graceful degradation if `compute_period_aggregates` RPC absent)
- [x] **E2E scaffold** `apps/e2e/admin/avstemming.spec.ts` — 4 journeys, 11 tests, all guarded by `test.skip(true, "M8: needs deployed env + accountant seed")`; 1 empty stub for cross-accountant isolation (TODO comment only)
- [x] **Typecheck + ESLint repair** — resolved all type errors and lint warnings (commit `ddc7bc470`)

---

## Acceptance Criteria

- [x] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated — orchestrator handles
- [ ] User journeys written — orchestrator writes `JOURNEY-avstemming.md`
- [ ] Handoff written — orchestrator writes `HANDOFF-avstemming-pages.md`
- [x] E2E scaffold present — execution gated to M8 per campaign plan

---

## Artifact Downloads

The `/avstemming/[run_id]` page exposes four downloadable artifacts via the signed-URL API route:

| `type` param | Label | Format |
|---|---|---|
| `summary_pdf` | Sammendrag | PDF |
| `detail_csv` | Detalj-linjer | CSV |
| `invoice_bundle_pdf` | Faktura-bunke | PDF |
| `discrepancy_pdf` | Avvik-liste | PDF |

---

## Open Debt

| Item | Impact | Resolution path |
|---|---|---|
| `billing` schema absent from `database.types.ts` | `as any` casts in fetchers + API route | Regen types after M7a migration lands in main type-regen pipeline |
| `compute_period_aggregates` RPC may be missing | `fetchPeriodPreview` silently returns zero totals | Implement RPC in M8 schema work or accept silent zeros for UAT |
| E2E execution deferred | 11 tests skipped | Unblock in M8 once accountant seed + auth helper exist |
| Cross-accountant isolation test (spec line 126–128) | 1 empty stub with TODO | Implement alongside M8 auth helper |
