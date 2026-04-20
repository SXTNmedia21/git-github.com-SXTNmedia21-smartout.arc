---
title: "`source` is an overloaded term — verify semantics before citing convention"
id: LEARNING_0053
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [council, semantics, schema, precedent]
---

# Learning-0053: `source` is an overloaded term — verify semantics before citing convention

## Context

Source-tagging council 2026-04-17 for v3 governance tables. Steward's Phase 3
verdict cited `channel_event.source + source_id` as the provenance precedent
and proposed extending that pattern to governance. Supervisor's Phase 3
code-trace found FIVE `provenance JSONB` precedents in cascade tables and
argued `channel_event.source` is NOT a provenance convention — it's an
event-envelope DOMAIN classifier (event-origin type: user/system/ai/webhook)
that sits alongside `event_type`, `correlation_id`, `causation_id`.

In Phase 5, Steward synthesized: "Supervisor is right. I over-generalized
from one precedent." The final verdict followed Supervisor's recommendation
(`provenance JSONB`, not `source text`).

## Discovery

**`source` means at least three different things in v3:**

| Pattern | Example | Semantic |
|---|---|---|
| Enum-typed domain classifier | `planning_event.source planning_event_source NOT NULL DEFAULT 'manual'` | What KIND of this thing is it (manual/auto/etc.) |
| Event-envelope origin type | `channel_event.source text NOT NULL` | Which system produced this event (user/ai/webhook/external) |
| Content provenance (different name) | `workspace_doc_chunk.source_id uuid` | Which source document did this chunk come from |

**The true "where did this row come from" convention in v3 is
`provenance JSONB`**, with five precedents in cascade tables.

## Impact

**For reviewers:** Before citing ONE precedent as convention, grep for
competing patterns. In v3, the competing patterns for "provenance" are:
`source`, `source_id`, `provenance`, `origin`, `created_via`,
`imported_from`, `migrated_from`. Read the migration HEADER and adjacent
columns — context disambiguates semantic. If two patterns coexist, the
newer ADR-backed pattern wins.

**For this council specifically:** Without Supervisor's full-repo grep,
the Steward's single-precedent reading would have led the group to add
`source text` columns to governance tables — creating exactly the kind of
orphan-concept semantic drift the Steward mandate exists to prevent.

**For the run-council SKILL:** the 4-layer review model (Learning 0051)
just earned another validation. Layer 3 (trigger/constraint semantics —
Supervisor's domain) caught what Layer 1 (per-file semantic review —
Steward's Phase 3) missed. The layers are not redundant; they see
different things. **Do not skip layers.**

## Generalization

`source` is one of ~20 terms in a typical codebase that accumulate
meanings over time:

- `source` — classifier vs origin vs FK
- `status` — workflow state vs boolean flag vs enum vs text
- `type` — class discriminator vs content-type vs enum
- `owner` — creator vs current-assignee vs admin
- `key` — primary key vs cache key vs auth key
- `role` — RBAC role vs domain role vs display role

For any of these terms, citing "we already have a `X` column elsewhere,
let's reuse it" is the wrong reflex. The right reflex: "what does `X`
mean in THIS codebase, and what are the 2-3 other things it might mean?"

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-04-17 (source-tagging)
- ADR-0140: decided outcome of the above council (governance provenance; numbered 0126 in draft, renumbered 2026-04-18)
- Related: Learning 0051 (4-layer post-impl review model — Layer 3 = Supervisor's code-trace caught this)
- Related: Cascade Core Foundation spec (Invariant 8)
- Cascade `provenance JSONB` precedents: `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql:81,151,270`
- False precedent that misled Phase 3: `supabase/migrations/20260422300000_channel_communications.sql:267-269`
