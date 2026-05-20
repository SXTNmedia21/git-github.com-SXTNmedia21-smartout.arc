---
title: "SET CONSTRAINTS ALL DEFERRED Does Not Defer Plain Triggers"
id: LEARNING_0312
status: canonical
layer: learning
created: 2026-05-18
updated: 2026-05-18
tags: [postgres, triggers, atomicity, council, spec-review, ADR-0369]
---

# Learning-0312: SET CONSTRAINTS ALL DEFERRED Does Not Defer Plain Triggers

## Context

Council review on 2026-05-18 of the Announcement Kind/Tier/Entity-Link design spec (V1 Pragmatic Sidecar). The spec proposed an atomic RPC `publish_announcement_atomic` that wraps two-row INSERTs (`channel_message` + `announcement_meta`) and claimed atomicity via `SET CONSTRAINTS ALL DEFERRED`. The notification trigger was redesigned to read `announcement_meta.tier` at trigger-fire time.

Steward Phase 3 verdict was APPROVE-WITH-CONDITIONS based on the assumption that `SET CONSTRAINTS ALL DEFERRED` would re-order the trigger fire so the sidecar exists at trigger-fire time.

## Discovery

`SET CONSTRAINTS ALL DEFERRED` is a PostgreSQL command that affects ONLY constraints declared `DEFERRABLE` (and either `INITIALLY DEFERRED` or set deferred via this command). It does NOT affect:

- Plain `CREATE TRIGGER ... AFTER INSERT` triggers — these fire immediately after the row insert (or at statement end for statement-level triggers).
- Non-deferrable FK constraints.
- Non-deferrable UNIQUE constraints.

To defer a trigger, the trigger itself must be declared as `CREATE CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`. Constraint triggers fire at commit time.

The notification trigger at `supabase/migrations/20260422310100_channel_message_notification_trigger.sql:79-82` is a plain `CREATE TRIGGER ... AFTER INSERT`, NOT a constraint trigger. Therefore `SET CONSTRAINTS ALL DEFERRED` inside the RPC is a no-op for this trigger. The trigger fires immediately after `channel_message` INSERT, before `announcement_meta` INSERT — the sidecar does not yet exist.

Consequence: every announcement published via the proposed RPC would receive `tier='work'` from the COALESCE fallback in the trigger because the sidecar lookup returns NULL. The tier-driven notification feature would be non-functional at run-time despite the code appearing to handle it.

## Impact

**Hard rule for future spec reviews:** If a spec claims atomicity between two INSERTs by referencing `SET CONSTRAINTS ALL DEFERRED`, the chair MUST verify:

1. The constraint or trigger being deferred is explicitly `DEFERRABLE` (FK marked `DEFERRABLE`, UNIQUE marked `DEFERRABLE`, or trigger declared as `CONSTRAINT TRIGGER`).
2. If the deferral target is a regular AFTER INSERT trigger, REJECT the atomicity claim — propose one of three alternatives:
   - (A) Reverse INSERT order + DEFERRABLE FK on dependent side.
   - (B) Move trigger logic into the RPC body (single-transaction explicit ordering).
   - (C) Convert trigger to CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED.

**Council protocol update:** Phase 3 chair must include a "transaction semantics check" alongside ADR coherence and trust-gate for any spec touching INSERT ordering across multiple tables with triggers.

**Memory hook for future spec authors:** When you need two-row atomic writes with trigger awareness, explicitly NAME the atomicity mechanism. "Atomic via deferred constraints" is insufficient unless the constraints + triggers are actually deferrable.

## References

- ADR-0369 (Announcement Atomicity — RPC-Body Fan-Out, deferred placeholder pending re-draft)
- Council session: `docs/council/COUNCIL-LOG.md` entry 2026-05-18 Announcement Kind/Tier/Link spec REJECT verdict
- PostgreSQL docs: [SET CONSTRAINTS](https://www.postgresql.org/docs/current/sql-set-constraints.html), [CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html)
- Falsifying evidence: `supabase/migrations/20260422310100_channel_message_notification_trigger.sql:79-82`
- Sibling pattern: L-0299 (pipe-mask signature assumption ≠ runtime reality)

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
