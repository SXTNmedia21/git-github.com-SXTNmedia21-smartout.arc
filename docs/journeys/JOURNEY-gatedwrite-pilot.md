---
title: JOURNEY — gatedwrite-pilot
status: done
updated: 2026-04-18
created: 2026-04-18
module: governance
tags: [journey, adr-0091, gatedwrite, profile, governance]
---

## Journey: Admin changes an employee role (no active framework)

**Precondition:** Workspace has no `workspace_framework_binding` row, or binding is inactive.

1. Admin clicks "Change role" on the people table → selects new role → confirms.
2. Consumer calls `updateProfileRole(profileId, workspaceId, newRole)` from `people-data-table.tsx`.
3. Server Action in `people-actions.ts`:
   - Fetches `currentProfile` via `.select("*").eq("profile_id", profileId)`.
   - Builds `GateContext` with `entityType: "profile"`, `entityIdColumn: "profile_id"`, `capability: "profile:update:role"`, `proposedData: {role: newRole}`, `currentData: currentProfile`.
   - Calls `gatedUpdate(supabase, "profile", {role: newRole}, gateCtx)`.
4. `gatedUpdate` calls `cascade_gate_write` RPC → no active framework → returns `{allowed:true, outcome:"applied"}`.
5. Wrapper runs the actual `.from("profile").update({role}).eq("profile_id", X)` → row updated.
6. Function returns `{ok:true}` (no `pendingProposal`).
7. Consumer calls `handleGatedResult(result, {appliedMessage: "Rolle oppdatert"})` → success toast shown.

**Postcondition:** Profile row has new role. `gate_evaluation` audit row written with `allow=true`, `reason="no-active-framework"`. No `change_proposal` created.

**Error paths:**
- `currentProfile` not found → returns `{ok:false, error}`; helper shows error toast.
- Supabase write fails post-gate (RLS denial etc.) → throws; helper's error handler trips.
- Caller passed `p_actor_profile_id` not matching `auth.uid()` → `assert_gate_caller` raises 42501; Server Action catches and returns `{ok:false}`.

## Journey: Admin changes a role in a workspace with an active framework

**Precondition:** `workspace_framework_binding` active; `framework_trigger` has row with `source_entity_type="profile"` and `is_enabled=true`.

1–3. Same as journey 1 through `gatedUpdate`.
4. `cascade_gate_write` RPC: framework active + trigger matches → creates `change_proposal` row (status: `pending`, `trigger_entity_type: "profile"`, `changes: {proposed, current, action}`) → returns `{allowed:false, outcome:"proposed", proposal_id:<uuid>}`.
5. Wrapper wraps the response in `GateDeniedError` with `outcome: "proposed"` and `proposalId`.
6. Server Action catches the error, returns `{ok:true, pendingProposal: proposalId}` + emits `"profile update proposed"` telemetry (event is not yet in registry; gap flagged in HANDOFF).
7. Consumer calls `handleGatedResult(result, {appliedMessage: "Rolle oppdatert", proposedMessage: "Rolleendring sendt til godkjenning"})`.
8. Helper sees `result.pendingProposal` truthy → fires `toast.info("Krever godkjenning", {description: "Endringen er sendt til godkjenning"})`.

**Postcondition:** `change_proposal` row created, status `pending`. `gate_evaluation` audit row with `allow=false`, `reason="framework-trigger-matched"`. `profile` row NOT updated. Admin sees "Krever godkjenning" info toast.

**Error paths:**
- Profile not found before gate call → returns `{ok:false, error}`; error toast.
- RPC timeout → `GateDeniedError` thrown with `outcome: "blocked"`; consumer shows error toast. (This outcome currently unreachable — reserved for WP1.)

## Journey: Bulk action — admin reassigns 10 people to a new department

**Precondition:** 10 profiles selected in the table; active framework may or may not be present.

1. Admin opens bulk menu → "Assign to department" → selects department → confirms.
2. Consumer calls `bulkUpdateProfiles(profileIds, workspaceId, {department_id: newDept})`.
3. Server Action iterates profileIds serially (N+1 — structural, RPC is single-entity):
   - For each: fetch current profile, build GateContext with `entityIdColumn: "profile_id"`, call `gatedUpdate`.
   - Accumulate: `proposalIds[]` for proposed, `errors[]` for failed.
4. Returns `{ok:true, pendingProposal?: string, proposalIds: string[]}` (shape is structurally assignable to `GatedActionResult`; `proposalIds.length` drives the count in messaging).
5. Consumer calls `handleGatedResult(result, {appliedMessage: "10 personer tildelt", proposedMessage: \`${result.proposalIds.length} endring(er) sendt til godkjenning\`})`.
6. Helper picks the branch by presence of `pendingProposal` / `error`.

**Postcondition (no framework):** 10 profiles updated. 10 `gate_evaluation` audit rows written.
**Postcondition (active framework):** 10 `change_proposal` rows, all `pending`. 10 `gate_evaluation` rows with `allow=false`. No profile changes.

**Error paths:**
- Mid-iteration failure → remaining profiles still processed; errors surfaced via aggregated `errors[]`.
- All 10 fail → `{ok:false, error}` returned; helper error toast.

## Developer journey: copy this pattern to the next module

**Precondition:** Another Server Action in `apps/web/src/app/**/_actions/*.ts` uses direct `.from().insert/update/delete()`.

1. Add `gatedUpdate`/`gatedInsert`/`gatedDelete` import from `@smartout/supabase/gate-client`.
2. For each write: fetch currentData (if update/delete) → build `GateContext` with correct `entityType`, `entityIdColumn` (table's PK — check schema), `capability` (convention: `"{entity}:{verb}:{field}"`), `actorProfileId`, `proposedData`, `currentData`.
3. Wrap in try/catch for `GateDeniedError`:
   - On `err.outcome === "proposed"` → return `{ok:true, pendingProposal: err.proposalId}`
   - Otherwise → return `{ok:false, error: err.reason ?? "Governance denied"}`.
4. Change the function return type to `Promise<GatedActionResult>` or a superset.
5. Update consumers to use `handleGatedResult` from `@/lib/gated-result`.
6. Vitest test: mock `gatedUpdate`, cover applied / proposed / denied / fetch-fail.

**Postcondition:** Module migrated. ESLint warning count drops by the number of sites migrated.

**Checklist (from PLAN Consumer Migration Contract):**
- [ ] Action returns `Promise<GatedActionResult>` (or superset)
- [ ] Consumer uses `handleGatedResult` OR manually branches on all three outcomes
- [ ] Proposal path shows info toast (not success)
- [ ] Denial path shows error toast (not success)
- [ ] Bulk actions aggregate and surface proposal IDs
