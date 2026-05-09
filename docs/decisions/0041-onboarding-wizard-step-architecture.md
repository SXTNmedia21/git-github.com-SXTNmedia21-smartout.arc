---
title: "Onboarding Wizard Step Architecture"
id: ADR-0041
status: superseded
layer: decision
created: 2026-03-01
updated: 2026-05-02
---

# ADR-0041: Onboarding Wizard Step Architecture

> **SUPERSEDED (2026-05-02).** This ADR described the `STEP_COMPONENTS` registry +
> `OnboardingProvider` pattern. The runtime now uses `AnimatedWizardShell` +
> `wizard-definition.ts` at `apps/web/src/app/onboarding/page.tsx`. The original
> `OnboardingProvider` is not mounted. Verified by audit slice 10 (2026-05-02).

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
