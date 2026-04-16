---
title: Learning 0038 — Registry destinations can claim routes providers silently drop
status: captured
created: 2026-04-16
updated: 2026-04-16
module: observability
tags: [learning, telemetry, routing, contracts, ci-hygiene]
---

# Learning 0038 — Registry destinations can claim routes providers silently drop

## Context

Council R2 (2026-04-16) reviewing PR #213 traced the `botsson.*` event pipeline end-to-end and found that the 6 events' `destinations: ["posthog", "logger", "activity_trail"]` routing was silently non-functional for activity_trail. The provider at `packages/telemetry/src/providers/activity-trail.ts:53-59` rejects any event without `properties.entity` and logs a warning. None of the 6 `botsson.*` event types declared an entity → every insert skipped.

R1 had approved the telemetry work without noticing — it only verified emit() was called, not that every declared destination actually received the event.

## What we learned

A routing declaration is a CLAIM, not a contract. Providers are free to reject events that don't meet their schema expectations, and `Promise.allSettled` in `emit()` swallows the rejection silently. This creates a class of bug where:

1. Registry says event goes to N destinations
2. Emit fires + returns resolved
3. Only K<N destinations actually persist the event
4. No test catches the drop
5. Dashboards built on the assumption of N destinations show empty data

## Why this matters

CLAUDE.md says "no mutation without emit." But emit alone is insufficient — the chain from emit → destination must be verified. Otherwise we have "emit() without persistence" which is functionally equivalent to the silent-capability problem Learning 0034 already flagged.

## How to detect

- CI test that emits every entry in `EVENT_ROUTING` with representative payloads and asserts each declared destination actually received the event (count rows in `activity_trail`, PostHog event IDs returned, logger line counts)
- Pre-merge checklist: for every new event added to the registry, trace one live invocation end-to-end through the dev pipeline to confirm all declared destinations fire

## How to fix

For the specific contract break found in R2:
- Every event routing to `activity_trail` MUST include `properties.entity` in its type definition
- Provider + type are co-located contracts — if the provider validates, the type should require

For the class of bug:
- Add a provider-validation CI test. Each provider declares its required fields (e.g. activity-trail requires `entity`); test asserts every event routed to that destination satisfies the required fields via TypeScript's exhaustiveness check.

## Related

- ADR-0113 — Runtime Telemetry Standard
- Addendum ADR-0113 2026-04-16 — activity_trail entity contract
- Learning 0034 — capability-without-emit-invisible-to-cascade (sibling pattern: this is emit-without-persistence)
- Council 2026-04-16 R2 review (PR #213)
