---
title: "Simulation schema and simulator microservice"
id: ADR_0058
status: proposed
layer: decision
created: 2026-03-23
updated: 2026-03-23
---

# ADR-0058: Dedicated simulation schema and simulator microservice for cascade system testing

## Context and Problem Statement

Smartout's cascade system (I1+D1-D6+C1-C4+K1a/K1b) spans 151 telemetry events, 18 engine action types, 9 engine processes, and 6 AI missions. No single test or walkthrough exercises the full system. We need a way to both prove the system works (CI) and demonstrate it to stakeholders (live demo). This requires a new microservice and a new PostgreSQL schema.

## Decision Drivers

- Full cascade coverage requires coordinated data across 14 dimensions — cannot be achieved by isolated unit tests alone
- Live demos require real-time simulation with realistic timing, not instant test execution
- Seeding test data into real workspaces must be reversible without residual data
- The simulator must not pollute the core product schema with test infrastructure
- Existing service pattern (Hono on sequential ports) is proven and well-understood

## Considered Options

1. **Dedicated `simulation` schema + `services/simulator/` Hono microservice** — New schema for control plane (run metadata, manifests, gap reports, cleanup tracking). Business data seeded into real app tables, tracked via manifests. Hono service on port 5013.
2. **Extend E2E test suite (Playwright only)** — Add cascade-specific Playwright tests with seed helpers. No new schema or service.
3. **Edge Function orchestrator** — Supabase Edge Function that coordinates simulation. No new service.

## Decision Outcome

Chosen option: **"Option 1 — Dedicated simulation schema + Hono microservice"**, because:

- Playwright tests cannot run a 3-hour real-time demo with timewarp controls
- Edge Functions have 150s timeout limits — incompatible with long-running simulation
- A dedicated schema isolates test infrastructure from product schema (no `simulation_run_id` columns on core tables)
- Manifest-based cleanup is safer than schema-drop and supports seeding into existing workspaces
- Hono service on port 5013 follows the established pattern (stage-engine 5010, shift-mcp 5011, contract-service 5012)
- The gap analysis engine (workspace diagnostics) has standalone value beyond testing

## Rules & Consequences

- **Good, because** full cascade coverage becomes measurable and CI-runnable
- **Good, because** gap analysis doubles as a workspace health diagnostic tool
- **Good, because** live demos become reproducible and self-cleaning
- **Bad, because** one more service to maintain (port 5013, Docker Compose entry, health check)
- **Bad, because** manifest-based cleanup adds complexity (especially mutation rollback)
- **Agent Impact:** The `simulation` schema is platform-admin-only with NO RLS. The Hono service is the auth boundary — dashboard UI never queries simulation tables directly. All simulation data reads go through the service's SSE endpoint. When adding new cascade tables or telemetry events, the simulator's gap analysis buckets and scenario coverage expectations may need updating.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
