---
title: "Invite acceptance for existing users — login page token consumption + phone index fix"
id: ADR-0409
status: accepted
layer: decision
created: 2026-05-24
updated: 2026-05-24
---

# ADR-0409: Invite acceptance for existing users — login page token consumption + phone index fix

## Context and Problem Statement

Invited users who already have a Smartout auth.users account land on `/login?invite=<token>` after
clicking an invite email link. The login page read only `?return_to` and `?reason` from the URL;
`?invite=` was silently ignored. After successful sign-in, `accept-invitation` EF was never called,
so no `profile` row was created — the user landed on the "no workspaces" empty state.

Separately, the phone unique index `idx_invitation_unique_phone` used `(workspace_id, phone, status)`
as its key. Because `status='cancelled'` is part of the key, multiple cancelled rows for the same
`(workspace_id, phone)` collide on the third resend, blocking the resend flow. The email equivalent
was fixed 2026-05-15 (ADR-0169 / `workspace_invitation_pending_unique_per_email`). Phone was missed.

## Decision Drivers

- BUG-002: phone invite resend fails after 2+ resends — `idx_invitation_unique_phone` collision
- BUG-003: existing user clicks invite link → lands on generic login with no invite context
- BUG-005: login succeeds but `accept-invitation` EF never called → no profile created → "no workspaces"
- Both affected users (p.l.sixtens@gmail.com, sxtn.lind@gmail.com) unblocked via direct SQL; code-level fix prevents recurrence

## Considered Options

### BUG-002 (phone index)
1. **Partial-unique index (chosen)** — mirror ADR-0169 email pattern: `WHERE status='pending' AND phone IS NOT NULL`
2. **Application-level dedup** — pre-cancel in code before each INSERT (fragile, race-prone)

### BUG-003 + BUG-005 (existing-user accept flow)
1. **Login page token consumption (chosen)** — read `?invite=` on `/login`, call `accept-invitation` EF after successful sign-in (password, OTP, Google OAuth)
2. **Intercept in `/api/auth/callback`** — route-level, centralised, but no access to invite token from OAuth state unless threaded through `redirectTo`
3. **Do nothing, rely on safety net only** — breaks the primary flow; safety net is last resort only

## Decision Outcome

Chosen options: **1 + 1** (partial-unique index + login-page token consumption).

### BUG-002 fix
- `DROP INDEX idx_invitation_unique_phone` (status-in-key behaviour)
- `CREATE UNIQUE INDEX workspace_invitation_pending_unique_per_phone ON invitation (workspace_id, phone) WHERE status='pending' AND phone IS NOT NULL`
- Pre-migration dedup of accumulated `cancelled` rows (idempotent `DO $$ … $$` block)
- Migration: `20260625130000_invitation_pending_unique_per_phone.sql`

### BUG-003 + BUG-005 fix
- `apps/web/src/app/login/page.tsx`: read `inviteToken = searchParams.get("invite")` (UUID-validated)
- After successful sign-in (password submit + OTP `handleOtpVerified`): call `consumeInviteAfterAuth(supabase, token)` — invokes `accept-invitation` EF with Bearer JWT
- On EF success: redirect to `/select-workspace`; on failure: show non-blocking error banner, still redirect to `/select-workspace`
- Google OAuth: carry token through `redirectTo` as `/select-workspace?invite=<token>`; `/select-workspace` silently consumes on mount

### Safety net (BUG-005 fallback)
- `apps/web/src/app/select-workspace/SelectWorkspaceClient.tsx`: in the empty state, query `invitation WHERE email=userEmail AND status='pending'`
- For each pending row: render "Bli med i <workspace>" CTA → calls `accept-invitation` EF → `router.refresh()`
- Also consumes `?invite=<token>` from URL when Google OAuth carries the token through

### Mobile parity (verified, no change needed)
- `apps/web/src/app/m/invite/callback/page.tsx` uses `UniversalLinkBridge` which routes the `token` param into the native app scheme — correct path, unaffected by these changes

### Telemetry
- `invitation accepted` event already emitted by `accept-invitation` EF (server-side). No new client emit needed.

## Rules & Consequences

- **Good:** Existing users clicking invite links now get the EF called in the same session — profile created, invitation marked accepted
- **Good:** Phone resend works after any number of resends (mirrors email behaviour from ADR-0169)
- **Good:** Safety net on `/select-workspace` catches users who went through the reset-password workaround path and have orphaned pending invitations
- **Bad:** The login page now async-calls the EF inside the sign-in handler — adds latency on the invite path only (~200ms typical). Non-blocking UX: user sees "logging in" animation while EF runs
- **Bad:** Google OAuth invite carry-through relies on token surviving URL query param across the OAuth redirect round-trip. This is tested but could break if the OAuth provider strips unknown query params from `redirectTo` — observed to work with Google via Supabase
- **Agent Impact:** No capability or tool changes. If testing invite flows, verify `accept-invitation` EF is called from the login page (not just from `/signup`). Phone resend is now unblocked — test with 3+ resend attempts

---

> Registered in `docs/decisions/0000-decision-log.md`.
> Refs: ADR-0169 (email precedent), BUG-002/003/005 (`docs/test-runs/2026-05-23-prod-release-d766392a.md`)
