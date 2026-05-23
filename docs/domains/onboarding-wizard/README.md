---
title: "Onboarding Wizard — Domain README"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: onboarding-wizard
tags: [domain, onboarding-wizard, wizard, identity, d2-resource]
mirror: verified
last_verified: 2026-05-23
---

# Onboarding Wizard — Source of Truth

> Authoritative folder for the **onboarding-wizard** domain. If code contradicts this folder → **CODE wins**, update these docs.
>
> **Strategy A (ADR-0397):** The existing `welcome-wizard/` directory is extended in place — not rebuilt. Steps 5 (Availability) + 6 (Consent) were inserted between PersonalNumber and the existing Optional/Done steps, making `TOTAL_STEPS = 8`. The gate stub at `WelcomeWizardGate.tsx:20-22` was wired from `return null` to `return <WelcomeWizard … />`.

The Onboarding Wizard is the **structured employee-PII onboarding surface** for Smartout. It walks a newly-invited employee through identity, contact, address, tax, availability, and consent in 8 steps — on web or mobile. Completion is required for schedule-readiness (Tier B). Two new tables (`consent_acceptance`, `employee_onboarding_state`) enable immutable consent auditing and cross-device resumability.

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| Gate wired (`WelcomeWizardGate` returns wizard) | ✅ | 🟡 | `apps/web/src/app/dashboard/_components/WelcomeWizardGate.tsx` (commit 41b5a87e4) |
| TOTAL_STEPS 6→8, AvailabilityStep + ConsentStep inserted | ✅ | 🟡 | `apps/web/src/components/welcome-wizard/WelcomeWizard.tsx` (commit 2c0a8decd) |
| PersonalNumberStep R8 — confirmation sub-screen + reveal toggle | ✅ | 🟡 | `apps/web/src/components/welcome-wizard/steps/PersonalNumberStep.tsx` (commit 5c2853454) |
| `saveAvailability` + `saveConsent` Server Actions | ✅ | ✅ | `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts`; 3+7 unit tests |
| Web BFF: `/api/employee-onboarding/state` GET/PUT + `/dismiss` POST | ✅ | 🟡 | Commit 8f1c61d5c |
| Mobile BFF: `/api/mobile/employee-onboarding/state` + `/save-step` | ✅ | 🟡 | Commit 97d57720f |
| Mobile WizardShell (RN twin) | ✅ | 🟡 | `apps/mobile/src/components/ui/WizardShell.tsx` (commit 2ee6f92fa) |
| Mobile step components (8 RN counterparts) | ✅ | 🟡 | `apps/mobile/src/components/welcome-wizard/_steps/` (commits 1d4f75abb–7dfb8b1df) |
| `/onboarding` mobile route + first-mount gate | ✅ | 🟡 | `apps/mobile/app/(app)/onboarding/index.tsx` (commit 46f178738) |
| `useOnboardingProgress` hook (shared web + mobile) | ✅ | 🟡 | Commit 486f489c0 |
| Home CTA card `CompleteProfileCard` | ✅ | 🟡 | Commit a6f6bbe27 |
| `complete-data.tsx` deprecation banner | ✅ | — | Commit 7d3e40eb5 |
| `consent_acceptance` migration | ✅ | 🟡 | `supabase/migrations/20260624000000_create_consent_acceptance.sql` |
| `employee_onboarding_state` migration | ✅ | 🟡 | `supabase/migrations/20260624000100_create_employee_onboarding_state.sql` |
| New telemetry events (`dismissed`, `resumed`) | ✅ | 🟡 | `packages/telemetry/src/registry.ts` |
| Mobile nativeMotion tokens | ✅ | — | Commit 1d4f75abb |
| ESLint rule: `no-wizard-barrel-import` (D14) | ✅ | — | `packages/eslint-config/` (commit 2c0a8decd) |
| `@smartout/ui/wizard/state` subpath export (D14) | ✅ | — | `packages/ui/src/wizard/` |
| Maestro mobile E2E coverage | 🔴 | 🔴 | ROADMAP item — see GAPS-AND-DEBT |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status matrix: [../_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map — gate → layout → shell → steps → actions → DB |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | Reused + new tables, RLS, telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | verified | 3 journeys — web complete / mobile complete / dismiss-resume |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | Successor sorties + open scope decisions |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Pre-existing + introduced debt |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Test matrix |

## Agent Guardrails

> Read before touching onboarding-wizard code. Truth lives in this folder.

- **Never write identity-layer PII directly to `profile`** — `display_name`, `phone`, `emergency_contact_*`, `date_of_birth`, `address_*` belong on `user_identity` (ADR-0396). `saveContact` + `saveOptional` already write to the correct table.
- **`saveAddress` currently writes to `profile`** — this is a pre-existing ADR-0396 violation, documented in GAPS-AND-DEBT §D1. Do NOT replicate this pattern.
- **`submit_own_pii` RPC is the binding write contract for PII** — use it for address, identity (personal_number), and banking fields. Never bypass with direct column writes. (`supabase/migrations/20260514000010_secure_submit_own_pii.sql`)
- **`consent_acceptance` is append-only** — no UPDATE/DELETE policy. Any attempt to build an edit flow here is wrong. Audit-immutability is intentional (Bokf. §13-style).
- **`profile.is_welcome_complete` + `employee_onboarding_state.completed_at` are set in the same transaction** — `completeWelcome` must keep them atomic. Never set one without the other.
- **`engine_event` on `welcome_wizard_completed` is a downstream consumer dependency** — do NOT remove or reroute. Registry line 14253-14268 is the binding anchor.
- **Mobile imports `useWizardState` via deep path only** — `@smartout/ui/wizard/state`, never the barrel (`@smartout/ui/wizard`). ESLint rule `no-wizard-barrel-import` enforces this (D14 / ADR-0397 §D14).
- **No agent capability for wizard writes in V1** — channel guard D15: wizard mutations route through cookie/Bearer BFF only. If a Botsson tool is added, it MUST declare `allowedChannels: ['chat']` per ADR-0163.
- **Owning tables:** `consent_acceptance`, `employee_onboarding_state` (new). Reads/writes also to: `user_identity`, `profile`, `employee_availability`.
- **Owning surfaces:** `apps/web/src/components/welcome-wizard/`, `apps/mobile/src/components/welcome-wizard/`, `apps/mobile/app/(app)/onboarding/`.
- **Owning Server Actions:** `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts` (8 actions: saveContact, saveAddress, savePersonalNumber, saveAvailability, saveConsent, saveOptional, skipOptional, completeWelcome).
- **BFF routes:** `/api/employee-onboarding/state` (web cookie) + `/api/mobile/employee-onboarding/{state,save-step}` (Bearer via `resolveMobileActor`).
