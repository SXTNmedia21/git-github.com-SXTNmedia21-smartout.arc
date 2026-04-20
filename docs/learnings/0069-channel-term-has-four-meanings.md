---
title: "The word 'channel' has four meanings in this codebase"
id: L-0069
status: accepted
layer: learning
module: meta
created: 2026-04-19
updated: 2026-04-19
tags: [learnings, naming, ontology, vocabulary]
---

# Learning-0069: The word "channel" has four meanings in this codebase — adopt disambiguating prefixes

## What Happened

During the 2026-04-19 helpdesk council, the agent-coordinator traced capability-and-restriction paths and discovered four distinct concepts all named "channel":

| Name in code | Type | Location | Meaning |
|---|---|---|---|
| `SessionChannel` | `"chat" \| "voice" \| "sms" \| ...` | `packages/ai/src/capabilities/types.ts:26-36` | Transport modality of an agent session |
| `engine_process.allowed_channels` | `text[]` of SessionChannel values | `20260304100000_engine_process_tables.sql` | Which modalities a process may run on |
| `comm_channel_type` | `'department' \| 'team' \| 'session' \| 'custom' \| 'direct' \| 'news' \| 'skill'` | `20260422300000_channel_communications.sql:11-14` | What kind of Komm room this is |
| `channel.id` | uuid | Same migration | Identifier of a specific Komm room |

The briefing for the helpdesk proposal used bare "channel" for multiple concepts, and at least one reviewer's analysis contained a mis-mapping (treating `engine_process.allowed_channels` as a property of a Komm channel row). The collision is not hypothetical — it actively confused a capable reviewer during review.

## What We Learned

When a short common word becomes the name of multiple distinct concepts, every discussion and every code review inherits the ambiguity. Senior reviewers can disambiguate from context; new contributors and AI agents cannot. The failure mode is silent: wrong code gets written because the author thought they were operating on one concept while touching another.

Four-way collisions compound:
- In specs, "the channel is restricted" is ambiguous across all four meanings.
- In migrations, `allowed_channels` text vs `channel_id` uuid reads as two different fields about the same thing.
- In prompts to LLMs, "check the channel policy" loads the wrong concept.
- In naming new columns, developers pick the shortest available name, increasing collision rate.

## The Rule

Adopt prefix convention immediately for all new code touching these concepts:

1. **`session_modality`** (or `originating_modality`) — for the `SessionChannel` concept. "The session's modality" reads cleanly.
2. **`allowed_modalities`** — for `engine_process.allowed_channels` (amends column name; migration path required). Short-term documentation aid until renamed.
3. **`room_type`** — for the `comm_channel_type` enum. "What kind of room is this?" avoids the word channel entirely.
4. **`channel_id`** or **`room_id`** — for the UUID on the `channel` table. Keep `channel_id` for back-compat but prefer `room_id` in new code.

Usage rule: no new spec, ADR, or code comment uses bare "channel" for any of these concepts. Either one of the four above prefixes, or explicit qualification ("the Komm channel row," "the agent session's channel").

For code already written: leave column names for now (migration cost > value), but add prefix-style variable names in new logic. Gradual migration is acceptable; forcing a rename now creates more breakage than clarity.

## References

- Council 2026-04-19 — helpdesk, code-trace discovery.
- ADR-0078 — channel restriction (uses "channel" for multiple meanings).
- ADR-0107 — BotssonProvider channel derivation (first ADR to distinguish SessionChannel cleanly).
- ADR-0160 — `channel_event` vs `engine_event` boundary (uses "channel" for the Komm concept).
