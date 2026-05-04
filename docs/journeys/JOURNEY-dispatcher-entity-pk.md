---
title: "Journey — Dispatcher ENTITY_PK extension for Helpdesk + channel"
status: done
updated: 2026-04-20
created: 2026-04-20
module: helpdesk-channel
tags: [engine-dispatch, entity-pk, helpdesk, phase-2-prep]
---

# Journey — Dispatcher ENTITY_PK extension for Helpdesk + channel

> Sub-sortie D of the Helpdesk campaign. Pure infrastructure: unlocks Phase 2
> capability tools that need to mutate `channel`, `channel_message`, or
> `engine_state` rows through dispatcher `update_entity` steps. No new UI,
> no new user-visible behavior in Phase 1.

## Context

L-0085 captured that `supabase/functions/engine-dispatch/index.ts` maintains
two hand-rolled structures that silently no-op when an entity type is not
listed:

1. `ENTITY_PK` (line 494) — maps `entity_type` → primary-key column name.
2. The inline `allowed` array inside the `case "update_entity":` branch
   (around line 720) — a second allowlist that must mirror ENTITY_PK.

The Progressive Channel council (ADR-0165) and the helpdesk Phase 1 seed
migration (`20260515130200_helpdesk_query_process_seed.sql`) both explicitly
flagged this as a Phase 2 prerequisite: engine_process blueprints that want
to set `engine_state.status`, update `channel.channel_type`, or record
`channel_message` deliveries through the dispatcher were blocked until the
map grew. This sub-sortie adds those three entries so future capability
tools can consume them without further dispatcher work.

## Journey: Capability author adds an update_entity step targeting a channel

**Precondition:** engineer is drafting a Phase 2 capability tool or
engine_process step that needs to mutate `channel`, `channel_message`, or
`engine_state`.

1. Engineer opens `supabase/functions/engine-dispatch/index.ts` and reads
   the `ENTITY_PK` map → **system shows** `channel`, `channel_message`, and
   `engine_state` are listed with PK column `"id"`.
2. Engineer authors the dispatcher step payload:
   `{ action_type: "update_entity", entity: "channel", set: { channel_type: "desk" } }`
   and triggers the process. → **Dispatcher** passes the `gate_action` check,
   looks up `ENTITY_PK["channel"]`, runs
   `.from("channel").update(...).eq("id", state.entity_id)`.
3. On success, dispatcher calls `advanceToNextStep`. → **Engineer sees** the
   target row updated and the engine_state progressing.

**Postcondition:** engine_process blueprints can mutate channel / message /
engine_state rows without the earlier silent-noop trap.

**Error paths:**

- **PK mismatch** — if a future entity is added to the allowlist but its
  real PK column is NOT `id`, the `.eq("id", ...)` will match zero rows and
  the handler now surfaces the Supabase error by marking the state
  `status='blocked'` with `last_error` populated. This behavior was hardened
  earlier (ultrareview rp6ofqyfv bug_013) and applies uniformly.
- **ENTITY_PK / allowlist divergence** — the Deno whitelist test
  `entity_pk_test.ts` fails in CI if the two structures drift out of sync.

## Journey: Capability author adds a ticket-resolution engine_process step

**Precondition:** Phase 2 ticket workflow needs to flip
`engine_state.status` to `complete` from inside a dispatcher step (instead
of through the current Server Action path).

1. Engineer writes `{ action_type: "update_entity", entity: "engine_state",
   set: { status: "complete", completed_at: "<timestamp>" } }` as a process
   step. → **System** resolves `ENTITY_PK["engine_state"] === "id"`, runs the
   update against the parent ticket state row, and advances the process.
2. Downstream consumers (notification_outbox, activity_trail, UI realtime
   channel) observe the state transition. → **Employee sees** their
   helpdesk ticket move to "resolved" in the mobile thread view.

**Postcondition:** ticket-resolution orchestration can live inside a single
engine_process blueprint without requiring an out-of-band Server Action.

**Error paths:**

- `gate_action` denial still blocks the update (ADR-0099 remains the
  authority check).
- A completed `engine_state` with a null `completed_at` is rejected by
  L-0079's invariant; callers must include `completed_at` in the `set`
  payload when transitioning to `complete`.

## Journey: Reviewer audits the dispatcher for silent-noop regressions

**Precondition:** reviewer or future Claude session wants to confirm
L-0085's guard is still in place after unrelated changes to the dispatcher.

1. Reviewer runs
   `deno test --allow-read supabase/functions/engine-dispatch/entity_pk_test.ts`.
   → **Test harness** asserts (a) all nine required entities live in
   ENTITY_PK with the expected PK column, and (b) the inline `update_entity`
   allowlist lists every ENTITY_PK key.
2. If a future PR deletes an entry from one structure but not the other,
   the test fails with a message pointing to L-0085. → **Reviewer sees** the
   divergence before merge.

**Postcondition:** the silent-noop trap captured in L-0085 is caught by
mechanical test rather than line-by-line code-trace.

## Out of scope (deferred to Phase 2)

- `assign_task` handler extension. Today the handler only creates a
  `session_task` when `state.entity_type === "department_session"`; for a
  helpdesk ticket (`entity_type === "engine_state"` or `"channel"`) it
  silently advances. Phase 2 capability tools assign tickets through the
  `helpdesk_query` capability's application-layer `assign_ticket` tool, not
  through a dispatcher step, so this remains acceptable until the Progressive
  Channel council opens a concrete use-case.
- Code-generating ENTITY_PK from `packages/supabase/src/database.types.ts`.
  L-0085's long-term recommendation. Tracked separately — out of scope for
  this sub-sortie.
- Dispatcher-side `create_channel_message` or notify-over-channel handlers.
  Belongs to Phase 2 capability work, not infrastructure.

## Related

- L-0085 — Dispatcher ENTITY_PK map is a hand-maintained ceiling
- ADR-0165 — Progressive Channel Discriminator (Phase 2 consumer)
- ADR-0161 — Helpdesk ticket ontology (ticket = engine_state)
- ADR-0099 — Unified authority gate (still runs before every update_entity)
- Migration `20260515130200_helpdesk_query_process_seed.sql` — explicit
  Phase 2 deferral comment the dispatcher now unblocks
