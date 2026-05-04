---
title: "DB Triggers That Emit Domain Events Must Gate Like Application Writers"
id: LEARNING_0110
status: canonical
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [database, triggers, authority, gate-action, c4, engine-event, daily-operation, council]
---

# Learning-0110: DB Triggers Must Gate Like Application Writers

## Context

Council 2's consolidation plan (ADR-0187, see L-0108) proposes `trg_session_pending_signoff` as the sole emitter for `department_session.status='pending_signoff'` transitions. The trigger fires on `UPDATE` of `session_hook` where `hook_key='pre_close'` and `status='complete'`, walks up to the parent session, flips `status`, and INSERTs into `engine_event`.

The Phase 2.5 review asked: does this trigger pass through `gate_action`? The answer in the proposed implementation was no — "triggers are infrastructure, gating is for application writers." Council 2 rejected that framing. A trigger that inserts into `engine_event` and flips a business-visible status column is an **authoritative writer**; it is as capable of corrupting the audit trail as any Server Action.

Without `gate_action` in the trigger body, any `UPDATE` that satisfies the trigger condition — including stray admin queries from a migration console, a cron misfire, a manually-executed SQL snippet, or a future malicious INSERT path — produces legitimate-looking `engine_event` rows with no authority record. The activity trail says "the system transitioned this session" without any signed actor identity or evaluated policy.

Council 2 made trigger-gating a precondition for merging ADR-0187.

## Discovery

"System-initiated" is not a synonym for "ungated." The gate is not about the actor being human — it's about *whether a policy was evaluated against a capability, regardless of who triggered it*. Three roles a gated system-initiated action fills:

1. **Policy evaluation record** — `gate_evaluation` row proves the transition was evaluated against `engine_authority_config.session.auto_signoff_transition` with `min_role='system'`. Without it, we can't distinguish legitimate auto-transitions from stray writes.
2. **Deny path** — if an operator temporarily disables auto-signoff by flipping `engine_authority_config.enabled = false`, the trigger must respect it. Ungated triggers cannot be paused without DROP TRIGGER.
3. **Actor channel labeling** — the gate records `channel='system'` and `actor_profile_id=NULL`. Downstream surfaces (admin audit, AI-copilot narrative) can then distinguish "the system advanced this" from "the leader advanced this", rendering accordingly.

Applies equally to emit-registry subscribers: if a subscriber re-fires events based on `engine_event` rows (fan-out to external webhooks, Slack, email digests), the subscriber's emit path is also a gated writer. Using `system` as the channel identifier does not remove the gate — it passes the gate with a system-labeled evaluation.

The seeded capability for the trigger must live in the same migration that creates the trigger. Per L-0107 and L-0111, a gate call without a seed row default-allows and is therefore fictitious. For triggers the pattern becomes:

```sql
CREATE OR REPLACE FUNCTION trg_session_pending_signoff() RETURNS TRIGGER AS $$
DECLARE
  v_allow BOOLEAN;
BEGIN
  SELECT allow INTO v_allow FROM gate_action(
    p_workspace_id := NEW.workspace_id,
    p_capability := 'session.auto_signoff_transition',
    p_channel := 'system',
    p_actor_profile_id := NULL
  );
  IF NOT v_allow THEN
    RAISE EXCEPTION 'auto-signoff-transition blocked by authority config';
  END IF;
  -- ... proceed with UPDATE + engine_event INSERT ...
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

And the seed row lands in the same migration:

```sql
INSERT INTO engine_authority_config (workspace_id, capability, min_role, enabled, ...)
SELECT id, 'session.auto_signoff_transition', 'system', true, ... FROM workspace;
```

## Impact

- **ADR-0187 precondition:** Trigger-gating is required before the consolidation merges. No trigger that emits `engine_event` lands without `gate_action` in the body.
- **Seed parity (L-0111 / ADR-0189):** System-role capabilities (`min_role='system'`) are part of the CI parity check. Trigger body grep for `gate_action` literal + migration grep for seed INSERT.
- **Emit-registry subscribers:** Subscribers that perform subsequent authoritative writes (webhook dispatch, external fan-out) must also pass through `gate_action` with `channel='system'`. Covered in ADR-0187 §Subscribers.
- **Terminology fix:** "System" is a channel label, not a bypass. Removed the informal phrasing "triggers don't need gates" from council Phase 2 guidance.
- **Applies retroactively:** Existing triggers that insert into `engine_event` (audit-log triggers, `activity_trail` writers) are in scope for a follow-up audit. Council 2 flagged this as a separate sortie — not in scope for the current consolidation but queued.

## References

- ADR-0187 (proposed — single-emitter, includes gated-trigger requirement)
- ADR-0189 (proposed — CI seed parity covers `min_role='system'` capabilities, see L-0111)
- ADR-0099 (original `gate_action` contract)
- ADR-0091 (`cascade_gate_write` placement — related authority layer)
- Learning-0107 (authority appearance ≠ presence)
- Learning-0111 (CI capability seed parity)
- Council 2 verdict, 2026-04-22 daily-operation session

---

> Registered in `docs/learnings/0000-learning-log.md`.
