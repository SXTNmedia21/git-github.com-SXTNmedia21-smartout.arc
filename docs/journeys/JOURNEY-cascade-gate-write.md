---
title: User Journeys — cascade-gate-write (ADR-0091 WP2)
status: ready-for-merge
updated: 2026-04-18
created: 2026-04-18
module: governance
tags: [governance, adr-0091, adr-0114, c4, cascade_gate_write]
---

# User Journeys — cascade-gate-write (ADR-0091 WP2)

The three journeys below cover the ways `cascade_gate_write` changes
developer and reviewer behavior now that WP2 is live. They complement
the cascade-foundation journeys (which describe how governance data gets
into the workspace) — these describe how mutations against that data
are mediated.

---

## Journey: Developer writes a governance-gated mutation

**Precondition:**
- Workspace has an active `regulatory_framework` (via
  `workspace_framework_binding`).
- `framework_trigger` rows exist for the framework, at least one
  matching `source_entity_type = '<table under write>'`.
- Developer is writing a Server Action (per ADR-0114) for, e.g.,
  updating an `employment_contract`.

1. Developer writes a Server Action that needs to update an
   `employment_contract` row → Per ADR-0114 R3, they import
   `gatedUpdate` from `@smartout/supabase/gate-client` instead of
   calling `supabase.from('employment_contract').update(...)` directly.
2. The Server Action calls
   `gatedUpdate({ entityType: 'employment_contract', entityId, patch, workspaceId, actorProfileId })`
   → The TS wrapper calls
   `supabase.rpc('cascade_gate_write', { p_entity_type, p_entity_id, p_action: 'update', p_workspace_id, p_proposed_data, p_current_data, p_actor_profile_id })`.
3. Inside the RPC, `assert_gate_caller()` runs first → System verifies
   either `auth.uid()` matches `p_actor_profile_id` (JWT path) or the
   caller is `service_role` with a non-null `p_actor_profile_id`
   (service path). Mismatch raises `SQLSTATE '42501'` and the function
   returns nothing.
4. Identity verified → System resolves the workspace's active framework
   via `workspace_framework_binding` and scans `framework_trigger` rows
   matching `source_entity_type = 'employment_contract'`.
5. At least one trigger matches → System inserts a `change_proposal` row
   with `proposal_state = 'pending'`, carrying the diff between
   `p_current_data` and `p_proposed_data` and the list of matched
   trigger IDs → System writes a `gate_evaluation` audit row recording
   `outcome = 'proposed'`, `proposal_id = <new uuid>`, `actor_profile_id`,
   `entity_type`, `entity_id`, `workspace_id` → RPC returns
   `{ allowed: false, outcome: 'proposed', proposal_id: '<uuid>' }`.
6. TS wrapper maps the RPC JSON into `GateResponse` shape → Returns
   `{ ok: false, outcome: 'proposed', proposal_id }` to the Server
   Action.
7. Server Action surfaces the proposal ID to the UI → User sees a toast
   "Endringen krever godkjenning — forslag #<short-id> opprettet" with
   a link to the pending proposals view. The `employment_contract` row
   on disk is unchanged.

**Postcondition:**
- A `change_proposal` row exists in state `pending` carrying the diff.
- A `gate_evaluation` audit row records the decision.
- The target table row is unchanged.
- The UI informs the user that a proposal was created.

**Error paths:**
- **Caller identity mismatch** → `assert_gate_caller()` raises `42501`.
  TS wrapper surfaces this as `{ ok: false, outcome: 'blocked', reason: 'caller_identity_mismatch' }`.
  Server Action renders as an error toast; no audit row is written
  because the function aborts before reaching the audit insert.
- **`workspace_id` has no active framework binding** → See the third
  journey (no-friction path).
- **Framework is bound but no trigger matches** → System writes a
  `gate_evaluation` row with `outcome = 'applied'`, performs the
  write inline (inside the RPC transaction), and returns
  `{ allowed: true, outcome: 'applied' }`. No proposal is created.
- **Underlying DB constraint on the target row violates** (FK, NOT NULL,
  check) → Constraint error bubbles up; `gate_evaluation` still records
  the attempted outcome but the write is rolled back with the rest of
  the transaction.

---

## Journey: Reviewer approves a pending proposal

**Precondition:**
- A `change_proposal` row exists in `proposal_state = 'pending'` for the
  workspace, created by the first journey.
- Reviewer has `admin` or `owner` role in the workspace.

1. Reviewer opens the pending-proposals surface → System lists
   `change_proposal` rows filtered to their workspace.
2. Reviewer selects the proposal → System renders the diff (old values
   vs proposed values) and the matched trigger descriptions.
3. Reviewer clicks "Approve" → Server Action updates
   `change_proposal.proposal_state` to `'approved'`, records
   `approved_by_profile_id` and `approved_at`, and re-invokes the
   original write path with an approval context.
4. Application code re-calls `gatedUpdate` with an
   `approved_proposal_id` field in the context → The TS wrapper passes
   this through as part of `p_proposed_data`'s metadata envelope (the
   wrapper convention is to carry approval context in
   `_governance.approved_proposal_id`).
5. Inside the RPC, the trigger scan still runs, but the audit logic
   recognizes the `approved_proposal_id` tied to the same diff →
   System writes the row inline, writes a `gate_evaluation` row with
   `outcome = 'applied'` and `approved_proposal_id = <id>`, and
   returns `{ allowed: true, outcome: 'applied' }`.
6. TS wrapper returns `{ ok: true, outcome: 'applied' }` → Server Action
   surfaces success toast; UI re-fetches and reflects the new value.

**Postcondition:**
- `change_proposal.proposal_state = 'approved'`.
- Target row carries the proposed values.
- Two `gate_evaluation` rows exist for this change: the original
  `outcome = 'proposed'` and the post-approval `outcome = 'applied'`,
  linked by `proposal_id`.

**Error paths:**
- **Reviewer is not admin/owner** → ADR-0099 `gate_action` check in the
  approval Server Action rejects before `cascade_gate_write` runs.
  `change_proposal` remains `pending`.
- **Underlying row has been mutated between proposal creation and
  approval** → The approval re-write still calls the RPC; any fresh
  trigger matches against the current baseline produce a new
  proposal rather than silently overwriting. Reviewer sees a second
  pending proposal rather than a false-success.
- **Proposal already approved by someone else** → Application layer
  rejects the second approval based on `proposal_state != 'pending'`.

---

## Journey: Developer writes a mutation in a workspace without active framework

**Precondition:**
- Workspace exists but has no active
  `workspace_framework_binding` — e.g. a freshly bootstrapped workspace
  where the admin has not yet chosen which framework to apply, or an
  internal test workspace.
- Developer calls `gatedInsert / gatedUpdate / gatedDelete` as usual.

1. Server Action calls `gatedInsert` → TS wrapper calls
   `cascade_gate_write`.
2. `assert_gate_caller()` verifies identity → Passes.
3. System looks up the active framework binding → Finds none (either
   no row in `workspace_framework_binding` for the workspace, or all
   bindings have `is_active = false`).
4. System short-circuits: no framework → no triggers to scan → no
   possible proposal → System writes a `gate_evaluation` audit row
   with `outcome = 'applied'` and `framework_id = NULL`, performs the
   write inline, and returns `{ allowed: true, outcome: 'applied' }`.
5. TS wrapper returns `{ ok: true, outcome: 'applied' }` → Server Action
   surfaces success toast immediately; no proposal UI is shown.

**Postcondition:**
- Target row carries the new values.
- A `gate_evaluation` audit row records the decision with
  `framework_id = NULL` (explicit record that the gate ran but found
  no governance rules to apply).
- No `change_proposal` row is created.

This is the no-friction path: workspaces without governance pay only
the single audit-row insertion cost of running the gate, but otherwise
behave exactly like a direct insert/update/delete. This is intentional
— the gate must be installable on day one without blocking workspaces
that haven't configured governance yet.
