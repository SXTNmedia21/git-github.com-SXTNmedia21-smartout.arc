---
title: "`event` Entity via D5 Niche Parameterization — Preserve ADR-0367 Tri-Layer D6"
id: ADR-0426
status: proposed
layer: decision
created: 2026-05-25
updated: 2026-05-25
---

# ADR-0426: `event` Entity via D5 Niche Parameterization

> **Status: PROPOSED** — prereq for X03 family (sortie I). Land via dedicated sortie H
> before opening any event-entity ADRs (event D4/D6, room D1, event_settlement C3,
> event_tip_pool C3).

## Context and Problem Statement

11-agent sim council 2026-05-25 surfaced the need for an `event` first-class entity
spanning hotel weddings, festival concerts, multi-day bistro promotions, conference banquets
— anything where multiple `department_session` rows belong to a coherent commercial /
operational unit with shared lifecycle (planning → setup → execution → settlement → review).

The synthesizer's first instinct was to add `event` at the D4/D6 boundary as a sibling to
`department_session`. Supervisor flagged the collision with [[ADR-0367]] — Day Line
Area-Anchored Runtime — which establishes D6 production as the **tri-layer model**
`department_session → day_line → shift_session`. Adding `event_session` as a fourth sibling
layer would amend ADR-0367 and create downstream debt (every D6 consumer would need to
handle 4 layers, not 3).

Cascade spec §2.2 establishes D5 (Service Concept) as the parameterization layer — D5
parameters drive coefficients in D1, D3, D4, D6 WITHOUT introducing new entity types. This
is the cleaner architectural path.

## Decision Drivers

- ADR-0367 tri-layer D6 is load-bearing for `apps/web/src/components/day/**` and
  `apps/web/src/app/dashboard/day/**` — amending it cascades through dozens of consumers
- D5 niche parameterization is the documented escape valve for verticals that need entity
  shape variation
- Hotel/festival/wedding/banquet all reuse existing D6 entities — they don't need NEW D6
  shapes, they need DIFFERENT relationships between existing D6 rows
- ADR-0078 workspace boundary preserved — `event` rows are workspace-scoped, not
  cross-workspace

## Considered Options

1. **A** — Add `event_session` as 4th D6 layer (amends ADR-0367, cascades through ~20
   consumers)
2. **B** — Add `event` as D5 niche parameter that GROUPS existing `department_session` rows
   via a join table (`event_session_membership`)
3. **C** — Hotel-specific only — ship `event` only in `hospitality.no.hotel.v1` sub-package,
   defer festival/banquet

## Decision Outcome

**Chosen: Option B — `event` as D5 niche grouping entity.**

### Schema sketch

```sql
-- D5 parameterization layer — workspace_id scoped
CREATE TABLE public.event (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id),
  niche_template_id TEXT NOT NULL,  -- e.g. 'hospitality.no.hotel.v1.wedding'
  name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  guest_count INTEGER,
  payer_company_id UUID REFERENCES public.company(company_id),  -- payer ≠ workspace, per ADR-0131 carve
  status event_status_enum NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Join: many department_sessions belong to one event
CREATE TABLE public.event_session_membership (
  event_id UUID NOT NULL REFERENCES public.event(event_id) ON DELETE CASCADE,
  department_session_id UUID NOT NULL REFERENCES public.department_session(department_session_id),
  role_in_event event_session_role_enum NOT NULL,  -- e.g. 'ceremony_prep', 'reception_service'
  PRIMARY KEY (event_id, department_session_id)
);
```

### Why this preserves ADR-0367

- D6 tri-layer (`department_session → day_line → shift_session`) is UNTOUCHED
- `event` lives at D5 (parameterization), not D6 (production)
- Cross-department aggregation = JOIN through `event_session_membership`, not a new D6 layer
- `event_tip_pool` becomes a parent of multiple `tip_pool` rows (one per
  `department_session_id`) — closes Pattern 2 from sim
- `event_settlement` aggregates `daily_reconciliation` rows via event_id — closes
  GAP-A8-multi-day-settlement

### Validation against sim findings

| Sim finding | Resolution via D5 grouping |
|---|---|
| GAP-A6 / GAP-A7 / GAP-A8 — event-as-first-class | `event` table at D5 |
| GAP-A6 — cross-department orchestration view | JOIN through `event_session_membership` |
| Pattern 2 — tip_pool single-session lock | `event_tip_pool` parent of N `tip_pool` rows |
| GAP-A8 — multi-day settlement no aggregate | `event_settlement` via event_id |
| GAP-A8-03 — payer ≠ workspace | `event.payer_company_id` carve from ADR-0131 |
| GAP-A6/HOTEL-2 — room ops as D6 | Deferred: room sub-entity ships in `hospitality.no.hotel.v1` only |
| GAP-A10 — production-block (festival stage time) | Out of scope for D5; festival = separate product line per sim verdict |

## Rules & Consequences

- **Good:** ADR-0367 tri-layer invariant preserved
- **Good:** D5 niche-parameterization layer used as designed
- **Good:** Closes 12+ hotel/festival/wedding/banquet gaps via one architectural move
- **Good:** Payer ≠ workspace gap (ADR-0131 carve) lands cleanly
- **Bad:** Many `JOIN event_session_membership` queries downstream — needs index discipline
- **Bad:** Festival production-block (stage time) NOT solved — that's a separate product
  per sim verdict (Smartout Events)
- **Bad:** Mobile day-line UI may need event-aware filtering for hotel managers (Linda's
  cross-department view) — design work needed

## Agent Impact

When any sortie or campaign proposes new D6 entity layers, FIRST verify whether the use case
can be expressed as D5 parameterization or D5 grouping. Default to D5; escalate to ADR-0367
amendment only if D5 grouping cannot represent the entity lifecycle (e.g. event-as-aggregate-
of-sessions semantics fundamentally require a different state machine than department_session).

For sortie I (X03 family) — the 4 child ADRs (event D4/D6, room D1, event_settlement C3,
event_tip_pool C3) now reduce to:

- **X03-A** (event D5 grouping) — this ADR
- **X03-B** (room D1) — gated on `hospitality.no.hotel.v1` sub-package decision
- **X03-C** (event_settlement) — JOIN-based aggregate, no new entity
- **X03-D** (event_tip_pool) — parent of `tip_pool`, no UNIQUE conflict

## References

- 11-agent restaurant-week + hotel + festival sim council 2026-05-25 (Phase 5 synthesis)
- [[ADR-0367]] — Day Line Area-Anchored Runtime tri-layer D6
- [[ADR-0131]] — Stripe Connect platform model (payer ≠ workspace carve)
- `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` §2.2 D5
- L-0356 — ADR-0367 tri-layer D6 collision risk on new entities
