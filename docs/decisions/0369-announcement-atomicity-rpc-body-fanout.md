---
title: "Announcement Atomicity — RPC-Body Fan-Out"
id: ADR_0369
status: accepted
layer: decision
created: 2026-05-18
updated: 2026-05-18
---

# ADR-0369: Announcement Atomicity — RPC-Body Fan-Out

> Drafted from council REJECT verdict on V1 spec (2026-05-18, Phase 5 chair self-reversal precedent #10 per L-0294). **Decision: Option B (RPC-body fan-out)** locked 2026-05-18 by Pontus. V2 spec must implement per §Decision Outcome.

## Context and Problem Statement

The Announcement Kind/Tier/Entity-Link spec (V1 Pragmatic Sidecar) introduced a two-row write (`channel_message` + `announcement_meta`) and claimed atomicity via `SET CONSTRAINTS ALL DEFERRED` in the wrapping RPC. Council Phase 5 reversed the chair's APPROVE-WITH-CONDITIONS verdict after Supervisor's code-trace showed `SET CONSTRAINTS` only defers DEFERRABLE constraints (FK + UNIQUE marked DEFERRABLE), NOT plain `AFTER INSERT` triggers. The notification trigger at `supabase/migrations/20260422310100_channel_message_notification_trigger.sql:79-82` is a plain `AFTER INSERT` trigger and fires at statement end, NOT at COMMIT.

Consequence of the failed assumption: every announcement published via the proposed RPC would receive `tier='work'` from the COALESCE fallback in the trigger, because the sidecar (`announcement_meta`) does not exist at trigger-firing time. The tier-driven notification path would never observe the actual tier.

This ADR documents the architectural choice the spec must lock before re-submission.

## Decision Drivers

- Trigger refactor in the original spec assumed PostgreSQL semantics that do not hold for plain (non-constraint) triggers.
- Three viable alternatives surfaced during council review; each has different operational + migration trade-offs.
- Atomicity is load-bearing for the tier-driven notification feature — without it, the feature is non-functional.
- The chosen mechanism must preserve the existing trigger's load-bearing behaviours (EXCEPTION handler, mute filter, sender exclusion).
- Cross-module impact: the notifications module owner is consulted because the fan-out target shape (notification_outbox) sits in that module.

## Considered Options

1. **Option A — Reverse INSERT order + DEFERRABLE FK on sidecar.** Insert into `announcement_meta` FIRST with a pre-generated `message_id`, then insert into `channel_message` with the same id. Requires the FK `announcement_meta.message_id REFERENCES channel_message(id)` to be `DEFERRABLE INITIALLY DEFERRED`. `SET CONSTRAINTS ALL DEFERRED` then DOES apply to the FK. At commit, both rows exist + FK validates. Pros: minimal trigger surgery. Cons: changes FK semantics; FK is now deferred for ALL channel_message inserts globally (or per-statement if set per statement) — possible action-at-distance for other code paths.

2. **Option B — Move fan-out out of `AFTER INSERT` trigger into RPC body.** The RPC inserts both rows, then explicitly invokes the fan-out logic (e.g. via a helper function `publish_announcement_notifications(message_id)`) inside the same transaction. The existing `AFTER INSERT` trigger continues to fire for non-announcement message types only (early-return on `message_type='announcement'`). Pros: simplest atomicity story (no DEFERRABLE complexity); explicit ordering; easier to test. Cons: two code paths for fan-out (trigger for non-announcements, RPC for announcements); both must stay in lockstep on shared invariants (channel_member subscription, mute, sender exclusion).

3. **Option C — Convert notification trigger to CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED.** Trigger fires at COMMIT instead of after each INSERT. `announcement_meta` exists at trigger-firing time. Pros: single trigger code path; minimal RPC surgery. Cons: `CREATE CONSTRAINT TRIGGER` requires specific syntactic shape; SECURITY DEFINER constraint triggers are less common and may surprise future maintainers; deferred timing affects ALL channel_message inserts (including non-announcements) — subtle semantic change.

## Decision Outcome

**Chosen: Option B — Move fan-out out of `AFTER INSERT` trigger into RPC body.**

Concrete shape:

```sql
CREATE OR REPLACE FUNCTION public.publish_announcement_atomic(
  p_workspace_id uuid,
  p_actor_profile_id uuid,
  p_channel_id uuid,
  p_title text,
  p_body text,
  p_kind announcement_kind,
  p_tier announcement_tier,
  p_tags text[],
  p_linked_entity_type entity_link_type_enum,
  p_linked_entity_id uuid,
  p_visibility channel_message_visibility,
  p_targeted_member_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id uuid;
BEGIN
  -- 1. Capability gate (defense-in-depth — RPC enforces, even if caller already gated)
  PERFORM public.assert_capability(p_workspace_id, p_actor_profile_id, 'communication', 'publish_announcement');

  -- 2. Insert parent message
  INSERT INTO channel_message (workspace_id, channel_id, sender_profile_id, message_type, title, body, visibility, targeted_member_ids)
  VALUES (p_workspace_id, p_channel_id, p_actor_profile_id, 'announcement', p_title, p_body, p_visibility, p_targeted_member_ids)
  RETURNING id INTO v_message_id;

  -- 3. Insert sidecar (sibling row, same transaction)
  INSERT INTO announcement_meta (channel_message_id, kind, tier, tags, linked_entity_type, linked_entity_id)
  VALUES (v_message_id, p_kind, p_tier, p_tags, p_linked_entity_type, p_linked_entity_id);

  -- 4. Inline fan-out (replaces trigger path for announcements)
  PERFORM public.fn_publish_announcement_notifications(v_message_id, p_tier, p_targeted_member_ids);

  RETURN v_message_id;
END $$;

REVOKE ALL ON FUNCTION public.publish_announcement_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_announcement_atomic TO authenticated, service_role;
```

The existing `AFTER INSERT` trigger at `supabase/migrations/20260422310100_channel_message_notification_trigger.sql:79-82` keeps fan-out for non-announcement message types. The trigger gets a guard: `IF NEW.message_type = 'announcement' THEN RETURN NEW; END IF;` at the top — announcement fan-out lives ONLY in the RPC body.

Until V2 spec lands:
- No migration file may be written that re-uses the SET CONSTRAINTS pattern from V1.
- The 4 composer paths must converge on `publish_announcement_atomic` RPC.
- Direct `INSERT INTO channel_message ... message_type='announcement'` outside the RPC is forbidden — add a CHECK trigger if necessary to enforce.

## Rules and Consequences

- **Good, because** documenting the atomicity choice explicitly prevents future spec drafts from making the same SET CONSTRAINTS mistake.
- **Good, because** Option B preserves the existing trigger's safety net (EXCEPTION WHEN OTHERS) for non-announcement message types unchanged.
- **Bad, because** any choice introduces complexity (DEFERRABLE FK action-at-distance, two-path fan-out, or constraint-trigger semantic surprise).
- **Agent Impact:** Future capability tools that need cross-table atomic writes must explicitly name their atomicity mechanism. Generic SET CONSTRAINTS reference is rejected. Council Phase 3 chairs must verify atomicity claims against PostgreSQL transaction semantics, not just against intent prose.

---

> After re-draft of spec: finalize one option, register in `docs/decisions/0000-decision-log.md`, update ADR table in `CLAUDE.md`. Pair with ADR-0370 + ADR-0371 (council derivatives).
