---
title: "User Journey — Onboarding Cleanup"
status: done
updated: 2026-03-26
created: 2026-03-26
module: onboarding
tags: [journey, onboarding, cleanup]
---

# Journey: Onboarding Cleanup

## Journey: Admin Creates New Workspace via Onboarding Wizard

**Precondition:** User has signed up and is redirected to /onboarding

1. User lands on /onboarding -> System checks if onboarding is already completed -> If completed, middleware redirects to /dashboard
2. User progresses through 10 wizard sections (Hero, Welcome, Business, Departments, Locations, Procedures, Season, Done) -> Each section saves data progressively via WizardContext
3. Botsson AI assistant offers suggestions at each step -> All 14 tools validate input via Zod schemas before execution
4. User reaches finalization -> System calls finalizeOnboarding() -> emit() fires "onboarding completed" telemetry event
5. User is redirected to /dashboard via unified redirect utility

**Postcondition:** Workspace is created with all onboarding data. Telemetry event logged. User cannot re-enter onboarding.

**Error paths:**

- Invalid tool input: Zod schema rejects, Botsson shows validation error
- Network failure during save: WizardContext retries, shows error toast
- User refreshes mid-wizard: Progressive save restores state from last checkpoint
- Already completed user visits /onboarding: Server middleware redirects to /dashboard

## Journey: Developer Maintains Onboarding Code

**Precondition:** Developer needs to modify onboarding behavior

1. Developer opens `apps/web/src/app/onboarding/` -> Clean structure with sections/, components/, hooks/, lib/
2. No dead showcase code exists -> Deleted in cleanup (was ~9900 lines of dead code)
3. All colors use CSS variables from design tokens -> No hardcoded hex values
4. All text uses i18n keys from `packages/i18n/locales/{nb,en}/onboarding.json`
5. Motion constants defined in `lib/motion.ts` -> Shared easing values

**Postcondition:** Code is maintainable, token-compliant, i18n-ready.
