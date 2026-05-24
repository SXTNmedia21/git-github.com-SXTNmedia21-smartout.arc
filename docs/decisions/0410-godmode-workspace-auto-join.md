---
title: "ADR-0410: Godmode Workspace Auto-Join (Design A)"
id: ADR-0410
status: accepted
layer: decision
created: 2026-05-24
updated: 2026-05-24
---

# ADR-0410: Godmode Workspace Auto-Join (Design A)

**Status:** Accepted
**Date:** 2026-05-24

## Context and Problem Statement

Pontus (user_identity.is_godmode=true) is the platform operator who needs to access
any workspace via the admin app to investigate issues, perform support, and verify
that production is healthy. However, the admin app's `requireAccountant()` gate checked
only `billing.accountant_company_grant` rows — Pontus has none, so every admin route
returned 404.

Additionally, once a godmode user reaches the workspaces list, they need a way to
navigate INTO a workspace as an authenticated admin — not just view billing metadata.
Two designs were on the table:

- **Design A — Auto-join via SECURITY DEFINER RPC:** The platform admin auto-creates
  an admin profile in the target workspace (idempotent), then is redirected to the
  workspace dashboard. Simple, one-click, zero state needed.
- **Design B — Impersonation overlay:** A separate session overlay that "acts as"
  the workspace owner without creating a real profile row. More complex; requires
  overlay middleware and careful session isolation.

Pontus's stated preference was Design A as the default ("rask" — fast), with Design B
as a possible future addition for more granular audit separation.

## Decision Drivers

- Godmode users must be able to access the admin app without accountant grants.
- Every godmode access to a protected admin route MUST be written to `activity_trail` (audit mandate).
- The workspace join action must be idempotent (calling it twice must not create two profiles).
- Design must not require middleware changes or session overlay infrastructure.
- Audit trail must be hermetic — any RPC call that creates a profile must also write the trail in the same transaction.

## Considered Options

- **Option A — Auto-join via SECURITY DEFINER RPC** (chosen)
- **Option B — Impersonation overlay with session middleware** (deferred)
- **Option C — Manual grant creation by Pontus before accessing admin** (rejected — cumbersome)

## Decision Outcome

Chosen option: **Design A (auto-join)**, because it is the simplest approach with
no infrastructure changes, is idempotent by design, and delivers a single-click
UX that Pontus explicitly requested. Audit trail is enforced in the RPC body
(same transaction), so it cannot be skipped.

### Implementation

**`requireAccountant()` godmode short-circuit (BUG-006):**
- Before checking accountant grants, query `user_identity.is_godmode` for the current user.
- If true: fetch all company IDs via service-role client (bypasses company RLS), return them,
  and emit `godmode.admin_access` to `activity_trail` via the telemetry system.
- The telemetry emit is fire-and-catch — a telemetry failure never blocks access.
- The workspaces page uses the service-role admin client when `isGodmode=true` so
  that `fetchWorkspacesForCompanies` can see workspaces across all companies
  (user-scoped client would be blocked by workspace RLS for a non-profile user).

**`fn_godmode_join_workspace(p_workspace_id uuid)` RPC (FEATURE-001):**
- SECURITY DEFINER — bypasses RLS for the profile INSERT.
- Asserts `auth.uid()` has `is_godmode=true` on `user_identity` — raises exception if not.
- Idempotent: if a profile already exists for `(user_id, workspace_id)`, return the existing `profile_id`.
- Inserts profile with `role='admin'`, `status='active'`, `source='godmode'`, `display_name` from first_name.
- Inserts `activity_trail` row in the same function body (same implicit transaction).
- Returns `profile_id uuid`.

**UI — "Gå til" button (FEATURE-001):**
- Rendered per row in workspaces list, visible only when `isGodmode=true`.
- Invokes `goToWorkspaceAction` Server Action.
- On RPC success: resolves workspace slug, redirects to `https://{slug}.smartout.ai/dashboard`.
- Shows a `Loader2` spinner during the Server Action invocation (startTransition).

### Security Model

- The RPC's `SECURITY DEFINER` + `is_godmode` assertion means a non-godmode user
  calling the RPC gets a PostgreSQL exception, not a silent no-op.
- The `actor_kind='godmode'` field on the activity_trail row distinguishes godmode
  actions from normal admin profile actions in audit queries.
- Design B (impersonation without profile creation) is not blocked by this ADR.
  It can be added as a separate Design B layer if finer audit separation is needed
  (e.g. godmode actions that should NOT be attributed to a real profile row).

### is_godmode vs is_super_admin

The field is named `is_godmode` in the production schema (confirmed in database.types.ts
line 20616). An earlier project memo referenced `is_super_admin` — that name was never
committed. `is_godmode` is canonical.

## Rules & Consequences enforced for Agents

- **Good:** Godmode users can now access all admin routes without manual grant creation.
- **Good:** Every godmode access is hermetically audited to activity_trail.
- **Good:** Profile insert is idempotent — safe to call from "Gå til" multiple times.
- **Bad:** The godmode admin profile IS a real profile row — it appears in workspace
  member lists. Operators should be aware that Pontus may appear as an admin in any
  workspace he has visited via "Gå til".
- **Agent Impact:**
  - When implementing new admin-app gates, use `requireAccountant()` — never check
    accountant grants directly. The godmode short-circuit is in that function.
  - When writing new godmode-exclusive actions, assert `is_godmode` server-side
    (either via `isGodmodeUser()` or the RPC body pattern). Never trust client input.
  - New events in the `godmode.*` namespace must route to `activity_trail` (audit mandatory).
  - Do NOT use Design B (impersonation) without a new ADR — the session overlay
    approach has different security semantics and needs separate council review.
