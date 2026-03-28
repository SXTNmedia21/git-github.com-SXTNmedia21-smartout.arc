---
title: "ADR-0068: Simulation Schema and Dedicated Service"
status: accepted
updated: 2026-03-28
created: 2026-03-28
module: simulation
tags: [adr, simulation, cascade, testing, platform-admin]
---

# ADR-0068: Simulation Schema and Dedicated Service

## Context

Smartout's cascade system (I1 + 6D + 4C + K1a/K1b) has never been verified end-to-end. No single test exercises all 151 telemetry events, 18 engine action types, 9 engine processes, and 5 session hook types together. A simulator is needed that exercises the cascade through identical code paths the app uses.

## Decision

1. **Dedicated `simulation` PostgreSQL schema** for simulator control plane (run metadata, clock segments, manifests, gap reports, timeline events). Business data is seeded into real app schemas (`public`, `payroll`) and tracked via manifests for cleanup.

2. **Dedicated Hono microservice** on port 5013 (`services/simulator/`). Matches existing service pattern (stage-engine 5010, shift-mcp 5011, contract-service 5012).

3. **Platform-admin control panel** at `/platform-admin/simulator` with transport controls, cascade dimension gates, event feed, and gap report.

4. **Two execution modes:**
   - Phase 1: System proof (deterministic, no AI agents, direct inserts, CI-runnable)
   - Phase 2: Demo mode (real-time, AI swarm, SSE streaming, timewarp)

5. **Tariff rates sourced from `tariff_rate_table` / `supabase/templates/restaurant/`**, never from `hospitality.ts` (incorrect rates).

6. **I1 bootstrap via direct dimension seeding** until Phase C bootstrap service is wired. Documented as temporary scaffolding.

7. **No RLS on simulation tables** — Hono service is the auth boundary (JWT + `is_godmode` validation). UI never queries simulation tables directly.

## Consequences

- 5th PostgreSQL schema (after public, payroll, websites, timesheet)
- Schema-qualified enums (`simulation.run_status`, etc.) to avoid collision with 124 existing enums
- Simulator seed data must stay aligned with `supabase/templates/restaurant/` to prevent divergence
- Orphan detection required on service startup for crashed/abandoned runs
- Simulator lifecycle events emitted via telemetry (`emit()`)

## Council Review

Reviewed 2026-03-28 by System Council (steward, supervisor, agent-coordinator, frontend-designer). Verdict: APPROVE WITH CHANGES. 17 conditions addressed in design spec.
