---
title: "Journey — Employee Onboarding Wizard"
feature: employee-onboarding-wizard
status: draft
created: 2026-05-23
updated: 2026-05-23
module: onboarding
tags: [onboarding, wizard, web, mobile, identity, consent, availability, pii, gdpr, welcome-wizard]
---

# Journey — Employee Onboarding Wizard

Schedule-ready Tier B onboarding: new employee completes 8-step wizard (Hero → Contact → Address → PersonalNumber → Availability → Consent → Optional → Done) on web OR mobile. Identity columns stay on `user_identity` (ADR-0396). Strategy A — extend existing `WelcomeWizard` in place, do not rebuild (ADR-0397). Both surfaces share Server Actions + Zod + `useWizardState` step machine.

**Spec:** `docs/superpowers/specs/2026-05-23-employee-onboarding-wizard-design.md` (R2)
**Plan:** `docs/superpowers/plans/2026-05-23-employee-onboarding-wizard.md`

---

## Journey 1: Web — new employee completes onboarding end-to-end

**Precondition:** Employee has accepted invite, has a `profile` row in workspace with `welcome_wizard_completed=false` and `welcome_wizard_dismissed=false`. First login on web (app.smartout.ai/<slug>).

1. Employee lands on `/dashboard` → `WelcomeWizardGate` reads server-side `profile.welcome_wizard_*` flags → System renders `WelcomeWizard` overlay (previously returned `null`).
2. Employee sees Step 1 HeroStep → Continue → Step 2 ContactStep submits phone + emergency_contact_name + emergency_contact_phone via existing Server Action → updates `user_identity` (ADR-0396, never `profile`).
3. Employee fills AddressStep → Server Action `submit_own_pii` RPC with `field_groups=['address']`.
4. Employee fills PersonalNumberStep with reveal-toggle + confirmation sub-screen (R8) → `submit_own_pii` RPC with `field_groups=['identity']`.
5. Employee fills AvailabilityStep (new) → `saveAvailability` Server Action writes RRULE rows to `employee_availability` (preference_type ∈ unavailable|preferred|blocked) → emits `profile.welcome_wizard_step_completed` (step=5).
6. Employee accepts handbook + gdpr (+ optional tariff) in ConsentStep (new) → `saveConsent` Server Action inserts append-only rows in `consent_acceptance` (RLS, no UPDATE/DELETE) → emits per-consent-type.
7. Employee submits OptionalStep → DoneStep → `completeWelcome` Server Action sets `profile.welcome_wizard_completed=true`, upserts `employee_onboarding_state.status='completed'` → emits `profile.welcome_wizard_completed` (engine_event destination).
8. Wizard unmounts → Employee lands on home dashboard, fully ready.

**Postcondition:** `profile.welcome_wizard_completed=true`; `user_identity` has phone+emergency+address+personal_number; `employee_availability` has RRULE rows; `consent_acceptance` has handbook+gdpr (+tariff if accepted) rows; `employee_onboarding_state.status='completed'`.

**Error paths:**
- Server Action throws → Wizard surfaces Norwegian error inline at the failing step; per-step state preserved; retry allowed.
- `submit_own_pii` validation fails (e.g. invalid personal_number checksum) → step-level error, no DB write.
- Consent already accepted with same `document_version` → append-only, second row written (audit trail), no error.
- Network drop mid-step → next mount resumes at `employee_onboarding_state.current_step`.

**Verification:** Playwright E2E `apps/e2e/onboarding-wizard/web.spec.ts` covers 8-step happy path + step-2 resume after refresh.

---

## Journey 2: Mobile — new employee completes onboarding end-to-end

**Precondition:** Employee has accepted invite, has a `profile` row in workspace with `welcome_wizard_completed=false`. First login on mobile app.

1. Employee lands on `(app)/_layout` → reads `profile.welcome_wizard_completed` via `/api/mobile/onboarding/state` (Bearer JWT, server-derives identity per ADR-0151) → System redirects to `/onboarding` route.
2. Employee sees mobile HeroStep (RN twin) → swipe/tap Continue → ContactStep submits via `/api/mobile/onboarding/save-step` (POST Bearer) → BFF wraps the same Server Action used by web.
3. Steps 3 (Address), 4 (PersonalNumber with reveal+confirm), 5 (Availability), 6 (Consent), 7 (Optional), 8 (Done) each POST to `save-step` → server writes via same RPC/Server Action contract → identical Zod validation.
4. PersonalNumberStep on mobile renders same reveal-toggle + confirm sub-screen (R8 parity).
5. AvailabilityStep on mobile uses native day-picker + time-picker → builds identical RRULE payload → server-side parity check.
6. ConsentStep renders handbook + gdpr (+ optional tariff) as native scroll + acceptance toggle.
7. DoneStep → mobile fires `completeWelcome` via BFF → `profile.welcome_wizard_completed=true` → user lands on home.

**Postcondition:** Same as Journey 1. Mobile + web are interchangeable mid-flow (state persists per-step in `employee_onboarding_state`).

**Error paths:**
- BFF 401 (token expired) → mobile re-auth flow, then resume at last completed step.
- BFF 400 validation → step-level error toast, retry.
- Mobile offline → enqueue per ADR-0134 (workspace_id + actor_id resolved before emit), retry on reconnect.
- App backgrounded mid-step → `employee_onboarding_state.current_step` preserved server-side, resume on next launch.

**Verification:** Manual mobile smoke + Maestro flow (mobile E2E debt acknowledged in HANDOFF if not landed Phase 16).

---

## Journey 3: Resume — employee dismisses mid-wizard, resumes from home

**Precondition:** Employee opened wizard, completed steps 1–3, then dismissed via X.

1. Employee on Step 4 PersonalNumberStep taps X (dismiss) → `dismissWelcomeWizard` Server Action sets `profile.welcome_wizard_dismissed=true` + upserts `employee_onboarding_state.status='dismissed'` → emits `profile.welcome_wizard_dismissed`.
2. Wizard unmounts → Employee lands on home dashboard.
3. Home reads `useOnboardingProgress` hook (shared web+mobile) → hook returns `{ completed: 3, total: 8, status: 'dismissed', resume_step: 4 }` from `/api/onboarding/state`.
4. Home dashboard mounts `CompleteProfileCard` on NoShift / BeforeShift / AfterShift views (NOT DuringShift) → card shows "Fullfør profilen din — 3 av 8 steg" + CTA.
5. Employee taps CTA → `resumeWelcomeWizard` Server Action sets `profile.welcome_wizard_dismissed=false` + emits `profile.welcome_wizard_resumed` → Wizard re-mounts at Step 4 (resume_step).
6. Employee finishes Steps 4–8 → completion sets `welcome_wizard_completed=true` → CompleteProfileCard disappears from home.

**Postcondition:** Wizard fully completed; CompleteProfileCard no longer rendered on any home view.

**Error paths:**
- Employee dismisses again before completing → second dismiss row appended (audit), card stays on home until completion.
- Employee completes ContactStep on mobile, then resumes on web at Step 4 → cross-device resume works (state is server-side).
- Hook fails to fetch state → card not rendered (silent skip), no broken UI.

**Verification:** Playwright `apps/e2e/onboarding-wizard/resume.spec.ts` covers dismiss → home → resume → complete cycle.
