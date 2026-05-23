---
title: "Employee Onboarding Wizard — Design Spec (R2)"
status: review
updated: 2026-05-23
created: 2026-05-23
module: onboarding-wizard
tags: [wizard, onboarding, employee, mobile, web, d2-resource, consent]
---

# Employee Onboarding Wizard — Design Spec (R2)

> Complete and mate the existing web WelcomeWizard with two new steps + give it a mobile twin. Reuse what works. Add only what is missing.

## R2 revision history

R1 spec (2026-05-23) was REJECTED by council (4/4 reviewers converged) — it misrepresented existing system state, proposed duplicate identity-layer columns on `profile`, invented a parallel telemetry namespace, and silently dropped an engine_event consumer. This R2 spec incorporates all 10 required revisions (R1-R10) from the Phase 5 synthesis.

Verdict to address: **REJECT — REVISE BEFORE PLAN-WRITING.** See council log entry 2026-05-23 for the full reasoning.

---

## §0 Existing surface inventory (R1)

A 6-step web WelcomeWizard already exists. The gate is mounted in the dashboard layout. The only thing missing is the gate returning the wizard instead of `null`.

| Artifact | Path | State |
|---|---|---|
| Web wizard shell | `apps/web/src/components/welcome-wizard/WelcomeWizard.tsx` | Complete: 6-step state machine, framer-motion transitions, step dots, header + bell. `TOTAL_STEPS = 6`. |
| Step 1 — `HeroStep` | `apps/web/src/components/welcome-wizard/steps/HeroStep.tsx` | Welcome screen, no writes. |
| Step 2 — `ContactStep` | `apps/web/src/components/welcome-wizard/steps/ContactStep.tsx` | Writes `display_name` + `phone` to **`user_identity`** via `saveContact` action. |
| Step 3 — `AddressStep` | `apps/web/src/components/welcome-wizard/steps/AddressStep.tsx` | Writes `address_line_1/2`, `postal_code`, `city` to **`profile`** via `saveAddress` action. |
| Step 4 — `PersonalNumberStep` | `apps/web/src/components/welcome-wizard/steps/PersonalNumberStep.tsx` | Writes `personal_number` to **`profile`** via `savePersonalNumber` action. |
| Step 5 — `OptionalStep` | `apps/web/src/components/welcome-wizard/steps/OptionalStep.tsx` | Writes `emergency_contact_*` to **`user_identity`** + `bank_account` to **`profile`** via `saveOptional` action. Skippable via `skipOptional`. |
| Step 6 — `DoneStep` | `apps/web/src/components/welcome-wizard/steps/DoneStep.tsx` | Calls `completeWelcome` action → flips `profile.is_welcome_complete = true` + `welcome_completed_at = now()`. |
| Gate stub | `apps/web/src/app/dashboard/_components/WelcomeWizardGate.tsx:20-22` | **Returns `null`** — the wizard is fully built but never rendered. One-line fix to wire it up. |
| Gate mount | `apps/web/src/app/dashboard/layout.tsx:180-190` | Gate is mounted, gated on `is_welcome_complete === false || null`. Already correct. |
| Server Actions | `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts` | 6 actions: `saveContact`, `saveAddress`, `savePersonalNumber`, `saveOptional`, `skipOptional`, `completeWelcome`. All audit-traced. |
| Hardened PII RPC | `supabase/migrations/20260514000010_secure_submit_own_pii.sql` | `submit_own_pii(workspace_id, field_group, values)` — accepts `'identity' | 'banking' | 'address'`. Used by mobile `complete-data.tsx` today. ADR-0151-hardened (workspace_id derived server-side). |
| Mobile PII screen | `apps/mobile/app/(app)/(me)/contract/complete-data.tsx` | Single-screen submit-own-pii caller. No multi-step wizard. |
| Web telemetry events | `packages/telemetry/src/registry.ts:636-665` | `profile welcome_wizard_started`, `_step_completed`, `_completed`, `_skipped_optional`. `_completed` routes to **`["posthog","logger","activity_trail","engine_event"]`** (registry:14253-14268). |
| Generic wizard events | `packages/telemetry/src/registry.ts:3615-3683` | `wizard started/step_entered/step_completed/step_skipped/step_back/completed/abandoned/validation_failed/fact_edited` (9 events, space-separated, no dot). |

This spec is therefore not a greenfield build. It is **(a)** wire the existing gate, **(b)** extend the wizard with two new steps (availability + consent), **(c)** add a mobile twin using the same step state and Server Actions, and **(d)** introduce two new tables (`consent_acceptance`, `employee_onboarding_state`) for resumability + consent capture.

## Background

A new employee accepts their invite and lands in a half-empty app. The web WelcomeWizard would walk them through identity + contact + address + personal_number + emergency contact + bank account — but the gate currently returns `null`, so nothing renders. Mobile employees have only a single-screen PII form (`complete-data.tsx`) and no resumable, multi-step onboarding.

Two pieces are also missing entirely from the existing wizard:
- **Availability** — the employee's weekly availability defaults to "any day, any time" because the scheduler treats absence of rows as "available." A new step captures explicit unavailable weekdays into `employee_availability` (existing table, RRULE-based).
- **Consent** — handbook acceptance + GDPR acknowledgement (+ tariff if `is_tariff_bound`). No append-only acceptance log exists today.

## Goals

1. Wire the existing `WelcomeWizardGate` so the wizard actually renders for new employees.
2. Add two new steps to the existing wizard: **Availability** (between PersonalNumber and Optional) and **Consent** (before DoneStep).
3. Build a mobile twin of the wizard reusing the same Server Actions + the new steps' BFF endpoints.
4. Persist per-step state so an employee can resume on a different device (`employee_onboarding_state`).
5. Capture consent acceptances in an append-only audit table (`consent_acceptance`).
6. Soft-gate: an employee can dismiss the wizard and finish later via a home-screen CTA. Gate re-triggers next cold start until `is_welcome_complete = true`.

## Non-Goals

- New identity-layer columns on `profile`. **All identity fields stay on `user_identity` where they already live** (R2).
- A parallel telemetry namespace. **Reuse existing `profile welcome_wizard_*` events** (R5).
- Bypass `submit_own_pii` RPC. **Reuse it.** (R3)
- Replace existing `welcome-wizard/` directory. **Extend in place.** (R1 Option A)
- Admin/workspace bootstrap wizards (`/join`, `/onboarding`, `/dashboard/setup` — web-only per ADR-0133, unchanged).
- Contract signing flow (separate domain).
- Hours-within-day availability granularity (V1: daily on/off only — D5).
- Hard payroll blocking on missing PII (downstream concern at payroll-period-lock).
- Mobile home-screen news / community widgets (separate sortie).

## Decisions Locked (R2-revised)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Tier B** info scope: identity, contact, payroll PII, availability, consent. | Schedule-ready + lønn-ready minimum. |
| D2 | **Soft gate, resumable, per-step save.** | Maximises completion without forced friction; payroll-PII gate is enforced at lock-time. |
| D3 | **Shared step state + per-platform shells.** `useWizardState` (existing) is React-portable (pure hooks; `"use client"` is Next.js bundler metadata RN ignores). | Web `WizardShell` is Tailwind/framer-motion-bound; mobile needs its own shell. State machine is shareable. |
| D4 | **Step 4 PII confirmation: full reveal + optional hide toggle (R8).** | Masking on a verification screen defeats verification. User owns the data and must see it. |
| D5 | **V1 availability = daily on/off only, RRULE rows in existing `employee_availability`.** | Schema cannot encode time-within-day without DTSTART; defer. |
| **D6** | **Strategy A: extend existing `welcome-wizard/`** (R1). Steps 1-4 + 6 reuse existing components. New steps 5a (Availability) and 5b (Consent) inserted between PersonalNumber and DoneStep, making TOTAL_STEPS = 8. | All four reviewers converged that ignoring the existing wizard is the blocker. Extending it removes the migration risk + preserves engine_event continuity. |
| **D7** | **No new identity-layer columns on `profile`** (R2). Contact + emergency contact write to `user_identity` (already exist there) via the existing `saveContact` + `saveOptional` Server Actions. Per ADR-NEW-0396 (this sortie). | Identity is pre-workspace; duplicating on `profile` creates dual source-of-truth. |
| **D8** | **Reuse existing `submit_own_pii` RPC for PII writes** (R3). New steps use new Server Actions wrapping the RPC where possible. | Existing audit trail + ADR-0151 hardening + mobile already uses it. |
| **D9** | **Surface ownership: WelcomeWizard owns the structured employee-PII flow** (R4). Mobile `complete-data.tsx` is the single-screen fallback for late editing and gets a deprecation banner pointing to the wizard. | One canonical onboarding surface per L-0178 dual-surface ownership. |
| **D10** | **Telemetry reuses `profile welcome_wizard_*` event family** (R5). Adds only two new events: `profile welcome_wizard_dismissed` and `profile welcome_wizard_resumed`. `_completed` destinations preserved exactly (incl. engine_event). | Drops the proposed `onboarding.wizard_*` dot namespace; matches registry convention; preserves engine_event consumers. |
| **D11** | **Step toggle direction (R8 / C1):** UI copy is *"Hvilke dager kan du IKKE jobbe?"* on step 5a. Data shape matches: `Set<Weekday>` of unavailable days. Column name + UI label both say "unavailable." | Removes the semantic inversion. |
| **D12** | **Component-contract table mandatory** (R6). Each new step component lists its primitives + i18n keys + a11y contract. See §S_components. | Prevents drift across the two shells. |
| **D13** | **Accessibility: WCAG 2.2 AA target.** `useReducedMotion()` gate on AnimatedWizardShell. `aria-pressed` / `accessibilityState.checked` on toggle chips. Focus to "Neste" on step mount. PII confirmation announced as dialog. See §S_a11y. (R7) | Wizard is first interaction; a11y debt here is disproportionate. |
| **D14** | **Barrel-import discipline** (R9). Mobile imports `useWizardState` via deep path (`@smartout/ui/wizard/state`), not the barrel that exports web-only shells. New ESLint rule enforces this on `apps/mobile/**`. | Prevents Metro from pulling lucide-react + framer-motion into mobile bundle. |
| **D15** | **Channel guard (R10):** wizard mutations route through cookie/Bearer BFF only. No agent capability for wizard writes in V1. If a "help me onboard" Botsson tool is added later, it MUST declare `allowedChannels: ['chat']` per ADR-0163. | Closes the question explicitly. |

---

## §S1. Step Flow (8 steps — 6 existing + 2 new)

`TOTAL_STEPS` changes from 6 to 8 in `WelcomeWizard.tsx`. New steps inserted as 5 + 6 (was Optional + Done). Old Optional becomes step 7; Done becomes step 8.

| # | Step | Component | Required fields | Validation | Save target | New? |
|---|---|---|---|---|---|---|
| 1 | **Velkommen** | `HeroStep` (existing) | none | — | — | reused |
| 2 | **Kontakt** | `ContactStep` (existing) | `display_name`, `phone` | display_name min 2; phone E.164 | `user_identity` via `saveContact` | reused |
| 3 | **Adresse** | `AddressStep` (existing) | `address_line_1`, `postal_code`, `city` | required fields | `profile` via `saveAddress` | reused |
| 4 | **Personnummer (PII)** | `PersonalNumberStep` (existing) — extended with R8 reveal toggle + confirmation sub-screen | `personal_number` | 11 digits + mod-11 | `profile` via `savePersonalNumber` | reused + R8 fix |
| **5** | **Tilgjengelighet** | **`AvailabilityStep` (NEW)** | unavailable weekdays as `Set<Weekday>` | At least one available day (UI nudge, not blocking) | `employee_availability` (one INSERT per unavailable day, RRULE) — via new `saveAvailability` Server Action | **NEW** |
| **6** | **Samtykke** | **`ConsentStep` (NEW)** | `accepted.handbook` + `accepted.gdpr` (+ `accepted.tariff` if workspace `is_tariff_bound`) | All checkboxes checked | `consent_acceptance` (one row per consent_type) via new `saveConsent` Server Action | **NEW** |
| 7 | **Valgfritt (lønn + nødkontakt)** | `OptionalStep` (existing) | `bank_account`, `emergency_contact_*` — all optional | mod-11 on bank_account; E.164 on phone | `profile.bank_account` + `user_identity.emergency_contact_*` via `saveOptional` (or `skipOptional`) | reused |
| 8 | **Ferdig** | `DoneStep` (existing) | — | — | Calls `completeWelcome` → `profile.is_welcome_complete = true` + `welcome_completed_at = now()` + records to `employee_onboarding_state.completed_at` (NEW) | reused + extended |

Step ordering rationale: availability is captured BEFORE optional bank/emergency so the schedule has the data even if the employee skips OptionalStep. Consent comes after availability so the handbook acceptance is the last gesture before the "Ferdig" screen — gives the user a clear "I am done committing" moment.

UI conventions:
- All steps use the existing wizard shell's design tokens (Nordic Split colors, Geist + Instrument Serif fonts, Lucide icons).
- Step 4 — `PersonalNumberStep` extended per R8: full reveal + `Eye`/`EyeOff` toggle + explicit "Bekreft og lagre" CTA. No masking on the confirmation screen.
- Step 5 — copy: *"Hvilke dager kan du vanligvis IKKE jobbe?"* + help text: *"Du kan endre dette når som helst i Min Tid."*
- Step 6 — PDF preview of handbook (existing handbook bucket); GDPR text block (constant in V1; ROADMAP item for catalog); 2-3 checkboxes; submit triggers completeWelcome via Step 8's `DoneStep`.

## §S2. Data Model

### Existing tables — reused (no schema changes)

- `user_identity`: writes via `saveContact` (phone, display_name) + `saveOptional` (emergency_contact_*). NO NEW COLUMNS.
- `profile`: writes via `saveAddress` (address_*), `savePersonalNumber` (personal_number), `saveOptional` (bank_account), `completeWelcome` (is_welcome_complete + welcome_completed_at). NO NEW COLUMNS.
- `employee_availability`: writes via new `saveAvailability` Server Action. One row per unavailable weekday:
  - `workspace_id`, `profile_id` (server-derived)
  - `valid_from = CURRENT_DATE`, `valid_to = NULL`
  - `rrule = 'FREQ=WEEKLY;BYDAY=<MO|TU|WE|TH|FR|SA|SU>'`
  - `preference_type = 'unavailable'`
  - `reason = 'onboarding-wizard'` (provenance discriminator)
  - `created_by = profile_id` (NOT NULL — R-NEW per agent-coord finding O-5)

### New tables (2)

**`consent_acceptance`** (append-only audit, ADR-style):
```sql
CREATE TABLE public.consent_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('handbook','gdpr','tariff')),
  document_version TEXT NOT NULL,           -- e.g. "handbook-v3"
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'employee-onboarding-wizard',
  client_user_agent TEXT,
  client_ip TEXT                            -- captured server-side at BFF
);
CREATE INDEX idx_consent_acceptance_profile
  ON public.consent_acceptance(profile_id, consent_type, accepted_at DESC);
```
RLS: SELECT for owning profile + manager/admin. INSERT only via SECURITY DEFINER function (or service role from Server Action) — never JWT-direct. **NO UPDATE/DELETE policy** (Bokf. §13-style immutability).

Note on consent scope vs ADR-0311: this table is for **identity-layer** onboarding consent (handbook + GDPR + tariff acknowledgement). ADR-0311 governs **payroll trekk-samtykke (Aml. §14-15)** which is a separate payroll-domain concern using `payroll.consent_document` + DocuSeal. Both can coexist; this table does NOT replace ADR-0311's payroll table.

**`employee_onboarding_state`** (resumability):
```sql
CREATE TABLE public.employee_onboarding_state (
  profile_id UUID PRIMARY KEY REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','dismissed','completed')),  -- enum per agent-coord R7
  current_step_index INT NOT NULL DEFAULT 0,
  step_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL)),  -- enforce status-timestamp coherence
  CHECK ((status = 'dismissed') = (dismissed_at IS NOT NULL))
);
```
RLS: dual policy — JWT (own profile_id) + API key (workspace-scoped).

`step_data` does NOT contain payroll PII or consent records (those are written directly to their canonical tables at step commit).

`completed_at` is set in the same transaction as `profile.is_welcome_complete = true` (the existing `completeWelcome` action is extended to also update this row).

### Existing PII RPC reused

Steps 2, 3, 4, 7 continue to use the existing Server Actions (`saveContact` → user_identity, `saveAddress` → profile via `submit_own_pii('address', …)`, `savePersonalNumber` → profile via `submit_own_pii('identity', …)`, `saveOptional` → both). The hardened `submit_own_pii` migration `20260514000010_secure_submit_own_pii.sql` is the binding contract.

## §S3. Architecture

### File layout (changes from current state)

```
apps/web/src/components/welcome-wizard/                       ← EXTEND existing
  WelcomeWizard.tsx                  — bump TOTAL_STEPS 6→8, insert steps 5+6, add a11y + reduced-motion
  steps/AvailabilityStep.tsx         — NEW
  steps/ConsentStep.tsx              — NEW
  steps/PersonalNumberStep.tsx       — EXTEND with reveal toggle + confirmation sub-screen (R8/D4)
  steps/StepDots.tsx                 — already exists, just consumes new total

apps/web/src/app/dashboard/_components/WelcomeWizardGate.tsx  ← ONE-LINE FIX
  — return <WelcomeWizard userEmail={userEmail} /> instead of null

apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts ← ADD 2 actions
  + saveAvailability(unavailableDays: Weekday[]): writes employee_availability rows
  + saveConsent(accepted: { handbook: bool; gdpr: bool; tariff?: bool }): writes consent_acceptance rows
  + extend completeWelcome to also update employee_onboarding_state.{status,completed_at}

apps/web/src/app/api/employee-onboarding/state/route.ts       ← NEW (web cookie)
  GET → load { status, current_step_index, step_data }; upsert if missing → status='in_progress'
  PUT → upsert step_data + current_step_index
  POST /dismiss → set status='dismissed', dismissed_at=now()

apps/web/src/app/api/mobile/employee-onboarding/state/route.ts ← NEW (mobile Bearer, uses resolveMobileActor)
  Same body schema as web route. Identical contract.

apps/web/src/app/api/mobile/employee-onboarding/save-step/route.ts ← NEW (mobile Bearer)
  POST → delegates to web Server Actions (saveContact / saveAddress / etc.) via cross-action call
  OR: mobile calls the same Server Actions via a thin BFF wrapper that resolves identity from Bearer.

apps/mobile/src/components/ui/WizardShell.tsx                  ← NEW (RN shell)
  Uses useWizardState (deep import: @smartout/ui/wizard/state per D14)
  Mounts WizardHeader + step component + nav (Tilbake / Neste / Hopp / Lukk)

apps/mobile/src/components/ui/WizardHeader.tsx                 ← LIFTED from reconciliation/_shared/WizardHeader.tsx

apps/mobile/src/components/welcome-wizard/_steps/              ← NEW (RN counterparts of web steps)
  HeroStep.tsx
  ContactStep.tsx
  AddressStep.tsx
  PersonalNumberStep.tsx
  AvailabilityStep.tsx
  ConsentStep.tsx
  OptionalStep.tsx
  DoneStep.tsx

apps/mobile/app/(app)/onboarding/index.tsx                     ← NEW route mounting the mobile shell

packages/ui/src/wizard/                                         ← MINIMAL changes
  types.ts: replace `icon?: LucideIcon` with `iconName?: string` so mobile can render its own (R-NEW per spec §S6 L-W1).
  package.json: add subpath export "@smartout/ui/wizard/state" → useWizardState only (D14 / R9 barrel discipline)

packages/eslint-config/                                         ← NEW rule
  no-wizard-barrel-import: forbid `import { useWizardState } from "@smartout/ui/wizard"` in apps/mobile/**
```

**No new `packages/wizard-definitions/` package.** The R1 spec's idea is dropped — Step components live next to their existing siblings (web in `welcome-wizard/`, mobile in `welcome-wizard/`), and the state machine `useWizardState` stays in `packages/ui/src/wizard/`. Shared types (`WizardStep`, `WeekdayCode`, etc.) live in `apps/web/src/components/welcome-wizard/types.ts` and `apps/mobile/src/components/welcome-wizard/types.ts` until a real cross-platform need emerges.

### Sharing boundary

| Layer | Lives in | Shared web↔mobile? |
|---|---|---|
| `useWizardState` step machine | `packages/ui/src/wizard/useWizardState.ts` | YES (deep import only) |
| WizardDefinition / WizardStepDef types | `packages/ui/src/wizard/types.ts` (after `iconName` change) | YES |
| Step React components | Per-platform | NO (intentional; identical contract per §S_components) |
| Server Actions (saveContact, saveAddress, etc.) | `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts` | YES via mobile BFF wrapper that re-invokes the actions server-side |
| BFF endpoints | `/api/employee-onboarding/*` (cookie) + `/api/mobile/employee-onboarding/*` (Bearer) | NO (two transports, same body schema) |

### Authentication

- **Web BFF:** cookie via existing `createClient()` → Server Action.
- **Mobile BFF:** Bearer via existing helper `apps/web/src/app/api/mobile/_shared/actor.ts:resolveMobileActor` (per agent-coord O-6 — do NOT re-inline like bookings/shifts predates). After identity resolution, mobile BFF re-invokes the same Server Actions web uses.
- ADR-0151: profile_id + workspace_id always server-derived. Never accepted from body.
- ADR-0133: identity-layer / pre-cascade flow. Not D1-D5 authoring; not D6 production. Steward Phase 5 reframing confirms ADR-0133 does not classify this flow as forbidden. Existing mobile `complete-data.tsx` is the single-screen precedent; this wizard is the multi-step formal version.

## §S4. Persistence + State Machine Flow + Telemetry

### Step lifecycle (identical on web + mobile)

```
user enters step N
  → component reads state.<stepKey> from useWizardState
  → user edits, validation on blur
  → user taps "Neste"
    → step Zod schema parsed; on fail → highlight + abort
    → call step's Server Action (web direct; mobile via BFF wrapper)
    → on 200 → updateState(patch) + next() + PUT BFF /state {current_step_index: N+1, step_data}
    → on error → toast, stay on step
  user taps "Tilbake" → back() (no DB write)
  user taps "Hopp" (only on steps 5, 7 where skippable) → next() with empty patch + PUT BFF
  user taps "Lukk og fortsett senere" → POST /dismiss → router push home
```

Step 4 (PersonalNumber) — confirmation sub-screen ordering:
- Form input → "Neste"
- Confirmation sub-screen: **full personal_number displayed** with `Eye`/`EyeOff` toggle (default visible) + "Bekreft og lagre" primary CTA + "Tilbake" secondary
- On confirm → `savePersonalNumber` Server Action → on 200, advance.

Step 6 (Consent) → submit triggers Step 8's `DoneStep` mount with `completeWelcome` action — transaction:
1. INSERT one `consent_acceptance` row per accepted consent_type (via `saveConsent`)
2. UPDATE `profile.is_welcome_complete = true`, `welcome_completed_at = now()`
3. UPDATE `employee_onboarding_state.status = 'completed'`, `completed_at = now()`
4. emit `profile welcome_wizard_completed` (existing event, preserved destinations including engine_event)

All-or-nothing. If any consent row INSERT fails, transaction rolls back.

### State-row creation

`employee_onboarding_state` row is created lazily by the BFF's GET handler the first time it is requested (UPSERT semantics — never errors on existing row). `profile welcome_wizard_started` fires on first GET.

### Telemetry — reuse existing namespace (D10 / R5)

NO new event family. Reuse `profile welcome_wizard_*` (registry:636-665) with **destinations preserved exactly**, especially `engine_event` on `_completed` (registry:14253-14268).

Two new events added to the family:
- `profile welcome_wizard_dismissed` — destinations: `[posthog, logger, activity_trail]` (no engine_event; dismissal does not drive downstream processes)
- `profile welcome_wizard_resumed` — destinations: `[posthog, logger, activity_trail]`

Existing events used as-is:
- `profile welcome_wizard_started` (first state-row creation)
- `profile welcome_wizard_step_completed` (each "Neste")
- `profile welcome_wizard_skipped_optional` (Hopp from skippable step — generalize copy to cover step 5 + step 7)
- `profile welcome_wizard_completed` (Done) — engine_event destination preserved for downstream consumers (welcome series, training assignment, payroll-readiness check, etc.)

Per ADR-0377: every new event must land with at least one `emit()` call-site in the same plan commit. Plan-writing phase enforces this.

## §S5. Trigger + Entry-Point + Home CTA

### Trigger

- **Web:** existing `apps/web/src/app/dashboard/layout.tsx:180-190` already gates on `is_welcome_complete === false || null` → renders `<WelcomeWizardGate userEmail={userEmail} />`. The fix is one line inside `WelcomeWizardGate.tsx`: return `<WelcomeWizard userEmail={userEmail} />` instead of `null`. Spec does not change the gating logic.
- **Mobile:** `apps/mobile/app/(app)/_layout.tsx` SessionProvider effect reads `useMyProfile()` → if `profile.is_welcome_complete === false` (and `status !== 'dismissed'` from state row), push `/(app)/onboarding` on initial mount.

### Dismissibility

- Both shells have an overflow menu "Lukk og fortsett senere" → POST `/dismiss` → state row `status='dismissed'`. Trigger does not re-fire same session.
- Cold start: gate re-checks; if `status='dismissed'` but `is_welcome_complete=false`, gate still triggers (re-prompt). The state row's `dismissed_at` is the suppression signal for the same session, NOT a permanent off-switch.

### Home CTA (D14 frontend-designer R6)

- **Card design:** warm orange dot (`bg-primary`, 6px) + label "Fullfør profilen din" (`text-sm font-medium`) + muted micro-copy "{N steg igjen}" (`text-xs text-muted-foreground`). Full card is the touch target.
- **When shown:** `is_welcome_complete === false` AND day phase ≠ `active_shift`.
- **Surface:** `NoShiftView`, `BeforeShiftView`, post-shift wind-down. **NOT** `DuringShiftView` (D6-active context is action-focused, profile-completion interrupt is wrong context).
- **Hook:** new `useOnboardingProgress()` returns `{ done: number, total: number, status: 'in_progress'|'dismissed'|'completed' }`. Both web + mobile consume.

## §S6. Mobile Shell Construction

1. Lift `apps/mobile/src/components/reconciliation/_shared/WizardHeader.tsx` to `apps/mobile/src/components/ui/WizardHeader.tsx` (no API change; relocation + import sweep).
2. Create `apps/mobile/src/components/ui/WizardShell.tsx`:
   - Imports `useWizardState` via deep path `@smartout/ui/wizard/state` (D14).
   - Renders `<WizardHeader>` + current step component + `<WizardNavBar>` (Tilbake / Neste / Hopp / Lukk overflow).
   - Reduced motion: gate Reanimated step transitions on `useReducedMotion()` from `react-native-reanimated`.
3. `packages/design-tokens/src/native.ts`: add `nativeMotion` export with spring + enter/exit timings matching web `motionTokens.spring` (35/22/2.2) + `enterMs:500` + `exitMs:250`. (frontend-designer C7 — pre-req task, not wizard-only.)
4. The existing `reconciliation/clockout.tsx` (hand-rolled `useState(0)`) gets a follow-up sortie to adopt the new WizardShell. **OUT OF SCOPE for this spec.**

Known one-line fix in `packages/ui/src/wizard/types.ts`: replace `icon?: LucideIcon` (from `lucide-react`, web-only) with `iconName?: string`. Web shell renders by name lookup; mobile shell renders by name lookup. Existing wizard-definition.ts usages get a sweep to switch from `icon: Layers` to `iconName: "layers"`.

## §S_components. Component Contract Table (R6)

| Step | Web component | Web primitives | Mobile component | Mobile primitives | i18n key prefix | a11y notes |
|---|---|---|---|---|---|---|
| 1 Hero | `HeroStep.web.tsx` (existing) | shadcn `Button` | `HeroStep.tsx` (NEW) | `@smartout/ui` `Button` | `welcome.hero.*` | autoFocus primary CTA |
| 2 Kontakt | `ContactStep.tsx` (existing) | shadcn `Input` | `ContactStep.tsx` (NEW) | `@smartout/ui` `Input` (mobile) | `welcome.contact.*` | label-for-input pairing |
| 3 Adresse | `AddressStep.tsx` (existing) | shadcn `Input` | `AddressStep.tsx` (NEW) | `@smartout/ui` `Input` | `welcome.address.*` | postal_code numeric keyboard |
| 4 Personnr | `PersonalNumberStep.tsx` (existing + R8 extension) | shadcn `Input` + `Button` + Lucide `Eye`/`EyeOff` | `PersonalNumberStep.tsx` (NEW) | mobile equivalents + lucide-react-native | `welcome.personal_number.*` | confirmation screen = `role="dialog"` / `accessibilityLiveRegion="assertive"` |
| 5 Tilgjengelighet | `AvailabilityStep.tsx` (NEW) | shadcn `Toggle` ×7 | `AvailabilityStep.tsx` (NEW) | RN `Pressable` chips ×7 | `welcome.availability.*` | `aria-pressed` / `accessibilityState.checked` per chip |
| 6 Samtykke | `ConsentStep.tsx` (NEW) | shadcn `Checkbox` + `Button` + PDF preview link | `ConsentStep.tsx` (NEW) | mobile `Checkbox` + `Button` + WebView PDF | `welcome.consent.*` | each checkbox `aria-required` + associated label |
| 7 Valgfritt | `OptionalStep.tsx` (existing) | shadcn `Input` | `OptionalStep.tsx` (NEW) | mobile `Input` + `Dropdown` for relasjon | `welcome.optional.*` | skippable — Hopp button gets `aria-label` |
| 8 Ferdig | `DoneStep.tsx` (existing) | shadcn `Button` | `DoneStep.tsx` (NEW) | `Button` | `welcome.done.*` | live-region announce of completion |

No raw `<input>` / `TextInput`. Every form field uses the design-token primitive of its platform.

## §S_a11y. Accessibility Section (R7)

Target: **WCAG 2.2 AA.** Plan-writing phase enforces these as acceptance criteria per step.

| Requirement | Web | Mobile |
|---|---|---|
| Focus to primary CTA on step mount | `autoFocus` on `<Button>` | `inputRef.focus()` in `useEffect` |
| Step transition announcement | `aria-live="polite"` on step container | `accessibilityLiveRegion="polite"` |
| Reduced motion | `useReducedMotion()` → swap spring for opacity fade (250ms) | `useReducedMotion()` from `react-native-reanimated` → instant transition |
| Toggle chips state | `aria-pressed` | `accessibilityState={{ checked }}` |
| PII confirmation sub-screen | `role="dialog"` + `aria-labelledby` | `accessibilityLiveRegion="assertive"` + `accessibilityViewIsModal` |
| Form fields | `<label htmlFor>` or `aria-label` | `accessibilityLabel` |
| Keyboard navigation (web) | Tab order = visual order; Esc dismisses overflow menu; Enter advances | n/a |
| Focus rings | `focus-visible:ring-2 ring-ring` (Nordic Split tokens, never `outline-none` without ring) | n/a |
| Color contrast | Verified via Nordic Split palette (already compliant) | Verified via nativeTheme tokens |

Skipped tests: spec does not mandate screen-reader integration tests in V1 (axe-core for web is in scope; mobile screen-reader testing is a manual checklist per release).

## §S7. Domain Integration

New domain folder `docs/domains/onboarding-wizard/` follows the 8-file spine (domain-steward `pre onboarding-wizard`):

1. README.md — entry + Agent Guardrails
2. OVERVIEW.md — D2 Resource + identity-layer placement
3. ARCHITECTURE.md — L1–L5 code map citing this spec's paths
4. DATA-MODEL.md — `consent_acceptance` + `employee_onboarding_state` + reuse of existing user_identity/profile/employee_availability
5. USER-FLOWS.md — link to a new `docs/journeys/employee-onboarding-wizard/`
6. ROADMAP.md — hours-within-day availability, document-version catalog, agent "help me onboard" capability
7. GAPS-AND-DEBT.md — overlaps: identity (user_identity), contracts (separate domain), payroll (reads personal_number/bank_account)
8. E2E-COVERAGE.md — Playwright web + Maestro mobile coverage matrix

Plus `docs/domains/_DASHBOARD.md` row.

**Cascade placement:** identity-layer + D2 Resource. The wizard's outputs become D2 attributes the schedule consumes (availability, personal_number for payroll, bank_account for payroll). Consent + onboarding_state are **audit/governance** artifacts (not C4 governance per agent-coord O-12 correction); they live in this domain because they don't merit their own.

**Overlap edges** (to register in _DASHBOARD.md):
- ↔ identity: shared user_identity columns
- ↔ contracts: contract-signing is a distinct domain
- ↔ payroll: payroll reads personal_number + bank_account; wizard is one of two write paths (other: admin profile editor + mobile `complete-data.tsx` deprecation surface)

## §S8. ADRs Required

ADR slot reservation (verified: HEAD = ADR-0395):

| Slot | Topic | Why |
|---|---|---|
| **ADR-0396** | Identity-layer columns belong on `user_identity`, NOT `profile` | Codifies the invariant the R1 spec violated. Includes pre-commit lint rule that flags `ALTER TABLE profile ADD COLUMN (phone|personal_number|emergency_contact|date_of_birth|address_*|email|*_id_*)`. Cross-link: ADR-0151, L-0177, schema-orphan-rebuild-pattern. |
| **ADR-0397** | Employee Onboarding Wizard — Strategy A (extend existing WelcomeWizard) + soft-gate + 8-step shape + mobile twin via deep-import-only shared state | Establishes pattern: never replace existing onboarding-class surfaces without an explicit migration ADR. Establishes the deep-import discipline for `@smartout/ui/wizard/*`. |
| **ADR-0398** (optional, defer) | `consent_acceptance` audit-table contract | Append-only, document-version-stamped, no UPDATE/DELETE policy. Could land in plan-writing instead. |

Both ADRs drafted in the implementation plan, not in this spec.

## §S9. Out of Scope (explicit)

- Hours-within-day availability granularity (V1: daily on/off only).
- Document-versioning catalog (V1 hardcodes `handbook_version`, `gdpr_version` constants).
- Hard payroll gating on missing PII.
- Reconciliation-clockout refactor onto the new mobile WizardShell.
- Web dashboard news widget / mobile home news+community real-data wiring.
- Profile photo upload (existing wizard does not have it; the R1 spec's optional photo step is dropped — wizard reuses existing `avatar_color` fallback for now).
- Agent "help me onboard" Botsson capability (ROADMAP).
- Mobile screen-reader integration tests (manual checklist V1).

## §S10. Verification Tasks (resolved)

| Question | Status | Result |
|---|---|---|
| Does an availability table exist? | RESOLVED | `employee_availability` (20260518200000), RRULE + preference_type. `created_by` NOT NULL — wizard must include `profile_id` (R-NEW). |
| Does profile already have `phone` / `emergency_contact_*`? | RESOLVED (corrected R2) | **They live on `user_identity`, NOT profile.** R1 spec was wrong. ADR-0396 enforces. |
| Does a consent-acceptance table exist? | RESOLVED | No. New table proposed. ADR-0311 governs separate payroll-domain consent; no conflict. |
| Does WelcomeWizard already exist? | RESOLVED (R2) | **YES.** 6 components, 6 Server Actions, gate stub. Strategy A = extend. |
| Does `submit_own_pii` RPC exist? | RESOLVED | Yes, hardened 20260514000010, used by mobile + welcome-wizard-actions today. Field groups: identity / banking / address. |
| AnimatedWizardShell location? | RESOLVED | `apps/web/src/components/wizard/AnimatedWizardShell.tsx`. (Steward Phase 3 grep was narrow-scoped; reversed in Phase 5.) |
| Mobile `expo-image-picker` web stub? | DEFERRED (out of scope) | Photo upload dropped from V1 (§S9). |

## §S11. Risks + Mitigations

| Risk | Mitigation |
|---|---|
| Engine_event consumer silently breaks if telemetry destinations drift | D10: explicitly preserve existing destinations on `profile welcome_wizard_completed`. CI test: snapshot test on registry entry to catch destination changes. |
| Dual source-of-truth for identity PII recurs in future features | ADR-0396 + pre-commit lint blocks identity-layer columns on `profile`. |
| Two parallel wizards (existing + new) coexist by accident | Strategy A explicitly extends in place. Plan adds a CI check: only one `<WelcomeWizard>` exists in apps/web/src/. |
| Mobile bundler pulls lucide-react via barrel | D14: deep import `@smartout/ui/wizard/state` + ESLint rule. |
| User dismisses, never returns | Permanent home CTA + telemetry on `wizard_dismissed` to track drop-off. |
| Mod-11 passes but typo'd real-but-wrong number | D4: full-reveal confirmation sub-screen with `Eye`/`EyeOff` toggle. |
| Mobile shell drifts visually from web | Component-contract table (§S_components) + snapshot screenshots per step (Playwright + Maestro). |
| Consent text updates → existing acceptances stale | `document_version` column captures version. Future re-consent flow detects mismatches. |
| Availability RRULE-only V1 misleads users | Step 5 copy explicit: "Sett tider for hver dag senere i Min Tid." |
| Pre-cascade identity boundary blurred | ADR-0133 reframing in §D3 + agent-coord O-16 confirmation. ADR-0396 reinforces. |

## §S12. Acceptance Criteria

A new employee from a fresh invite, on web and mobile independently:

1. Accepts invite + verifies account.
2. Lands on wizard automatically (gate fires).
3. Sees `display_name` pre-filled.
4. Advances through all 8 steps in <6 minutes. Each "Neste" persists.
5. Closes app on step 4, reopens on different device on step 4 with typed values present.
6. Dismisses wizard → sees "Fullfør profilen din ({N} steg igjen)" home CTA. Card NOT shown during active shift.
7. On step 6 + step 8 completion:
   - `profile.is_welcome_complete = true`, `welcome_completed_at = now()`
   - `consent_acceptance` rows for handbook + gdpr (+ tariff if applicable)
   - `user_identity.phone` + `emergency_contact_*` populated
   - `profile.personal_number` + `bank_account` populated
   - `employee_availability` rows for any unavailable weekdays
   - `employee_onboarding_state.status = 'completed'`
   - `profile welcome_wizard_completed` emitted to **posthog + logger + activity_trail + engine_event** (engine_event preserved per D10)
   - Home no longer shows CTA, gate does not trigger on next cold start
8. Visual parity per §S_components contract table.
9. WCAG 2.2 AA per §S_a11y.
10. No new columns on `profile`. Pre-commit lint passes.
11. No barrel imports of `@smartout/ui/wizard` from `apps/mobile/**`. ESLint passes.
12. Only one `<WelcomeWizard>` reference in `apps/web/src/`.

## R2 Compliance Map

| Council R# | Description | Where addressed |
|---|---|---|
| R1 | Migration strategy A/B/C | §D6 (Strategy A explicit), §0 inventory, §S3 extends-in-place |
| R2 | No new profile columns | §D7, §S2, §S8 (ADR-0396), §S12 acceptance #10 |
| R3 | Use submit_own_pii | §D8, §S2 PII reuse note |
| R4 | Surface ownership vs mobile complete-data | §D9 |
| R5 | Reuse `profile welcome_wizard_*` events | §D10, §S4 telemetry |
| R6 | Component contract table | §S_components |
| R7 | A11y section | §S_a11y |
| R8 | UX fixes (toggle inversion, PII reveal) | §D4, §D11, §S1 step 5 copy |
| R9 | Deep import discipline | §D14, §S3 layout note, §S12 acceptance #11 |
| R10 | Channel guard declared | §D15 |
