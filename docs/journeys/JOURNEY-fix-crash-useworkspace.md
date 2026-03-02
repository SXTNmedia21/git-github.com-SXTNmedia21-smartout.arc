---
title: "User Journeys — fix-crash-useworkspace"
status: done
updated: 2026-03-02
created: 2026-03-02
module: web
tags: [journey, dashboard, workspace, crash, bugfix]
---

# User Journeys — fix-crash-useworkspace

## Journey: Authenticated User Without Workspace Accesses Dashboard

**Precondition:** User is logged in but has no workspace (no profile record, or profile has no associated workspace).

1. User navigates to `/dashboard` → Server layout runs `DashboardLayout`
2. Layout authenticates user via Supabase → User found (not redirected to `/login`)
3. Layout queries for workspace (by slug or first available) → No workspace found
4. Layout calls `redirect("/onboarding")` → User is redirected to onboarding wizard
5. User sees onboarding flow to create or join a workspace

**Postcondition:** User lands on `/onboarding` and can set up their workspace.

**Error paths:**

- If user is not authenticated → redirected to `/login` (existing behavior, unchanged)
- If workspace slug exists but user has no profile in it → redirected to `/access-denied?reason=no-profile` (existing behavior, unchanged)
- If workspace slug doesn't match any workspace → redirected to `/access-denied?reason=workspace-not-found` (existing behavior, unchanged)

---

## Journey: Authenticated User With Workspace Accesses Dashboard (Happy Path)

**Precondition:** User is logged in and has at least one workspace with a profile.

1. User navigates to `/dashboard` → Server layout runs `DashboardLayout`
2. Layout authenticates user → User found
3. Layout queries workspace (by slug or first available) → Workspace found
4. Layout renders `WorkspaceProvider` → `DashboardShell` → children
5. User sees the dashboard with full workspace context

**Postcondition:** Dashboard renders correctly with `useWorkspace` hook available throughout the component tree.

**Error paths:** None — this is the happy path (unchanged by this fix).

---

## Bug: What Was Broken (Before Fix)

**Precondition:** User logged in, no workspace found.

1. User navigates to `/dashboard`
2. Layout found no workspace
3. Layout rendered `DashboardShell` **without** `WorkspaceProvider`
4. `DashboardShell` or its children called `useWorkspace()`
5. **CRASH:** `useWorkspace must be used within a WorkspaceProvider`

**Fix:** Step 3 now calls `redirect("/onboarding")` instead of rendering without the provider.
