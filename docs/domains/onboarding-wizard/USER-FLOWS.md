---
title: "Onboarding Wizard — User Flows"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: onboarding-wizard
tags: [domain, onboarding-wizard, user-flows, journeys, web, mobile, resume]
mirror: verified
last_verified: 2026-05-23
---

# Onboarding Wizard — User Flows

> Flow index. Canonical journeys live in `docs/journeys/JOURNEY-employee-onboarding-wizard.md`. This file does NOT duplicate them — it summarizes and links.

## Flow index

| # | Flow | Role | Shipped? | Journey |
|---|---|---|---|---|
| 1 | Web — new employee completes 8-step wizard end-to-end | employee | ✅ | [JOURNEY-employee-onboarding-wizard.md §Journey 1](../../journeys/JOURNEY-employee-onboarding-wizard.md) |
| 2 | Mobile — new employee completes 8-step wizard end-to-end | employee | ✅ | [JOURNEY-employee-onboarding-wizard.md §Journey 2](../../journeys/JOURNEY-employee-onboarding-wizard.md) |
| 3 | Dismiss mid-wizard → resume from home CTA card | employee | ✅ | [JOURNEY-employee-onboarding-wizard.md §Journey 3](../../journeys/JOURNEY-employee-onboarding-wizard.md) |

## Journey 1 summary — Web complete

**Precondition:** Employee accepted invite, `profile.welcome_wizard_completed=false`, `welcome_wizard_dismissed=false`. First login on web.

1. Lands on `/dashboard` → `WelcomeWizardGate` returns `<WelcomeWizard … />` (was `null` before this sortie).
2. Steps 1–4 (Hero → Contact → Address → PersonalNumber with R8 reveal toggle + confirm sub-screen).
3. Step 5 AvailabilityStep (NEW) → `saveAvailability` writes RRULE rows to `employee_availability`.
4. Step 6 ConsentStep (NEW) → `saveConsent` inserts append-only rows in `consent_acceptance`.
5. Step 7 OptionalStep (skippable) → Step 8 DoneStep → `completeWelcome` flips `profile.is_welcome_complete = true` + updates `employee_onboarding_state.status='completed'` + emits `profile welcome_wizard_completed` (engine_event destination preserved).
6. Wizard unmounts → employee on home dashboard, fully schedule-ready.

**Postcondition:** `profile.welcome_wizard_completed=true`; `user_identity` has phone + emergency contact; `profile` has personal_number; `employee_availability` has RRULE rows; `consent_acceptance` has handbook + gdpr rows.

## Journey 2 summary — Mobile complete

**Precondition:** Employee accepted invite, first login on mobile app.

1. `(app)/_layout` reads `profile.welcome_wizard_completed` via `/api/mobile/onboarding/state` (Bearer) → redirects to `/onboarding` route.
2. Mobile `WizardShell.tsx` (RN) mounts 8 RN step twins via `useWizardState` (deep import from `@smartout/ui/wizard/state`).
3. Each step POSTs to `/api/mobile/employee-onboarding/save-step` → Bearer BFF → `resolveMobileActor` → re-invokes same Server Action as web.
4. Steps 4 (PersonalNumber), 5 (Availability), 6 (Consent) have native RN parity (day-picker, reveal toggle, scroll + acceptance toggle).
5. DoneStep → `/api/mobile/employee-onboarding/save-step` with `stepKey='complete'` → `completeWelcome` → `profile.welcome_wizard_completed=true`.

**Postcondition:** Same as Journey 1. Web + mobile are interchangeable mid-flow (state persists per-step in `employee_onboarding_state`).

## Journey 3 summary — Dismiss + resume

**Precondition:** Employee opened wizard, completed steps 1–3, dismissed via X.

1. Tap X → `dismissWelcomeWizard` Server Action → `profile.welcome_wizard_dismissed=true`, `employee_onboarding_state.status='dismissed'` → emits `profile welcome_wizard_dismissed`.
2. Home reads `useOnboardingProgress` → returns `{ completed: 3, total: 8, status: 'dismissed', resume_step: 4 }`.
3. Home mounts `CompleteProfileCard` on NoShift / BeforeShift / AfterShift views (NOT DuringShift) — shows "Fullfør profilen din — 3 av 8 steg" + CTA.
4. Tap CTA → `resumeWelcomeWizard` Server Action → `welcome_wizard_dismissed=false` + emits `profile welcome_wizard_resumed` → wizard re-mounts at Step 4.
5. Employee finishes Steps 4–8 → `welcome_wizard_completed=true` → card disappears.

## Cross-surface notes

- **Web composes, mobile executes** (ADR-0133) — but this is a pre-cascade identity flow, not a D6 production flow. Both surfaces can complete the wizard in full (symmetry justified by precedent `complete-data.tsx`).
- **Authority decisions** — all wizard mutations require Bearer / cookie JWT. No anonymous writes. No agent capability in V1 (D15 channel guard).
- **Cross-device resume** — `employee_onboarding_state` is server-side; an employee who starts on mobile and switches to web resumes at the correct step.
- **AvailabilityStep is skippable** (UI nudge if no unavailable days selected, but not a hard block). **ConsentStep is NOT skippable** — `completeWelcome` verifies consent rows exist before setting `is_welcome_complete = true`.
