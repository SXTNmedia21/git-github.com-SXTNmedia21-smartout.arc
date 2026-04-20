---
title: "Sibling table pattern is not an ontology answer"
id: L-0070
status: accepted
layer: learning
module: meta
created: 2026-04-19
updated: 2026-04-19
tags: [learnings, database, ontology, schema-design]
---

# Learning-0070: Sibling table pattern does not answer ontology questions; it hides them

## What Happened

During the 2026-04-19 council on "Kanaler som Help Desk", the supervisor proposed resolving the wide-column problem (7 conditional columns on `channel` for desk_query) by extracting them to a sibling table `channel_desk_query` with `UNIQUE(channel_id)` — matching the existing pattern used by `channel_ai_policy`, `channel_notification_policy`, and `channel_retention_policy`.

The steward and narrator pushed back. The sibling pattern works for those three existing tables because they express **attributes ABOUT a channel** (policy decisions, retention rules, AI behavior). A desk_query is different — it is an **entity with its own lifecycle** (open → in_progress → resolved → closed, SLA timer, assignment transitions) that merely uses a channel thread for its conversation. Extracting ticket fields to a sibling table preserved the ontology error ("desk_query IS-A channel") while only fixing the cosmetic symptom (column sprawl on the parent).

All five reviewers independently converged on the same grunnproblem: a ticket is a Cascade entity (Event Engine process + state), not a channel with decoration.

## What We Learned

Sibling tables answer "where should these columns live?" but not "does this concept belong on this parent at all?" The sibling pattern is structurally sound when the extracted columns describe the parent; it misleads when the extracted columns describe an entity that happens to be adjacent.

Three tests distinguish the two cases:

1. **Lifecycle test:** Does the sibling have its own state machine? (`channel_ai_policy` — no, it's configuration. `desk_query` — yes, it transitions through states.)
2. **Deletion test:** If the parent is archived, does the sibling become meaningless or must it be preserved? (`channel_retention_policy` dies with the channel. A resolved ticket's audit trail must outlive a channel archive.)
3. **Cross-reference test:** Do other parts of the system reference the sibling as a first-class entity, or only via the parent? (Policies are always accessed "through the channel." Tickets are accessed by ticket_id, queue, assignee, priority — the channel is incidental.)

If any test fails, the sibling pattern is hiding an ontology miss, not solving a shape problem.

## The Rule

When column sprawl is proposed for extraction to a sibling table, apply the three tests before accepting. If lifecycle/deletion/cross-reference point to first-class-entity status, the right answer is a new table with its own primary key, not a sibling table. In the helpdesk case, "entity with lifecycle" is `engine_state` (ADR-0161), and the channel is the conversation projection — not the parent.

Corollary: `channel_ai_policy`, `channel_notification_policy`, `channel_retention_policy` are correct uses of the sibling pattern (all three fail no test). They should not be cited as precedent for entities that do fail the tests.

## References

- ADR-0161 — Helpdesk ontology (ticket as engine_state), uses this learning as rejection rationale.
- Council 2026-04-19 — five reviewers converged on ontology mismatch.
- Cascade invariant #2 — one role per datum.
