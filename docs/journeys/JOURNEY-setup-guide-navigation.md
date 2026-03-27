---
title: "User Journeys — Setup Guide Navigation"
status: done
updated: 2026-03-27
created: 2026-03-27
module: dashboard
tags: [journey, setup, wizard, onboarding, navigation]
---

# User Journeys — Setup Guide Navigation

## Journey 1: Admin first login after bootstrap — redirect to setup guide

**Precondition:** Workspace exists with `setup_guide_completed = false`. Admin has completed `/onboarding` (bootstrap finalization). Session is fresh (no `setup_dismissed` in sessionStorage).

1. Admin navigates to `/dashboard` → DashboardShell loads, reads `workspace.setup_guide_completed` from context
2. Flag is `false` and no session dismiss → useEffect fires `window.location.href = "/dashboard/setup"`
3. Browser hard-navigates to `/dashboard/setup` → Setup page renders `WorkspaceSetupWizard` full-screen (no sidebar/header)
4. Admin sees welcome step with 9-step wizard

**Postcondition:** Admin is on `/dashboard/setup` viewing the workspace setup wizard.

**Error paths:**

- Workspace context not yet loaded → `setupGuideCompleted` defaults to `true` (no redirect, safe fallback)
- Network error loading workspace → No redirect fires; admin sees normal dashboard

---

## Journey 2: Admin completes the setup wizard

**Precondition:** Admin is on `/dashboard/setup` viewing the wizard.

1. Admin navigates through all 9 wizard steps (welcome → documents → governance → payroll → employment → team → shift templates → season → handbook)
2. On last step, admin clicks "Fullfør og åpne dashboard" → `handleComplete()` fires
3. System updates `workspace.setup_guide_completed = true` via Supabase client
4. System emits `setup_guide completed` telemetry event (→ PostHog, logger, activity_trail)
5. System clears `setup_dismissed` from sessionStorage (no longer needed)
6. System hard-navigates to `/dashboard` → Server layout re-fetches workspace data with updated flag
7. DashboardShell reads `setup_guide_completed = true` → No redirect, normal dashboard renders

**Postcondition:** Admin sees the normal dashboard. Setup wizard will never auto-redirect again.

**Error paths:**

- Supabase update fails → Admin still navigates to dashboard, but next page load may redirect back to setup (flag still false)
- Telemetry emit fails → Silently ignored (`void emit(...)`)

---

## Journey 3: Admin dismisses setup guide for session

**Precondition:** Workspace has `setup_guide_completed = false`. Admin has been redirected to `/dashboard/setup` or sees the wizard.

1. Admin clicks "Hopp over" (skip) in the wizard → `dismissSetup()` fires in DashboardShell
2. System sets `setupDismissed = true` in React state
3. System writes `setup_dismissed = "1"` to sessionStorage
4. `isSetupMode` becomes `false` → Wizard dismiss UI triggers, normal dashboard shows
5. Admin navigates freely within the dashboard for this session

**Postcondition:** Admin sees normal dashboard. Setup guide won't redirect for this browser session.

**Error paths:**

- sessionStorage not available (private browsing) → State still works via React state for current page, but won't persist across navigations

---

## Journey 4: Admin returns in new session (setup incomplete)

**Precondition:** Workspace has `setup_guide_completed = false`. Previous session dismiss has expired (new session = fresh sessionStorage).

1. Admin opens browser and navigates to `/dashboard` → DashboardShell loads
2. `setup_guide_completed` is `false`, sessionStorage `setup_dismissed` is absent → redirect fires
3. Browser navigates to `/dashboard/setup` → Wizard shows again

**Postcondition:** Admin sees setup wizard. They can complete it or dismiss again.

---

## Journey 5: Admin manually accesses setup page after completion

**Precondition:** Workspace has `setup_guide_completed = true`. Admin wants to revisit setup.

1. Admin navigates directly to `/dashboard/setup` → Page renders
2. `isSetupPage` check in DashboardShell prevents redirect loop
3. Setup wizard renders full-screen as normal
4. Admin can review/modify setup steps
5. Clicking "Fullfør" again is safe — updates the flag to `true` again (idempotent)

**Postcondition:** Admin can always access the setup wizard manually, regardless of flag state.

---

## Journey 6: Developer works with seed workspace

**Precondition:** Developer runs `npx supabase db reset` or uses local Supabase with seed data.

1. Seed SQL inserts workspace `b0000000-...` with `onboarding_completed = true`
2. Seed SQL UPDATE sets `setup_guide_completed = true` for the dev workspace
3. Developer logs in → No redirect to setup guide → Normal dashboard shows immediately

**Postcondition:** Developer is not trapped in setup mode during local development.

**Error paths:**

- Seed SQL not applied → Column defaults to `false` → Developer gets redirected to setup. Fix: run `UPDATE workspace SET setup_guide_completed = true WHERE workspace_id = 'b0000000-...'`
