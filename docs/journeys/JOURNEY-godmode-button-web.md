---
title: "User Journeys — godmode-button-web"
status: done
updated: 2026-05-25
created: 2026-05-25
module: platform-admin
tags: [journey, godmode, adr-0410]
---

# User Journeys — godmode-button-web

## Journey: Platform admin (godmode) logs into a workspace from the detail page

**Precondition:**
- User is signed in to apps/web (port 3060) with `user_identity.is_godmode = true`.
- Target workspace exists with a non-null `slug`.

1. Admin opens `/platform-admin/workspaces/<workspace_id>` → server-side `getSuperAdminId()` guard passes → page renders.
2. Admin sees the workspace name + status badges + a primary button "Logg inn på workspace" right-aligned in the header → clicks it.
3. Client `<GoToWorkspaceButton>` enters `useTransition` pending state (spinner replaces ArrowRight icon, button disabled).
4. Server Action `goToWorkspaceAction(workspaceId)` calls RPC `fn_godmode_join_workspace(p_workspace_id)` →
   - RPC asserts `auth.uid()` exists + `user_identity.is_godmode = true`. If not → raises exception → action throws.
   - RPC resolves `workspace.company_id`. If workspace missing → raises exception → action throws.
   - RPC looks up existing `profile` row for `(user_id, workspace_id)`. Found → reuse `profile_id`. Not found → INSERT new admin profile (`role=admin`, `status=active`, `source=godmode`, random `profile_code`).
   - RPC writes `activity_trail` row (`event=godmode.workspace_joined`, `actor_kind=godmode`, jsonb payload with godmode_user_id + workspace_id + profile_id + was_existing flag).
   - RPC returns `profile_id`.
5. Server Action queries `workspace.slug` for the redirect URL.
6. Server Action calls `redirect("https://${slug}.smartout.ai/dashboard")` → throws Next.js `NEXT_REDIRECT` internal.
7. Browser navigates to the workspace subdomain → middleware sets `x-workspace-slug` → dashboard layout loads with the godmode admin's session intact.
8. Admin lands on the workspace dashboard with full admin role permissions.

**Postcondition:**
- One `activity_trail` row exists with the access event (audit trail per ADR-0410).
- `profile` row exists for `(godmode_user_id, workspace_id)` with `role=admin` (created if first visit, reused on repeat visits).
- Admin's browser is on `{slug}.smartout.ai/dashboard`.

**Error paths:**
- **Non-godmode caller (defense-in-depth):** RPC raises `'fn_godmode_join_workspace: caller is not a godmode user'`. Action throws. Client catches in `try/catch`, calls `toast.error("Kunne ikke logge inn på <name>: <msg>")`. Button returns to idle state.
- **Workspace not found:** RPC raises `'fn_godmode_join_workspace: workspace <id> not found'`. Same toast path as above.
- **Missing slug:** Action throws `"Fant ikke workspace-slug — kontakt support"`. Same toast path.
- **Network/RPC connectivity:** caught by client catch → toast surfaced.

## Journey: Non-godmode user lands on the page (negative)

**Precondition:**
- User is signed in to apps/web but `user_identity.is_godmode = false` (or row missing).

1. User navigates to `/platform-admin/workspaces/<workspace_id>` → `getSuperAdminId()` returns null → page calls `redirect("/dashboard")`.
2. User never sees the workspace detail page nor the button.

**Postcondition:** No activity_trail row written, no profile mutation, no leak of platform-admin data.

## Manual Test Cases

1. **Happy path (first visit):** godmode admin clicks button on a workspace where they have no profile → activity_trail row created, profile row inserted with `source=godmode`, redirected to subdomain dashboard.
2. **Idempotent (repeat visit):** godmode admin clicks button on a workspace they already joined → activity_trail still written (`was_existing=true`), no duplicate profile, same redirect.
3. **Negative (non-godmode):** flip `is_godmode=false` on a test user → loading `/platform-admin/workspaces/<id>` redirects to `/dashboard`.
4. **Slug-less workspace (negative):** target workspace with `slug=NULL` → action throws "Fant ikke workspace-slug", toast surfaced, button returns to idle.
