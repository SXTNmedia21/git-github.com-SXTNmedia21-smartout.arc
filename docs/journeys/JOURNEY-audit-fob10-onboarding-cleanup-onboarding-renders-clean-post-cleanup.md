---
title: "Journey — /onboarding renders clean post-cleanup"
feature: audit-fob10-onboarding-cleanup
journey: onboarding-renders-clean-post-cleanup
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: onboarding
tags: [journey, onboarding, cleanup, regression-check]
---

# Journey: /onboarding renders cleanly after legacy file deletion

**Role:** anonymous visitor + new admin starting workspace setup

**Precondition:** 17 legacy scroll-wizard files deleted per T2. AnimatedWizardShell tree intact. Typecheck green.

## Happy Path

1. Visitor navigates to `/onboarding` → Next.js renders `page.tsx`
2. `page.tsx` mounts `AnimatedWizardShell` (no `OnboardingProvider` / `WizardContext` references remain)
3. Wizard initializes against current state hook (whatever AnimatedWizardShell uses post-Phase E)
4. User progresses through wizard normally — first step renders, transitions work
5. No console errors, no `useOnboarding must be used within OnboardingProvider` throw

**Postcondition:** Onboarding flow functional. No legacy import errors. No dead-code imports surfaced.

## Error Paths

- **`page.tsx` still references deleted symbol** → typecheck fails in T2 (gate G2). T2 stops, reports failure, escalates.
- **AnimatedWizardShell imports a file marked DELETE_SAFE by T1** → council escalation; T1 mis-classified.

## Verification

- [ ] `pnpm --filter web typecheck` 0 errors after deletion
- [ ] `pnpm --filter web dev` → curl `http://localhost:3060/onboarding` returns 200 + valid HTML
- [ ] Visual smoke: load /onboarding in browser, click through first 2 steps

**Mark `status: verified` when all three checked.**
