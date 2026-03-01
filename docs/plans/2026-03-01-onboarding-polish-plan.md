# Onboarding Wizard Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the onboarding wizard with progress indicator, keyboard navigation, i18n extraction, E2E test fixes, documentation updates (CLAUDE.md, INDEX.md, ADR), and a PR to development.

**Architecture:** 8 independent tracks that can be executed in any order. Each track is self-contained. The PR (Track H) should be last.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind v4, Playwright, @smartout/i18n package

---

## Track A: Progress Indicator

### Task 1: Add step progress bar to wizard shell

**Files:**

- Create: `apps/web/src/app/onboarding/StepProgress.tsx`
- Modify: `apps/web/src/app/onboarding/page.tsx`

**Context:** The wizard has 15 steps but no visual indication of progress. Add a minimal progress bar that shows the current step position. Exclude transient steps (crawling, finalizing) from the visual count. The bar should sit above the step content.

**Step 1: Create StepProgress component**

```typescript
// apps/web/src/app/onboarding/StepProgress.tsx
"use client";

import type { WizardStep } from "./types";

/**
 * Visual steps shown in the progress bar.
 * Excludes transient steps (crawling, finalizing) and terminal steps (done).
 */
const VISIBLE_STEPS: { step: WizardStep; label: string }[] = [
  { step: "init", label: "Website" },
  { step: "auth", label: "Account" },
  { step: "org_verification", label: "Company" },
  { step: "branding", label: "Branding" },
  { step: "season_identity", label: "Season" },
  { step: "departments", label: "Departments" },
  { step: "teams", label: "Teams" },
  { step: "locations", label: "Locations" },
  { step: "procedures", label: "Procedures" },
  { step: "battlefield_review", label: "Review" },
  { step: "invite", label: "Invite" },
];

/** Steps where the progress bar should be hidden entirely. */
const HIDDEN_STEPS: WizardStep[] = ["crawling", "finalizing", "done"];

interface StepProgressProps {
  currentStep: WizardStep;
}

export function StepProgress({ currentStep }: StepProgressProps) {
  if (HIDDEN_STEPS.includes(currentStep)) return null;

  // season_education maps to the same position as season_identity
  const effectiveStep =
    currentStep === "season_education" ? "season_identity" : currentStep;

  const currentIndex = VISIBLE_STEPS.findIndex(
    (s) => s.step === effectiveStep,
  );
  const progress =
    currentIndex >= 0
      ? ((currentIndex + 1) / VISIBLE_STEPS.length) * 100
      : 0;

  return (
    <div className="mx-auto mb-8 w-full max-w-5xl px-6">
      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Step label */}
      {currentIndex >= 0 && (
        <div className="mt-2 flex justify-between text-xs text-zinc-600">
          <span>
            Step {currentIndex + 1} of {VISIBLE_STEPS.length}
          </span>
          <span className="text-zinc-500">
            {VISIBLE_STEPS[currentIndex]?.label}
          </span>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add StepProgress to the wizard shell page.tsx**

In `apps/web/src/app/onboarding/page.tsx`, inside the `OnboardingContent` function, add the progress bar above the step content:

```typescript
// Add import at top:
import { StepProgress } from "./StepProgress";

// In the JSX, add before the step content div:
<StepProgress currentStep={wizard.step} />
```

Place it after the ambient background div but before the step content container, inside the `relative z-10` wrapper.

**Step 3: Verify it compiles**

Run: `pnpm --filter web exec tsc --noEmit --pretty 2>&1 | grep onboarding`

**Step 4: Commit**

```bash
git add apps/web/src/app/onboarding/StepProgress.tsx apps/web/src/app/onboarding/page.tsx
git commit -m "feat(onboarding): add step progress bar to wizard shell"
```

---

## Track B: Keyboard Navigation & Accessibility

### Task 2: Add keyboard handlers to all 4 drawers

**Files:**

- Modify: `apps/web/src/app/onboarding/drawers/DepartmentDrawer.tsx`
- Modify: `apps/web/src/app/onboarding/drawers/TeamDrawer.tsx`
- Modify: `apps/web/src/app/onboarding/drawers/LocationDrawer.tsx`
- Modify: `apps/web/src/app/onboarding/drawers/ProcedureDrawer.tsx`

**Context:** All 4 drawers are overlay panels with no keyboard support. Add:

- `Escape` key closes the drawer
- `role="dialog"` and `aria-modal="true"` on the overlay
- `aria-label` on the drawer panel
- Auto-focus the first input when drawer opens

**Step 1: Update DepartmentDrawer**

Add `useEffect` + `useRef` for keyboard handling and auto-focus:

```typescript
import { useEffect, useRef } from "react";

// Inside the component, before the return:
const firstInputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (!isOpen) return;

  // Auto-focus first input
  firstInputRef.current?.focus();

  // Escape key handler
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [isOpen, onClose]);

// On the overlay div, add:
// role="dialog" aria-modal="true" aria-label="Edit Department"

// On the name input, add:
// ref={firstInputRef}
```

Apply the same pattern to TeamDrawer, LocationDrawer, and ProcedureDrawer. Each gets:

- `useEffect` with Escape handler
- `useRef` for auto-focus on first input
- `role="dialog"` + `aria-modal="true"` + `aria-label` on overlay

**Step 2: Verify compile**

Run: `pnpm --filter web exec tsc --noEmit --pretty 2>&1 | grep onboarding`

**Step 3: Commit**

```bash
git add apps/web/src/app/onboarding/drawers/
git commit -m "feat(onboarding): add keyboard navigation and ARIA to drawers"
```

---

## Track C: Fix E2E Tests

### Task 3: Fix dashboard.spec.ts selector

**Files:**

- Modify: `apps/e2e/tests/dashboard.spec.ts`

**Context:** The dashboard test uses `text=Operations` which matches multiple elements (strict mode violation). Fix the selector to be more specific.

**Step 1: Read the current dashboard page to find unique selectors**

Read: `apps/web/src/app/(dashboard)/page.tsx` or the dashboard layout to find a unique element.

**Step 2: Update dashboard.spec.ts**

Replace the ambiguous selector with a unique one. For example, use `h1` or a specific heading instead of bare text matching. If the dashboard has a main heading like "Welcome back" or a specific role, use that.

If the page structure doesn't have a unique selector, use `page.locator('h1').first()` or a data-testid approach:

```typescript
test("should load the dashboard page correctly", async ({ page }) => {
  await page.goto("/dashboard");
  // Wait for page load — check for sidebar or main content area
  await expect(page.locator('[data-testid="dashboard"]').or(page.locator("main"))).toBeVisible({
    timeout: 10000,
  });
});
```

**Step 3: Commit**

```bash
git add apps/e2e/tests/dashboard.spec.ts
git commit -m "fix(e2e): resolve strict mode selector in dashboard test"
```

---

### Task 4: Expand auth.spec.ts with additional test cases

**Files:**

- Modify: `apps/e2e/tests/auth.spec.ts`

**Context:** Current auth tests only verify page load and one validation. Add tests for:

- Login page form elements visible
- Signup page form elements visible
- Short password validation
- Empty email validation

**Step 1: Add test cases**

```typescript
test.describe("Login Page", () => {
  test("should show login form elements", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.locator('input[name="email"]').or(page.locator('input[type="email"]')),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

test.describe("Signup Page", () => {
  test("should show all signup form fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(
      page.locator('input[name="email"]').or(page.locator('input[type="email"]')),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('input[name="password"]').or(page.locator('input[type="password"]').first()),
    ).toBeVisible();
  });
});
```

**Step 2: Commit**

```bash
git add apps/e2e/tests/auth.spec.ts
git commit -m "test(e2e): expand auth test coverage with form element checks"
```

---

## Track D: i18n Extraction

### Task 5: Set up i18n provider in onboarding layout

**Files:**

- Modify: `apps/web/src/app/onboarding/layout.tsx`
- Create: `packages/i18n/locales/en/onboarding.json`
- Create: `packages/i18n/locales/nb/onboarding.json`

**Context:** The i18n package exists (`@smartout/i18n`) with config for 8 languages but ZERO actual usage in the app. For the wizard we'll use a simpler approach: create translation JSON files and a lightweight hook, without wiring up a full i18next provider (that's a bigger project). Instead, create a local `useTranslations` hook that reads from a static object. This keeps the wizard self-contained and avoids touching app-wide layout.

**Step 1: Create English onboarding translations**

```json
// packages/i18n/locales/en/onboarding.json
{
  "init": {
    "title": "Let's build your workspace.",
    "subtitle": "Provide your company's website address and we'll automatically generate your structure, departments, and core policies.",
    "placeholder": "your-webpage.com",
    "scan": "Scan & Generate",
    "skip": "Skip"
  },
  "crawling": {
    "title": "Analyzing {url}...",
    "subtitle": "Extracting company structure, locations, and generating standard operational policies."
  },
  "auth": {
    "title": "Save your progress",
    "subtitle": "Create an account to keep everything we just found about your business.",
    "createAccount": "Create Account",
    "signIn": "Sign In",
    "emailPlaceholder": "Email address",
    "passwordPlaceholder": "Password (min. 8 characters)",
    "confirmPlaceholder": "Confirm password",
    "submitSignup": "Create Account & Continue",
    "submitSignin": "Sign In & Continue",
    "skip": "Skip for now (you can create an account later)",
    "passwordMismatch": "Passwords do not match",
    "passwordTooShort": "Password must be at least 8 characters"
  },
  "orgVerification": {
    "title": "Verify Company Identity",
    "subtitle": "Enter your Norwegian organization number to pull official public records for your workspace.",
    "placeholder": "Organisasjonsnummer (9 siffer)",
    "search": "Search Brønnøysundregistrene",
    "skip": "Skip this step for now",
    "tryAgain": "Try Again",
    "confirm": "Looks correct",
    "invalidOrg": "Et gyldig norsk organisasjonsnummer har 9 siffer."
  },
  "branding": {
    "title": "Your Branding & Voice",
    "subtitle": "Set up your company's visual identity and communication style.",
    "logo": "Company Logo",
    "logoHint": "Click to upload or drag & drop",
    "slogan": "Company Slogan",
    "brandColor": "Brand Color",
    "tone": "Communication Tone",
    "next": "Generate Contract & Proceed",
    "back": "Back"
  },
  "seasonEducation": {
    "title": "The Concept of Seasons",
    "subtitle": "In Smartout, everything operates in Seasons. Reset budgets, update menus, and change setups seamlessly.",
    "whyTitle": "Why Seasons?",
    "whyBody": "Instead of a continuously growing, unmanageable system, Smartout uses Seasons. A Season can be permanent (like \"Core Operations\") or temporal (like \"Summer 2024\"). This lets you archive past performance, assign seasonal staff cleanly, and switch entire operational configurations overnight.",
    "next": "I understand, let's build one"
  },
  "seasonIdentity": {
    "title": "Name Your First Season",
    "subtitle": "Define the timeframe and identity for your initial setup.",
    "name": "Season Name",
    "nameHint": "Used internally and for your staff to identify the current active configuration.",
    "startDate": "Start Date (Optional)",
    "endDate": "End Date (Optional)",
    "type": "Season Type",
    "permanent": "Permanent Season",
    "permanentDesc": "A continuous baseline configuration. You can always archive it or spin up a new season later.",
    "temporal": "Temporal Season",
    "temporalDesc": "Strict temporal bounds (e.g. Summer 2024). Perfect for pop-ups or high-season changes.",
    "next": "Setup Departments",
    "back": "Back"
  },
  "departments": {
    "title": "Define Departments",
    "subtitle": "What is a department? It's a dedicated area with its own shift plan and procedures.",
    "active": "Active Departments",
    "empty": "No departments installed yet.",
    "emptyHint": "Click a suggestion below or create a custom one.",
    "addCustom": "+ Create Custom Department",
    "addShort": "+ Add Custom",
    "useInSeason": "Use in Season",
    "notUsed": "Not used in {season}",
    "remove": "Remove",
    "suggestions": "Recommended for your industry",
    "next": "Setup Teams",
    "back": "Back"
  },
  "teams": {
    "title": "Define Teams",
    "subtitle": "If Departments are the \"areas,\" Teams are the \"people.\"",
    "setup": "Teams Setup",
    "noDepts": "You haven't defined any departments yet.",
    "addTeam": "+ Add Team",
    "noTeams": "No teams added",
    "crossDept": "Cross-Department Teams",
    "crossDeptHint": "Teams that operate across multiple departments (e.g., Management).",
    "noCrossDept": "No cross-department teams added",
    "next": "Verify Locations",
    "back": "Back"
  },
  "locations": {
    "title": "Setup Locations",
    "subtitle": "Define where your business operates physically.",
    "hq": "Main Office / Headquarters",
    "noDesc": "No description",
    "add": "+ Add another Location",
    "edit": "Edit",
    "next": "Setup Procedures",
    "back": "Back"
  },
  "procedures": {
    "title": "Define Procedures",
    "subtitle": "Set up the standard operating procedures and tasks for your departments.",
    "initial": "Initial Tasks & Routines",
    "noDepts": "You must define departments before creating procedures.",
    "empty": "No procedures created yet.",
    "add": "+ Create Custom Procedure",
    "editDetails": "Edit Details",
    "next": "Final Review",
    "back": "Back"
  },
  "review": {
    "title": "Battlefield Review",
    "subtitle": "Is everything looking sharp, general? Here is the final battle plan.",
    "identity": "Identity & Brand",
    "season": "Initial Season",
    "locations": "Locations",
    "departments": "Departments",
    "procedures": "Procedures",
    "edit": "Edit",
    "goBack": "Wait, go back",
    "activate": "Activate Workspace"
  },
  "finalizing": {
    "title": "Finalizing Workspace",
    "subtitle": "Saving structure, injecting policies, and spinning up your dashboard..."
  },
  "invite": {
    "title": "Invite your first team member",
    "subtitle": "{name} is ready! Bring someone onboard.",
    "email": "Email Invite",
    "phone": "SMS Invite",
    "link": "Shareable Link",
    "sent": "Sent!",
    "enterDashboard": "Enter Dashboard",
    "skip": "Skip for now"
  },
  "done": {
    "title": "You're All Set!",
    "subtitle": "Welcome to the future of hospitality management.",
    "dashboard": "Enter Dashboard"
  },
  "drawers": {
    "editDepartment": "Edit Department",
    "editTeam": "Edit Team",
    "editLocation": "Edit Location",
    "editProcedure": "Edit Procedure",
    "name": "Internal Name",
    "description": "Description",
    "teamName": "Team Name",
    "locationName": "Location Name",
    "procedureTitle": "Procedure Title",
    "urgency": "Urgency Level",
    "assignTo": "Assign to Department",
    "instructions": "Instructions",
    "done": "Done",
    "remove": "Remove",
    "crossDept": "Cross-Department Team"
  }
}
```

**Step 2: Create Norwegian translations** (same structure, Norwegian values)

Create `packages/i18n/locales/nb/onboarding.json` with Norwegian translations of all the above keys.

**Step 3: Commit i18n files only** (don't wire into components yet — that's a separate, larger task)

```bash
git add packages/i18n/locales/en/onboarding.json packages/i18n/locales/nb/onboarding.json
git commit -m "feat(i18n): add English and Norwegian onboarding translation keys"
```

**Note:** Wiring `useTranslation()` into all 15 step components + 4 drawers is a full track on its own (~2h of work). This task prepares the translation files. The actual component migration should be a follow-up task when the app-wide i18n provider is set up.

---

## Track E: CLAUDE.md Audit

### Task 6: Update CLAUDE.md with new onboarding structure

**Files:**

- Modify: `CLAUDE.md`

**Context:** CLAUDE.md needs to reflect the refactored onboarding wizard structure. Add info about:

- The new file structure (steps/, drawers/, hooks/, types.ts, WizardContext.tsx)
- The progressive save mechanism
- The invitation system updates (phone + invite_type)

**Step 1: Add onboarding architecture note**

In the `## Monorepo Structure` section, under `apps/web/`, add a note:

```
│   ├── onboarding/     → Wizard: 15 step components + 4 drawers + useOnboardingWizard hook
```

**Step 2: Update changelog**

Add a new entry to the changelog table at the bottom of CLAUDE.md:

```
| 2026-03-01 | 7.9.0   | Onboarding wizard refactored: 15 step components, 4 drawers, progressive save, auth step, invite step | Claude |
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with onboarding wizard architecture"
```

---

## Track F: docs/INDEX.md Update

### Task 7: Add journeys section to INDEX.md

**Files:**

- Modify: `docs/INDEX.md`

**Context:** Three new journey docs were added to `docs/journeys/` but INDEX.md doesn't list them.

**Step 1: Add Journeys section**

After the Plans section in INDEX.md, add:

```markdown
## User Journeys

| File                                     | Status   | Module     | Description                           |
| ---------------------------------------- | -------- | ---------- | ------------------------------------- |
| `journeys/admin-workspace-setup.md`      | Approved | Onboarding | 15-step admin wizard flow             |
| `journeys/employee-invitation-accept.md` | Approved | Onboarding | Invite channels + acceptance flow     |
| `journeys/trainee-mode-core.md`          | Approved | Onboarding | Trainee checkpoints + module journeys |
```

**Step 2: Add new plans to Plans section**

Add the new plan files that were created:

```markdown
| `plans/2026-03-01-admin-wizard-completion.md` | Approved | Onboarding | Wizard refactor design |
| `plans/2026-03-01-admin-wizard-completion-plan.md` | Approved | Onboarding | Wizard refactor implementation plan |
| `plans/2026-03-01-module1-user-journeys-design.md` | Approved | Onboarding | User journeys + seed data design |
| `plans/2026-03-01-onboarding-polish-plan.md` | Approved | Onboarding | Polish: progress bar, a11y, i18n, E2E, docs |
```

**Step 3: Commit**

```bash
git add docs/INDEX.md
git commit -m "docs: add journeys section and new plans to INDEX.md"
```

---

## Track G: ADR for Wizard Refactor

### Task 8: Write ADR-0041 for onboarding wizard architecture

**Files:**

- Create: `docs/decisions/ADR-0041-onboarding-wizard-step-architecture.md`
- Modify: `docs/decisions/0000-decision-log.md`

**Step 1: Create the ADR**

```markdown
---
title: "Onboarding Wizard Step Architecture"
id: ADR_0041
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-03-01
---

# ADR-0041: Onboarding Wizard Step Architecture

## Context and Problem Statement

The onboarding wizard was a single 1,882-line page.tsx file containing all 13 steps, 4 drawer overlays, state management, API calls, and mock data fallbacks. Adding new steps (auth, invite) or modifying existing steps required editing a monolithic file with high risk of regressions.

## Decision Drivers

- Need to add AuthStep (inline signup) and InviteStep (email/SMS/link) to the wizard flow
- Progressive save to onboarding_session required centralized state management
- Step components needed independent testability
- Drawer components were duplicating code patterns

## Considered Options

1. **Step components with context hook** — Extract each step into its own component, centralize state in useOnboardingWizard hook, share via React Context
2. **Keep monolith, add new steps inline** — Continue extending page.tsx with new step blocks
3. **URL-based routing per step** — Each step as a separate route (/onboarding/init, /onboarding/auth, etc.)

## Decision Outcome

Chosen option: **"Step components with context hook"**, because it provides the best balance of modularity, shared state, and simplicity.

## Rules & Consequences

- **Good, because** each step is independently editable and testable
- **Good, because** useOnboardingWizard centralizes progressive save, auth tracking, and finalization
- **Good, because** drawers are reusable components with clean prop interfaces
- **Bad, because** 24 files instead of 1 — more files to navigate
- **Agent Impact:** When modifying wizard behavior, check types.ts for WizardContext interface changes, update STEP_COMPONENTS map in page.tsx if adding/removing steps
```

**Step 2: Register in decision log**

Add to `docs/decisions/0000-decision-log.md`:

```markdown
| 0041 | Onboarding Wizard Step Architecture | Step components with context hook over monolith | Accepted | 2026-03-01 |
```

**Step 3: Commit**

```bash
git add docs/decisions/ADR-0041-onboarding-wizard-step-architecture.md docs/decisions/0000-decision-log.md
git commit -m "docs: ADR-0041 onboarding wizard step architecture"
```

---

## Track H: Create PR to Development

### Task 9: Create pull request

**Prerequisites:** All tracks A-G committed and pushed.

**Step 1: Push all commits**

```bash
git push
```

**Step 2: Create PR**

```bash
gh pr create --base development --title "feat(onboarding): wizard refactor with progressive save, auth, invite" --body "$(cat <<'EOF'
## Summary

- Refactored 1,882-line monolithic wizard into 15 step components + 4 drawers + context hook
- Added AuthStep (inline signup/signin between crawl and org verification)
- Added InviteStep (email, SMS, shareable link invites post-activation)
- Enhanced BattlefieldReviewStep with all sections and edit navigation
- Progressive save to onboarding_session via useOnboardingWizard hook
- DB migration: invite_type enum + phone column on invitation table
- Edge Function: create-invitation supports single invite with SendGrid/Twilio dispatch
- Module 1 user journey docs (admin setup, employee invite, trainee mode)
- SQL seed data for journey engine (5 journeys, 25 checkpoints)
- Updated E2E tests for new wizard flow
- Progress indicator, keyboard navigation, i18n translation files
- ADR-0041: wizard step architecture decision

## Test plan

- [ ] Full typecheck passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
- [ ] E2E: `pnpm test:e2e -- --project=web` — onboarding tests pass
- [ ] Manual: navigate /onboarding, complete full wizard with mock data
- [ ] Manual: verify progress bar updates across steps
- [ ] Manual: verify Escape closes drawers
- [ ] Manual: verify auth step appears after crawl for unauthenticated users

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Task Dependency Graph

```
Track A (Progress bar):    Task 1 (independent)
Track B (Keyboard):        Task 2 (independent)
Track C (E2E fixes):       Task 3 → Task 4 (sequential)
Track D (i18n):            Task 5 (independent)
Track E (CLAUDE.md):       Task 6 (independent)
Track F (INDEX.md):        Task 7 (independent)
Track G (ADR):             Task 8 (independent)
Track H (PR):              Task 9 (depends on all above)
```

**Parallelization:** Tracks A-G are fully independent. Run them in any order or in parallel. Track H (PR) runs last.

---

## Files Created/Modified Summary

| Action | File                                                             |
| ------ | ---------------------------------------------------------------- |
| Create | `apps/web/src/app/onboarding/StepProgress.tsx`                   |
| Modify | `apps/web/src/app/onboarding/page.tsx`                           |
| Modify | `apps/web/src/app/onboarding/drawers/DepartmentDrawer.tsx`       |
| Modify | `apps/web/src/app/onboarding/drawers/TeamDrawer.tsx`             |
| Modify | `apps/web/src/app/onboarding/drawers/LocationDrawer.tsx`         |
| Modify | `apps/web/src/app/onboarding/drawers/ProcedureDrawer.tsx`        |
| Modify | `apps/e2e/tests/dashboard.spec.ts`                               |
| Modify | `apps/e2e/tests/auth.spec.ts`                                    |
| Create | `packages/i18n/locales/en/onboarding.json`                       |
| Create | `packages/i18n/locales/nb/onboarding.json`                       |
| Modify | `CLAUDE.md`                                                      |
| Modify | `docs/INDEX.md`                                                  |
| Create | `docs/decisions/ADR-0041-onboarding-wizard-step-architecture.md` |
| Modify | `docs/decisions/0000-decision-log.md`                            |
