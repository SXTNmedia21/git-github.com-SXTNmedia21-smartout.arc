---
title: "Reports — Roadmap"
status: in_progress
mirror: aspirational
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: reports
tags: [domain, reports, roadmap]
---

# Reports — Roadmap

> Forward plan + design intent. **Aspirational** — this describes intent, not built state. Built state lives in ARCHITECTURE + DATA-MODEL. Gaps live in GAPS-AND-DEBT.

## Delivered (confirmed vs code)

| Item | Confirmed in code | Evidence |
|---|---|---|
| `/dashboard/reports` 5-tab layout | ✅ | `ReportsPageShell.tsx:97-103` |
| 4 static analytics tabs (overview/people/staffing/training) with Recharts | ✅ | `_components/OverviewSection.tsx`, `PeopleSection.tsx`, `StaffingSection.tsx`, `TrainingSection.tsx` |
| AI report builder (7-step wizard) via `ReportsChatPanel` + `AiReportDrawer` | ✅ | `reports.ts:34-69`, `AiReportDrawer.tsx`, `ReportsChatPanel.tsx` |
| `custom_report` table + 4 RLS policies | ✅ | migration `20260301150000` |
| `SavedReportsGrid` ("Mine rapporter" tab) | ✅ | `SavedReportsGrid.tsx:60` |
| `ReportViewer` (renders table/bar/pie/kpi) | ✅ | `ReportViewer.tsx` |
| Botsson tool bridge (7 tools, read-only + nav) | ✅ | `use-reports-tools.ts`, `reports-tools-bridge.tsx` |
| `ReportInsightDrawer` (insight detail + factor controls) | ✅ | `ReportInsightDrawer.tsx`, `OverviewDeepInsights.tsx` |
| BFF route `/api/reports-agent` (auth + profile guard) | ✅ | `route.ts:28-94` |
| Nordic Split token sweep (no hardcoded colors) | ✅ | `JOURNEY-nordic-split-reports-admin-ser-konsistent-reports.md` |

## Governing ADRs

| ADR | Scope | Relevance to reports |
|---|---|---|
| ADR-0115 | RSC Migration Pattern for Dashboard Routes | `/dashboard/reports` migrated to Server Component entrypoint (cited as example at ADR-0115:103) |
| ADR-0151 | Workspace ID resolution | `workspace_id` always auth-derived in BFF; never from request body |
| ADR-0189 | Engine authority config default-allow | `reports` capability has no seed → falls through to default-allow (save_report comment at `save-report.ts:26`) |
| ADR-0204 | gatedMutation (SS-5) | `save_report` and `delete_report` route through `gatedMutation` |
| ADR-0238 | DomainChatOwnership | Reports page does NOT declare chat ownership (`owns_chat_surface=false`) |
| ADR-0392 | Domain-steward system | This `pre` run is the first execution for the reports domain |

## Planned phases

### Phase A — Core journey authoring (not started)
Author the 7 missing journey files (F1–F7 from USER-FLOWS.md). These are not optional for `/close-feature` gates.

### Phase B — Telemetry instrumentation (not started)
Register `reports.*` events in `packages/telemetry/src/registry.ts`. Candidates:
- `reports.tab_viewed` — when user opens a tab
- `reports.ai_builder_opened` — when AI drawer opens
- `reports.report_previewed` — when `preview_report` completes
- `reports.report_saved` — when `save_report` succeeds (currently only `activity_trail` via gatedMutation)
- `reports.report_deleted` — when `delete_report` succeeds

### Phase C — E2E test coverage (not started)
Write Playwright spec(s) under `apps/e2e/tests/` covering at minimum:
- F5 (build custom report): open AI drawer → complete wizard → verify `custom_report` row created
- F6 (view saved report): navigate to "Mine rapporter" → verify cards render
- Sidebar navigation to `/dashboard/reports`

### Phase D — Data source expansion (aspirational)
The current `list_data_sources` tool at `packages/ai/src/tools/report/list-data-sources.ts:18` defines 6 static data sources (profiles, departments, teams, locations, protocols, protocol_assignments). Future candidates:
- `schedule_shift` — direct shift analytics
- `session_task` — task completion rates (procedure-engine data)
- `employee_payroll_profile` — cost analytics (requires payroll domain boundary agreement)

### Phase E — Saved report management UI (aspirational)
Currently report management (rename, pin, delete) requires the AI chat flow. A direct UI in "Mine rapporter" (e.g., `ReportCard` context menu) would improve UX.

### Phase F — MODULE_10 full reconciliation scope (deferred, not reports domain)
The original `SMARTOUT_MODULE_10_REPORTS.md` scope includes daily reconciliation, settlement/OCR, deviation motor, KPI dashboard alert engine, QR routines, role/season reconciliation. These are:
- Daily reconciliation → **day-session domain**
- Settlement/OCR → **day-session + billing domains**
- Deviation motor → **day-session domain**
- KPI alert engine → potentially a future `monitoring` domain or `C1` capability
- QR routines → **procedure-engine domain**

None of these belong in the reports domain as scoped. The reports domain remains a read-surface and custom report builder only.

## Legacy sources absorbed

| Source | Status |
|---|---|
| `docs/architecture/modules/SMARTOUT_MODULE_10_REPORTS.md` | Flagged `migration_status: pending, planned_domain: reports` — mark archived after this run. Content partially contradicts current scope (MODULE_10 includes reconciliation/settlement which belongs elsewhere). |
| `docs/architecture/SMARTOUT_MODULE_10_REPORTS_AND_KPIS.md` | Cross-reference with SMARTOUT_MODULE_10 — check for unique content before archiving. |
| `docs/plans/PLAN-nordic-split-reports.md` | Empty plan stub (scaffold only, no real content). Status: `draft`, no tasks filled in. **Confirmed gap**: PLAN-nordic-split-reports is an empty scaffold — the actual Nordic Split work was done and verified via journey file. No spec/plan reconciliation needed (empty). |
