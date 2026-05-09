---
title: ADR-0122 — Governance Telemetry Quad-Destination Routing
id: ADR-0122
status: proposed
layer: decision
created: 2026-04-17
updated: 2026-04-17
module: governance
tags: [adr, telemetry, governance, audit-trail, emit]
---

# ADR-0122 — Governance Telemetry Quad-Destination Routing

## Context and Problem Statement

`apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts` wires 7 mutations (policy/protocol/procedure create + update + archive, plus assignment mutate). Every mutation calls `emit()` — but the emitted event name is `"button clicked"`, which `packages/telemetry/src/registry.ts` routes to `destinations: ["posthog"]` only. The governance mutations therefore produce zero audit trail and zero Event Engine triggers. Each mutation carries a `TODO(plan-phase-2): event pending — no [X] event registered yet` comment (7 occurrences at lines 104, 146, 195, 237, 298, 341, 380).

Per ADR-0004 and CLAUDE.md ("Every mutation emits. `emit()` drives four destinations: PostHog, Logger, activity_trail, engine_event"), mutations routed to PostHog-only violate the cascade invariant that every state change leaves an audit-trail spor and is available to the Event Engine for downstream workflow automation.

## Decision Drivers

- CLAUDE.md declares four-destination emit as a hard rule; governance is currently non-compliant.
- L-0038 (registry destinations provider silent drop) already warns that declaration ≠ coverage; here we have the inverse — declaration is PostHog-only, so coverage is correctly half-empty.
- ADR-0114 (Server Actions canonical mutation primitive) proposed 2026-04-16 relies on the emit contract being honored; if 7 governance mutations silently drop audit, the contract is aspirational.
- Governance data is high-value for audit and compliance purposes — missing activity_trail coverage here is a regulatory-risk surface, not a nice-to-have.

## Considered Options

1. **Register 7 domain-specific events** — `"policy created"`, `"policy updated"`, `"policy archived"`, `"protocol created"`, `"protocol updated"`, `"procedure created"`, `"protocol assignment updated"` — each routed to all four destinations (`posthog + logger + activity_trail + engine_event`). Update the 7 emit call sites to use the new names.
2. **Widen the `"button clicked"` route to include all four destinations.** Simpler, but pollutes the activity_trail with every button click across the app — unacceptable signal-to-noise.
3. **Accept current state as technical debt** — defer until ADR-0114 Server Actions migration lands.

## Decision Outcome

Chosen option: **Option 1 — register 7 domain-specific governance events with quad-destination routing.**

Implementation contract:
- Each event name follows the domain-object-past-tense convention (`"policy created"`, `"protocol archived"`, etc.).
- Every event declares `destinations: ["posthog", "logger", "activity_trail", "engine_event"]` in `packages/telemetry/src/registry.ts`.
- Every event declares a `properties.entity` contract (table + id) to satisfy the activity_trail provider's entity-presence check (per L-0038).
- Every event declares a `category: "governance"` tag.
- Call sites in `use-governance-mutations.ts` update their `emit()` invocation to the new event name in the same commit.
- CI assertion: a Vitest test that mock-emits each of the 7 events and asserts all 4 provider entry points receive the payload (per L-0038 contract-asserting-test pattern).
- The `TODO(plan-phase-2)` comments are removed in the same commit as part of the event registration.

## Rules & Consequences

- **Good, because** governance mutations now participate in the cascade audit trail per CLAUDE.md; Event Engine can trigger downstream workflows (notification, protocol re-assignment) from governance changes; ADR-0114 emit contract becomes honest for this module.
- **Good, because** the CI assertion prevents regression — future events added to the governance module must prove quad-destination coverage before merge.
- **Bad, because** the 7 call sites must be coordinated — can't land event registration without the call-site update (split would leave registry entries unused or call sites emitting unknown events).
- **Bad, because** activity_trail volume increases — expected, since governance was under-emitting; not a true regression.
- **Agent Impact:** Botsson / Stage-Engine capabilities that query governance changes (if any land post this ADR) can now rely on `engine_event` routing for governance mutations. Trust Gate for any such capability passes as of this ADR.

---

> Registered in `docs/decisions/0000-decision-log.md`. Supersedes the `TODO(plan-phase-2)` comments in `use-governance-mutations.ts`.
