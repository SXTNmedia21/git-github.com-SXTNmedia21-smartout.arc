---
title: Admin Onboarding Wizard Completion
status: done
created: 2026-03-01
module: "1 (Onboarding)"
scope: Refactor monolithic wizard into step components, add auth step, progressive save, workspace activation, invite step
---

# Admin Onboarding Wizard Completion

## Summary

Complete the admin workspace setup wizard by refactoring the monolithic 1,880-line `page.tsx` into step components with a shared context hook, then adding: inline auth (after crawl), progressive save to `onboarding_session`, workspace activation via `activate_workspace_v3`, and a full invite step (email + SMS + link).

## Decisions Captured

| Decision        | Choice                    | Rationale                                                                          |
| --------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| Save strategy   | Progressive save          | Each step persists to `onboarding_session`. Resume if browser closes.              |
| Post-activation | Invite first employee     | Don't let admin leave without starting employee pipeline                           |
| Auth flow       | Landing CTA driven        | Show value first (crawl), then ask for signup. URL passed via `?url=` query param. |
| Architecture    | Full refactor + build     | Extract steps into components. 1,880 lines is already too large to extend.         |
| Invite scope    | Full (email + SMS + link) | All three channels. Requires Twilio + Resend wiring.                               |

## Architecture

### File Structure

```
apps/web/src/app/onboarding/
  page.tsx                    ← Shell: WizardProvider + step router + ambient background
  layout.tsx                  ← Metadata, no auth required (public page)
  types.ts                    ← WizardState, WorkspaceData, drawer types
  steps/
    InitStep.tsx              ← URL input + "Scan & Generate"
    CrawlStep.tsx             ← Loading spinner during scrape
    AuthStep.tsx              ← NEW: Inline signup (email+password + SSO)
    OrgVerificationStep.tsx   ← Brreg lookup + confirm
    BrandingStep.tsx          ← Logo, slogan, color, tone
    SeasonEducationStep.tsx   ← "Why Seasons?" explainer
    SeasonIdentityStep.tsx    ← Name, dates, type
    DepartmentsStep.tsx       ← Add/edit departments
    TeamsStep.tsx             ← Teams per dept + cross-dept
    LocationsStep.tsx         ← Physical locations
    ProceduresStep.tsx        ← SOPs + urgency
    BattlefieldReviewStep.tsx ← Enhanced summary, clickable sections
    FinalizeStep.tsx          ← Loading state during activation
    InviteStep.tsx            ← NEW: Email + SMS + link invite
    DoneStep.tsx              ← NEW: Success + redirect to dashboard
  drawers/
    DepartmentDrawer.tsx      ← Extracted from monolith
    TeamDrawer.tsx            ← Extracted from monolith
    LocationDrawer.tsx        ← Extracted from monolith
    ProcedureDrawer.tsx       ← Extracted from monolith
  hooks/
    useOnboardingWizard.ts    ← State machine + progressive save + Supabase calls
```

### Step Flow

```
init → crawling → auth → org_verification → branding → season_education
→ season_identity → departments → teams → locations → procedures
→ battlefield_review → finalizing → invite → done
```

### useOnboardingWizard Hook

Central state manager exposing:

- `step` / `goTo(step)` — current step and navigation
- `workspaceData` / `updateData(partial)` — accumulated form data
- `sessionId` — `onboarding_session` row ID
- `save()` — persist current state to `onboarding_session`
- `finalize()` — call `activate_workspace_v3` RPC via `activate-workspace` Edge Function
- `isAuthenticated` / `user` — auth state
- `resume()` — on page load, check for incomplete session and restore

Progressive save: `goTo(nextStep)` triggers `save()` automatically. Uses `supabase.from('onboarding_session').upsert()`.

## New Features

### 1. Auth Step (after crawl)

**Trigger:** Crawl completes, scraped data loaded into state.

**UI:** "Save your progress — create an account"

- Email + password form
- Divider ("or")
- Google / Microsoft SSO buttons
- "Already have an account? Sign in" toggle (inline, no redirect)

**Edge cases:**

- User already logged in → skip auth step, jump to org_verification
- Existing account, not logged in → inline sign-in toggle
- Auth fails → show error inline, retry
- Crawl failed (mock data) → auth step still shows

**On success:** Creates `onboarding_session` row with `user_id` + scraped data.

### 2. Progressive Save

**Mechanism:** `onboarding_session` table (already exists).

Fields used:

- `current_step` — wizard state string
- `data` — full `workspaceData` as JSONB
- `user_id` — from auth
- `started_at` / `updated_at` — timestamps

**Save triggers:** Each step transition via `goTo()`.

**Resume:** On page load, if user is authenticated, check for incomplete `onboarding_session`. If found, restore `workspaceData` + `step` from session.

### 3. Workspace Activation

**Trigger:** "Activate Workspace" button on battlefield review.

**Flow:**

1. Set step to `finalizing` (loading UI)
2. Call `activate-workspace` Edge Function with full `workspaceData`
3. Edge Function calls `activate_workspace_v3` RPC
4. On success: receive `workspace_id`, set step to `invite`
5. On error: fall back to `battlefield_review` with error message

**Edge Function already exists** at `supabase/functions/activate-workspace/index.ts`. Calls `activate_workspace_v3` RPC which handles atomic creation of: Company → Workspace → CompanyMember → Profile → Season → Locations → Departments → Teams → Policy → Protocol → Procedures.

### 4. Invite Step (after activation)

**UI:**

- Email input + "Send Email Invite" button
- Phone input + "Send SMS Invite" button
- Copy-able invite link: `https://app.smartout.ai/invite/{token}`
- "Skip for now" link → redirects to dashboard

**Database:** New `workspace_invite` table (migration required).

| Column         | Type              | Notes                                         |
| -------------- | ----------------- | --------------------------------------------- |
| `invite_id`    | uuid PK           |                                               |
| `workspace_id` | uuid FK           | RLS scoped                                    |
| `invite_type`  | enum              | `email`, `sms`, `link`                        |
| `email`        | text              | nullable                                      |
| `phone`        | text              | nullable                                      |
| `token`        | text              | unique, URL-safe, used in invite link         |
| `status`       | enum              | `pending`, `accepted`, `expired`, `cancelled` |
| `invited_by`   | uuid FK → profile |                                               |
| `role`         | text              | default `employee`                            |
| `created_at`   | timestamptz       |                                               |
| `expires_at`   | timestamptz       | default 7 days                                |
| `accepted_at`  | timestamptz       | nullable                                      |

**RLS:**

- JWT admins in workspace: full CRUD
- Anon: SELECT by token (for acceptance page)

**Edge Function:** `send-invite`

- Validates auth (JWT required)
- Creates `workspace_invite` row
- If email: sends via Resend
- If SMS: sends via Twilio
- If link: just returns the token (no external dispatch)

### 5. Enhanced Battlefield Review

Current: Shows Identity & Brand + Initial Season cards.

Enhanced to show:

- Identity & Brand (name, org number, tone)
- Initial Season (name, type, date range)
- Locations (count + names)
- Departments (count + teams per dept)
- Procedures (count + list)
- Each section clickable → jumps back to that step
- Clear "Activate Workspace" CTA

## Database Changes

### New Migration: `workspace_invite` table

```sql
CREATE TYPE public.invite_type AS ENUM ('email', 'sms', 'link');
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

CREATE TABLE public.workspace_invite (
  invite_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspace(workspace_id),
  invite_type public.invite_type NOT NULL,
  email text,
  phone text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status public.invite_status NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES public.profile(profile_id),
  role text NOT NULL DEFAULT 'employee',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  CONSTRAINT email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL OR invite_type = 'link')
);

ALTER TABLE public.workspace_invite ENABLE ROW LEVEL SECURITY;
```

### Existing: `onboarding_session` table

Already has `data` JSONB column. May need to verify `current_step` column exists, or add it.

## Integration Points

| System                             | Integration                                             |
| ---------------------------------- | ------------------------------------------------------- |
| Supabase Auth                      | `signUp()`, `signInWithPassword()`, `signInWithOAuth()` |
| `onboarding_session` table         | Progressive save (upsert data JSONB)                    |
| `activate_workspace_v3` RPC        | Atomic workspace creation                               |
| `activate-workspace` Edge Function | Gateway to RPC                                          |
| Resend                             | Email invite dispatch                                   |
| Twilio                             | SMS invite dispatch                                     |
| `send-invite` Edge Function        | NEW: invite creation + dispatch                         |

## Out of Scope

- Employee invite acceptance flow (separate work)
- Trainee journey/sandbox (separate module track)
- AI-guided onboarding (Mr. Botsson overlay)
- Bulk CSV import
- Invite management UI (resend, cancel, track)
