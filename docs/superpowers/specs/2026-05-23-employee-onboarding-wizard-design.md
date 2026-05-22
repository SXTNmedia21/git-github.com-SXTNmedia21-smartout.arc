---
title: "Employee Onboarding Wizard — Design Spec"
status: review
updated: 2026-05-23
created: 2026-05-23
module: onboarding-wizard
tags: [wizard, onboarding, employee, mobile, web, d2-resource, consent]
---

# Employee Onboarding Wizard — Design Spec

> One wizard, two shells. New employees fill in the personal info Smartout needs to put them on the schedule and pay them, on whichever device they happen to open first.

## Background

- A new employee's `profile` row is created when an admin invites them. After accepting the invite and verifying their account, they land in a half-empty app: no `personal_number` / `bank_account` (so payroll can't lock them), no `phone` / emergency contact (so a leader can't reach them), no availability (so the schedule treats them as fully available by default), no recorded consent.
- The web `/join` and `/onboarding` flows are admin/I1 (workspace bootstrap) and are explicitly web-only per ADR-0133. **No employee onboarding flow exists on either platform today** — `apps/mobile/app/(app)/(me)/contract/complete-data.tsx` is a single-screen PII form and is not wired into a first-login flow.
- The mobile home screen "Siste nytt" + community ("Lars feirer år i dag") cards are hardcoded placeholders (`apps/mobile/src/components/home/NoShiftView.tsx:129-144`) — that surface gap is being addressed in a separate sortie (Announcement home-feed).

## Goals

1. New employees can complete the minimum set of fields needed to be (a) scheduled and (b) paid, in one guided flow, on either mobile or web.
2. Same flow on both platforms — identical step list, validation, persistence, copy. Each platform renders with its native UI primitives.
3. Resumable across devices and sessions (per-step save to DB).
4. Soft-gated, not blocking — an employee can dismiss the wizard and finish later from a permanent home-screen CTA.
5. Audit-trail-correct consent capture (append-only, document-version-stamped).

## Non-Goals

- Admin / workspace bootstrap (covered by `/join`, `/onboarding`, `/dashboard/setup` — web-only, ADR-0133).
- Contract signing flow (separate domain — `apps/mobile/app/(app)/(me)/contract/`).
- Hours-within-day availability granularity (V1 collects daily on/off only — see §S5).
- Profile editing UI after wizard completes (handled by existing Min Tid surfaces).
- Mobile home-screen news / community widgets (separate sortie).
- Hard payroll blocking on missing PII (a downstream concern for the payroll-period-lock action; this wizard provides the data, not the gate).

## Decisions Locked at Brainstorm (2026-05-23)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Tier B (schedule-ready)** info scope: identity, contact, payroll PII, availability, consent. | Tier A omits enough to keep employees unusable for scheduling; Tier C bundles preferences/skills that drift fast and belong in drift-managed surfaces. |
| D2 | **Soft gate, resumable, per-step save.** | Maximises completion without forcing hard friction; payroll-PII gate is enforced at lock-time anyway, not at first login. |
| D3 | **Shared definition + state-machine, separate shells.** | Web `WizardShell` is Tailwind/framer-motion-bound, not portable. State machine (`useWizardState`) is already framework-agnostic in `packages/ui`. |
| D4 | **PII confirmation screen on the payroll step** before save. | Mod-11 validation catches typos but not number-swap; a read-only "ser dette riktig ut?" screen costs one tap and prevents wrong payouts. |
| D5 | **V1 availability = daily on/off only, written to existing `employee_availability` via RRULE.** | Schema (`employee_availability.rrule` text, `preference_type` enum, no DTSTART) cannot encode time-within-day without extension; defer to a later iteration. |

---

## S1. Step Flow (6 steps)

Each step has a Norwegian (Bokmål) title and one screen of content. "Hopp over" available on all except step 6.

| # | Step | Required fields | Optional fields | Validation | Save target |
|---|---|---|---|---|---|
| 1 | **Velkommen** | `display_name` (pre-filled from invite, confirm-editable) | `avatar_url` (image upload), `language_override` | display_name min 2 chars | `profile` |
| 2 | **Kontakt** | `phone` (E.164, NO default) | — | E.164 regex; auth e-mail shown read-only above field | `profile` |
| 3 | **Nødkontakt** | `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation` (UI labels: foreldre / partner / søsken / venn / annet — stored as English enum values `parent` / `partner` / `sibling` / `friend` / `other`) | — | All three required if any provided; phone E.164 | `profile` |
| 4 | **Lønnsdata (sensitiv PII)** | `personal_number` (11 digits + mod-11), `bank_account` (11 digits + mod-11) | — | Mod-11 client + server; PII-confirmation sub-screen before save (D4) | `profile` |
| 5 | **Tilgjengelighet** | per ukedag mon-sun: `tilgjengelig | ikke tilgjengelig` (default: tilgjengelig alle dager) | — | At least one available day if not all unavailable (UI nudge, not blocking) | `employee_availability` (one row per `unavailable` day, RRULE `FREQ=WEEKLY;BYDAY=<2-letter>`) |
| 6 | **Samtykke** | `accepted.handbook` checkbox, `accepted.gdpr` checkbox (+ `accepted.tariff` if workspace `is_tariff_bound`) | — | All required checkboxes checked; submit = wizard complete | `consent_acceptance` (one row per consent_type), then `profile.is_welcome_complete = true` + `welcome_completed_at = now()` |

UI conventions:
- Mobile + web both use `Input`, `Dropdown`, `Button`, `DateField`-equivalent from each platform's design-tokens package — no per-step ad-hoc styling.
- Step 4 renders a 🔒 PII chip in the header + tooltip explaining what the data is used for and where it's stored.
- Step 5 uses 7 chips (mon-sun) with toggle UI; the underlying state is a `Set<Weekday>` of unavailable days (default empty = all available).

## S2. Data Model

### Existing tables — reused / extended

**`profile`** (existing). Reuse:
- `display_name`, `avatar_url`, `personal_number`, `bank_account`, `language_override`, `is_welcome_complete`, `welcome_completed_at`.

Add columns (single forward migration):
- `phone TEXT` (E.164)
- `emergency_contact_name TEXT`
- `emergency_contact_phone TEXT` (E.164)
- `emergency_contact_relation TEXT CHECK (relation IN ('parent','partner','sibling','friend','other'))`

Optionally add an enum `emergency_relation` instead of CHECK (preferred — matches Smartout enum convention). The plan-writing phase chooses; either works.

**`employee_availability`** (existing, `supabase/migrations/20260518200000_create_employee_availability.sql`). Wizard writes one row per `unavailable` weekday with:
- `preference_type = 'unavailable'`
- `rrule = 'FREQ=WEEKLY;BYDAY=<MO|TU|WE|TH|FR|SA|SU>'`
- `valid_from = today`
- `valid_to = NULL`
- `reason = 'onboarding-wizard'` (provenance — distinguishes wizard-set defaults from later manager-set overrides)

`available` days = no row.

### New tables (2)

**`consent_acceptance`** (append-only audit table, ADR-style):
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
  client_ip TEXT,                          -- captured server-side at BFF
  CONSTRAINT consent_acceptance_no_update CHECK (true) -- enforced via RLS: no UPDATE/DELETE policy
);
CREATE INDEX idx_consent_acceptance_profile ON public.consent_acceptance(profile_id, consent_type, accepted_at DESC);
```
RLS: SELECT for the owning profile + manager/admin role; INSERT only via the BFF (service role); NO UPDATE/DELETE policy (immutable per Bokf. §13-style audit pattern).

`document_version` references the active version of the corresponding handbook / GDPR text — the spec leaves the document-versioning catalog as a future concern (V1 hardcodes the constants and notes them in ROADMAP).

**`employee_onboarding_state`** (resumability):
```sql
CREATE TABLE public.employee_onboarding_state (
  profile_id UUID PRIMARY KEY REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  current_step_index INT NOT NULL DEFAULT 0,
  step_data JSONB NOT NULL DEFAULT '{}'::jsonb,  -- per-step partial form values
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ,                       -- last time user dismissed
  completed_at TIMESTAMPTZ,                       -- mirrors profile.welcome_completed_at when set
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
RLS: dual policy — JWT (`profile_id = (SELECT profile_id FROM profile WHERE user_id = auth.uid() …)`) + API key (`workspace_id = get_api_workspace_id()`).

`completed_at` is set in the same transaction as `profile.is_welcome_complete = true` so the two cannot drift.

### What does NOT go in `step_data`

- Final payroll PII (`personal_number`, `bank_account`) is not staged in `step_data` — those are written directly to `profile` on step 4 commit (after PII confirmation sub-screen) so they're never in a JSON blob at rest.
- Consent acceptances likewise insert directly to `consent_acceptance` at step 6 — never staged.
- Everything else (display_name, phone, emergency contact, availability draft) can stage to `step_data` so the user sees their typed-but-not-submitted values when they resume.

## S3. Architecture

### File layout

```
packages/wizard-definitions/                           ← NEW package
  package.json                                          (name: "@smartout/wizard-definitions")
  src/employee-onboarding/
    definition.ts        — WizardDefinition<State>: 6 steps, loadState, onComplete
    schemas.ts           — Zod schemas, one per step + the full-state schema
    types.ts             — EmployeeOnboardingState, EmergencyRelation, Weekday
    step-ids.ts          — const STEP_IDS for cross-platform identity
    index.ts

packages/ui/src/wizard/                                ← existing — unchanged
  useWizardState.ts
  useWizardBotsson.ts
  types.ts               (one fix: make `icon` field generic per L-W1 below)

apps/web/src/app/employee-onboarding/                  ← NEW route
  page.tsx               — auth gate + load definition + mount AnimatedWizardShell
  _steps/
    WelcomeStep.tsx
    ContactStep.tsx
    EmergencyContactStep.tsx
    PayrollPiiStep.tsx    (includes PII confirmation sub-screen)
    AvailabilityStep.tsx
    ConsentStep.tsx

apps/mobile/src/components/ui/
  WizardShell.tsx        — NEW RN shell (uses useWizardState, mirrors WizardShell semantics)
  WizardHeader.tsx       — lifted from reconciliation/_shared/WizardHeader.tsx

apps/mobile/src/components/employee-onboarding/_steps/
  WelcomeStep.tsx
  ContactStep.tsx
  EmergencyContactStep.tsx
  PayrollPiiStep.tsx
  AvailabilityStep.tsx
  ConsentStep.tsx

apps/mobile/app/(app)/onboarding/
  index.tsx              — route: load definition + mount mobile WizardShell

apps/web/src/app/api/employee-onboarding/state/route.ts        ← cookie auth (web)
apps/web/src/app/api/mobile/employee-onboarding/state/route.ts ← Bearer auth (mobile)
  GET  → load { current_step_index, step_data, completed_at, dismissed_at }
  PUT  → upsert step_data + current_step_index (partial — JSONB merge)
  POST → /complete   commit final fields to profile + consent_acceptance + flip is_welcome_complete

apps/web/src/app/api/mobile/employee-onboarding/dismiss/route.ts  ← Bearer
  POST → set dismissed_at = now()
```

### Sharing boundary

| Layer | Lives in | Shared web↔mobile? |
|---|---|---|
| State machine | `packages/ui/src/wizard/useWizardState.ts` | YES (existing, portable) |
| Wizard type contracts | `packages/ui/src/wizard/types.ts` | YES |
| Step definition + Zod + loadState + onComplete | `packages/wizard-definitions/src/employee-onboarding/` | YES |
| Step React components | `apps/web/src/.../_steps/*.tsx` + `apps/mobile/src/.../_steps/*.tsx` | NO (per-platform; receive identical props) |
| Shell chrome (header, nav, animations) | `AnimatedWizardShell` (web) + `WizardShell` (mobile) | NO (per-platform) |
| BFF persistence | `/api/employee-onboarding/state/*` (cookie) + `/api/mobile/employee-onboarding/state/*` (Bearer) | NO (two transports, same body schema) |

### Authentication

- **Web BFF:** cookie (`createClient()`), derives `profile_id` from session.
- **Mobile BFF:** Bearer (`admin.auth.getUser(token)`), derives `profile_id` from JWT. Mirrors the pattern shipped in `/api/mobile/bookings/route.ts` (post-2026-05-23 fix `9e9508a45`) and `/api/mobile/shifts/route.ts` (ADR-0151).
- ADR-0151: NEVER accept `profile_id` or `workspace_id` from request body — both server-derived.
- ADR-0133: this is a mobile-allowed "execute/witness" action (employee fills own data, no authoring of workspace-level entities), well inside the mobile boundary.

## S4. Persistence + State Machine Flow

```
Step lifecycle on mobile:
  user enters step N
  → component reads state.<stepKey> from useWizardState
  → user edits, validation runs on blur
  → user taps "Neste"
    → step Zod schema parsed; on fail → highlight + abort
    → updateState({...patch})   (in-memory state machine)
    → PUT BFF { current_step_index: N+1, step_data: <merged JSONB> }
    → on 200 → next()  (state machine advances)
    → on error → toast "kunne ikke lagre", stay on step
  user taps "Tilbake"
    → back() (state machine retreats, no DB write needed)
  user taps "Hopp over" (steps 1-5 only)
    → next() with current step left empty/partial; DB persists current state
  user taps "Hopp wizard for nå" from any step's overflow menu
    → POST /dismiss → sets dismissed_at; navigate to home
```

On step 4 (payroll PII):
- Sub-screen ordering: form input → "Neste" → PII confirmation sub-screen with masked-ish summary (`personal_number` shown as `XXXXXX 12345`, `bank_account` shown as `XXXX.XX.12345`) → "Bekreft og lagre".
- On confirm → PUT BFF includes `personal_number` + `bank_account` (BFF writes directly to `profile`, not to `step_data`).

On step 6 (consent):
- Submit → POST `/complete` → server transaction:
  1. INSERT one `consent_acceptance` row per accepted consent_type
  2. UPDATE `profile.is_welcome_complete = true`, `welcome_completed_at = now()`
  3. UPDATE `employee_onboarding_state.completed_at = now()`
- All-or-nothing — if step 1 fails for any consent_type, the whole transaction rolls back.
- `emit({ event: 'onboarding.wizard_completed', … })` after commit.

### State-row creation

The `employee_onboarding_state` row is created lazily by the BFF's GET handler the first time it is requested for a profile (UPSERT semantics — never errors on existing row). This means `wizard_started` fires on the first GET, which is the first cold-start trigger after invite-accept.

### Telemetry

Add to `packages/telemetry/src/registry.ts`:
- `onboarding.wizard_started` (one-time, when state row created)
- `onboarding.wizard_step_advanced` { from_step, to_step }
- `onboarding.wizard_dismissed`
- `onboarding.wizard_completed`
- `onboarding.wizard_resumed` (when user comes back after `dismissed_at` was set)

Destinations: posthog + logger + activity_trail. No engine_event (wizard does not drive cascade workflows).

## S5. Trigger + Entry-Point + Home CTA

### Trigger

- Mobile `(app)/_layout.tsx` SessionProvider effect runs `useMyProfile()`; if `profile.is_welcome_complete === false`, push the user to `/(app)/onboarding` on initial mount.
- Web `dashboard/layout.tsx` runs the same check server-side and redirects (or renders an interstitial — implementation choice during plan-writing).
- The trigger fires once per cold start. It does not interrupt an active session.

### Dismissibility

- Each platform's WizardShell has an overflow menu "Lukk og fortsett senere" → POST `/dismiss` → navigates back to home. The wizard does not re-trigger until next cold start.
- The state row's `dismissed_at` is the trigger-suppression signal for the same session.

### Home CTA

- Mobile: new card in `apps/mobile/src/components/home/NoShiftView.tsx` (and same on BeforeShift/During/After variants), rendered only when `is_welcome_complete === false`. Reads `employee_onboarding_state.current_step_index` to render "Fullfør profil (4/6)". Tap → push `/(app)/onboarding`.
- Web: equivalent card in employee dashboard.
- A `useOnboardingProgress()` hook (mobile + web) wraps the read so both surfaces share contract.

## S6. Mobile Shell Strategy

The mobile WizardShell is the only net-new UI primitive needed. It must match the web shell's lifecycle exactly so the shared `WizardDefinition` works without conditionals.

Construction:
1. Lift `apps/mobile/src/components/reconciliation/_shared/WizardHeader.tsx` to `apps/mobile/src/components/ui/WizardHeader.tsx` (no API change; just relocation + import sweep).
2. Create `apps/mobile/src/components/ui/WizardShell.tsx`:
   - Accepts `WizardDefinition<TState>` + initialState.
   - Internally calls `useWizardState` from `@smartout/ui`.
   - Renders: `<WizardHeader stepIndex={n} total={N} title={t(step.labelKey)} />`, then `<step.component ...stepProps />`, then nav bar `[Tilbake] [Neste / Bekreft og fullfør]` + overflow menu (Hopp / Lukk).
   - Honours the same `hideNavBar`, `skippable`, `onStepLeave` step-def fields the web shell does.
3. The existing `clockout.tsx` reconciliation wizard gets a follow-up sortie to switch from its hand-rolled `currentIdx` state to the shared `useWizardState` + new mobile `WizardShell` — out of scope for this spec, listed in ROADMAP.

**Known one-line fix needed in `packages/ui/src/wizard/types.ts`** (per research finding L-W1): the `icon?: LucideIcon` field imports from `lucide-react` (web-only). Change to platform-generic (either `unknown` with renderer prop, or pass icon name as string and let each shell render its own — recommend the latter for clarity).

## S7. Domain Integration

A new domain folder `docs/domains/onboarding-wizard/` follows the 8-file spine (`domain-steward pre onboarding-wizard`):

1. README.md — entry + Agent Guardrails
2. OVERVIEW.md — D2 Resource placement, what we own / don't own, invariants
3. ARCHITECTURE.md — L1–L5 code map citing this spec's paths
4. DATA-MODEL.md — the two new tables + the four new profile columns + RRULE convention
5. USER-FLOWS.md — link to a new `docs/journeys/employee-onboarding-wizard/` (created by feature work)
6. ROADMAP.md — hours-within-day availability, contract-signing integration, document-versioning catalog
7. GAPS-AND-DEBT.md — known overlaps (Identity profile-cols; Contracts contract-signing; Payroll personal_number+bank_account consumers)
8. E2E-COVERAGE.md — Playwright web + Detox/Maestro mobile coverage matrix

Plus `docs/domains/_DASHBOARD.md` row.

**Cascade placement:** D2 Resource (the wizard's outputs are D2 attributes the schedule consumes). Consent + onboarding_state are control-plane (C4 governance) artifacts; they live in the same domain because they don't merit their own.

**Overlap edges** (to register in _DASHBOARD.md):
- ↔ identity: shared `profile` columns
- ↔ contracts: distinct concern (contract = legal employment doc; onboarding-wizard = personal data + consent to operational policies)
- ↔ payroll: payroll reads `profile.personal_number` + `profile.bank_account` — wizard is one of two write paths (other: admin profile editor)

## S8. ADRs Required

| Slot | Topic | Why |
|---|---|---|
| Next available (grep first per CLAUDE.md L-0042) | Employee Onboarding Wizard — soft-gate + shared definition architecture | Establishes the precedent that mobile + web share a `WizardDefinition` from `packages/wizard-definitions/*` while keeping per-platform shells; should be referenced when the next wizard (reconciliation refactor, future flows) lands. |
| Same or next | `consent_acceptance` audit-table contract | Append-only, document-version-stamped, no UPDATE/DELETE policy — establishes the pattern for any future consent capture (cookie, marketing, etc.). |

Both ADRs drafted in the implementation plan, not in this spec.

## S9. Out of Scope (explicit)

- Hours-within-day availability granularity (V1: daily on/off only).
- Document-versioning catalog (V1 hardcodes `handbook_version`, `gdpr_version` constants in the wizard definition; a real catalog comes later).
- Hard payroll gating on missing PII (handled at lock-time by the payroll period-lock action; this wizard provides data, not enforcement).
- Reconciliation-clockout refactor onto the new mobile WizardShell (follow-up sortie).
- Web dashboard home news widget + mobile home news/community real-data wiring (separate Announcement-home-feed sortie).
- Profile photo upload backend (V1 step 1 accepts upload to existing `avatars` bucket; if that bucket policy is too restrictive for first-login self-upload, fall back to "skip" + `avatar_color`; verify during plan-writing).

## S10. Verification Tasks (resolved before plan-writing)

These are the verification commitments I made during brainstorm. Status now:

| Question | Status | Result |
|---|---|---|
| Does an availability table exist? | RESOLVED | `employee_availability` exists (`20260518200000_create_employee_availability.sql`). Uses RRULE + preference_type. No DTSTART → V1 daily-only. |
| Does profile already have `phone` / `emergency_contact_*`? | RESOLVED | `avatar_url`, `personal_number`, `bank_account`, `is_welcome_complete`, `welcome_completed_at` all exist on `profile`. `phone` + `emergency_contact_*` do NOT — must be added. |
| Does a consent-acceptance table exist? | RESOLVED | No. `payroll_consent_document` is a document table, not acceptance log. Must create `consent_acceptance`. |
| Can the `avatars` storage bucket be written by employee themselves on first login? | DEFERRED to plan-writing | Implementation question, not a design question. Plan must check the bucket's INSERT policy. |

## S11. Risks + Mitigations

| Risk | Mitigation |
|---|---|
| User abandons mid-wizard, never returns | Per-step DB save + permanent home CTA + telemetry on `dismissed_at` so we can see drop-off and intervene with copy/UX |
| Mod-11 validation passes but user typo'd a real-but-wrong number | D4 PII confirmation sub-screen on step 4 |
| Mobile shell drifts visually from web | Snapshot screenshots per step in both Playwright and Maestro, reviewed each PR that touches step components |
| Consent text updates → existing acceptances stale | `document_version` column captures the version they agreed to; a future "re-consent" flow can detect mismatches and re-prompt |
| `employee_availability` RRULE-only V1 misleads users into thinking they've set their hours | Step 5 copy explicit: "På hvilke dager kan du jobbe? (Sett tider for hver dag senere i Min Tid.)" |
| Schedule conflicts: admin pre-set fields contradicted by wizard input | Wizard updates `profile` directly; admin's later changes win as usual (last-write-wins on the column). The audit-trail (`activity_trail` via emit) preserves both. |

## Acceptance Criteria

A new employee from a fresh invite, on mobile and on web independently:

1. Accepts invite + verifies account.
2. Lands on the wizard automatically on first cold start.
3. Sees `display_name` pre-filled from the invite.
4. Can advance through all 6 steps in <5 minutes, with each step's "Neste" persisting to the DB.
5. Can close the app on step 3 and reopen on a different device on step 3 with their typed values still present.
6. Can dismiss the wizard and see "Fullfør profil (3/6)" on the home screen, tapping which returns them to step 3.
7. On completing step 6:
   - `profile.is_welcome_complete = true`
   - `profile.welcome_completed_at = now()`
   - `consent_acceptance` has rows for handbook + gdpr (+ tariff if applicable)
   - `profile` has phone, emergency_contact_*, personal_number, bank_account populated
   - `employee_availability` has rows for any unavailable weekdays
   - `onboarding.wizard_completed` event emitted
   - Home no longer shows the CTA, wizard does not re-trigger on next cold start
8. Visual parity: a screenshot per step on web matches the corresponding mobile step in terms of fields, labels, validation copy, and progress indicator.
