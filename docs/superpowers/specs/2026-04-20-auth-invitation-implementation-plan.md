---
title: "Auth & Invitation — P1 Implementation Plan"
id: PLAN_AUTH_INVITATION_P1_2026_04_20
version: "1.0"
status: accepted
layer: plan
created: 2026-04-20
updated: 2026-04-20
author: claude (spec-writer agent, under Pontus orchestration)
depends_on:
  - ADR-0021 (amended portal subdomain)
  - ADR-0167 invitation tokens as credentials
  - ADR-0168 magic link as default
  - ADR-0169 partial unique index on pending invitations
  - L-0083 phantom telemetry contract
  - L-0089 ghost routes in PUBLIC_ROUTES
  - L-0090 enum-vs-timestamp cascade heuristic
  - L-0091 semantic conflict resolution per-minority
supersedes_scope_of:
  - /tmp/design-bundle/smartout/project/uploads/2026-04-19-auth-invitation-holistic-design.md
tags: [plan, auth, invitation, implementation]
module: auth
---

# Auth & Invitation — P1 Implementation Plan

## 1. TL;DR

P1 ships 13 web screens on the portal subdomain + backend gaps (partial-unique migration, opened-tracking RPC, 6 newly-registered telemetry events wired to UI emit sites, i18n extraction). Mobile (4 screens), CSV bulk import, SMS/QR channels, "Husk valget" cookie, expiry cron, dialog split of `invite-member-dialog.tsx`, and visual regression are explicitly deferred to P2. The single Trust Gate condition: every registered telemetry event in `packages/telemetry/src/registry.ts` under categories `auth`, `people`, `onboarding`, `navigation` has at least one grep-verifiable emit site before merge (hard lesson from L-0083).

---

## 2. Council verdict summary

| Q | Topic | Winner | Note |
|---|---|---|---|
| Q1 | Portal subdomain canonical for auth? | **b** — yes, all auth routes on `app.smartout.ai`; workspace subdomains redirect | ADR-0021 amended |
| Q2 | Magic-link default on /login? | **b** — yes, unify with /signup | ADR-0168 |
| Q3 | Token classification? | **b** — credential (first-8-char censoring) | ADR-0167 |
| Q4 | DB uniqueness on pending invites? | **b** — partial unique index `(workspace_id, lower(email)) WHERE status='pending'` | ADR-0169 |
| Q5 | Status lifecycle: enum vs timestamp columns? | **b** — keep enum + add `opened_at timestamptz` column | L-0090 |
| Q6 | Opened-tracking mechanism? | **b** — SECURITY DEFINER RPC `track_invitation_opened(p_token)` called from page loader | — |
| Q7 | Split `/reset-password` into two routes? | **b** — new `/update-password` page; `/reset-password` stays as request-email step only | L-0089 |
| Q8 | `/update-password` handles what paths? | **b** — both Supabase recovery-hash AND Bubble `force_password_reset` | — |
| Q9 | Invitation context header content? | **b** — logo + inviter name + workspace + role + start date | — |
| Q10 | Invitation variant A vs B decision? | **b** — server-side: email exists in `auth.users` → variant A, else variant B | — |
| Q11 | Channels in P1 scope? | **b** — link + email only; SMS/QR shown disabled with P2 tooltip | — |
| Q12 | CSV bulk import in P1? | **b** — no, defer to P2 | — |
| Q13 | Admin status list location? | **b** — `/dashboard/people` new `InvitationStatusList` component | — |
| Q14 | Status-display derivation? | **b** — `deriveDisplayStatus(invitation) → 'sent'\|'viewed'\|'accepted'\|'expired'\|'cancelled'` function in shared lib | — |
| Q15 | Split `invite-member-dialog.tsx` (1103 lines)? | **b** — no, defer to P2 (visual-only P1 changes) | — |
| Q16 | "Husk valget" cookie on `/select-workspace`? | **b** — defer to P2 | — |
| Q17 | `/join` scope in P1? | **c — with constraint** — visual polish only; Botsson on /join gated to tools with `requiresWorkspace: false` + no mutations + `allowedChannels: ['chat']` | steward minority preserved as constraint per L-0091 |
| Q18 | `AuthLayout` vs existing `AuthBrandPanel`? | **b** — keep `AuthBrandPanel` (generalize), do NOT introduce new component; add variant prop for glass vs flat | see §4 |
| Q19 | Workspace accent color source? | **b** — hash-derived OKLCH from workspace slug, exposed as `--workspace-accent` CSS variable | — |
| Q20 | Telemetry emit-site ownership? | **b** — Edge Function emits lifecycle events (`invitation created/dispatched/cancelled`); UI emits interaction events (`invitation opened/expired/resent`, `auth password_reset_*`) | L-0083 |
| Q21 | Token censoring scope? | **b** — every emit payload + every log write; grep-checkable via `first 8 chars` comment | ADR-0167 |
| Q22 | Mobile in P1? | **b** — no, all 4 mobile auth screens deferred to P2 | ADR-0133 |
| Q23 | Expiry cron in P1? | **b** — no, P2; P1 uses on-read check in page loader + StatusList | — |
| Q24 | Hardcoded Norwegian strings in new screens? | **b** — forbidden, all strings go through `packages/i18n/src/no/auth.ts` | — |
| Q25 | Visual regression / Playwright coverage in P1? | **b** — Playwright E2E per journey mandatory; visual regression deferred to P2 | — |

---

## 3. Scope boundaries

### In scope for P1

- **13 web screens** (portal subdomain only):
  1. `/login` — already Fase 1 shipped, magic-link default still to flip
  2. `/signup` — already Fase 1 shipped
  3. `/reset-password` — already Fase 1 shipped (email-request step only)
  4. `/update-password` — NEW page (split from `/reset-password`)
  5. `/invite/[token]` — redesign (variant A: existing user)
  6. `/invite/[token]` — redesign (variant B: new user)
  7. `/invite/[token]` — error states (expired/invalid/cancelled/accepted)
  8. `/select-workspace` — polish
  9. `/welcome` — redesign (single screen, 3 action cards)
  10. `/join` — visual polish only (wizard shell unchanged)
  11. `/dashboard/people` — new `InvitationStatusList` section
  12. `/confirm-email` — Nordic Split audit (exists, needs polish)
  13. `/api/auth/callback` — no UI; verify it redirects correctly to portal subdomain
- **Backend gaps:**
  - Migration adding `opened_at timestamptz NULL` to `workspace_invitation`
  - Migration adding partial unique index (with pre-cleanup for existing duplicates)
  - SECURITY DEFINER RPC `track_invitation_opened(p_token uuid)`
  - UI emit sites for 6 newly-registered telemetry events
- **Shared primitives:** `InvitationContextHeader`, `InvitationStatusBadge`, `PasswordStrengthMeter`, `WorkspaceCard`, `ChannelSelector`, `InvitationStatusList`, hash-derived `--workspace-accent` token
- **i18n:** new `packages/i18n/src/no/auth.ts` with all auth/invite copy
- **E2E tests:** Playwright spec per journey under `apps/e2e/tests/auth/`

### Out of scope for P1 (P2 deferrals)

- Mobile auth screens (4 screens across `apps/mobile/app/(auth)/`)
- CSV bulk import mode in `invite-member-dialog.tsx`
- SMS channel dispatch (Twilio)
- QR channel generation + universal-link fallback
- "Husk valget" cookie on `/select-workspace`
- Dialog split of `invite-member-dialog.tsx` (1103 lines) into sub-components
- `invitation-expire-cron` scheduled Edge Function
- Visual regression testing (screenshot diffing)
- `/join` onboarding-wizard architecture changes (Q17=c — visual polish only; Botsson stays gated per capability manifest constraint)
- Apple/Microsoft SSO
- Per-workspace configurable expiry

---

## 4. Architecture changes

File-level impact. Items marked **DONE** landed in the P0 hotfix wave (commits `fc28549d`, `450dd267`, `ff1a9815`).

| # | Change | File(s) | Status |
|---|---|---|---|
| 1 | Middleware PUBLIC_ROUTES cleanup (remove `/update-password` ghost) | `apps/web/src/middleware.ts` | **DONE** (`fc28549d`) |
| 2 | Register 6 new telemetry events (`auth magic_link_sent/opened/expired`, `invitation opened/expired/resent`, `auth password_reset_requested/completed`) | `packages/telemetry/src/registry.ts` | **DONE** (`450dd267`) |
| 3 | `create-invitation` Edge Function emits `invitation created` + `invitation dispatched` | `supabase/functions/create-invitation/index.ts` | **DONE** (`ff1a9815`) |
| 4 | Migration: `opened_at timestamptz NULL` on `workspace_invitation` | `supabase/migrations/YYYYMMDDHHMMSS_invitation_opened_at.sql` | NEW |
| 5 | Migration: partial unique index on pending invitations (with pre-cleanup) | `supabase/migrations/YYYYMMDDHHMMSS_invitation_partial_unique_pending.sql` | NEW |
| 6 | RPC: `track_invitation_opened(p_token uuid)` SECURITY DEFINER | `supabase/migrations/YYYYMMDDHHMMSS_track_invitation_opened_rpc.sql` | NEW |
| 7 | `/reset-password` adds UI emit sites for `auth password_reset_requested` (on email submit) + `auth password_reset_completed` (only fires if kept dual-mode — will be removed once update-password handles completion) | `apps/web/src/app/reset-password/page.tsx` | MODIFY |
| 8 | `/update-password` NEW route — handles Supabase recovery-hash AND `force_password_reset` metadata; emits `auth password_reset_completed` on success | `apps/web/src/app/update-password/page.tsx` | NEW |
| 9 | Middleware line 220: change redirect target from `/reset-password` to `/update-password` for `force_password_reset` users | `apps/web/src/middleware.ts` | MODIFY (after #8 ships) |
| 10 | `resetPasswordForEmail` → `redirectTo` change from `/reset-password` to `/update-password` | `apps/web/src/app/reset-password/page.tsx` | MODIFY (after #8 ships) |
| 11 | Botsson capability manifest: add required `requiresWorkspace: boolean` field | `packages/ai/src/capabilities/*.ts` + manifest type | NEW FIELD |
| 12 | `/join` Botsson gate: load only capabilities with `requiresWorkspace: false` AND no mutations AND `allowedChannels: ['chat']` | `apps/web/src/app/join/` (Botsson loader) | MODIFY |
| 13 | `--workspace-accent` token (hash-derived OKLCH from workspace slug) | `packages/design-tokens/src/tokens.css` + helper in `packages/design-tokens/src/index.ts` | NEW |
| 14 | i18n: Norwegian auth strings | `packages/i18n/src/no/auth.ts` | NEW |

### Decision on `AuthLayout` vs generalized `AuthBrandPanel` (Q18)

The holistic spec proposed a new `AuthLayout` component. Fase 1 shipped `AuthBrandPanel` and `AuthIconInput` instead. Council verdict **b**: keep `AuthBrandPanel`, add a `variant` prop (`'glass' | 'flat' | 'compact'`) for `/update-password`, `/invite/[token]`, `/select-workspace`, `/welcome`. A new wrapper component would be duplication. Rationale: the brand-panel pattern already exists and works; `/invite/[token]` needs a workspace-themed variant (uses `--workspace-accent`) — this is a prop, not a new component.

---

## 5. Wave plan (dependency-ordered)

Seven waves (A–G). A and B can run in parallel. C waves are per-screen and can parallelize after A+B land. D, E, F, G are sequential.

### Wave A — Backend foundations

**Can run in parallel with Wave B.** Estimated effort: M.

Files:
- CREATE `supabase/migrations/YYYYMMDDHHMMSS_invitation_opened_at.sql` — adds `opened_at timestamptz NULL`
- CREATE `supabase/migrations/YYYYMMDDHHMMSS_invitation_partial_unique_pending.sql` — pre-cleanup UPDATE + partial unique index (per ADR-0169 migration block)
- CREATE `supabase/migrations/YYYYMMDDHHMMSS_track_invitation_opened_rpc.sql` — SECURITY DEFINER function
- MODIFY `apps/web/src/app/reset-password/page.tsx` — add `emit('auth password_reset_requested', ...)` on email submit success
- MODIFY `supabase/functions/create-invitation/index.ts` — catch PostgreSQL `23505` on unique violation, return user-friendly response referencing existing pending row (per ADR-0169)

Acceptance:
- `supabase migration list` shows 3 new migrations
- `track_invitation_opened` callable by anon role (RLS bypassed via SECURITY DEFINER, sets `opened_at` only if null — idempotent)
- Attempting to create a duplicate pending invite returns 409 with existing invitation ID (not 500)
- `emit('auth password_reset_requested', ...)` grep-verifiable in `reset-password/page.tsx`

### Wave B — Shared primitives

**Can run in parallel with Wave A.** Estimated effort: L.

Files:
- CREATE `apps/web/src/components/auth/InvitationContextHeader.tsx` — logo + "{inviter} inviterte deg til {workspace} som {role}" + start date; uses `--workspace-accent`
- CREATE `apps/web/src/components/auth/InvitationStatusBadge.tsx` — badge rendering for each display status
- CREATE `apps/web/src/lib/invitations/derive-display-status.ts` — `deriveDisplayStatus(invitation) → 'sent' | 'viewed' | 'accepted' | 'expired' | 'cancelled'` (pure function; unit-test-covered)
- CREATE `apps/web/src/components/auth/PasswordStrengthMeter.tsx` — extracted from inline code in `/reset-password/page.tsx`; reused by `/update-password` and `/invite/[token]` variant B
- CREATE `apps/web/src/components/workspace/WorkspaceCard.tsx` — card used in `/select-workspace`
- CREATE `apps/web/src/components/auth/ChannelSelector.tsx` — checkbox group for `link | email`; `sms | qr` visible but disabled with tooltip "Tilgjengelig i P2"
- CREATE `packages/design-tokens/src/workspace-accent.ts` — hash function `slugToAccent(slug: string) → { hue: number, css: string }`; exported from `packages/design-tokens`
- MODIFY `packages/design-tokens/src/tokens.css` — add `:root { --workspace-accent: oklch(0.65 0.15 40); }` as default; runtime override set via inline style on portal root when workspace context known
- MODIFY `apps/web/src/components/auth/AuthBrandPanel.tsx` — add `variant?: 'glass' | 'flat' | 'compact'` prop

Acceptance:
- All 6 new components pass `pnpm --filter web exec tsc --noEmit`
- `deriveDisplayStatus` unit test covers all 5 output branches
- `slugToAccent('cafe-skuta')` ≠ `slugToAccent('peppes-pizza')` (perceptually distinct hues)
- `ChannelSelector` SMS/QR checkboxes are `disabled` + render tooltip

### Wave C — Screens (parallel per screen after A+B)

**Eight parallelizable sub-waves.** Each screen is an independent PR candidate. Estimated effort: L total (S each).

#### C1 — `/update-password` (NEW page)

- CREATE `apps/web/src/app/update-password/page.tsx`
- Handles two entry paths:
  - Supabase `#access_token` + `type=recovery` hash fragment (email-link recovery)
  - `force_password_reset` metadata on `auth.users` (Bubble-migrated)
- Uses `AuthBrandPanel` + `PasswordStrengthMeter`
- Emits `auth password_reset_completed` on successful update

#### C2 — `/reset-password` cleanup

- Remove inline password-strength code (now imported from primitive)
- Remove update-password fallback logic (now handled by new route)
- Redirect `resetPasswordForEmail` to `/update-password`

#### C3 — `/invite/[token]` redesign

- MODIFY `apps/web/src/app/invite/[token]/page.tsx`
- Page loader calls `track_invitation_opened(p_token)` RPC (emits `invitation opened`)
- Top: `InvitationContextHeader` (logo + inviter + workspace + role + start date)
- Form body: variant A (existing user) or variant B (new user) based on server-side `auth.users` lookup
- Error states: expired (emits `invitation expired`), invalid, cancelled, accepted
- Uses `AuthBrandPanel variant="glass"` with `--workspace-accent` applied

#### C4 — `/select-workspace` redesign

- MODIFY `apps/web/src/app/select-workspace/page.tsx` (or create if missing)
- Renders `WorkspaceCard[]` for each workspace the user is a member of
- Emits `workspace selected` on click
- No "husk valget" cookie (Q16 deferred)

#### C5 — `/welcome` redesign

- MODIFY `apps/web/src/app/welcome/page.tsx`
- Single screen, 3 action cards: "Gå til dashboard", "Fullfør profil", "Se onboarding-videoen"
- Uses `AuthBrandPanel variant="flat"`

#### C6 — `/join` visual polish + Botsson gate

- MODIFY `apps/web/src/app/join/page.tsx` + wizard shell
- Visual audit only — colors, spacing, typography to Nordic Split
- MODIFY Botsson loader: filter capability list by `requiresWorkspace === false && mutations.length === 0 && allowedChannels.includes('chat')`
- No wizard architecture changes

#### C7 — `/login` + `/signup` magic-link default flip

- MODIFY `apps/web/src/app/login/page.tsx:159` — change `authMethod` default from `'password'` to `'magic'`
- Verify localStorage persistence per ADR-0168 "power-users set once"
- Emit `auth magic_link_sent` on magic link request (already registered)

#### C8 — `/confirm-email` Nordic Split audit

- MODIFY `apps/web/src/app/confirm-email/page.tsx` (if exists)
- Remove any hardcoded `zinc-*` / `gray-*` → CSS variables
- Reuse `AuthBrandPanel`

Acceptance (all C sub-waves):
- Typecheck clean per-file
- No hardcoded `zinc-*`, `slate-*`, `gray-*` (grep-verifiable)
- All emit sites grep-verifiable for their declared events
- `AuthBrandPanel` reused (no duplicated brand-panel JSX)

### Wave D — Admin flow

**Depends on B (InvitationStatusBadge + deriveDisplayStatus).** Estimated effort: M.

Files:
- CREATE `apps/web/src/app/dashboard/people/_components/invitation-status-list.tsx`
- MODIFY `apps/web/src/app/dashboard/people/page.tsx` to render `<InvitationStatusList />`
- Query: `useInvitationList(workspace_id)` hook — lists invitations, filters by status, displays via `InvitationStatusBadge`
- Row actions: resend (emits `invitation resent`), cancel (emits `invitation cancelled` — already produced by existing Edge Function)
- On-read expiry check: if `expires_at < now()` and `status = 'pending'`, mark row with `'expired'` display status AND fire a one-shot emit `invitation expired` with dedupe (per-row-per-session) to avoid spam

Acceptance:
- `InvitationStatusList` renders all 5 display statuses correctly via `deriveDisplayStatus`
- Resend and cancel buttons trigger mutations + emit
- Expired rows show "Fornyet lenke"-style re-invite shortcut

### Wave E — i18n extraction

**Depends on all C waves landing.** Estimated effort: M.

Files:
- CREATE `packages/i18n/src/no/auth.ts` — all Norwegian auth/invite copy:
  - `auth.login.*`, `auth.signup.*`, `auth.reset.*`, `auth.update.*`
  - `auth.invite.*` (context header, variant A, variant B, error states)
  - `auth.welcome.*`, `auth.select_workspace.*`
  - `auth.join.*` (wizard step labels)
- MODIFY each screen from Wave C to use `t('auth.xxx.yyy')` via `useTranslation` hook (per `packages/i18n`)

Acceptance:
- Grep for Norwegian characters in `apps/web/src/app/login|signup|reset-password|update-password|invite|select-workspace|welcome|join/**/*.tsx` returns **only** within comments, keys, or placeholder strings already resolved via `t()`
- Hard-coded string pattern `['"][A-ZÆØÅa-zæøå][^'"]{3,}` in those paths returns 0 matches outside i18n call sites

### Wave F — Playwright E2E tests

**Depends on all C waves + Wave D.** Estimated effort: L.

Files (under `apps/e2e/tests/auth/`):
- `login-happy.spec.ts`
- `login-magic-link.spec.ts`
- `login-password-forgot-password-update-login.spec.ts`
- `signup-magic-link-sent.spec.ts`
- `signup-password-to-join.spec.ts`
- `invitation-accept-new-user.spec.ts`
- `invitation-accept-existing-user.spec.ts`
- `invitation-expired-show-error.spec.ts`
- `select-workspace-multi.spec.ts`
- `welcome-post-signup.spec.ts`

Acceptance: each test exercises the journey from §6 end-to-end against Supabase Local + local web dev server.

### Wave G — Test iteration

- Run full E2E suite, triage failures, dispatch fix subagents per-screen, re-run until green
- Collect flake stats; any test with >2 retries flagged for P2 stabilization

Acceptance: `pnpm --filter @smartout/e2e exec playwright test tests/auth/` exits 0, no skips.

---

## 6. User journeys

### Journey: Returning user logs in via magic link
**Precondition:** User has existing `user_identity` and at least one workspace membership.
1. User opens `app.smartout.ai/login` → System renders magic-link tab by default (per ADR-0168) → User sees email input.
2. User enters email + clicks "Send magisk lenke" → System calls Supabase `signInWithOtp`, emits `auth magic_link_sent` → User sees "Lenke sendt" confirmation.
3. User opens email, clicks link → System redirects to `/api/auth/callback` → Session established, emits `auth magic_link_opened` → Redirects to `/select-workspace` (if >1 workspace) or direct to `{slug}.smartout.ai/dashboard`.

**Postcondition:** User is authenticated in their chosen workspace.
**Error paths:** Email not delivered → resend after 30s cooldown. Link expired → error page with "Send ny lenke" action, emits `auth magic_link_expired`.
**Test file:** `apps/e2e/tests/auth/login-magic-link.spec.ts`

### Journey: Returning user logs in with password, forgets, resets, updates, logs in
**Precondition:** User has existing `user_identity` with password.
1. User opens `app.smartout.ai/login` → switches to Passord tab → enters wrong password → sees "Feil passord" + "Glemt passord?" CTA.
2. Clicks "Glemt passord?" → redirects to `/reset-password` → enters email → emits `auth password_reset_requested` → sees "Sjekk e-posten".
3. Opens reset email, clicks link → lands on `/update-password#access_token=...&type=recovery` → enters new password (validated by `PasswordStrengthMeter`) → emits `auth password_reset_completed` → auto-redirects to `/login`.
4. Enters email + new password → session established, emits `auth signed_in` → lands on dashboard.

**Postcondition:** Password rotated, user authenticated.
**Error paths:** Weak password → `PasswordStrengthMeter` blocks submit. Recovery link expired → `/update-password` shows "Lenken har utløpt" + link back to `/reset-password`.
**Test file:** `apps/e2e/tests/auth/login-password-forgot-password-update-login.spec.ts`

### Journey: New user signs up via magic link
**Precondition:** No existing `user_identity` for the email.
1. User opens `/signup` → magic-link tab default → enters email + full name → clicks "Opprett konto".
2. System sends magic link, emits `auth magic_link_sent` + `user signed_up (pending_confirm)` → shows "Sjekk e-posten".

**Postcondition:** `auth.users` row created in `pending` state; magic-link email pending user click.
**Error paths:** Email already exists → inline error "Denne e-posten er allerede registrert. Vil du logge inn?" with link to `/login`.
**Test file:** `apps/e2e/tests/auth/signup-magic-link-sent.spec.ts`

### Journey: New user signs up with password then enters /join
**Precondition:** No existing `user_identity`.
1. User on `/signup` → Passord tab → enters email + name + password → clicks "Opprett konto".
2. System creates `auth.users` row → emits `user signed_up` → redirects to `/join`.
3. Wizard opens (visual polish only per P1 scope) → Botsson sidebar loads with `requiresWorkspace: false` capabilities only → User completes wizard → I1 bootstrap → workspace created → redirects to `{slug}.smartout.ai/dashboard`.

**Postcondition:** User has identity + workspace + first profile; lands on dashboard.
**Error paths:** Wizard step fails → retry in place. Botsson tool attempts mutation → blocked at router layer (per Q17 constraint).
**Test file:** `apps/e2e/tests/auth/signup-password-to-join.spec.ts`

### Journey: Invited new user accepts (variant B)
**Precondition:** Admin created invitation; email does NOT exist in `auth.users`.
1. User clicks invitation email link → lands on `app.smartout.ai/invite/[token]` → page loader calls `track_invitation_opened(p_token)` RPC → emits `invitation opened` → invitation row gets `opened_at = now()`.
2. System loads `get_invitation_by_token(p_token)` → status = `pending` → renders `InvitationContextHeader` (logo + "Anna Olsen inviterte deg til Café Skuta som Servitør" + "Du starter 1. juli 2026") + variant B form (name + email + phone + password + terms).
3. User fills form + checks terms + submits → `accept-invitation` Edge Function creates `auth.users` + `user_identity` + `profile` + `company_member` → emits `invitation accepted` + `profile created` + `user signed_up` → returns session tokens.
4. Client sets session → redirects to `/welcome` → user sees 3 action cards.

**Postcondition:** User has identity, profile in target workspace, active session, invitation row `status='accepted'` with `accepted_at`.
**Error paths:** Token invalid → error page. Token expired → emits `invitation expired` + error. Token accepted → "Du har allerede akseptert. Logg inn." Race: double-submit → second call no-ops (idempotent per ADR-0167 + accept Edge Function).
**Test file:** `apps/e2e/tests/auth/invitation-accept-new-user.spec.ts`

### Journey: Invited existing user accepts (variant A)
**Precondition:** Admin created invitation; email EXISTS in `auth.users`.
1. User clicks link → `/invite/[token]` → `track_invitation_opened` RPC → emits `invitation opened`.
2. Page shows `InvitationContextHeader` + variant A form (email locked, name pre-filled from invitation, password field for authentication).
3. User enters password (authenticating to existing account) → submits → `accept-invitation` finds existing `user_identity`, creates new `profile` + `company_member` in target workspace → emits `invitation accepted` + `profile created` (NOT `user signed_up` since identity exists).
4. Redirects to `{slug}.smartout.ai/dashboard` (skips `/welcome` since existing user).

**Postcondition:** Existing identity gains profile in target workspace.
**Error paths:** Wrong password → "Feil passord" inline. User opts "Glemt passord?" → link to `/reset-password` preserving invitation-continuation context.
**Test file:** `apps/e2e/tests/auth/invitation-accept-existing-user.spec.ts`

### Journey: Invited user finds expired link
**Precondition:** Invitation `status='pending'` but `expires_at < now()`.
1. User clicks email link → `/invite/[token]` loader detects expired → emits `invitation expired` (idempotent) + marks row via on-read check.
2. Page renders error state with Nordic Split design: "Denne lenken har utløpt" + "Kontakt {inviter} for ny lenke" + admin contact info.

**Postcondition:** Invitation shown as expired in admin `InvitationStatusList` next time it's loaded.
**Error paths:** N/A (terminal state).
**Test file:** `apps/e2e/tests/auth/invitation-expired-show-error.spec.ts`

### Journey: Multi-workspace user selects workspace after login
**Precondition:** User authenticated, has ≥2 workspace memberships.
1. After login → redirects to `app.smartout.ai/select-workspace` → renders `WorkspaceCard[]` showing workspace name, role, last activity, status indicator.
2. User clicks card → emits `workspace selected` → redirects to `{slug}.smartout.ai/dashboard`.

**Postcondition:** User lands on chosen workspace dashboard. No cookie remembers choice (P2).
**Error paths:** Zero workspaces → redirect to `/welcome` with "Opprett eller finn arbeidsplass".
**Test file:** `apps/e2e/tests/auth/select-workspace-multi.spec.ts`

### Journey: New signup lands on /welcome post-signup
**Precondition:** Just completed signup via magic link or password.
1. After `user signed_up` + workspace-less state → redirect to `/welcome`.
2. Screen shows 3 action cards — "Gå til dashboard" (if profile exists), "Fullfør profil" (if profile incomplete), "Se onboarding-videoen".
3. User clicks an action → respective navigation.

**Postcondition:** User routed to next meaningful step.
**Error paths:** If no workspace yet (variant-B invitation path already redirected) → the welcome screen hides the dashboard card.
**Test file:** `apps/e2e/tests/auth/welcome-post-signup.spec.ts`

### Journey: Returning user logs in with password (happy path)
**Precondition:** User has existing `user_identity` + password, one workspace.
1. `/login` → Passord tab → enters email + password → submits.
2. System authenticates via Supabase → emits `user signed_in` → redirects direct to `{slug}.smartout.ai/dashboard`.

**Postcondition:** User authenticated in their workspace.
**Error paths:** Wrong password → "Feil passord" inline error with "Glemt passord?" CTA.
**Test file:** `apps/e2e/tests/auth/login-happy.spec.ts`

---

## 7. Acceptance criteria

- [ ] All 10 Wave F Playwright tests green
- [ ] `pnpm --filter web exec tsc --noEmit` exits 0
- [ ] No hardcoded Norwegian strings in auth screens — grep `['"][A-ZÆØÅa-zæøå][^'"]{3,}['"]` in `apps/web/src/app/{login,signup,reset-password,update-password,invite,select-workspace,welcome,join,confirm-email}/**/*.tsx` returns 0 non-i18n matches
- [ ] No hardcoded Tailwind color tokens — grep `bg-zinc-|bg-slate-|bg-gray-|border-zinc-|border-gray-|text-zinc-|text-gray-` in those paths returns 0 matches
- [ ] All 6 new telemetry events have at least one grep-verifiable emit site:
  - `auth magic_link_sent` → `/login` + `/signup`
  - `auth magic_link_opened` → `/api/auth/callback`
  - `auth magic_link_expired` → `/login` error handler
  - `auth password_reset_requested` → `/reset-password`
  - `auth password_reset_completed` → `/update-password`
  - `invitation opened` → `/invite/[token]` page loader
  - `invitation expired` → `/invite/[token]` loader + `InvitationStatusList` on-read check
  - `invitation resent` → `InvitationStatusList` resend action
- [ ] `/update-password` route exists as a file (`apps/web/src/app/update-password/page.tsx`), handles both recovery-hash AND `force_password_reset` metadata paths
- [ ] Middleware line 220 redirects `force_password_reset` users to `/update-password` (not `/reset-password`)
- [ ] `/invite/[token]` renders `InvitationContextHeader` with workspace name + inviter + role + start date
- [ ] `InvitationStatusList` renders all 5 display-statuses correctly via `deriveDisplayStatus`
- [ ] Partial unique index migration applies clean on both fresh DB and on DB with pre-existing duplicate pending rows (pre-cleanup UPDATE verified)
- [ ] Botsson on `/join` loads only capabilities satisfying `requiresWorkspace === false && mutations.length === 0 && allowedChannels.includes('chat')`
- [ ] `AuthBrandPanel` is reused across all portal screens (grep confirms no duplicated brand-panel JSX)
- [ ] `--workspace-accent` token renders distinct OKLCH values for 10 test slugs (see §10 checklist)

---

## 8. Risks & mitigations

**Risk 1 — Middleware redirect cycle if `/update-password` route mis-handled.** If the new page doesn't correctly consume both `#access_token` hash fragment AND `force_password_reset` metadata, middleware line 220 could redirect in a loop.
- **Mitigation:** `/update-password` page detects which entry mode it's in via URL hash + user metadata, renders accordingly. E2E test `login-password-forgot-password-update-login.spec.ts` exercises the Supabase recovery-hash path end-to-end. Middleware redirect change (#9 in §4) MUST land AFTER the page exists (#8).

**Risk 2 — Partial unique index migration fails on production data.** If existing duplicate pending rows exist (likely — no prior constraint), `CREATE UNIQUE INDEX` fails.
- **Mitigation:** Migration file begins with the pre-cleanup `UPDATE workspace_invitation SET status='cancelled' WHERE status='pending' AND id NOT IN (SELECT DISTINCT ON (workspace_id, lower(email)) id ...)` per ADR-0169. Verified locally against `yljaglomadbhyqpcigff` (prod) before promoting. Dry-run with `EXPLAIN ANALYZE` of the SELECT first; apply cleanup separately from index creation if row count is high.

**Risk 3 — Telemetry emit-site drift repeats L-0083.** Registering events in `registry.ts` without an actual call site is exactly the failure we just documented. The 6 new events already exist in the registry post-`450dd267`; P1 must produce them.
- **Mitigation:** Trust Gate (§10) has an explicit grep check per event. CI step added (or manual verification at merge time) that every event name in `registry.ts` has at least one occurrence in `apps/web/src/**` or `supabase/functions/**`. If CI is not feasible in P1, the grep lives in the `/close-feature` checklist for this branch.

---

## 9. ADR cross-reference table

| ADR | Status | Description | Role in this plan |
|---|---|---|---|
| ADR-0021 (amended) | Accepted + 2026-04-20 amendment | Subdomain workspace routing + portal as canonical auth surface | Defines that all auth screens live on `app.smartout.ai` |
| ADR-0085 | Accepted | Telemetry emit contract | All 6 new emit sites follow this contract |
| ADR-0115 | Accepted | RSC migration pattern | `/update-password` page uses Server Component shell + client password form |
| ADR-0132 | Accepted | Mobile AI routing (thin client) | Justifies Q22: mobile auth deferred to P2 |
| ADR-0133 | Accepted | Mobile Surface Boundary ("web composes, mobile executes") | Justifies Q22 + Q17 scope constraints |
| ADR-0134 | Accepted | Mobile Telemetry Contract | Emit-site rules (actor_id, workspace_id required) |
| ADR-0167 | Proposed | Invitation tokens as credentials | Token censoring + never-in-AI-context rules applied to every emit + every log |
| ADR-0168 | Proposed | Magic link as default auth method | Drives Q2 + C7 default flip |
| ADR-0169 | Proposed | Partial unique index on pending invitations | Drives Q4 + Wave A migration |
| L-0083 | Learning | Registered telemetry event without producer is phantom contract | Root lesson behind Trust Gate §10 |
| L-0089 | Learning | Ghost routes in PUBLIC_ROUTES worse than 404 | Drives Q7 + /update-password creation |
| L-0090 | Learning | Enum-vs-timestamp cascade heuristic | Drives Q5 — enum stays, timestamp column added |
| L-0091 | Learning | Semantic conflict resolution must be explicit per-minority | Applied to Q17 steward minority (constraint preserved in majority verdict) |

---

## 10. Trust Gate verification checklist

Run before declaring P1 complete. Every box must be checked with a verification command or artifact.

- [ ] Every new telemetry event in `packages/telemetry/src/registry.ts` under categories `auth`, `people`, `onboarding`, `navigation` has at least one emit site. Verify:
  ```bash
  for event in "auth magic_link_sent" "auth magic_link_opened" "auth magic_link_expired" \
               "auth password_reset_requested" "auth password_reset_completed" \
               "invitation opened" "invitation expired" "invitation resent"; do
    count=$(grep -rEl "emit\\(['\"]${event}['\"]" apps/web/src supabase/functions 2>/dev/null | wc -l)
    echo "$event → $count emit sites"
  done
  ```
- [ ] `apps/web/src/app/update-password/page.tsx` exists AND `apps/web/src/middleware.ts` line ~220 redirects `force_password_reset` users to `/update-password`
- [ ] No Botsson tool loaded on `/join` has `requiresWorkspace: true`. Verify by grepping `/join` capability loader for manifest filter + running wizard locally with browser-dev-tools network tab
- [ ] Invitation token censored (first 8 chars only) in every emit payload. Grep:
  ```bash
  grep -rEn "emit\\(.*'invitation" apps/web/src supabase/functions | grep -v "substring\\|first 8\\|slice\\(0, 8\\)"
  ```
  Expected: 0 lines. Any match indicates raw token being emitted.
- [ ] Partial unique index migration has pre-cleanup for existing duplicate pending rows. Verify migration file opens with `UPDATE workspace_invitation SET status = 'cancelled' WHERE ... NOT IN (SELECT DISTINCT ON ...)` before `CREATE UNIQUE INDEX`
- [ ] Hash-derived workspace accent color works for 10 test slugs. Run:
  ```bash
  pnpm --filter @smartout/design-tokens exec node -e "
    const { slugToAccent } = require('./dist/workspace-accent.js');
    const slugs = ['cafe-skuta','peppes-pizza','sult-bar','maaemo','olivia','noor','egon','big-horn','frognerseteren','dovrehallen'];
    const hues = new Set(slugs.map(s => slugToAccent(s).hue));
    console.log('distinct hues:', hues.size, '/', slugs.length);
  "
  ```
  Expected: 10 distinct hues.
- [ ] All 10 E2E specs green: `pnpm --filter @smartout/e2e exec playwright test tests/auth/`
- [ ] Typecheck: `pnpm --filter web exec tsc --noEmit` exits 0
- [ ] No hardcoded colors: `grep -rE "(bg|border|text)-(zinc|slate|gray)-" apps/web/src/app/{login,signup,reset-password,update-password,invite,select-workspace,welcome,join,confirm-email}/` returns 0
- [ ] No hardcoded Norwegian: `grep -rE "['\"][A-ZÆØÅa-zæøå][a-zæøå ]{10,}['\"]" apps/web/src/app/{login,signup,reset-password,update-password,invite,select-workspace,welcome,join}/` returns 0 outside i18n `t()` call contexts

When every box is checked, close feature per `/close-feature` protocol: user journeys written (§6), handoff written, decision log updated with ADR-0167/0168/0169 status (proposed → accepted on merge).
