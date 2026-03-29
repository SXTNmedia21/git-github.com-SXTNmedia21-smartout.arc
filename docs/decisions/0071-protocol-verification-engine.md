---
title: "ADR-0071: Protocol Verification Engine Architecture"
status: accepted
updated: 2026-03-29
created: 2026-03-29
module: testing
tags: [adr, protocol, verification, mission, journey, e2e]
---

# ADR-0071: Protocol Verification Engine Architecture

## Context

Smartout has Protokoll packages (Journey + Mission + Roadmap + License) as markdown docs describing user workflows. We need a system to execute these workflows automatically, verify each step passes via control gates, and generate documentation, AI mission drafts, and UX audit reports.

The existing journey system (ADR-0031) provides a metadata registry with 68 journey definitions. ADR-0038 defines output generators (E2E, doc, Linear, Botsson) from journey definitions. This system extends both.

Council review (2026-03-29) identified dual-source-of-truth and mission-target concerns that shaped these decisions.

## Decisions

### 1. Generator targets engine_missions + engine_stages, not AgentMission registry

The `AgentMission` type in `registry.ts` is Ultravox-specific (voice, clientTools, monolithic systemPrompt). The Stage Engine's database schema (`engine_missions` + `engine_stages`) is the proper target for structured missions with per-stage goals, instructions, and success criteria. Generated missions are always drafts (`is_active: false`) requiring human review.

### 2. journey_step is read-only input

The Protocol Runner reads `journey_step` data for linkage (via `journey_step_slug`) but never writes to it. Protocol definitions are TypeScript files in `apps/e2e/protocols/` containing Playwright-specific execution details (selectors, actions, gates) that don't belong in the journey metadata registry.

### 3. Step results stored as JSONB in journey_test_run.test_output

No new table. Step results are always queried in context of a test run. JSONB avoids a new table with RLS, workspace_id, updated_at, indexes for data with no independent lifecycle. A new `'protocol'` value is added to the `journey_test_type` enum.

### 4. Protocol definitions are TypeScript, not JSON

TypeScript files provide compile-time validation via Zod schemas, IDE support, and natural composition with Playwright fixtures. JSON was rejected because it creates a dual source of truth with `journey_step` (DB, per ADR-0031).

### 5. This EXTENDS ADR-0031 and ADR-0038

The Protocol Verification Engine is an additional consumer of the journey metadata registry, not a replacement. It extends the testing capability with control gates and multi-output generation. The existing `JourneyReporter` remains unchanged.

### 6. Event Engine boundary

The Protocol Runner is a test/observation tool, NOT a workflow engine. It never triggers engine processes or creates engine states. Gate checks are read-only DB queries. This is explicitly different from `engine_state` / `engine_state_step` which track live workflow instances.

## Consequences

- Protocol definitions must be maintained alongside Journey.md docs
- UI changes require updating both the markdown docs and the protocol testid selectors
- Generated missions require human review workflow before production use
- The `journey_test_type` enum gains a third value: `protocol`
