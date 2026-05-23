---
title: "Onboarding Wizard — Overview"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: onboarding-wizard
tags: [domain, onboarding-wizard, wizard, identity, d2-resource]
mirror: verified
last_verified: 2026-05-23
---

# Onboarding Wizard — Overview

> What this domain is and why it exists. **Code wins** — if this contradicts code, update here.

## 1. What it is

The Onboarding Wizard is the structured employee-PII onboarding surface for Smartout. It walks a newly-invited employee through 8 steps — Hero, Contact, Address, PersonalNumber, Availability, Consent, Optional (bank + emergency contact), Done — on web or mobile. Completion yields a "Schedule-ready Tier B" employee: the scheduler knows their availability, HR has their consent, and payroll has their PII minimum (personal_number + bank_account).

A 6-step web `WelcomeWizard` already existed in `apps/web/src/components/welcome-wizard/` before this sortie. The gate stub at `WelcomeWizardGate.tsx:20-22` was simply returning `null`, so the wizard never rendered. Strategy A (ADR-0397) extended the wizard in place: the gate was wired to return `<WelcomeWizard … />`, two new steps (Availability at position 5, Consent at position 6) were inserted, `TOTAL_STEPS` was updated from 6 to 8, and a full mobile twin was built. This domain owns the resulting surface.

## 2. Cascade placement

| Dimension | Role |
|---|---|
| **Identity layer** (pre-workspace) | `user_identity` receives `display_name`, `phone`, `emergency_contact_*` from Steps 2 + 7. ADR-0396 mandates identity columns never duplicate on `profile`. |
| **D2 Resource** | `profile` receives `personal_number`, `bank_account`, `is_welcome_complete`, `welcome_completed_at` — employee attributes within a workspace. `employee_availability` receives RRULE rows (Step 5). |
| **C2 Agent-Utility** | `employee_onboarding_state` is a C2-class resumability artifact — per-employee wizard progress tracked server-side, readable by the mobile gate. |

The wizard is a **pre-cascade, identity-layer flow** (ADR-0133 confirmed this is not a forbidden mobile authoring surface: compare precedent `complete-data.tsx`). It produces the D2 resource rows that the cascade engine subsequently reads. It does not produce D6 production data.

## 3. Boundaries

**Owns:**
- `consent_acceptance` table (append-only, identity-layer consent audit)
- `employee_onboarding_state` table (resumability state per profile)
- `apps/web/src/components/welcome-wizard/` (all 8 step components + WelcomeWizard shell)
- `apps/mobile/src/components/welcome-wizard/_steps/` (8 RN step twins)
- `apps/mobile/app/(app)/onboarding/index.tsx` route
- `apps/web/src/app/api/employee-onboarding/*` (web cookie BFF)
- `apps/web/src/app/api/mobile/employee-onboarding/*` (mobile Bearer BFF)
- `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts` (8 Server Actions)
- `useOnboardingProgress` hook
- `CompleteProfileCard` home CTA

**Does NOT own:**
- `user_identity` DDL — owned by **identity domain** (pre-workspace layer)
- `profile` DDL — owned by **identity / D2 resource** domain
- `employee_availability` DDL — owned by **scheduling / D2** domain; wizard writes rows, does not define the table
- `payroll.consent_document` + DocuSeal payroll consent — owned by **payroll domain** (ADR-0311 governs payroll `trekk-samtykke`; this wizard's `consent_acceptance` is a separate identity-layer concern)
- Workspace admin onboarding (`/join`, `/onboarding`, `/dashboard/setup`) — web-only per ADR-0133, owned by **workspace-admin** domain
- Contract signing flow — separate domain
- `submit_own_pii` RPC DDL — shared utility (`supabase/migrations/20260514000010_secure_submit_own_pii.sql`); wizard is a consumer, not an owner

## 4. Key invariants

- **Identity columns live on `user_identity`, never duplicated on `profile`** (ADR-0396). `saveContact` writes `display_name` + `phone` to `user_identity`; `saveOptional` writes `emergency_contact_*` to `user_identity`. Violation: `saveAddress` currently writes `address_*` to `profile` — pre-existing debt (GAPS-AND-DEBT §D1).
- **`consent_acceptance` is append-only** — no UPDATE/DELETE RLS policy. A second acceptance of the same `consent_type` + `document_version` writes a second row (audit trail). This is intentional and correct.
- **`profile.is_welcome_complete` and `employee_onboarding_state.completed_at` set atomically** — `completeWelcome` Server Action (`welcome-wizard-actions.ts`) must maintain this invariant; splitting the writes is a bug.
- **`profile welcome_wizard_completed` destinations preserved exactly** — registry line 14253-14268 includes `engine_event`; removing this routing breaks downstream consumers.
- **Step 4 (PersonalNumber) always shows full digit string on the confirmation sub-screen** — masking on a verification screen defeats its purpose (ADR-0397 §D4 / R8). Default: visible. Toggle: `Eye`/`EyeOff` (hide, not show).
- **Mobile imports `useWizardState` via deep path** — `@smartout/ui/wizard/state`, never barrel. ESLint rule `no-wizard-barrel-import` enforces this to prevent Lucide + Framer Motion from landing in the RN bundle (ADR-0397 §D14).
- **`employee_availability` rows written by wizard use `reason = 'onboarding-wizard'`** — provenance discriminator for scheduler queries.
