---
title: "Journey — HMS surface mutations close ADR-0099/0114/0204 gaps"
status: verified
feature: pre-m5-mutation-closure
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [journey, ui-shell, mutation-closure, gate-action, council-verified, campaign-ui-shell, M5-prereq]
---

# Journey — HMS surface mutations close ADR-0099/0114/0204 gaps

> Sub-sortie: `pre-m5-mutation-closure`. M5 Sortie 1 of 4, BLOCKER for Sortie 2-4. Council-verified 2026-05-17.

## Journey: Admin updates deviation status via gated Server Action (was: direct browser write)

**Precondition:** Admin signed in. Deviation exists in workspace. Pre-this-sortie, `use-update-deviation.ts:26-67` performs `supabase.from("deviation").update(...)` from browser anon client, fires `void emit()` (fire-and-forget), `workspace_id` resolved client-side. No `gate_action()` RPC call. No audit trail of who authorized the update.

1. Admin on `/dashboard/hms/deviations` opens DeviationDetailDrawer → clicks "Acknowledge" → React handler fires
2. `useUpdateDeviation` mutation hook (TanStack) invokes `updateDeviationAction` Server Action via thin wrapper (no direct `supabase.from(...)` from browser)
3. Server Action body: `gate_action("hms.update_deviation_manual", "update", actor_id=resolveCurrentProfile(), workspace_id=resolveCurrentWorkspace(), ...)` → returns `allowed: true` or 4xx
4. If allowed: `gatedMutation` wrapper executes admin-client write with server-resolved `workspace_id` enforcement
5. Server-side `await emit({ event: "deviation updated", ... })` runs synchronously; failure surfaces to caller (no fire-and-forget)
6. Response returns to client; TanStack invalidates deviation queries
7. UI re-renders with new status; `activity_trail` row exists with `actor_id` + `workspace_id` + `gate_action_id`

**Postcondition:** Update audited, gated, workspace-scoped server-side. `engine_authority_config` row for `hms.update_deviation_manual` enforces min_role. Any cross-workspace write attempt blocked by gate.

**Error paths:**
- Gate denies (insufficient role) → Server Action returns 403 → TanStack mutation `onError` → toast "Manglende rettigheter"
- Workspace mismatch (request manipulated) → gate rejects, audit row written with `denied=true`
- Network failure → standard TanStack retry
- Telemetry emit failure → mutation succeeds but error logged (emit is fire-after-success per registry convention)

## Journey: Admin completes session task via gated Server Action

Same shape as above for `use-complete-task.ts:25-33`. Capability: `hms.complete_session_task_manual` (or reuse existing if present).

## Journey: Admin creates policy with gate_action enforcement

**Precondition:** Admin on `/dashboard/policies`, clicks "Ny policy" → PolicyCreateDialog opens.

1. Form submit → calls `createPolicy` Server Action
2. `createPolicy` (currently at `policy-actions.ts:74-120`): role-string check at line 77 (`role !== "admin" && role !== "owner"`) — REPLACED by `gate_action("policy.create_manual", "create", actor_id, workspace_id, ...)` 
3. Capability seed exists in `engine_authority_config` for `policy.create_manual` (new migration in this sortie)
4. Gate allowed → admin-client insert (workspace_id server-resolved per ADR-0151)
5. Server-side `await emit({ event: "policy created", entity: "policy", entity_id, ... })` — event is REGISTERED in `packages/telemetry/src/registry.ts` (new entry this sortie)
6. `revalidatePath("/dashboard/policies")` → UI refresh
7. Dialog closes, list shows new policy

**Postcondition:** Policy creation audited via gate_action, telemetry registered. Future role changes via `engine_authority_config` UI take effect without code edit.

**Error paths:**
- Gate denies → 403 + Norwegian error toast
- Telemetry registry missing entry (regression detector) → emit throws TypeScript error at build time

## Verification

- `pnpm --filter web typecheck` → 0 errors
- `pnpm --filter web site-map:validate` → exit 0
- `grep -nE 'supabase\.from\("(deviation|session_task)"\)\.(update|insert|delete)' apps/web/src/app/dashboard/hms/_hooks/` → 0 hits
- `grep -nE 'void emit\(' apps/web/src/app/dashboard/hms/_hooks/ apps/web/src/app/dashboard/policies/_actions/` → 0 hits
- `grep 'gate_action' apps/web/src/app/dashboard/policies/_actions/policy-actions.ts` → ≥1 hit
- `grep 'policy created' packages/telemetry/src/registry.ts` → ≥1 hit
- New capability seed migration file exists in `supabase/migrations/` with timestamp > current HEAD max
- `supabase db reset` succeeds locally; `policy.create_manual` row visible in `engine_authority_config`

## E2E (recommended)

Unit-level: `apps/web/e2e/hms/` could extend with deviation-update flow asserting gate_action audit row written. Out of scope for this sub-sortie — Sortie 3 polish covers UI verification.

## Council learning ref

L-0286 (Polish PRs gild half-converted patterns) — this sortie closes the half-conversion BEFORE polish ships.
L-0287 (Bridge tool description = phantom amplifier) — defers tool description polish until L4 capability exists.
ADR-0360 (L-0258 collision detector) — Sortie 2 ships, depends on this sortie completing first. Originally 0347→0348 in Sortie 1 G4 to resolve schedule-density-persistence collision; renumbered to 0360 in sync-campaign outsider-renumber (payroll kept 0347-0356). Schedule-density-persistence is now ADR-0359.
