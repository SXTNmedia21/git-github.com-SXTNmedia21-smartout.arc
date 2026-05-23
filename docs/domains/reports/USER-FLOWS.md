---
title: "Reports — User Flows"
status: in_progress
mirror: mixed
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: reports
tags: [domain, reports, user-flows, journeys]
---

# Reports — User Flows

> Flow index. **Links** to `docs/journeys/<slug>/` — does NOT duplicate journey content here.
> `mirror: mixed` — one journey file exists (Nordic Split polish), core flows not yet authored.

## Flow index

| # | Flow | Role | Journey file | Status |
|---|---|---|---|---|
| F1 | View Overview tab (KPI + trend + dept stats) | manager/admin | (not-yet-authored) `JOURNEY-reports-view-overview` | MISSING |
| F2 | View People tab (headcount by status/role) | manager/admin | (not-yet-authored) `JOURNEY-reports-view-people` | MISSING |
| F3 | View Staffing tab (shift coverage + capacity) | manager/admin | (not-yet-authored) `JOURNEY-reports-view-staffing` | MISSING |
| F4 | View Training tab (protocol completion readiness) | manager/admin | (not-yet-authored) `JOURNEY-reports-view-training` | MISSING |
| F5 | Build custom report via AI wizard | admin | (not-yet-authored) `JOURNEY-reports-build-custom-report` | MISSING |
| F6 | View saved report from "Mine rapporter" | manager/admin | (not-yet-authored) `JOURNEY-reports-view-saved-report` | MISSING |
| F7 | Delete saved report | admin | (not-yet-authored) `JOURNEY-reports-delete-report` | MISSING |
| F8 | Botsson navigates to reports tab | employee/manager | (not-yet-authored) `JOURNEY-reports-botsson-nav` | MISSING |
| — | Nordic Split design polish (design tokens) | admin | [`JOURNEY-nordic-split-reports-admin-ser-konsistent-reports`](../../journeys/JOURNEY-nordic-split-reports-admin-ser-konsistent-reports.md) | verified (2026-04-23) — design-only |

## Flow narratives (pre-journey stub)

### F5 — Build custom report via AI wizard

**Precondition:** Admin is logged in; workspace has data (profiles, shifts, or protocol assignments).

1. Admin clicks "AI Assistent" button in page header → `AiReportDrawer` opens (Sheet, 420px, `apps/web/src/app/dashboard/reports/_components/AiReportDrawer.tsx:27`)
2. `ReportsChatPanel` renders inside the sheet → user types a question or request
3. Panel POSTs to `/api/reports-agent` with `workspaceId + userMessage + conversationHistory`
4. BFF verifies auth + profile membership → delegates to `runReportsAgent`
5. Agent calls `list_data_sources` (step 1) → presents options in chat
6. Agent guides user through steps 2-5 (metrics → grouping → filters → visualization)
7. Agent calls `preview_report` (step 6) → result streams back; `ReportViewer` renders in "Mine rapporter" tab
8. User approves preview → agent calls `save_report` (step 7) → `custom_report` row inserted; `refreshKey` incremented → `SavedReportsGrid` refetches
9. Confirmation displayed in chat panel

**Error paths:**
- Auth failure → 401 from BFF → chat panel shows error state
- User not workspace member → 403 from BFF → chat panel shows error state
- Zod validation failure (message too short/long) → 400 from BFF → error in chat
- `gatedMutation` denied → agent returns JSON `{ error: "Kunne ikke lagre..." }` → chat shows denial message
- Database error → agent returns `{ error: "Database query failed: ..." }` → shown in chat

### F6 — View saved report

**Precondition:** At least one `custom_report` row exists for the workspace.

1. User navigates to `/dashboard/reports` → opens "Mine rapporter" tab
2. `SavedReportsGrid` fetches from `custom_report` WHERE `workspace_id = workspaceId` (Supabase browser client, RLS-enforced)
3. Grid renders `ReportCard` for each report (name, description, visualization type, pin status)
4. User clicks a report card → `onSelectReport` fires → `activeReportData` set → `ReportViewer` renders above the grid

**Error path:**
- Network error fetching reports → grid shows "Noe gikk galt" error state with refresh button

### F7 — Delete saved report

**Precondition:** Report exists in "Mine rapporter" tab.

1. User opens AI assistant and asks to delete a report
2. Agent calls `delete_report` with `report_id` — but agent MUST confirm with user first (system prompt rule at `packages/ai/src/agents/reports.ts:67`)
3. Agent verifies report exists in workspace (pre-check at `packages/ai/src/tools/report/delete-report.ts:33-39`)
4. `gatedMutation` runs → DELETE executed if approved
5. Agent confirms deletion; "Mine rapporter" grid reflects change on next open

**Error path:**
- Report not found → agent returns `{ error: "Fant ikke rapporten" }`
- `gatedMutation` denied → error message in chat
