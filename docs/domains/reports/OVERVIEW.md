---
title: "Reports — Overview"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: reports
tags: [domain, reports, overview]
---

# Reports — Overview

> What this domain is and why it exists. **Code wins** — if this contradicts code, update here.

## 1. What it is

The reports domain is the **analytics and custom report read-surface** for workspace managers and admins. It gives them a structured view of their workforce across four lenses — Overview, People, Staffing, and Training — plus an AI-driven custom report builder where they can define ad-hoc queries against workspace data, preview results, and save reports for later access.

The domain surfaces real-time aggregations (fetched client-side from Supabase) and a conversational AI assistant (Mr. Botsson personality, Claude Sonnet 4.6 via OpenRouter) that walks through a 7-step wizard: choose data source → pick metrics → set grouping → add filters → choose visualization → preview → save.

This is **not** a reconciliation or settlement domain. Daily reconciliation (`daily_reconciliation`) lives in day-session. Payroll settlement lives in payroll. Billing PDFs/CSV live in billing. HMS reports live in hms. The reports domain is a workspace-internal analytics surface only.

## 2. Cascade placement

Reports is a **C2 agent-utility / read-surface**, not a cascade dimension.

| Cascade layer | Relationship |
|---|---|
| C2 Agent-Utility | Primary — the AI custom report builder is a C2 agent-utility capability (user-directed, personal productivity, `custom_report` rows scoped to workspace) |
| C1 Observability | Secondary read consumer — the 4 static tabs aggregate data that feeds C1 calibration insights (workforce readiness, staffing gap, training completion) |
| D1–D6 | **READ ONLY** — reports never writes to any D-dimension table. It reads `profile` (D2), `department` (D1), `schedule_shift` (D6), `protocol_assignment` (governance/training) |

The domain does NOT have its own cascade pipeline step, trigger, or engine process. It is a pure read-surface + one write (saving a custom report to `custom_report`).

This distinction is important: unlike procedure-engine (which authors D6 content) or year-wheel (which seeds D1 rows), reports **only observes**. It is the dashboard telescope, not a control plane.

## 3. Boundaries

**Owns:**
- Dashboard route `/dashboard/reports` and all sub-components (`_components/`, `_hooks/`, `_tools/`)
- BFF route `/api/reports-agent` (thin auth+profile proxy to the agent; does NOT own the agent logic)
- `custom_report` table in `public` schema — the only write the domain performs
- Telemetry events under `reports.*` namespace (currently ZERO — see GAPS)

**Does NOT own:**
- Specialist AI agent: `packages/ai/src/agents/reports.ts` → **agent-harness domain**
- Report tools layer: `packages/ai/src/tools/report/` (5 tools) → **agent-harness domain**
- `packages/ai/src/capabilities/business-intelligence/` → **business-intelligence domain (pending pre)**
- `packages/ai/src/capabilities/operations-intelligence/` → **day-session domain** (read-side KPI aggregations for sessions)
- Per-domain inline KPI strips on `/dashboard/` home → **core-structure domain**
- Payroll exports (A-melding/Tripletex), billing PDFs/CSV → **payroll / billing domains**
- HMS compliance reports → **hms domain**
- Daily reconciliation / deviation reporting → **day-session domain**

## 4. Key invariants

1. **preview before save** — `preview_report` is always called before `save_report`. Enforced by agent `SYSTEM_PROMPT` rule at `packages/ai/src/agents/reports.ts:64`.

2. **workspace_id auth-derived** — workspace_id in the BFF is resolved from `auth.uid()` → profile lookup (ADR-0151). Not from request body. Enforced at `apps/web/src/app/api/reports-agent/route.ts:55-67`.

3. **RLS workspace-scoped** — `custom_report` uses `get_workspace_ids_for_user(auth.uid())` for all 4 policies (SELECT/INSERT/UPDATE/DELETE). No API-key policy — internal dashboard feature only. Migration `supabase/migrations/20260301150000_create_custom_report.sql:25-45`.

4. **Botsson bridge: no writes** — the `ReportsToolsBridge` registers 7 tools, 6 are read-only, 1 opens a UI drawer. No data writes from the bridge. Comment at `apps/web/src/app/dashboard/reports/_tools/use-reports-tools.ts:22-23`.

5. **No chat surface ownership** — the reports page does NOT declare `DomainChatOwnership` (ADR-0238). `owns_chat_surface=false` per comment at `apps/web/src/app/dashboard/reports/_tools/use-reports-tools.ts:24` and `apps/web/src/app/dashboard/reports/_tools/reports-tools-bridge.tsx:13`.
