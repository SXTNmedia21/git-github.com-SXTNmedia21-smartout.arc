---
title: E2E Coverage Audit — Signup + Workspace Registration
status: done
updated: 2026-04-15
created: 2026-04-15
module: signup-workspace
tags: [e2e, playwright, signup, workspace, audit, regression]
---

# E2E Coverage Audit — Signup + Workspace Registration

Scope: every spec under `apps/e2e/tests/` that touches the signup / workspace
registration surface. Focus: regression safety so a prod break becomes a
red test.

## 1. Specs in scope

| File                                | Lines | Runtime layer            | Stateful?            | @smoke |
| ----------------------------------- | ----- | ------------------------ | -------------------- | ------ |
| `signup-flow.spec.ts`               | 118   | UI (onboarding wizard)   | Mutates DB (psql)    | no     |
| `journey-signup-onboarding.spec.ts` | 176   | Event Engine (no UI)     | Mutates engine state | no     |
| `journey-workspace-setup.spec.ts`   | 154   | Event Engine (no UI)     | Mutates engine state | no     |
| `auth.spec.ts`                      | 91    | UI (login + signup page) | Read-only            | yes    |
| `join-wizard.spec.ts`               | 285   | UI (/join wizard)        | localStorage only    | yes    |
| `join-to-onboarding.spec.ts`        | 149   | UI (/join → /onboarding) | Creates auth user    | no     |
| `join-e2e-flow.spec.ts`             | 125   | UI (/join full flow)     | Creates auth user    | no     |
| `workspace-setup-flow.spec.ts`      | 522   | UI (/dashboard/setup)    | Mutates DB (psql)    | yes    |
| `onboarding.spec.ts`                | —     | UI (/onboarding)         | —                    | —      |

## 2. What is covered today

### Signup UI (`/signup`, `/login`, `/join`)

- Login page renders with Norwegian labels and has email+password fields
  (`auth.spec.ts`).
- Invalid credentials surface an error toast/alert (`auth.spec.ts`).
- Unauthenticated `/dashboard` redirects to `/login` (`auth.spec.ts`).
- Session persists across navigation and reload (`auth.spec.ts`).
- `/signup` renders without a 500 and offers `Opprett konto` link from
  `/login` (`auth.spec.ts`).
- `/join` wizard loads Step 1 with required fields (`join-wizard.spec.ts`).
- `/join` sidebar shows canonical step labels and legacy labels are gone
  (`join-wizard.spec.ts`).
- End-to-end `/join` → signup → redirect to `/onboarding` with `ws=` query
  works with dummy data (`join-e2e-flow.spec.ts`,
  `join-to-onboarding.spec.ts`).

### Workspace setup UI (`/dashboard/setup`)

- Setup wizard shows when `setup_guide_completed=false` and hides when
  true (`workspace-setup-flow.spec.ts`).
- Wizard is full-screen (no sidebar) while active
  (`workspace-setup-flow.spec.ts`).
- Wizard navigates through all remaining steps from `document-drop` to
  `handbook` and ends on `Fullfør` (`workspace-setup-flow.spec.ts`).
- Governance step filters by industry (restaurant toggles visible)
  (`workspace-setup-flow.spec.ts`).
- Team step accepts new row input and updates person count
  (`workspace-setup-flow.spec.ts`).
- Skip button sets `sessionStorage.setup_dismissed` and wizard stays
  dismissed; clearing the flag makes it reappear
  (`workspace-setup-flow.spec.ts`).
- Completing the wizard dismisses setup mode and shows StrategicView
  (`workspace-setup-flow.spec.ts`).

### Event Engine (no UI)

- `signup.completed` dispatches create an `engine_state` on
  `signup_onboarding` with 10 steps, first `active`, rest `pending`
  (`journey-signup-onboarding.spec.ts`).
- 8 `onboarding.step_completed` events advance current_step 1→9 and mark
  each prior step `completed` (`journey-signup-onboarding.spec.ts`).
- `workspace.created` with matching `user_identity_id` resumes step 9
  and drives state to `complete` with all 10 rows `completed`
  (`journey-signup-onboarding.spec.ts`).
- `workspace.created` also starts the `workspace_setup` process with 9
  steps (`journey-workspace-setup.spec.ts`).
- 9 `wizard.step_completed` dispatches walk through the process to
  `complete` with all rows `completed`
  (`journey-workspace-setup.spec.ts`).

## 3. Gaps (regression risk)

### Signup form behaviour (UI)

| Gap                                                                   | Risk   |
| --------------------------------------------------------------------- | ------ |
| Password < 8 chars on `/signup` → client error                        | High   |
| Password ≠ confirmPassword on `/signup` → client error                | High   |
| Magic-link submit shows "Sjekk e-posten din" confirmation screen      | Medium |
| Password/magic-link tab toggle swaps form                             | Low    |
| Duplicate email — Supabase returns `User already registered` surfaced | High   |
| Google SSO button visible and not disabled by default                 | Low    |
| `/signup` footer link navigates to `/login`                           | Low    |

### `/join` wizard intake (UI)

| Gap                                                                      | Risk   |
| ------------------------------------------------------------------------ | ------ |
| Step 1 → 2 blocked when required fields (email, companyName, city) empty | High   |
| Invalid email format on step 1 blocks Neste                              | High   |
| Invalid Norwegian org number on step 2 blocks Neste                      | High   |
| localStorage persistence across reload restores wizard progress          | Medium |
| Back button from step N goes to N-1 and retains data                     | Medium |
| Final step password/confirmPassword mismatch shows error, stays on step  | High   |
| Signup with already-registered email on final step surfaces error        | High   |
| Sidebar labels match steps (covered) ✓                                   | —      |

### Workspace creation (backend / RPC)

| Gap                                                                                       | Risk   |
| ----------------------------------------------------------------------------------------- | ------ |
| `provision_onboarding_workspace` RPC returns a unique slug                                | High   |
| Two signups with same company name produce two distinct slugs                             | High   |
| New workspace ends in `status=sandbox` with a `verification_deadline` ~48h out            | High   |
| Re-running completeSignup for the same user reuses existing onboarding shell (idempotent) | High   |
| `profile` row ends with role=owner, status=active                                         | High   |
| `I1 bootstrap` seeds at least one location + department for restaurant template           | Medium |
| Company row (`company_details`, `company_opening_hours`) populated from intake            | Medium |

### Subdomain / slug / RLS (platform-level)

| Gap                                                                                  | Risk     |
| ------------------------------------------------------------------------------------ | -------- |
| Slug is URL-safe (lowercase, no spaces, no Norwegian chars)                          | High     |
| `{slug}.localhost` host header resolves the correct workspace via `x-workspace-slug` | Medium   |
| Invalid/non-existent slug hitting subdomain produces expected 404 / access-denied    | Medium   |
| Anon user hitting `/api/context/bootstrap` for another workspace cannot read data    | Critical |
| Two different signups cannot read each other's workspace (RLS isolation)             | Critical |

### Session + redirect flow

| Gap                                                                       | Risk   |
| ------------------------------------------------------------------------- | ------ |
| `/onboarding` when unauthenticated redirects to `/login`                  | Medium |
| After signup → `/api/auth/callback?next=/join` lands back on `/join`      | High   |
| `PENDING_SIGNUP_KEY` offline mode: stored email prefills next visit       | Low    |
| Auth callback with malformed `next=` param does not open an open-redirect | High   |

### Event Engine edge cases

| Gap                                                                                          | Risk   |
| -------------------------------------------------------------------------------------------- | ------ |
| `signup.completed` fired twice for same `entity_id` → idempotent (no duplicate state)        | High   |
| `workspace.created` without matching `user_identity_id` does NOT resume another user's state | High   |
| Firing `onboarding.step_completed` with an unknown `step_id` rejects / no-ops                | Medium |
| Firing steps out of order — engine enforces `current_step` gate                              | Medium |

## 4. Overlap / redundancy

- **`join-e2e-flow.spec.ts` vs `join-to-onboarding.spec.ts`** — ~80%
  overlap. Both click through the same 6 join steps with dummy data. The
  only difference: `join-to-onboarding.spec.ts` then checks for runtime
  errors on `/onboarding`, but it makes NO hard assertions — it just
  console.logs. **Recommendation: merge the two. Keep the full-flow
  with a real assertion on the onboarding shell rendering.** Not done in
  this change to respect the "do not rewrite" constraint.
- **`signup-flow.spec.ts` tests 1 & 2** both assert onboarding WizardShell
  is visible. Test 2 also asserts the Neste button and single-step area —
  test 1 is a subset of test 2. Low-value redundancy, not worth
  changing now.
- **`journey-signup-onboarding.spec.ts` test 3** and
  **`journey-workspace-setup.spec.ts` test 1** both dispatch
  `workspace.created`. First checks the _signup_onboarding_ resume,
  second checks the _workspace_setup_ start. Both are needed — no real
  overlap, just adjacent coverage of the same event fan-out.
- The `test.fixme` blocks in `join-wizard.spec.ts` (tests 2–7) are
  flagged with a known `WizardShell.useWizardState.next()` validation
  schema mismatch. Those are documented debt — do not touch as part of
  this audit (no app/package code changes are in scope).

## 5. Root causes for any existing red tests

Flagged from static read, not runtime:

- `join-wizard.spec.ts` tests 2–7: `test.fixme`'d. Root cause is
  documented in-file: `WizardShell.useWizardState.next()` validates
  `step.validation` against the full nested `JoinState`, but step
  schemas (`step1Schema`, `step2Schema`) expect flat keys. Unblocking
  them requires changing `WizardShell` — out of scope here.
- `join-to-onboarding.spec.ts`: never asserts; always passes. Treat as a
  smoke check, not a regression gate. Flagged as redundancy (see 4).

## 6. New specs added (this change)

All in `apps/e2e/tests/`. No existing spec modified.

| File                                       | Focus                                                                                                                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signup-page-validation.spec.ts`           | `/signup` form validation: password length, password mismatch, tab toggle, magic-link confirmation, duplicate email, Google SSO presence.                                                                        |
| `signup-session-redirects.spec.ts`         | Route guard + redirect matrix: `/onboarding`, `/join`, auth callback, session persistence after signup-equivalent state.                                                                                         |
| `journey-workspace-isolation.spec.ts`      | Event Engine RLS + match_state: (a) `workspace.created` with non-matching `user_identity_id` does NOT resume another user's signup state; (b) firing `signup.completed` twice for the same entity is idempotent. |
| `journey-onboarding-step-contract.spec.ts` | Event Engine contract: unknown `step_id` is a no-op, out-of-order step advances fail to resume, steps stay in authoritative order.                                                                               |

These focus on regression gates that close real gaps above. Where a gap
requires an app-code fix (`test.fixme` cases), no new spec is added —
those are existing debt.

## 7. How to run

```bash
# from repo root — make sure local Supabase is up
npx supabase start

# run the full signup+workspace suite
cd apps/e2e
pnpm test:e2e -- tests/signup-flow.spec.ts \
  tests/auth.spec.ts \
  tests/signup-page-validation.spec.ts \
  tests/signup-session-redirects.spec.ts \
  tests/join-wizard.spec.ts \
  tests/workspace-setup-flow.spec.ts \
  tests/journey-signup-onboarding.spec.ts \
  tests/journey-workspace-setup.spec.ts \
  tests/journey-workspace-isolation.spec.ts \
  tests/journey-onboarding-step-contract.spec.ts
```

The Playwright config auto-starts web on :3060 and landing on :3056
via `start-local-next-app.sh`, which sources local Supabase status for
env vars. No 1Password session is required for the Playwright-managed
servers.
