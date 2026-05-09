---
title: "Season-namespace unification for year-wheel telemetry events"
id: ADR-0164
status: accepted
layer: decision
created: 2026-04-20
updated: 2026-04-20
---

# ADR-0164: Season-namespace unification for year-wheel telemetry events

## Context and Problem Statement

The Year Wheel Redesign spec (2026-04-20) proposed a new telemetry namespace `"year_wheel ..."` for canvas-interaction events (`draw_started`, `draw_completed`, `sidebar_filter_changed`, `page_viewed`, `tab_changed`). The Council Phase 3 code-trace found that every existing event in this domain is already prefixed `"season "`: `"season created"`, `"season activated"`, `"season archived"`, `"season updated"`, `"season block_clicked"`, `"season pin_clicked"`, `"season year_navigated"`. Introducing `"year_wheel "` would split one domain (season planning) across two telemetry namespaces based on which UI widget emitted the event — the wheel canvas vs. the drawer/form.

## Decision Drivers

- **Analytics consistency** — PostHog dashboards, saved insights, and funnel definitions filter by event-name prefix. A namespace split fragments every season-scoped query (`"season *"` would miss canvas events under `"year_wheel *"`).
- **Domain vs. widget** — a telemetry namespace models the domain (what changed), not the widget (where the user clicked). A Procedure-Engine-Principle corollary: the lens does not define the atom.
- **Avoidable migration cost** — if `"year_wheel "` ships first and `"season "` unification comes later, every dashboard/query rebuilds.
- **Discriminated-union typing** — the TypeScript event union in `packages/telemetry/src/registry.ts` already contains several `"season ..."` members. Extending it is cheaper than introducing a parallel axis.

## Considered Options

1. **Namespace by widget** — use `"year_wheel draw_started"`, `"year_wheel sidebar_filter_changed"`, etc. Widget-centric, matches the file locations of the new components.
2. **Namespace by domain** — use `"season draw_started"`, `"season sidebar_filter_changed"`, `"season year_wheel_viewed"`, `"season tab_changed"`. Matches existing `"season ..."` events. Widget-agnostic.
3. **Dual namespace with aliasing** — emit both names and alias in PostHog. Maximum compatibility, double the write cost, invites confusion about which is canonical.

## Decision

**Option 2 — Namespace by domain.** All new events use the `"season "` prefix. The rename table applied in the redesign spec:

| Proposed | Canonical |
|---|---|
| `year_wheel draw_started` | `season draw_started` |
| `year_wheel draw_completed` | `season draw_completed` |
| `year_wheel draw_cancelled` | `season draw_cancelled` |
| `year_wheel sidebar_filter_changed` | `season sidebar_filter_changed` |
| `season page_viewed` | `season year_wheel_viewed` |
| `season tab_changed` | `season tab_changed` (unchanged) |

**Rule for future telemetry authoring:** the first token of any event name is the domain (matches an `entity_type` where applicable), not the surface or widget. The widget-context can travel in `properties.data` or a `view` sub-field, never in the event name.

## Consequences

### Positive

- Single prefix makes PostHog filters, funnels, and activity-trail queries complete for the season domain in one query.
- TypeScript discriminated-union stays tidy — all `"season ..."` members sit together.
- Easier for future AI-telemetry tools to enumerate domain events.

### Negative

- The name `"season year_wheel_viewed"` is slightly awkward (domain-then-widget). Acceptable cost — it preserves the widget-context as data without splitting namespaces.
- Anyone previously familiar with "widget namespace" patterns from other products has to relearn the convention.

### Neutral

- No runtime or DB cost; pure naming convention.

## Implementation

- Applied in redesign spec §7 (commit `ecf2ff36`).
- Enforced in `packages/telemetry/src/registry.ts` by dual registration (export interface + runtime entry) — see L-0072.

## References

- Spec: `docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md` §7
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-20 session
- L-0073: UI-widget namespace is not telemetry namespace
- Procedure Engine Principle: `project_procedure_engine_principle.md`
- Related: ADR-0113 (activity_trail silent-drop), L-0038 (provider silent rejection)
