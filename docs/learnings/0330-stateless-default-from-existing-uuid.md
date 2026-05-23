---
title: "Stateless-default — when a new contract proposes an ID field, grep adjacent code for existing UUID generation first"
id: LEARNING_0330
status: canonical
layer: learning
created: 2026-05-23
updated: 2026-05-23
tags: [council, idempotency, uuid, contract-design, stateless, dual-source-of-truth]
---

# Learning-0330: Stateless-default — reuse existing UUIDs over inventing new ID fields

## Context

Council 2026-05-23 reviewed the InlineConfirmCard HITL primitive (ADR-0398). The briefing proposed a new descriptor field `proposal_id: string` whose persistence story was open — listed options were:

- (a) stateless — UUID returned to LLM, discarded after roundtrip;
- (b) `engine_memory` row;
- (c) `engine_sessions` metadata;
- (d) new table `agent_proposal_draft`.

Code-trace by both Chair and Agent-Coord revealed that the existing `publish_announcement` tool at `packages/ai/src/capabilities/communication/publish-announcement.ts:238` ALREADY generates a UUID server-side (`crypto.randomUUID()`) and passes it to the RPC `publish_announcement_atomic` as `p_client_message_id` — a parameter that already exists in migration `20260620140400_publish_announcement_atomic_rpc.sql:20,70-80` for idempotency. The RPC enforces uniqueness on `client_message_id` via DB-level constraint.

**The proposed `proposal_id` is structurally identical to the existing `client_message_id` UUID.** Inventing it as a new field would create dual-source-of-truth (correlation token in browser, idempotency key in DB) with no synchronization guarantee.

## Discovery

**When a new contract proposes an ID field, grep adjacent code paths for existing UUID generation BEFORE adding a new field.** Hospitality + cascade code is mature enough that most "I need a correlation token" needs are already met by existing idempotency keys, foreign keys, or session identifiers. The default should be:

1. Identify the lifecycle of the new ID (this contract: from draft return → commit call).
2. Identify the persistence boundary (this contract: RPC-level idempotency — already enforced by `client_message_id` UNIQUE).
3. Grep the capability body for existing UUID generation in the same lifecycle.
4. Reuse the existing UUID under the new contract name — do NOT invent a parallel ID.

For ADR-0398 specifically: `proposal_id` IS `client_message_id`. The capability lifts `crypto.randomUUID()` BEFORE the `if (!params.confirm)` branch (currently at line 238 inside the truthy branch), returns it as `proposal_id` in draft response, and passes the same UUID to `p_client_message_id` at commit. No new persistence. No new field on a table. No race window — RPC's UNIQUE constraint is the single arbiter.

## Impact

**Trust-gate addition for Phase 5 chair (mandatory when a council reviews a contract proposing a new ID field):**

> "Does this ID field map to an existing UUID generated server-side in the same capability or in a downstream RPC parameter? If yes, the new field MUST be the same UUID under a new name, not a parallel ID. Cite file:line of existing generation. If no, document why a new ID is needed."

Failing the check = REJECT, return to brief with the existing UUID identified.

**Sibling learnings (same dual-source-of-truth class):**

- L-0176 — docstring drift (claim layer drifts from code).
- L-0177 — silent fallback from row-supplied IDs.
- L-0294 / L-0298 — ADR-text-vs-code receipts.

**Promotion criteria:** if this learning recurs across 3 councils where a proposed ID was actually an existing UUID, promote to Phase 3 hard rule in run-council SKILL.md.

## References

- ADR-0398 — InlineConfirmCard Primitive (surfaced this pattern; absorbed `proposal_id = client_message_id`).
- `packages/ai/src/capabilities/communication/publish-announcement.ts:238` — existing `crypto.randomUUID()` generation site.
- `supabase/migrations/20260620140400_publish_announcement_atomic_rpc.sql:20,70-80` — RPC's existing idempotency contract.
- L-0176, L-0177, L-0294, L-0298 — sibling dual-source-of-truth learnings.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
