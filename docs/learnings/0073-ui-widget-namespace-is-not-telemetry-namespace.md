---
title: "UI-widget namespace is not telemetry namespace"
id: LEARNING_0073
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [telemetry, naming, namespace, procedure-engine, analytics]
---

# Learning-0073: UI-widget namespace is not telemetry namespace

## Context

Year Wheel Redesign Council (2026-04-20). The spec proposed `"year_wheel "` as the event-name prefix for canvas-interaction events (`draw_started`, `draw_completed`, `sidebar_filter_changed`, `tab_changed`, `page_viewed`). The existing season-planning domain already used `"season "` as prefix across seven registered events. The code-trace flagged this as a namespace split with analytics and type-system consequences.

## Discovery

Telemetry namespaces model **what changed**, not **where the user clicked**. Two different widgets — the year-wheel canvas and the season drawer — both edit the same domain (season planning). Emitting under two different prefixes fragments every domain-scoped query:

- PostHog funnel "season created → season activated" becomes incomplete when a parallel "year_wheel draw_completed" exists as a leading step.
- Activity-trail audit scoped to a `season_id` misses gesture-level context emitted under a widget prefix.
- Discriminated-union types fragment across two parallel axes, complicating future automated telemetry-surface tools (e.g. AI enumerators).

This is a Procedure Engine Principle corollary: the atomic truth is the procedure/entity (in telemetry terms, the domain event). UI surfaces are **lenses** that render or manipulate the truth. A lens does not get to name the atom.

## Impact

### Rule

The first token of a telemetry event name is the **domain**, not the surface. Widgets travel in `properties.data` (e.g. `data: { source: 'year_wheel' }`) or as part of the event verb (e.g. `"season year_wheel_viewed"`), never as the event's namespace prefix.

### How to apply

- Before registering a new event, check whether the domain already has a prefix in `packages/telemetry/src/registry.ts`. If yes, use it.
- If the new event truly represents a new domain (not a new widget on an existing domain), introduce a new prefix — and write an ADR explaining why it's a new domain.
- Use `entity_type` as the canonical list of existing domains (see `packages/telemetry/src/registry.ts` — `EntityType` union).

### Examples

- Year-wheel `draw_started` → `"season draw_started"` (domain: season; widget: canvas)
- Schedule shift drag → `"shift updated"` (domain: shift; widget: schedule grid), not `"schedule shift_updated"`
- Dashboard nav tab click → `"button clicked"` with `data: { surface: 'dashboard_nav' }`, not a new prefix

### Why promoted

Three councils in a row have surfaced namespace-discipline gaps:
- 2026-04-17 (Post-Audit): governance events registered under mixed prefixes
- 2026-04-19 (Kanaler Help Desk): helpdesk vs. ticket vs. channel namespace ambiguity
- 2026-04-20 (Year Wheel Redesign): `year_wheel` vs. `season` split

Rule captured explicitly to head off the fourth occurrence.

## References

- ADR-0164: Season-namespace unification for year-wheel telemetry events
- Procedure Engine Principle: `project_procedure_engine_principle.md`
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-20 session
- Registry `EntityType` union: `packages/telemetry/src/registry.ts`
