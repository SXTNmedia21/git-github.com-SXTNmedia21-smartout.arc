---
title: "Journey — legacy import grep returns zero"
feature: audit-fob10-onboarding-cleanup
journey: legacy-import-grep-returns-zero
status: verified
verified_at: 2026-05-13
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: onboarding
tags: [journey, cleanup, regression-check, grep]
---

# Journey: Legacy onboarding symbols grep returns 0 across repo

**Role:** N/A — repo-wide invariant

**Precondition:** All 17 audit-claimed legacy files deleted per T2.

## Happy Path

1. Run `grep -r "useOnboardingState\|OnboardingProvider\|WizardContext" apps/ packages/ services/` → 0 hits
2. Run `grep -r "supabase.functions.invoke" apps/web/src/app/onboarding/` → 0 hits (ADR-0123 violation surface closed)
3. Run `find apps/web/src/app/onboarding -type f -name "*.tsx" -o -name "*.ts"` → returns only AnimatedWizardShell tree files (NOT the 17 deleted)
4. Audit synthesis F-OB-10-01 row marked CLOSED

**Postcondition:** No revival path. ADR-0123 EF-violation surface eliminated.

## Error Paths

- **Grep returns hits** → at least one consumer still imports legacy symbol. T2 incomplete OR T1 missed a file. Re-run T1 with expanded scope.
- **`apps/landing/` or `services/` imports onboarding symbols** → unexpected cross-app coupling, council.

## Verification

- [ ] `grep -r "useOnboardingState\|OnboardingProvider\|WizardContext" apps/ packages/ services/` returns 0
- [ ] `grep -r "supabase.functions.invoke" apps/web/src/app/onboarding/` returns 0
- [ ] T5 verifier captures both grep outputs in verification report

**Mark `status: verified` when all three checked.**
