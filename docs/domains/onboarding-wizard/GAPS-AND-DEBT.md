---
title: "Onboarding Wizard — Gaps and Debt"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: onboarding-wizard
tags: [domain, onboarding-wizard, gaps, debt, adr-0396]
mirror: verified
last_verified: 2026-05-23
---

# Onboarding Wizard — Gaps & Debt

> The bridge between built and planned. Every claim cited.

## 1. Verification method

- **CODE** = grepped, `path:line` cited.
- **ROADMAP / SPEC / PLAN** = target/intent in ROADMAP.md or `docs/superpowers/{specs,plans}` source.
- **GAP** = intent with no matching code.
- **DEBT** = built, but owes work.
- **DEVIATION** = code differs from intent.

## 2. Working (shipped + verified)

| # | Capability | Evidence |
|---|---|---|
| W1 | Gate wired — `WelcomeWizardGate` returns wizard instead of null | `apps/web/src/app/dashboard/_components/WelcomeWizardGate.tsx` commit 41b5a87e4 |
| W2 | `TOTAL_STEPS = 8`; AvailabilityStep (step 5) + ConsentStep (step 6) inserted | `apps/web/src/components/welcome-wizard/WelcomeWizard.tsx` commit 2c0a8decd |
| W3 | PersonalNumberStep R8 — confirm sub-screen + reveal toggle | `apps/web/src/components/welcome-wizard/steps/PersonalNumberStep.tsx` commit 5c2853454 |
| W4 | `saveAvailability` + `saveConsent` Server Actions | `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts` |
| W5 | Web BFF `/api/employee-onboarding/state` GET/PUT + dismiss | commit 8f1c61d5c |
| W6 | Mobile BFF `/api/mobile/employee-onboarding/state` + `/save-step` (Bearer) | commit 97d57720f |
| W7 | Mobile `WizardShell.tsx` (RN) with `useWizardState` deep import | commit 2ee6f92fa |
| W8 | 8 RN step components in `apps/mobile/src/components/welcome-wizard/_steps/` | commits 1d4f75abb–7dfb8b1df |
| W9 | `/onboarding` mobile route with first-mount gate | commit 46f178738 |
| W10 | `useOnboardingProgress` hook (shared web + mobile) | commit 486f489c0 |
| W11 | `CompleteProfileCard` home CTA on BeforeShift/NoShift/AfterShift | commit a6f6bbe27 |
| W12 | `complete-data.tsx` deprecation banner | commit 7d3e40eb5 |
| W13 | `consent_acceptance` migration + RLS | `supabase/migrations/20260624000000_create_consent_acceptance.sql` |
| W14 | `employee_onboarding_state` migration + RLS | `supabase/migrations/20260624000100_create_employee_onboarding_state.sql` |
| W15 | Two new telemetry events: `dismissed`, `resumed` | `packages/telemetry/src/registry.ts` |
| W16 | ESLint `no-wizard-barrel-import` rule (D14) | `packages/eslint-config/` |
| W17 | `@smartout/ui/wizard/state` subpath export (D14) | `packages/ui/src/wizard/` |
| W18 | `nativeMotion` tokens for RN | commit 1d4f75abb |

## 3. Gaps (planned, not built)

| # | Gap | Severity | Blocking? | Roadmap phase |
|---|---|---|---|---|
| G1 | Maestro mobile E2E coverage — full 8-step + dismiss-resume flow not yet in CI | medium | no | E |
| G2 | Versioned consent document catalog — `document_version` is V1 hardcoded (`"handbook-v1"`, `"gdpr-v1"`, `"tariff-v1"`); no `consent_document` table or admin UI | low | no | D |
| G3 | Server-side mod-11 checksum for `personal_number` — client-side only in V1 | low | no | C |
| G4 | ConsentStep handbook PDF link routes to `/dashboard/handbook` — content must exist at that route for the link to be useful; not a code bug | low | no | — |
| G5 | ConsentStep privacy policy link routes to `/legal/privacy` — content gap, not code bug | low | no | — |

## 4. Debt (built, but owes work)

| # | Debt | Risk | Cost |
|---|---|---|---|
| D1 | `saveAddress` writes `address_line_1/2`, `postal_code`, `city` to **`profile`**, not `user_identity`. Pre-existing violation of ADR-0396. Introduced before this sortie; wizard reused the existing action. Address columns need migrating to `user_identity` + `profile` columns dropped. | medium — dual source if identity domain also writes address | 1 day (Phase B) |
| D2 | `WizardShell` (web) drops validation errors returned from `useWizardState.next()` — errors are caught but not surfaced inline at the failing field. V1 acceptable; step-level error toasts show server errors but client-side Zod failures may silently abort navigation. | low — Zod validates before Server Action call; most user-facing errors come from server | ½ day (Phase F) |
| D3 | `governance/create-routine-action.ts` + `RoutineForm.tsx` typecheck errors — pre-existing baseline errors, unrelated to this sortie, present before branch cut | low | separate sortie |
| D4 | `use-procedure-steps.ts:46` mobile typecheck error — pre-existing baseline, unrelated | low | separate sortie |
| D5 | Mobile `complete-data.tsx` still wired for field-edit post-wizard — intentional per L-0178 (deprecation banner added). Full removal deferred until wizard adoption confirmed | low | Phase B+ |

## 4b. Deviations (code ≠ spec/plan)

| # | Source spec/plan | Spec said | Code does | Why |
|---|---|---|---|---|
| Dev-1 | R2 spec §S2 | `saveAddress` should write to `user_identity` (ADR-0396) | `saveAddress` writes to `profile` | Pre-existing Server Action reused in-place (Strategy A); correcting requires schema migration. Filed as Debt D1. |

## 5. Overlap with other domains

| Overlapping domain | Shared surface | Recommendation | Rationale |
|---|---|---|---|
| identity | `user_identity` — wizard writes `display_name`, `phone`, `emergency_contact_*` | keep (clear author/consumer seam) | Wizard writes at onboarding; identity domain owns table DDL. No cross-namespace write conflict. |
| scheduling / D2 | `employee_availability` — wizard inserts RRULE rows with `reason='onboarding-wizard'` | keep (provenance discriminator sufficient) | Scheduler reads all availability rows regardless of origin. Provenance tag enables future cleanup. |
| payroll | `consent_acceptance` (onboarding-wizard) vs `payroll.consent_document` (ADR-0311 trekk-samtykke) | keep distinct | Different legal basis (GDPR/handbook vs Aml. §14-15), different immutability contracts, different read audiences. No duplication of data. |
| contracts | DocuSeal signing flow | not related | Contract signing is a separate domain; wizard consent is only acknowledgement checkboxes. |
