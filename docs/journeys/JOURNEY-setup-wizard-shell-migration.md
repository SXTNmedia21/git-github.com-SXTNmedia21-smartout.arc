---
title: "User Journeys — Setup Wizard Shell Migration"
status: done
updated: 2026-03-28
created: 2026-03-28
module: dashboard
tags: [journey, setup, wizard, shell, migration]
---

# User Journeys — Setup Wizard Shell Migration

## Journey 1: Admin enters setup wizard (fresh workspace)

**Precondition:** Workspace exists with `setup_guide_completed = false`. Admin is authenticated with a profile in this workspace. No policies, no extra profiles, no shifts, no active season.

1. Admin navigates to `/dashboard` -> DashboardShell reads `setup_guide_completed = false` -> redirect fires to `/dashboard/setup`
2. Page renders `AnimatedWizardShell` with `dashboardSetupWizard` definition
3. Shell calls `loadState()` -> Supabase queries: auth user, profile, company, company_details (.maybeSingle), opening_hours, social_media
4. `loadState` returns `scrapedData` (pre-filled from DB), `workspaceId`, `profileId`
5. `loadState` queries module completion (policies, profiles, shifts, seasons) -> all incomplete -> `_initialStepIndex = 0`
6. Shell sets `loading = false`, renders step 0 (Welcome) with `SetupStepHeader` (title, subtitle, explanation) + `WelcomeStep` content
7. Brand panel (right) shows contextual message: "La oss sette opp arbeidsplassen din."
8. BotsTip shows industry-specific guidance inline below the header

**Postcondition:** Admin sees pre-filled welcome step with business data from onboarding.

**Error paths:**

- No auth user -> loadState returns empty, wizard shows defaults
- No company_details row -> .maybeSingle returns null, narrative fields show as empty
- loadState fails -> catch sets loading=false, wizard renders with defaultSetupState

---

## Journey 2: Admin completes setup wizard

**Precondition:** Admin is on any step of the setup wizard.

1. Admin navigates through 9 steps: Welcome -> Documents -> Governance -> Payroll -> Employment -> Team -> Shifts -> Season -> Handbook
2. Each step renders `SetupStepHeader` (i18n title, subtitle, explanation, botssonTip) + the step content
3. On team step, admin adds team members -> navigates away -> `onStepLeave` fires `sendTeamInvitations()` -> idempotent insert of pending invitation records
4. On last step (Handbook), admin clicks "Fullfør" -> `definition.onComplete(state)` fires:
   a. Updates `workspace.setup_guide_completed = true`
   b. Sends remaining team invitations (idempotent — skips already-sent)
   c. Triggers `ingest-workspace-knowledge` Edge Function (K1b, non-blocking)
   d. Clears `setup_dismissed` from sessionStorage
   e. Hard-navigates to `/dashboard`
5. `useWizardTelemetry` emits `wizard completed` event (telemetry is separate from business logic)
6. DashboardShell reads `setup_guide_completed = true` -> no redirect

**Postcondition:** Workspace fully configured. Admin on normal dashboard. Setup wizard will not auto-redirect again.

**Error paths:**

- `setup_guide_completed` update fails -> onComplete throws, wizard shows error state
- Team invitation insert fails -> logged to console, does not block completion
- K1b ingestion fails -> non-blocking, logged to console

---

## Journey 3: Admin returns to setup wizard (partial completion)

**Precondition:** Admin previously visited the wizard and completed governance (3+ policies) but not team/schedule/season. `setup_guide_completed` is still `false`.

1. Admin navigates to `/dashboard` -> redirect to `/dashboard/setup`
2. `loadState()` queries module completion:
   - governance: 3+ policies -> complete
   - people: 1 profile (admin only) -> incomplete
   - schedule: 0 shifts -> incomplete
   - season: 0 active -> incomplete
3. `_initialStepIndex` computed as 5 (team step — first step mapped to incomplete module)
4. Shell sets `currentStepIndex = 5` -> wizard opens directly on Team step
5. Admin can navigate back to review completed steps or continue forward

**Postcondition:** Admin resumes at the first incomplete step without re-doing completed work.

---

## Journey 4: Admin skips setup wizard

**Precondition:** Admin is on the setup wizard page.

1. Admin clicks "Hopp over og ga til dashboard" (top-right escape hatch)
2. Browser navigates to `/dashboard` via `<a href="/dashboard">`
3. DashboardShell reads `setup_guide_completed = false` -> redirect fires again
4. Admin is redirected back to `/dashboard/setup`

**Note:** The escape hatch only works for one navigation. To permanently dismiss, admin must either:

- Complete the wizard (sets `setup_guide_completed = true`)
- The DashboardShell sessionStorage dismiss mechanism handles session-level dismissal

**Error paths:** None — the escape hatch is a plain link.

---

## Journey 5: Admin manually accesses setup after completion

**Precondition:** `setup_guide_completed = true`.

1. Admin navigates directly to `/dashboard/setup`
2. Page renders AnimatedWizardShell normally (the page doesn't check the flag)
3. `loadState` hydrates from DB, `_initialStepIndex` may be 0 (all modules complete)
4. Admin can review all steps
5. Clicking "Fullfør" again is idempotent — flag stays true, invitations skip duplicates

**Postcondition:** Admin can always revisit setup manually.

---

## Journey 6: Shared infrastructure — loadState in other wizards

**Precondition:** The `loadState` fix in `useWizardState` is shared infrastructure.

1. `/join` wizard: `joinWizard.loadState` now actually runs on mount (was dead code before)
   - Restores state from localStorage for returning users
2. `/onboarding` wizard: `onboardingWizard.loadState` now actually runs on mount (was dead code before)
   - Queries `workspace.intelligence_data` for pre-filled business data
3. Both wizards show a loading spinner during hydration (via `loading` state in WizardShell)

**Postcondition:** All three wizards benefit from the shared loadState infrastructure fix.
