---
title: "Onboarding Wizard — Architecture"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: onboarding-wizard
tags: [domain, onboarding-wizard, architecture, bff, server-actions, mobile]
mirror: verified
last_verified: 2026-05-23
---

# Onboarding Wizard — Architecture

> L1–L5 code map. **Code wins.** Every component cited with path. Verified against commits on `feat/employee-onboarding-wizard` 2026-05-23.

## L1 — Surface (UI)

### Web

| File | Role | Commit |
|---|---|---|
| `apps/web/src/app/dashboard/_components/WelcomeWizardGate.tsx` | Gate: reads `profile.is_welcome_complete` + `welcome_wizard_dismissed`; returns `<WelcomeWizard userEmail={…} />` (was `null`) | 41b5a87e4 |
| `apps/web/src/app/dashboard/layout.tsx:180-190` | Gate mount — already correct pre-sortie; gated on `is_welcome_complete === false \|\| null` | unchanged |
| `apps/web/src/components/welcome-wizard/WelcomeWizard.tsx` | Shell: `TOTAL_STEPS = 8` (was 6), framer-motion transitions, step dots, header + bell, `useReducedMotion()` gate, focus-to-Neste on step mount | 2c0a8decd |
| `apps/web/src/components/welcome-wizard/steps/HeroStep.tsx` | Step 1 — welcome screen, no writes | reused (pre-sortie) |
| `apps/web/src/components/welcome-wizard/steps/ContactStep.tsx` | Step 2 — `display_name` + `phone` → `user_identity` | reused |
| `apps/web/src/components/welcome-wizard/steps/AddressStep.tsx` | Step 3 — `address_*` → `profile` (ADR-0396 debt, see GAPS §D1) | reused |
| `apps/web/src/components/welcome-wizard/steps/PersonalNumberStep.tsx` | Step 4 — `personal_number` → `profile`; R8 two-phase: input → confirm sub-screen with reveal toggle | 5c2853454 |
| `apps/web/src/components/welcome-wizard/steps/AvailabilityStep.tsx` | Step 5 (NEW) — unavailable weekday chips (`Set<Weekday>`) → `employee_availability` RRULE rows | 2c0a8decd |
| `apps/web/src/components/welcome-wizard/steps/ConsentStep.tsx` | Step 6 (NEW) — handbook + gdpr (+ tariff if `is_tariff_bound`) checkboxes → `consent_acceptance` | 2c0a8decd |
| `apps/web/src/components/welcome-wizard/steps/OptionalStep.tsx` | Step 7 — bank_account + emergency_contact_* (skippable) | reused |
| `apps/web/src/components/welcome-wizard/steps/DoneStep.tsx` | Step 8 — calls `completeWelcome` → flips `is_welcome_complete` + updates `employee_onboarding_state` | reused + extended |
| `apps/web/src/app/dashboard/_components/CompleteProfileCard.tsx` | Home CTA: shows resume progress card when dismissed; mounts on NoShift/BeforeShift/AfterShift (NOT DuringShift) | a6f6bbe27 |
| `apps/mobile/app/(me)/contract/complete-data.tsx` | Legacy single-screen PII form — gets deprecation banner pointing to wizard (intentional fallback for field edits) | 7d3e40eb5 |

### Mobile (React Native + Expo)

| File | Role | Commit |
|---|---|---|
| `apps/mobile/app/(app)/onboarding/index.tsx` | Route: reads `profile.welcome_wizard_completed` via `/api/mobile/onboarding/state`; redirects new employees to wizard | 46f178738 |
| `apps/mobile/src/components/ui/WizardShell.tsx` | RN shell: `useWizardState` (deep import), WizardHeader + step + nav (Tilbake/Neste/Hopp/Lukk) | 2ee6f92fa |
| `apps/mobile/src/components/ui/WizardHeader.tsx` | Lifted from `reconciliation/_shared/WizardHeader.tsx` for cross-wizard reuse | 07753e6ce |
| `apps/mobile/src/components/welcome-wizard/_steps/HeroStep.tsx` | RN step 1 | 1d4f75abb |
| `apps/mobile/src/components/welcome-wizard/_steps/ContactStep.tsx` | RN step 2 | 1d4f75abb |
| `apps/mobile/src/components/welcome-wizard/_steps/AddressStep.tsx` | RN step 3 | 48a831ec2 |
| `apps/mobile/src/components/welcome-wizard/_steps/PersonalNumberStep.tsx` | RN step 4 — reveal-toggle + confirm sub-screen (R8 parity) | 48a831ec2 |
| `apps/mobile/src/components/welcome-wizard/_steps/AvailabilityStep.tsx` | RN step 5 — native day-picker | 48a831ec2 |
| `apps/mobile/src/components/welcome-wizard/_steps/ConsentStep.tsx` | RN step 6 — native scroll + acceptance toggle | 48a831ec2 |
| `apps/mobile/src/components/welcome-wizard/_steps/OptionalStep.tsx` | RN step 7 | 7dfb8b1df |
| `apps/mobile/src/components/welcome-wizard/_steps/DoneStep.tsx` | RN step 8 | 7dfb8b1df |

## L2 — BFF / API

### Web (cookie SSR → Server Actions)

| Route | Method | Role |
|---|---|---|
| `apps/web/src/app/api/employee-onboarding/state/route.ts` | GET — load `{status, current_step_index, step_data}`; UPSERT if missing → `status='in_progress'` | commit 8f1c61d5c |
| `apps/web/src/app/api/employee-onboarding/state/route.ts` | PUT — upsert `step_data` + `current_step_index` | same |
| `apps/web/src/app/api/employee-onboarding/state/dismiss/route.ts` | POST — set `status='dismissed'`, `dismissed_at=now()` | commit 8f1c61d5c |
| `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts` | 8 Server Actions: `saveContact`, `saveAddress`, `savePersonalNumber`, `saveAvailability`, `saveConsent`, `saveOptional`, `skipOptional`, `completeWelcome` | extended 2c0a8decd |

### Mobile (Bearer JWT → `resolveMobileActor` → same Server Actions)

| Route | Method | Role |
|---|---|---|
| `apps/web/src/app/api/mobile/employee-onboarding/state/route.ts` | GET/PUT — same body schema as web route. Bearer identity via `resolveMobileActor`. | commit 97d57720f |
| `apps/web/src/app/api/mobile/employee-onboarding/state/dismiss/route.ts` | POST — dismiss via Bearer | commit 97d57720f |
| `apps/web/src/app/api/mobile/employee-onboarding/save-step/route.ts` | POST — delegates to web Server Actions server-side after Bearer identity resolution | commit 97d57720f |

**Authentication split:**
- Web: cookie via `createClient()` → Server Action (existing pattern)
- Mobile: Bearer via `apps/web/src/app/api/mobile/_shared/actor.ts:resolveMobileActor` (ADR-0151 — profile_id + workspace_id server-derived, never accepted from body)

## L3 — Engine / orchestration

No Event Engine processes or cron for this domain. The wizard is a direct user-driven flow.

The **`employee_onboarding_state` row is created lazily** by the BFF GET handler (UPSERT semantics) on first load. `profile welcome_wizard_started` fires on that first GET.

`completeWelcome` Server Action performs a single-transaction sequence:
1. INSERT `consent_acceptance` rows per accepted `consent_type`
2. UPDATE `profile.is_welcome_complete = true`, `welcome_completed_at = now()`
3. UPDATE `employee_onboarding_state.status = 'completed'`, `completed_at = now()`
4. emit `profile welcome_wizard_completed` → `["posthog","logger","activity_trail","engine_event"]` (registry:14253-14268)

## L4 — Capability / domain logic

| Package / artifact | Role |
|---|---|
| `packages/ui/src/wizard/useWizardState.ts` | Step state machine — shared web + mobile (deep import via `@smartout/ui/wizard/state` subpath) |
| `packages/ui/src/wizard/types.ts` | `WizardStep`, `WizardStepDef`, `WeekdayCode` types; `iconName?: string` replaces `icon?: LucideIcon` (R-NEW, mobile-safe) |
| `packages/eslint-config/` — `no-wizard-barrel-import` | Blocks `import { useWizardState } from "@smartout/ui/wizard"` in `apps/mobile/**` (D14) |
| `packages/telemetry/src/registry.ts:636-665` | `profile welcome_wizard_*` event family — 4 existing + 2 new (`dismissed`, `resumed`) |
| `supabase/migrations/20260514000010_secure_submit_own_pii.sql` | Hardened PII RPC — binding write contract for address, identity, banking fields |

## L5 — Persistence

See [DATA-MODEL.md](./DATA-MODEL.md) for full table definitions, RLS, and migration references.

Key tables: `consent_acceptance` (new), `employee_onboarding_state` (new), `user_identity` (reused), `profile` (reused), `employee_availability` (reused).

## Data flow

### Web happy path (Step 5 — Availability)

```
Employee fills AvailabilityStep
  → WelcomeWizard.tsx calls useWizardState.next()
  → AvailabilityStep calls saveAvailability(unavailableDays)          [Server Action]
    → Zod parse weekday array
    → DELETE existing 'onboarding-wizard' rows for profile (idempotent)
    → INSERT one employee_availability RRULE row per unavailable day
    → emit profile welcome_wizard_step_completed {step: 5}
  → on 200: PUT /api/employee-onboarding/state {current_step_index: 6}
  → WelcomeWizard advances to ConsentStep
```

### Mobile BFF delegation

```
Mobile POST /api/mobile/employee-onboarding/save-step {stepKey: 'availability', payload}
  → resolveMobileActor(request) → {profileId, workspaceId}        [Bearer JWT]
  → BFF re-invokes saveAvailability(payload, {profileId, workspaceId})
  → same Server Action body, same DB writes
  → PUT /api/mobile/employee-onboarding/state {current_step_index: 6}
  → 200 {ok: true}
```

### Web vs mobile divergence

| Concern | Web | Mobile |
|---|---|---|
| Authentication | Cookie `createClient()` | Bearer `resolveMobileActor` |
| Shell | `WelcomeWizard.tsx` (Tailwind + framer-motion) | `WizardShell.tsx` (RN FlatList + `nativeMotion` tokens) |
| State machine | `useWizardState` (same) | `useWizardState` via `@smartout/ui/wizard/state` (same) |
| Step components | Web-specific (Lucide, Tailwind) | RN-specific (native pickers, `accessibilityState`) |
| Server Actions | Direct | Via Bearer BFF wrapper |
| State persistence | `/api/employee-onboarding/state` | `/api/mobile/employee-onboarding/state` — identical body schema |
