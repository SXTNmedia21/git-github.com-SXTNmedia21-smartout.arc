---
title: "Ontology change ≠ presentation change — UX needs satisfiable by read-time queries do not justify FK columns"
id: LEARNING_0088
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [ontology, schema-design, yagni, presentation-layer]
---

# Learning-0088: Ontology change ≠ presentation change — UX needs satisfiable by read-time queries do not justify FK columns

## Context

The Progressive Channel council (2026-04-20) had an early draft proposing `channel_message.engine_state_id uuid REFERENCES engine_state(id)` as a back-reference from messages to tickets. The motivation was a UX requirement from the Frontend reviewer: *"show status-orb on the first message of a ticket thread, not on every message."*

The implementation path assumed this needed a persisted FK to identify "which message started this ticket." Code-trace revealed:

- The existing ontology (`engine_state.entity_id = channel.id`) already identifies the ticket's channel.
- "First message of the thread" is a cheap query: `SELECT * FROM channel_message WHERE channel_id = X ORDER BY created_at ASC LIMIT 1`.
- Adding the FK column would trigger: (1) migration to add the column, (2) backfill on existing tickets, (3) atomic capability-tool update to write the FK at insert, (4) projection trigger potentially needing updates if the back-reference is emitted in events, (5) mock audit expansion per L-0087, (6) RLS review.

Cost: ~1 sub-sortie of migration work + test matrix + review overhead.
Benefit: 0 vs. the query approach.

## The pattern

A UX requirement often feels like "the data model needs to know about X." But the actual question is: **does the system need to PERSIST X, or just DERIVE X at render time?**

If the answer is derivable from existing persisted state via a reasonable query (bounded rows, existing indexes, no cross-service call):

- Derive, don't persist.
- The derivation lives as a selector function, a view, or a component prop computation.
- The schema stays focused on facts, not presentation concerns.

If the answer is NOT derivable:

- The derivation would require unbounded scans, cross-service joins, or external calls.
- Persist the fact. Document why it's persisted (which query it replaces, what performance constraint drives it).

**Red flag phrases that indicate a presentation-masquerading-as-ontology change:**

- "We need to know which message was first."
- "The UI needs to show X on the row that Y."
- "Let's store the display status so we don't re-compute it."
- "Let's denormalize for faster reads."

Each of these should trigger: **can we compute this from what we already persist?** If yes, and the query is O(1) or O(N) with existing indexes, the persistence proposal is a YAGNI candidate.

## The learning

**When a UX requirement seems to drive a schema change, run the two-question gate:**

1. **Is the requested fact already derivable from existing persisted state?** If yes → prefer derivation.
2. **If derivable, what's the cost of the derivation at read time?** If bounded (indexed query on a reasonable row count), always prefer the query over the persisted denormalization.

**Schema mutations have second-order costs that presentation code does not:**

- Migration + backfill + rollback file
- RLS review for the new column
- Mock audit expansion (L-0087)
- Every consumer of the table now has one more field to think about
- Deprecation path if the column turns out to be misconceived

Presentation code has none of these. A wrong selector function can be rewritten in a single file without migrations or review overhead.

## Example from this council

| Approach | Cost | Notes |
|---|---|---|
| Add `channel_message.engine_state_id` FK | 1 migration + backfill + mock audit + RLS review + projection trigger check + 5 consumer file updates | Back-reference creates polymorphism trap (steward C1) |
| Compute "first message" via `MIN(created_at) WHERE channel_id = ...` at render | 1 selector function in the Min kø hook, 1 prop on MessageBubble | Cost = near-zero; index already exists on `channel_message(channel_id, created_at)` |

The query approach won trivially. The FK was rejected.

## Related

- ADR-0165 (Progressive Channel — rejected the engine_state_id FK on this learning's logic)
- L-0086 (plumbing ≠ feature — same family of "just because it CAN be a column doesn't mean it SHOULD be")
- YAGNI principle (CLAUDE.md: "Don't design for hypothetical future requirements")
