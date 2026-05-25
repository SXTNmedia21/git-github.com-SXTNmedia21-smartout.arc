---
title: "ADR-0367 Tri-Layer D6 Collision Risk on New Entities"
id: L-0356
status: accepted
layer: learning
created: 2026-05-25
updated: 2026-05-25
---

# L-0356: ADR-0367 Tri-Layer D6 Collision Risk on New Entities

## What happened

Restaurant-sim council 2026-05-25 Phase 3. The synthesizer recommended adding `event` as a
first-class entity at the D4/D6 boundary as a sibling to `department_session`. Supervisor
flagged the collision with [[ADR-0367]] (Day Line Area-Anchored Runtime), which establishes
D6 production as the tri-layer model `department_session → day_line → shift_session`.
Adding `event_session` as a 4th sibling layer would amend ADR-0367 and cascade through
~20 downstream consumers (`apps/web/src/components/day/**`, `apps/web/src/app/dashboard/day/**`,
mobile day-line, telemetry registry, RPC fn_list_my_tasks, etc.).

Phase 5 chair resolved via [[ADR-0426]] — `event` lives at D5 (Service Concept) as a
parameterization / grouping entity, JOIN-ing existing `department_session` rows via
`event_session_membership`. ADR-0367 tri-layer invariant preserved. Cross-department
aggregation = JOIN, not new layer.

## Why it matters

This is the FIRST instance of new-entity-vs-ADR-0367 collision since ADR-0367 landed
2026-05-18. Any future proposal to add multi-day entities (events, multi-day stays,
recurring bookings, training cohorts, festival production blocks) risks the same collision.
Without an explicit check, sortie authors may default to "add at D4/D6 as sibling" because
that's the obvious cascade-spec move for production-layer entities.

Cascade spec §2.2 establishes D5 (Service Concept) as the parameterization layer — D5
parameters drive coefficients in D1, D3, D4, D6 WITHOUT introducing new entity types. The
exception: when an entity has its own state machine fundamentally different from existing
D6 rows (e.g. event lifecycle has draft → confirmed → setup → live → settlement → archived
which doesn't map to `department_session_status_enum` upcoming → active → pending_signoff
→ closed → missed).

## Lesson learned

**Default to D5 parameterization for new multi-day or cross-department entity proposals.**
Escalate to ADR-0367 amendment only if D5 grouping cannot represent the entity lifecycle.

Test: can the new entity be expressed as `{ entity_id, niche_template_id, name, starts_at,
ends_at, ... }` + `entity_membership(entity_id, department_session_id, role_in_entity)` ?
If yes → D5. If the entity has its own state machine that can't be modeled as D5 +
join-table → ADR-0367 amendment with explicit rationale.

## How to apply

- **When ANY sortie or campaign proposes a new entity that spans multiple `department_session`
  rows or multiple days:** FIRST evaluate D5 parameterization path before D6 sibling-layer
  path
- **When the sortie author defaults to D6 sibling:** require explicit rationale why D5
  cannot work (cite state machine, lifecycle, or invariant that D5 grouping cannot express)
- **When ADR-0367 amendment is proposed:** require enumeration of downstream consumers
  affected + migration plan (~20 consumers per current count)
- **For multi-vendor / sub-workspace patterns (festival F01):** D5 grouping is NOT
  sufficient — that's a workspace-identity-model rewrite, escalate to ADR-0078 amendment OR
  separate-product path per sim verdict ("Smartout Events")

## References

- 11-agent restaurant-week + hotel + festival sim council 2026-05-25
- [[ADR-0367]] — Day Line Area-Anchored Runtime tri-layer D6
- [[ADR-0426]] — `event` entity via D5 niche parameterization (this learning's
  enforcement ADR)
- Cascade spec §2.2 — D5 Service Concept parameterization layer
  (`docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)
- L-0353 — Contract-Promise-Without-Fulfillment meta-pattern (cascade-boundary discipline
  is a sibling)
