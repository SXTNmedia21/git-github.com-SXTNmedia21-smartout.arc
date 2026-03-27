---
title: Setup Guide Navigation — Redirect & Dismiss Behavior
status: draft
created: 2026-03-27
updated: 2026-03-27
module: dashboard
tags: [setup, navigation, wizard, onboarding]
---

# Setup Guide Navigation

## Problem

The dashboard setup guide (`/dashboard/setup`) currently hijacks all navigation when
`resolve_cascade_tasks()` returns any critical tasks. This causes:

1. **Perpetual setup mode** — active workspaces with missing contracts or payroll for any
   employee trigger critical tasks indefinitely, locking users out of the dashboard.
2. **Full-screen takeover on `/dashboard`** — the overview page renders the setup wizard
   full-screen instead of showing the normal dashboard with the "Å gjøre" tab.
3. **No persistent dismiss** — clicking "skip" resets on page refresh, forcing the same
   redirect loop.

## Design

### New database flag

Add `workspace.setup_guide_completed` (boolean, NOT NULL, DEFAULT false).

This is **separate from** `workspace.onboarding_completed`, which controls the
`/onboarding` → `/dashboard` transition. The two flags serve different lifecycles:

| Flag                    | Controls                                   | Set by                                          |
| ----------------------- | ------------------------------------------ | ----------------------------------------------- |
| `onboarding_completed`  | `/onboarding` → `/dashboard` routing       | `finalize_onboarding_workspace()` RPC           |
| `setup_guide_completed` | `/dashboard` → `/dashboard/setup` redirect | Setup wizard completion (`onComplete` callback) |

### Navigation behavior

| Scenario                                              | Behavior                                       |
| ----------------------------------------------------- | ---------------------------------------------- |
| Page load + flag = false + not dismissed              | Redirect to `/dashboard/setup`                 |
| Page load + flag = false + dismissed (sessionStorage) | Land on `/dashboard` normally                  |
| In-app navigation (menu clicks)                       | Always free — no redirect                      |
| New login / new tab                                   | sessionStorage empty → redirect triggers again |
| Flag = true                                           | No redirect, ever                              |
| Manual navigation to `/dashboard/setup`               | Always accessible, regardless of flag          |

### "Å gjøre" tab

The todo tab in the overview is a **normal tab** alongside tactical, strategic,
reconciliation, and activity. It shows cascade tasks from `resolve_cascade_tasks()`.
It is never full-screen and is completely independent of the setup guide flag.

### Setup page (`/dashboard/setup`)

Renders full-screen using the wizard shell — no header, no sidebar menu. This behavior
is unchanged. The page remains accessible via direct URL even after setup is completed.

### Dismiss behavior

- "Hopp over" (skip) stores `setup_dismissed = "1"` in `sessionStorage`.
- This prevents redirects for the remainder of the browser session.
- Closing the tab or logging in again clears sessionStorage → redirect resumes.

### Flag lifecycle

- `setup_guide_completed` is set to `true` when the user completes the **last step**
  of the setup wizard in `WorkspaceSetupWizard.tsx` → `onComplete` callback.
- Once set, it is never automatically reverted. The redirect is permanently disabled.
- The `/dashboard/setup` route remains available for manual access.

## Implementation

### 1. Migration

```sql
ALTER TABLE public.workspace
  ADD COLUMN IF NOT EXISTS setup_guide_completed boolean NOT NULL DEFAULT false;
```

### 2. DashboardShell.tsx changes

- Remove the `useCascadeTasks`-driven `isSetupMode` logic for redirect/full-screen.
- Add a query for `workspace.setup_guide_completed`.
- Redirect logic: only on initial page load (useEffect with empty deps after data loads),
  only if `setup_guide_completed = false` AND `sessionStorage` dismiss is not set,
  only if current path is a dashboard page (not already on `/dashboard/setup`).
- Keep full-screen render only for `pathname === "/dashboard/setup"`.
- Default `adminView` to `"tactical"` (already done).

### 3. WorkspaceSetupWizard.tsx changes

- In `onComplete` callback: update `workspace.setup_guide_completed = true` via Supabase.
- Invalidate relevant query cache so DashboardShell picks up the new flag.

### 4. Regenerate types

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

## Out of scope

- Changing the "Å gjøre" tab content or behavior.
- Changing the onboarding wizard (`/onboarding`) or `onboarding_completed` flag.
- Adding a way to reset `setup_guide_completed` from the UI.
