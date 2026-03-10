---
title: "Journey — zero-to-production"
status: done
updated: 2026-03-08
created: 2026-03-08
module: cross-cutting
tags: [onboarding, setup-wizard, e2e, contract]
---

# Journey — zero-to-production

## Journey: New Customer — Onboarding Wizard (Admin)

**Precondition:** User has signed up, verified email, and has no completed workspace.

1. User navigates to `/onboarding` → System renders 7 scrollable sections (hero, business, departments, locations, procedures, season, welcome)
2. Contract section is hidden — user progresses directly from season to welcome
3. User scrolls through sections, filling in business data → System tracks progress via IntersectionObserver
4. Voice agent (Botsson) provides contextual guidance per section
5. User completes onboarding → System sets `onboarding_completed = true`, redirects to `/dashboard`

**Postcondition:** Workspace is created with `onboarding_completed = true`. User lands on dashboard.

**Error paths:**

- If user closes browser mid-onboarding → Data is lost (no progressive save in scroll wizard)
- If voice agent disconnects → User can still navigate and fill in data manually

---

## Journey: New Customer — Dashboard Setup Wizard (Admin)

**Precondition:** Workspace has `onboarding_completed = true` but lacks policies (< 3), extra profiles (≤ 1), shifts (0), or active seasons (0).

1. User navigates to `/dashboard` → `layout.tsx` confirms `onboarding_completed`, renders dashboard
2. `useWorkspaceSetup` queries 4 tables in parallel → Returns `needsSetup: true`
3. `AdminDashboard` renders `WorkspaceSetupWizard` instead of normal views
4. User progresses through 9 steps: welcome, document-drop, governance, payroll, employment, team, shift-template, season, handbook
5. User clicks "Fullfor og apne dashboard" on last step → Wizard dismisses, normal dashboard renders

**Postcondition:** Workspace has ≥ 3 policies, > 1 profiles, > 0 shifts, active season. Dashboard shows tactical/strategic views.

**Error paths:**

- User clicks "Hopp over" → System stores `smartout_setup_skipped_{workspaceId}` in localStorage (24h TTL). Wizard hidden for this workspace only. Other workspaces unaffected.
- User clears localStorage or TTL expires → Wizard reappears on next visit if setup still incomplete
- User with multiple workspaces → Skip flag is per-workspace, not global

---

## Journey: Returning Customer — Dashboard (Admin)

**Precondition:** Workspace is fully set up (≥ 3 policies, > 1 profiles, > 0 shifts, active season).

1. User navigates to `/dashboard` → `useWorkspaceSetup` returns `needsSetup: false`
2. System renders normal admin dashboard with tactical/strategic/reconciliation/activity views
3. Setup wizard is NOT shown

**Postcondition:** Normal dashboard experience.

**Error paths:**

- If data is deleted below thresholds → Setup wizard reappears on next visit

---

## Journey: E2E Test — Signup Flow Validation

**Precondition:** Local Supabase running, E2E admin user exists.

1. Test navigates to `/onboarding` → Verifies hero section visible, step counter shows 1/7
2. Test checks all 7 `data-section` attributes exist → Contract section NOT in DOM
3. Test hides workspace data (SQL) → Navigates to dashboard → Verifies setup wizard shows instead of StrategicView

**Postcondition:** 3 signup-flow tests pass.

---

## Journey: E2E Test — Workspace Setup Wizard

**Precondition:** Local Supabase running, workspace data hidden to simulate new workspace.

1. Tests 1-3: Wizard shows, scraped data renders, all 9 steps navigable
2. Tests 4-5: Governance templates filtered by industry, policy creation works
3. Test 6: Team member invitation via mocked Edge Function
4. Test 7: Wizard disappears when workspace data is restored
5. Test 8: Skip persists in localStorage (workspace-scoped key)
6. Test 9: Clearing localStorage skip key makes wizard reappear
7. Test 10: Full 9-step navigation from welcome to handbook
8. Test 11: After wizard complete, normal dashboard elements render

**Postcondition:** 11 workspace-setup-flow tests pass.
