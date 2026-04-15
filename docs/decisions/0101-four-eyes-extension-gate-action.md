---
title: "Four-Eyes Extension to gate_action (History-Based)"
id: ADR_0101
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
module: stage-engine
tags: [adr, security, c4-governance, authority, four-eyes, adr-0099]
---

# ADR-0101: Four-Eyes Extension to gate_action (History-Based)

**Status:** Accepted
**Date:** 2026-04-15

## Context and Problem Statement

ADR-0099 established `public.gate_action` as the unified authority gate. Some
capabilities (e.g. `shift_lifecycle.approve`, contract signing, deviation
closure on high-severity events) require *two* distinct actors to approve the
same entity before the mutation is allowed to land — a "four-eyes" policy.

Phase 0 Foundation already introduced the `engine_authority_config.requires_four_eyes`
column (migration `20260415120400`) and a first-cut gate extension
(`20260506110000`) that required callers to pass a `p_approvers_present UUID[]`
array. That approach pushes the state of "who has approved so far" up to the
caller, which does not hold it — it is stateless per request. The result was
that four-eyes only ever triggered when a client deliberately assembled a
two-actor array, which never happens in practice.

## Decision Drivers

- Four-eyes must be *decided by the gate*, not by the caller's accounting.
- The audit table `gate_evaluation` already records every call, including actor
  and capability. It is the natural state-of-record for "who has tried".
- Callers (agent-router, engine-dispatch, shift_lifecycle tools) must not need
  to coordinate state out-of-band.
- Entity scoping is required: the two eyes must be for the *same* object, not
  any object under the same capability.

## Considered Options

1. **Client-supplied `p_approvers_present UUID[]` array** (existing, ADR-0101 v1).
   Rejected — callers are stateless and cannot know prior actors.
2. **Dedicated `four_eyes_approval` table**. Rejected — duplicates data already
   in `gate_evaluation`; adds coupling with no new expressive power.
3. **History-based lookup on `gate_evaluation`** (chosen). Add `entity_id UUID`
   to `gate_evaluation`; `gate_action` takes a new optional `p_entity_id UUID`
   parameter. When `requires_four_eyes = true`, the gate queries
   `gate_evaluation` for any prior evaluation on the same
   (workspace_id, capability, entity_id) by a *different* actor. Present → allow
   (this is the second eye). Absent → deny with `reason = 'four_eyes_required'`.
   The current attempt is still audited, so the *next* distinct actor sees it.

## Decision Outcome

Chosen option: **history-based lookup on `gate_evaluation`**.

Migration `20260509100000_gate_action_four_eyes_history.sql`:

- `ALTER TABLE gate_evaluation ADD COLUMN entity_id UUID`.
- `CREATE OR REPLACE FUNCTION gate_action(..., p_entity_id UUID DEFAULT NULL)`
  with the history check. `p_approvers_present` remains in the signature as a
  no-op parameter for backwards compatibility with any intermediate caller but
  is not consulted for the decision.
- Each evaluation row now carries `entity_id` when the caller supplies one.

Callers that want four-eyes enforced must pass `p_entity_id`. Callers that do
not pass an `entity_id` get the pre-four-eyes behaviour (default-allow when
`requires_four_eyes = true` becomes undefined — we treat it as deny to fail
closed, matching the PLAN's intent).

## Rules & Consequences enforced for Agents

- **Good, because** the gate is self-sufficient — no stateful orchestration on
  the client side.
- **Good, because** entity scoping prevents cross-contamination (Alice approving
  shift A does not credit her as the first eye on shift B).
- **Bad, because** the gate now reads from its own audit table, creating a
  read dependency on `gate_evaluation`. Acceptable: the row count per
  (workspace, capability, entity) is bounded (four-eyes capabilities are rare).
- **Agent Impact:** `shift_lifecycle.approveShift` must pass
  `entity_id = shift_id` when calling the gate. Other four-eyes capabilities
  added in future must do the same.

## Test Coverage

pgTAP (`supabase/tests/gate-action.sql`):

- Case A: `requires_four_eyes=true`, single actor, no prior row → deny,
  `reason = 'four_eyes_required'`.
- Case B: `requires_four_eyes=true`, second distinct actor after a prior
  attempt → allow.
- Case C: `requires_four_eyes=false` → unchanged behaviour, no four-eyes
  denial.

Vitest (`packages/ai/src/capabilities/shift-lifecycle/__tests__/tools.test.ts`):
covers the surfaced `four_eyes_pending` response on `approve_shift`.
