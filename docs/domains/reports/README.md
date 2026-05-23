---
title: "Reports — Domain Index"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: reports
tags: [domain, reports, source-of-truth]
---

# Reports — Source of Truth

> Authoritative folder for the **reports** domain. If code contradicts this folder → **CODE wins**, update these docs.

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| `/dashboard/reports` page (5 tabs) | ✅ | 🟡 | Sidebar link verified; no dedicated Playwright spec |
| 4 data hooks (overview/people/staffing/training) | ✅ | 🔴 | No unit tests |
| 13 `_components/` (incl. AI drawer, chat panel, report viewer) | ✅ | 🔴 | No component tests |
| Botsson tool bridge (7 read + nav tools) | ✅ | 🔴 | No dedicated tests |
| BFF route `/api/reports-agent` (auth + profile guard) | ✅ | 🔴 | No route test |
| `custom_report` table + RLS | ✅ | 🔴 | Schema confirmed; no pgTAP |
| Telemetry `reports.*` namespace | 🔴 | — | Zero events in registry — GAP |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status matrix across all domains: [../_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | Tables, FKs, RLS, telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | mixed | Flow index → journeys |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | Forward plan + ADR/journey refs |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Built-vs-planned delta + overlap edges |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Test = proof of built |

## Agent Guardrails

> Read before touching reports code. Truth lives in this folder.

**Ownership boundary (critical):**
The specialist AI agent itself lives in `packages/ai/src/agents/reports.ts` and is **owned by the agent-harness domain**. The reports domain owns the UI surface, BFF proxy, and `custom_report` table only. Do NOT move `packages/ai/src/agents/reports.ts` into reports domain scope.

**Wizard rule (hard constraint):**
`preview_report` MUST be called before `save_report`. This is encoded in the agent's `SYSTEM_PROMPT` at `packages/ai/src/agents/reports.ts:64` — "Alltid kjør preview_report FØR save_report". Do NOT skip or reorder this step.

**Mutation path (save/delete):**
Both `save_report` and `delete_report` tools route through `gatedMutation()` (ADR-0204). The `reports` capability has no explicit `engine_authority_config` seed — `gate_action` falls through to default-allow per ADR-0189. If you add a seed, test the fallthrough path.

**workspace_id derivation (ADR-0151):**
`workspace_id` in the BFF route and Botsson tool bridge is always auth-derived from the session/prop, never from the request body. File: `apps/web/src/app/api/reports-agent/route.ts:55-67` (profile guard) and `apps/web/src/app/dashboard/reports/_tools/use-reports-tools.ts:54-56` (ADR-0151 comment).

**Not a cascade dimension:**
This domain is a C2 read-surface for analytics. It does NOT own D1–D6 tables. It reads from `profile`, `schedule_shift`, `protocol_assignment`, `department`, etc. Never write to those tables from reports domain code.

**Owning surfaces:**
- Route: `apps/web/src/app/dashboard/reports/`
- BFF: `apps/web/src/app/api/reports-agent/route.ts`
- Tables: `public.custom_report`
- Agent (OUT — harness owns): `packages/ai/src/agents/reports.ts`
- Tools (OUT — harness owns): `packages/ai/src/tools/report/`
