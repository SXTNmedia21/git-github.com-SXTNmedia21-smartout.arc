---
title: "Reports — Gaps & Debt"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: reports
tags: [domain, reports, gaps, debt]
---

# Reports — Gaps & Debt

> The bridge between built and planned. Every claim cited. Code wins.

## 1. Verification method

- **CODE** = grepped, `path:line` cited.
- **ROADMAP / SPEC / PLAN** = target/intent described in ROADMAP.md or a `docs/superpowers/{specs,plans}` source.
- **GAP** = intent with no matching code. **DEVIATION** = code differs from intent. **CONFIRMED** = code matches → lives in spine, not here.

## 2. Working (shipped + verified)

| # | Capability | Evidence (`path:line`) |
|---|---|---|
| W1 | `/dashboard/reports` 5-tab layout | `ReportsPageShell.tsx:97-103` — TABS constant |
| W2 | 4 data hooks (overview/people/staffing/training) | `_hooks/use-report-overview.ts:1`, `use-report-people.ts:1`, `use-report-staffing.ts:1`, `use-report-training.ts:1` |
| W3 | 13 `_components/` (12 tsx + 2 ts) | `ls apps/web/src/app/dashboard/reports/_components/` — 14 files confirmed |
| W4 | AI wizard 7 steps in system prompt | `packages/ai/src/agents/reports.ts:34-69` — `RAPPORTVEIVISEREN` STEPS 1–7 |
| W5 | `custom_report` table + 10 columns + 4 RLS policies | `supabase/migrations/20260301150000_create_custom_report.sql:11-45` |
| W6 | BFF route auth + profile guard | `apps/web/src/app/api/reports-agent/route.ts:34-67` |
| W7 | `gatedMutation` on save_report + delete_report | `packages/ai/src/tools/report/save-report.ts:54`, `delete-report.ts:44` |
| W8 | Botsson tool bridge 7 tools (6 read + 1 nav + 1 drawer) | `_tools/use-reports-tools.ts:8-14` (header comment) |
| W9 | `ReportInsightDrawer` + `OverviewDeepInsights` (insight panel) | `_components/ReportInsightDrawer.tsx`, `_components/OverviewDeepInsights.tsx` |
| W10 | Nordic Split: no hardcoded colors in 5 reports files | `JOURNEY-nordic-split-reports-admin-ser-konsistent-reports.md:11-14` (verification notes) |

## 3. Gaps (planned, not built)

| # | Gap | Severity | Blocking? | Roadmap phase |
|---|---|---|---|---|
| G1 | 7 user journey files missing (F1–F7 from USER-FLOWS.md) | high | yes (blocks `/close-feature` gate) | Phase A |
| G2 | Zero `reports.*` telemetry events in registry | medium | no | Phase B |
| G3 | No Playwright E2E spec for `/dashboard/reports` | medium | no | Phase C |
| G4 | No unit tests for 4 data hooks | low | no | Phase C |
| G5 | No pgTAP tests for `custom_report` RLS policies | low | no | Phase C |
| G6 | No API-key RLS policy on `custom_report` (JWT-only) — by design, but undocumented limit | low | no | Phase D (if public API needed) |
| G7 | `SavedReportsGrid` does not use TanStack Query — uses manual `useState`+`useEffect` pattern (`SavedReportsGrid.tsx:48-87`) | low | no | Phase E refactor |
| G8 | `custom_report` type missing from `database.types.ts` — note at `SavedReportsGrid.tsx:17-21` | medium | no | Next typegen run |

## 4. Debt (built, but owes work)

| # | Debt | Risk | Cost |
|---|---|---|---|
| D1 | `preview_report` aggregates client-side in-memory (`computeMetrics` at `preview-report.ts:119`); no server-side GROUP BY. Scales poorly above ~1000 rows (hard limit at `.limit(1000)` on line `276`). | medium (performance at large workspaces) | rewrite preview-report to use Supabase RPC or views |
| D2 | `ReportsChatPanel` manages conversation history in component state — no persistence. Chat is lost on drawer close. | low | add local storage or server-side session persistence |
| D3 | `reports` capability has no `engine_authority_config` seed — defaults to `gate_action` pass-through per ADR-0189. No explicit governance rule. If authority behavior needs to change, there's no existing seed to update. | low | add seed when governance requirement arises |
| D4 | `custom_report.updated_by` is nullable (`UUID REFERENCES profile`) — updates via AI tools don't always populate it | low | wire `updated_by` in `save_report` UPDATE path if one is added |

## 4b. Deviations (code ≠ spec/plan)

| # | Source spec/plan | Spec said | Code does (`path:line`) | Why |
|---|---|---|---|---|
| DEV-1 | `SMARTOUT_MODULE_10_REPORTS.md` | Planned: deviation motor, daily reconciliation, settlement/OCR, QR routines, KPI alert engine, role/season reconciliation, shift_approval table | Code: ONLY custom_report table + AI builder + 4 static analytics tabs | Scope narrowed — all reconciliation work lives in day-session/billing/procedure-engine. MODULE_10 was a broad spec that predated domain boundaries. |
| DEV-2 | `docs/plans/PLAN-nordic-split-reports.md` | Plan scaffold had `- [ ] Task 1` placeholder — never filled | Code: Nordic Split polish was fully delivered per journey file (2026-04-23) | Plan was an empty scaffold; work happened without filling in the plan file. |

## 5. Overlap with other domains

| # | Overlapping domain | Shared surface | Recommendation | Rationale |
|---|---|---|---|---|
| O1 | **agent-harness** | `packages/ai/src/agents/reports.ts` + `packages/ai/src/tools/report/` (5 tools) | **CONSOLIDATE-toward-harness** | Specialist agent code lives in agent-harness packages. Reports domain owns the UI surface + BFF proxy + `custom_report` table. Reports domain LINKS to agent-harness; it does NOT own reports.ts. This is the primary ownership seam. |
| O2 | **core-structure** | `/dashboard/reports` is a child route of `/dashboard/` (dashboard shell owned by core-structure) | **KEEP** | DashboardShell (core-structure) wraps; reports is a child route. Clear author/consumer. No ownership conflict. |
| O3 | **payroll** | Payroll exports (A-melding/Tripletex CSV/PDF) could surface in reports UI as "see also" | **KEEP** | Payroll exports stay in payroll domain code. Reports UI may link as "see also" but does NOT absorb payroll export surfaces. |
| O4 | **billing** | Billing PDFs/CSV exports could surface in reports UI | **KEEP** | Same as O3 — billing exports stay in billing domain. |
| O5 | **botsson** | `ReportsToolsBridge` uses `useRegisterTools("reports", tools)` — registers with Botsson tool registry | **KEEP** | Botsson SURFACES tools; reports domain DEFINES the tool implementations. Seam is `useRegisterTools`. ADR-0238 governs chat ownership boundary. |
| O6 | **business-intelligence** | `packages/ai/src/capabilities/business-intelligence/` (future domain, currently exists in code) | **SPLIT-pending** | BI capability is a separate domain. Reports domain does NOT absorb it. BI pending its own `pre` run. If BI tools are added to the AI builder in future, the ownership boundary must be explicit. |
| O7 | **day-session (operations-intelligence)** | `packages/ai/src/capabilities/operations-intelligence/` — read-side KPI aggregations used in day-session domain | **SPLIT-pending** — owned by day-session | Operations-intelligence capability belongs to day-session (cited in `docs/domains/day-session/ARCHITECTURE.md:185`). Reports domain does NOT claim it. If reports hooks later use ops-intelligence data, it is a read-consumer relationship only. |
| O8 | **training** | `protocol_assignment` data read by `use-report-training.ts` | **KEEP** | Training owns `protocol_assignment` schema. Reports reads via RLS-scoped Supabase query. Clear read-only consumer relationship. |

## Spec/plan reconciliation

| # | Source | Path | Verdict | Evidence |
|---|---|---|---|---|
| SP-1 | `SMARTOUT_MODULE_10_REPORTS.md` | `docs/architecture/modules/SMARTOUT_MODULE_10_REPORTS.md` | **Partial CONFIRMED + DEVIATION** | Custom report builder (custom_report + AI agent + 4 tabs) = CONFIRMED. All reconciliation/settlement/deviation scope = DEVIATION (lives in other domains). Migration_status: pending. |
| SP-2 | `PLAN-nordic-split-reports.md` | `docs/plans/PLAN-nordic-split-reports.md` | **GAP-as-scaffold** | Plan file is an empty scaffold (no tasks filled). Work delivered via journey file instead. No actual spec content to reconcile. |
| SP-3 | `JOURNEY-nordic-split-reports` | `docs/journeys/JOURNEY-nordic-split-reports-admin-ser-konsistent-reports.md` | **CONFIRMED** | Journey verified 2026-04-23: 0 zinc/gray/slate in 5 reports files; typecheck 0 errors; Nordic Split tokens applied. |
| SP-4 | ADR-0115 | `docs/decisions/0115-rsc-migration-pattern-dashboard-routes.md:103` | **CONFIRMED** | `/dashboard/reports` listed as migrated to RSC pattern in ADR. Confirmed by Server Component entrypoint at `page.tsx:23`. |

Spec/plan reconcile totals: **2 Confirmed · 1 Deviation · 1 Gap-as-scaffold**
