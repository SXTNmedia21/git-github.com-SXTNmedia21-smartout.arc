---
title: "Invitation Flow — Core Fixes"
status: draft
updated: 2026-03-27
created: 2026-03-27
module: onboarding
tags: [spec, invitation, auth, security, email]
---

# Invitation Flow — Core Fixes

## Goal

Make the critical invitation path work end-to-end:

```
Admin clicks "Invite" → Email arrives → User clicks link → User is in the app
```

## Context

Council audit (2026-03-27) found 4 blockers preventing reliable invitation flow. This spec covers those fixes only. UI polish, telemetry, i18n, animation, and engine integration are deferred to a follow-up.

## Scope

### In scope

1. Batch invite dispatch — people page "invite" sends emails/SMS
2. Existing user detection — accept page shows sign-in for known users
3. RLS security fix — tighten `USING (true)` on invitation table
4. Profile status — insert as `active` directly, remove trainee pretense

### Out of scope (follow-up PR)

- Accept page UI redesign (tokens, shadcn, animation, mobile, dark mode)
- Email template branding
- Telemetry on invitation creation
- Zod validation on Edge Functions
- i18n for hardcoded strings
- `invite_type` data accuracy fix
- `employee_onboarding` engine_process
- Protocol assignment on join
- `expire_stale_invitations()` cron scheduling
- Transaction wrapping in accept-invitation (RPC refactor)
- `listUsers()` replacement with direct query
- Magic link and SMS OTP sign-in for existing users (Fix 2 does password-only)

### Constraints

- New UI text for existing-user flow: hardcoded Norwegian (matching existing pattern). i18n is deferred.
- Migration and page.tsx changes MUST deploy together. Dropping the RLS policy without switching to RPC breaks the accept page.
- Existing admin RLS policies on invitation table remain untouched (`"Workspace admins can read invitations"`, `"Workspace admins can write invitations"` from `00011_employee_invitations.sql`).

---

## Fix 1: Batch Invite Dispatch

### Problem

`handleBatchInvites()` in `supabase/functions/create-invitation/index.ts` inserts invitation rows but never calls `sendEmailInvite()` or `sendSmsInvite()`. When an admin invites people from the people page, invitees never receive notification.

CSV import is intentionally insert-only (admin manages distribution manually).

**Important context:** The people page uses two code paths:

- **Single invite** (one person) → `handleSingleInvite()` — already dispatches email/SMS. No change needed.
- **Batch invite** (multiple rows, CSV import) → `handleBatchInvites()` — insert-only, no dispatch. This is the bug.

Currently batch mode is only used by CSV import. But the fix should support future use of batch mode for non-CSV multi-invite from the people page.

### Solution

Add email dispatch to `handleBatchInvites()` with a `skip_dispatch` flag. Default: dispatch emails. CSV import passes `skip_dispatch: true`.

**Files to modify:**

- `supabase/functions/create-invitation/index.ts`
- `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx`

**Changes:**

1. Add `skip_dispatch?: boolean` to the batch mode request body
2. After the `.insert()` call succeeds (line 92-100), if `!skip_dispatch`, iterate over `insertedInvites`
3. For each invitation with an email, build the invite URL and call `sendEmailInvite(email, inviteUrl, workspace_id)`
4. Use `Promise.allSettled()` — individual email failures should not fail the batch
5. Return dispatch results alongside insertion results: `{ success: true, count: N, dispatched: M, failed: F }`
6. The UI toast in `invite-member-dialog.tsx` should reflect actual dispatch count
7. CSV import path in the dialog passes `skip_dispatch: true` in the request body

**Edge cases:**

- If SendGrid key is not configured, skip dispatch silently (existing behavior in `sendEmailInvite`)
- If some emails fail, report partial success — don't roll back the DB inserts

### Acceptance criteria

- Admin invites 3 people from people page → 3 emails arrive
- CSV import of 10 people → 0 emails sent, 10 rows created
- If 2/3 emails fail → response shows `dispatched: 1, failed: 2`, all 3 DB rows exist

---

## Fix 2: Existing User Detection

### Problem

The accept page (`apps/web/src/app/invite/[token]/page.tsx`) always shows a "create password" form. If the invitee already has a Supabase auth account (e.g., works in another workspace), they must enter a password that gets silently ignored. There is no sign-in path for existing users.

### Solution

Two-phase accept page: detect whether the email already has an auth account, then show the appropriate form. This PR implements password-based sign-in only. Magic link and SMS OTP are deferred to a follow-up.

**Phase A: Email existence check**

The `get_invitation_by_token` RPC (Fix 3) returns `email_account_exists: boolean`. The RPC already runs as `SECURITY DEFINER` so it can check `auth.users`. No separate RPC needed.

**Phase B: Accept page flow**

```
1. Fetch invitation details (via RPC from Fix 3, includes email_account_exists)
2. If email_account_exists = false → NEW USER FLOW (current: name + email + password form)
3. If email_account_exists = true → EXISTING USER FLOW:
   a. Show "Du har allerede en Smartout-konto. Logg inn for å godta invitasjonen."
   b. Show sign-in form: email (pre-filled, read-only) + password
   c. Call supabase.auth.signInWithPassword({ email, password })
   d. On success → call accept-invitation Edge Function with Authorization header
   e. Edge Function detects authenticated user (existing code at lines 96-116), skips account creation
   f. Redirect to /welcome or /dashboard
4. If invitation has no email (link invite) → show full form (name + email + password)
   - On form submit, before calling accept-invitation, check email_account_exists
     via a lightweight RPC call. If exists, switch to sign-in flow.
```

**Files to modify:**

- `apps/web/src/app/invite/[token]/page.tsx` — two-phase form logic

**Edge cases:**

- User enters a different email than on the invitation → treat as new user (current behavior handles this)
- Already authenticated user visiting invite link: existing code at lines 96-116 of accept-invitation handles this correctly (checks email match to prevent admin accidentally accepting as invitee)
- Sign-in fails (wrong password) → show error, offer "Glemt passord?" link to Supabase password reset

### Acceptance criteria

- Existing user with email invite → sees sign-in form (email + password), no "create account"
- New user → sees current form (name + email + password)
- Link invite (no email) → shows full form, checks existence on submit
- After sign-in + acceptance → user lands in dashboard

---

## Fix 3: RLS Security Fix

### Problem

Migration `20260301073436_invitation_token_lookup_policy.sql` creates:

```sql
CREATE POLICY "Anyone can read invitation by token"
  ON public.invitation FOR SELECT TO anon, authenticated
  USING (true);
```

This exposes ALL invitation data (emails, phone numbers, tokens, workspace IDs, roles) to anyone with the Supabase anon key. A single `SELECT * FROM invitation` returns every pending invitation across all workspaces.

### Solution

Replace the blanket `USING (true)` policy with a `SECURITY DEFINER` RPC for token lookup. The accept page calls the RPC instead of querying the table directly.

**New RPC: `get_invitation_by_token(p_token uuid)`**

```sql
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  inv_status text;
BEGIN
  -- First check if the invitation exists and get its status
  SELECT i.status INTO inv_status
  FROM invitation i
  WHERE i.token = p_token;

  -- No invitation found
  IF inv_status IS NULL THEN
    RETURN NULL;
  END IF;

  -- Non-pending invitations: return status only (no PII)
  IF inv_status != 'pending' THEN
    RETURN json_build_object('status', inv_status);
  END IF;

  -- Pending invitation: return full details for the accept form
  SELECT json_build_object(
    'invitation_id', i.invitation_id,
    'email', i.email,
    'phone', i.phone,
    'first_name', i.first_name,
    'last_name', i.last_name,
    'role', i.role,
    'status', i.status,
    'expires_at', i.expires_at,
    'workspace_name', w.name,
    'inviter_name', p.display_name,
    'email_account_exists', EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.email = lower(i.email)
    )
  ) INTO result
  FROM invitation i
  LEFT JOIN workspace w ON w.workspace_id = i.workspace_id
  LEFT JOIN profile p ON p.profile_id = i.invited_by
  WHERE i.token = p_token;

  RETURN result;
END;
$$;

-- Grant anon access to the RPC (token is authorization)
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO anon, authenticated;
```

**Security notes:**

- Non-pending tokens return `{ status }` only — no PII exposure for consumed/expired/cancelled invitations
- `email_account_exists` is an information disclosure tradeoff, acceptable given UUID token entropy (122 bits)
- `inviter_name` may be NULL if the inviter's profile was deleted (LEFT JOIN handles this)
- Existing admin RLS policies remain untouched — people page continues to work via workspace-scoped SELECT

**Migration also drops the old policy:**

```sql
DROP POLICY IF EXISTS "Anyone can read invitation by token" ON public.invitation;
```

**Files to modify:**

- `supabase/migrations/` — new migration with RPC + policy drop
- `apps/web/src/app/invite/[token]/page.tsx` — replace `supabase.from("invitation").select(...)` with `supabase.rpc("get_invitation_by_token", { p_token: token })`

### Acceptance criteria

- `SELECT * FROM invitation` as anon returns 0 rows
- `supabase.rpc("get_invitation_by_token", { p_token: validToken })` returns invitation details
- `supabase.rpc("get_invitation_by_token", { p_token: invalidToken })` returns null
- Accept page renders correctly using RPC data
- Admin workspace queries (people page) still work (admin RLS policies unchanged)

---

## Fix 4: Profile Status — Set Active Directly

### Problem

`accept-invitation` inserts profile with `status: 'trainee'` (line 309) then immediately promotes to `'active'` (lines 393-397 for employees, 399-403 for guests). Trainee status is never observable by any system. This is misleading code.

### Decision

Set `active` directly. Trainee mode is a future feature that will be driven by engine_process when built.

### Solution

In `supabase/functions/accept-invitation/index.ts`:

1. Change line 309: `status: "trainee"` → `status: "active"`
2. Delete lines 393-397 (employee promotion to active)
3. Delete lines 399-403 (guest promotion to active)

This removes one unnecessary DB round-trip per invitation acceptance.

**Tradeoff:** If the employee cascade (contract + payroll inserts) fails after profile creation, the profile is `active` without its supporting data. This is accepted because: (a) these inserts rarely fail, (b) transaction wrapping is a follow-up fix. The previous code had the same risk — trainee-without-cascade was equally broken.

**Files to modify:**

- `supabase/functions/accept-invitation/index.ts`

### Acceptance criteria

- New employee profile created with `status: 'active'` in one step
- No second UPDATE query to profile table
- Guest profiles also created with `status: 'active'`

---

## File Change Summary

| File                                                                     | Changes                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `supabase/functions/create-invitation/index.ts`                          | Add email dispatch to batch mode, add `skip_dispatch` flag                                        |
| `supabase/functions/accept-invitation/index.ts`                          | Set active directly, remove trainee→active promotion                                              |
| `apps/web/src/app/invite/[token]/page.tsx`                               | Use RPC for token lookup, add existing-user detection + password sign-in flow                     |
| `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx` | Pass `skip_dispatch: true` for CSV import path                                                    |
| `supabase/migrations/YYYYMMDDHHMMSS_invitation_rls_rpc.sql`              | Drop `USING(true)` policy, create `get_invitation_by_token` RPC (includes `email_account_exists`) |

## Dependencies

- SendGrid API key must be configured (`SENDGRID_API_KEY` env var)
- `SITE_URL` env var for invite link generation

## Deployment

Migration and `page.tsx` changes MUST deploy together. The migration drops the anon SELECT policy and creates the RPC. If the migration deploys without the page.tsx change, the accept page breaks (cannot read invitation data). If the page.tsx changes deploy without the migration, the RPC doesn't exist yet.

## Testing

Manual test flow:

1. Admin opens people page → clicks "Invite" → enters email → submits
2. Check email inbox — invitation email arrives with accept link
3. Click link → accept page loads with invitation details
4. New user: fill form, create account → lands in dashboard with active profile
5. Existing user: sees sign-in options → authenticates → lands in dashboard

E2E test scenarios (for follow-up):

- New user email invite happy path
- Existing user email invite happy path
- Batch invite from people page (3 invites, verify 3 emails)
- CSV import (verify 0 emails sent)
- Expired invitation shows error
- Invalid token shows error
- RLS: anon cannot SELECT from invitation table directly
