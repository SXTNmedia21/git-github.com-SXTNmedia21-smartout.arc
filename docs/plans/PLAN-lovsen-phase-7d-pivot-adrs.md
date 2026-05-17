---
title: "Plan — lovsen-phase-7d-pivot-adrs"
status: done
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [plan, payroll, lovsen, dynamic-mcp-fetch, adrs]
---

# Plan — lovsen-phase-7d-pivot-adrs

> Branch: `feat/payroll-lovsen-phase-7d-pivot-adrs` | Worktree: /home/sxtnl/dev/smartout.ai-payroll-wt-4 | Base: `campaign/payroll` | Module: payroll | Started: 2026-05-17

## Goal

Ship 5 ADRs establishing the architectural foundation for the dynamic-MCP-fetch pivot per council 2026-05-17, so Phase 7e (bridge code) and 7f (capability tools + UI) have unambiguous contracts to implement against.

## Tasks

- [x] D1 — Author ADR-0350 (bridge transport: HTTP-via-BFF, capability HTTP client)
- [x] D2 — Author ADR-0351 (tariff floor: UP allowed, DOWN forbidden per Aml. §14-15)
- [x] D3 — Author ADR-0352 (derive_supplement_set MCP contract: Python-owned synthesis)
- [x] D4 — Author ADR-0353 (workspace_framework_binding lifecycle)
- [x] D5 — Author ADR-0354 (freshness ops: heartbeat cron + drift detector)
- [x] D6 — Write 3 learnings (L-0289/0290/0291), council audit doc, 4 ADR amendments (ADR-0341/0342/0348/0349), update decision log (5 rows) + council log

## Acceptance Criteria

- [x] 5 ADRs proposed (ADR-0350 through ADR-0354) — 1225 lines total
- [x] 3 learnings written (L-0289 chair-must-verify-adr-subject, L-0290 nho-cirkulær-primary-date, L-0291 capability-boundary-follows-schema-fk) — 116 lines
- [x] Council audit doc written — 215 lines
- [x] 4 ADR amendments applied (ADR-0341/0342/0348/0349)
- [x] Decision log updated — 5 rows added
- [x] Council log updated — new section appended
- [x] Typecheck clean (docs-only sortie — no TypeScript changes)

## Out of Scope

- Schema migration (Phase 7d-followup): `workspace_framework_binding` table, `tariff_snapshot` table, `active_union` column, DB CHECK constraint
- Bridge code (Phase 7e): `lovsen-client.ts`, BFF routes
- Capability tools + UI (Phase 7f): `setup_workspace_tariff`, `change`, `add_supplement_override`
- Worksheet rate correction (superseded — dynamic pivot kills worksheet authority over rates)
