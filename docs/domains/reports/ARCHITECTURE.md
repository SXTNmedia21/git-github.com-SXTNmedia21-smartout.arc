---
title: "Reports — Architecture"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: reports
tags: [domain, reports, architecture]
---

# Reports — Architecture

> L1–L5 code map. **Code wins** — every claim has a file:line anchor.

## L1 — Entry points

| Surface | File | Pattern | Notes |
|---|---|---|---|
| Web route | `apps/web/src/app/dashboard/reports/page.tsx:23` | Server Component (`withPagePerf` wrapper) | Resolves workspace via `resolveDashboardContext()`, passes `workspaceId` to shell |
| Loading skeleton | `apps/web/src/app/dashboard/reports/loading.tsx:3` | Next.js `loading.tsx` boundary | Renders 3 KPI skeletons + chart skeleton |
| BFF API route | `apps/web/src/app/api/reports-agent/route.ts:28` | App Router Route Handler (POST) | Auth + profile guard → delegates to `runReportsAgent` |

## L2 — Client shell

**`ReportsPageShell.tsx`** (`apps/web/src/app/dashboard/reports/_components/ReportsPageShell.tsx:105`)

The single client shell that owns all page state:
- `activeTab: ReportsTab` — controlled tab, navigable by Botsson via `switchReportTab` tool
- `aiDrawerOpen` — boolean controlling `AiReportDrawer` visibility
- `activeReportData` — holds preview data from the AI builder
- `refreshKey` — incremented on save to trigger `SavedReportsGrid` refetch
- `insightDrawerOpen` / `activeInsight` — controls `ReportInsightDrawer`

Tabs definition at line `97-103`:
```
overview → Oversikt
people   → Medarbeidere
staffing → Bemanning
training → Opplæring
saved    → Mine rapporter
```

Heavy tab components (`OverviewSection`, `PeopleSection`, `StaffingSection`, `TrainingSection`) are `next/dynamic` imported with `ssr: false` so Recharts (~90KB) only ships on tab-click. Anchor: `sectionLoading` constant at line `44`.

## L3 — 13 `_components/` (confirmed by `ls`)

| Component | File | Purpose |
|---|---|---|
| `AiReportDrawer.tsx` | `_components/AiReportDrawer.tsx` | shadcn Sheet wrapper around `ReportsChatPanel` |
| `OverviewDeepInsights.tsx` | `_components/OverviewDeepInsights.tsx` | Deep insights panel for Overview tab |
| `OverviewSection.tsx` | `_components/OverviewSection.tsx` | Overview tab: KPI cards + trend chart + dept stats |
| `PeopleSection.tsx` | `_components/PeopleSection.tsx` | People tab: headcount by status/role charts |
| `ReportCard.tsx` | `_components/ReportCard.tsx` | Single saved-report card (used by `SavedReportsGrid`) |
| `ReportInsightDrawer.tsx` | `_components/ReportInsightDrawer.tsx` | Sliding drawer for insight detail + factor controls |
| `ReportViewer.tsx` | `_components/ReportViewer.tsx` | Renders report data (table/bar/pie/kpi) from AI builder |
| `ReportsChatPanel.tsx` | `_components/ReportsChatPanel.tsx` | Conversational UI sending messages to `/api/reports-agent` |
| `ReportsPageShell.tsx` | `_components/ReportsPageShell.tsx` | Main container (see L2) |
| `SavedReportsGrid.tsx` | `_components/SavedReportsGrid.tsx` | Grid of saved reports; reads `custom_report` directly via supabase client |
| `StaffingSection.tsx` | `_components/StaffingSection.tsx` | Staffing tab: shift coverage + capacity charts |
| `TrainingSection.tsx` | `_components/TrainingSection.tsx` | Training tab: protocol completion + readiness charts |
| `chart-utils.ts` | `_components/chart-utils.ts` | Shared Recharts utility helpers |
| `report-insight-types.ts` | `_components/report-insight-types.ts` | `ReportInsightCard` type definition |

> Note: 12 `.tsx` + 2 `.ts` = 14 files total in `_components/`. The task spec says "13 components" — this is because `chart-utils.ts` and `report-insight-types.ts` are non-component utilities. Verified by `ls apps/web/src/app/dashboard/reports/_components/`.

## L4 — 4 data hooks (`_hooks/`)

Confirmed by `ls apps/web/src/app/dashboard/reports/_hooks/`:

| Hook | File | Data source tables |
|---|---|---|
| `useReportOverview` | `_hooks/use-report-overview.ts:1` | `profile`, `schedule_shift`, `protocol_assignment`, `department` — 4 parallel queries |
| `useReportPeople` | `_hooks/use-report-people.ts:1` | `profile` — headcount by status + role |
| `useReportStaffing` | `_hooks/use-report-staffing.ts:1` | `schedule_shift`, `department_session` — shift coverage |
| `useReportTraining` | `_hooks/use-report-training.ts:1` | `protocol_assignment`, `protocol` — training readiness |

All hooks use TanStack Query (`useQuery`) and the Supabase browser client. Queries are hoisted in `ReportsPageShell` so Botsson tools can access live data before tab chunks load (anchor: "Hoist analytics hooks" comment at `ReportsPageShell.tsx:127`).

## L5 — Botsson tool bridge (`_tools/`)

| File | Purpose |
|---|---|
| `_tools/use-reports-tools.ts:1` | Defines 7 `ClientToolDefinition` objects using `dataRef` + `useMemo` pattern |
| `_tools/reports-tools-bridge.tsx:19` | Thin component: calls `useReportsTools(props)` then `useRegisterTools("reports", tools)` |

**7 tools registered under namespace `"reports"`:**

| Tool | Type | ADR |
|---|---|---|
| `getReportsState` | read | — |
| `getKpiSummary` | read | — |
| `getReportByTab` | read | — |
| `listSavedReports` | read | — |
| `getUnfilledShifts` | read | — |
| `switchReportTab` | navigation (UI mutation only) | ADR-0238 (no chat ownership) |
| `openAiReportAssistant` | UI drawer open | ADR-0238 |

## BFF route — auth and profile guard

`apps/web/src/app/api/reports-agent/route.ts`:

1. **Auth check** (line `34-39`): `supabase.auth.getUser()` → 401 if missing
2. **Input validation** (line `41-52`): Zod `RequestSchema` — `workspaceId` (UUID), `userMessage` (1–10000 chars), `conversationHistory` array
3. **Profile guard** (line `54-67`): SELECT profile WHERE `workspace_id = body.workspaceId AND user_id = auth.uid()` → 403 if not member
4. **Delegate** (line `80-84`): `runReportsAgent({ ctx, userMessage, conversationHistory })`
5. **Response** (line `86-90`): `{ text, reportData, savedReport }`

The BFF is a **thin proxy**. It performs auth/authorization only. All agent logic lives in `packages/ai/src/agents/reports.ts` (agent-harness domain).

## Agent + tools (OUT — agent-harness owns, reports links)

| File | Owner | Notes |
|---|---|---|
| `packages/ai/src/agents/reports.ts` | agent-harness | `runReportsAgent` function; 7-step wizard system prompt (lines 34-69); Claude Sonnet 4.6 via OpenRouter |
| `packages/ai/src/tools/report/list-data-sources.ts` | agent-harness | Static catalog of 6 data sources |
| `packages/ai/src/tools/report/preview-report.ts` | agent-harness | Executes ReportConfig → Supabase queries client-side aggregation |
| `packages/ai/src/tools/report/save-report.ts` | agent-harness | `gatedMutation()` → INSERT `custom_report` |
| `packages/ai/src/tools/report/list-saved-reports.ts` | agent-harness | SELECT `custom_report` |
| `packages/ai/src/tools/report/delete-report.ts` | agent-harness | `gatedMutation()` → DELETE `custom_report` |
| `packages/ai/src/tools/report/types.ts` | agent-harness | `ReportConfig`, `ReportToolContext`, `ReportDataSource` types |
