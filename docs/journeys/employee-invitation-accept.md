---
title: "User Journey: Employee Invitation & Acceptance"
status: review
created: 2026-03-01
updated: 2026-03-29
module: onboarding
tags: [user-journey, employee, invitation, acceptance]
---

# User Journey: Employee Invitation & Acceptance

> **MERK**: Invitasjons- og akseptflyten er implementert (Edge Functions `create-invitation` og `accept-invitation`, `/invite/[token]` side). Men `trainee_journey`-tabellen finnes IKKE i databasen ennaa. Steg som refererer til `trainee_journey` er planlagt funksjonalitet.

## Overview

This document describes the complete flow from when an admin invites an employee to when that employee has an active profile in trainee mode.

**High-level flow:**

```
Admin invites employee
  → Employee receives invite (email / SMS / shared link)
  → Employee clicks invite link
  → Employee accepts invitation
  → Employee creates account (or signs in with existing)
  → user_identity created via handle_new_user() trigger
  → company_member + profile created (status: trainee)
  → trainee_journey record created
  → Employee redirected to dashboard in trainee mode
```

---

## Invitation Channels

### 1. Email Invite

| Aspect        | Detail                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Trigger       | Admin enters employee email in InviteStep or team member management UI                  |
| Backend       | `create-invitation` Edge Function creates `invitation` row with `invite_type = 'email'` |
| Dispatch      | SendGrid transactional email via notification pipeline                                  |
| Email content | Workspace name, inviting admin name, role, accept button                                |
| Accept URL    | `https://app.smartout.ai/invite/{token}`                                                |
| Token         | UUID v4 (122-bit entropy)                                                               |
| Expiry        | 7 days from `created_at`                                                                |

### 2. SMS Invite

| Aspect      | Detail                                                                                |
| ----------- | ------------------------------------------------------------------------------------- |
| Trigger     | Admin enters phone number (Norwegian `+47` prefix default)                            |
| Backend     | `create-invitation` Edge Function creates `invitation` row with `invite_type = 'sms'` |
| Dispatch    | Twilio SMS via notification pipeline                                                  |
| SMS content | Short message with workspace name + invite URL                                        |
| Accept URL  | `https://app.smartout.ai/invite/{token}`                                              |
| Token       | Same UUID mechanism as email                                                          |
| Expiry      | 7 days from `created_at`                                                              |

### 3. Shareable Link

| Aspect      | Detail                                                       |
| ----------- | ------------------------------------------------------------ |
| Trigger     | Auto-generated on InviteStep mount                           |
| Backend     | `create-invitation` with `invite_type = 'link'`, no dispatch |
| Dispatch    | None -- admin copies URL manually                            |
| Use case    | Job fairs, walk-ins, group onboarding, printed QR codes      |
| Link format | `https://app.smartout.ai/invite/{token}`                     |
| Token       | Same UUID mechanism                                          |
| Expiry      | 7 days from `created_at` (admin can regenerate)              |

---

## Acceptance Flow

### Variant A: New User (no Supabase account)

This is the most common path for first-time employees.

```
1. Employee clicks invite link
2. Browser navigates to /invite/[token] page
3. Client-side: SELECT from invitation WHERE token = {token}
4. Token validated:
   - Status must be 'pending'
   - created_at + 7 days > now()
5. Page renders: workspace name, role, "You've been invited to [Workspace]!"
6. Employee fills create account form:
   - Email + password
   - OR magic link (passwordless)
7. Supabase Auth signUp() called
8. handle_new_user() trigger fires on auth.users INSERT:
   - Creates user_identity row
9. accept-invitation Edge Function called:
   - Validates token again (race condition guard)
   - Creates company_member (role from invitation, default: member)
   - Creates profile (status: trainee, role from invitation)
   - Creates trainee_journey (status: not_started)
   - Updates invitation: status → 'accepted', accepted_at → now()
10. Client redirected to dashboard
11. Trainee mode begins (sandboxed experience, 48h escalation timer)
```

### Variant B: Existing User (has Supabase account, not in this workspace)

This covers users who already have a Smartout account in another workspace.

```
1. Employee clicks invite link
2. Browser navigates to /invite/[token] page
3. Token validated (same as Variant A, steps 3-4)
4. Page renders: "You already have a Smartout account. Sign in to join [Workspace]."
   - Detected via: user is already authenticated, OR email pre-check
5. Employee signs in via Supabase Auth signInWithPassword() or magic link
6. accept-invitation Edge Function called:
   - Validates token
   - Creates company_member in target workspace
   - Creates profile in target workspace (status: trainee)
   - Creates trainee_journey (status: not_started)
   - Updates invitation: status → 'accepted', accepted_at → now()
7. User now has multiple profiles (one per workspace)
8. Redirect to workspace selector or directly to new workspace dashboard
9. Trainee mode begins in the new workspace
```

### Variant C: Error Cases

| Scenario            | Condition                                                  | User sees                                                          |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Expired invite      | `created_at + 7 days < now()`                              | "This invitation has expired. Ask your manager to send a new one." |
| Already accepted    | `invitation.status = 'accepted'`                           | "This invitation has already been used."                           |
| Invalid token       | No `invitation` row found for token                        | "Invitation not found. Check the link or contact your manager."    |
| Already a member    | User already has `company_member` + `profile` in workspace | "You're already a member of [Workspace]." + link to dashboard      |
| Workspace suspended | `company.status` is suspended/inactive                     | "This workspace is currently unavailable."                         |

---

## Database Effects

### Sequence of database operations during full acceptance flow

| Step               | Table             | Action                         | Key fields                                                                                                  |
| ------------------ | ----------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Invite created     | `invitation`      | INSERT                         | `status: 'pending'`, `token: uuid`, `invite_type`, `workspace_id`, `email` or `phone`, `role`, `expires_at` |
| Account created    | `auth.users`      | INSERT via Supabase Auth       | `email`, `encrypted_password`, `email_confirmed_at`                                                         |
| Auth trigger fires | `user_identity`   | INSERT via `handle_new_user()` | `id` (matches `auth.users.id`), `email`, `display_name`                                                     |
| Invite accepted    | `invitation`      | UPDATE                         | `status: 'accepted'`, `accepted_at: now()`, `accepted_by: user_id`                                          |
| Workspace join     | `company_member`  | INSERT                         | `user_id`, `company_id`, `role: 'member'` (or role from invite)                                             |
| Profile created    | `profile`         | INSERT                         | `user_identity_id`, `workspace_id`, `status: 'trainee'`, `role` from invite                                 |
| Journey started    | `trainee_journey` | INSERT                         | `profile_id`, `workspace_id`, `status: 'not_started'`                                                       |

### Invitation table key columns

| Column         | Type          | Description                                            |
| -------------- | ------------- | ------------------------------------------------------ |
| `id`           | `uuid`        | Primary key                                            |
| `workspace_id` | `uuid`        | Target workspace                                       |
| `token`        | `uuid`        | Unique invite token (122-bit entropy)                  |
| `invite_type`  | `enum`        | `'email'` / `'sms'` / `'link'`                         |
| `email`        | `text`        | Invitee email (nullable for link/SMS)                  |
| `phone`        | `text`        | Invitee phone (nullable for email/link)                |
| `role`         | `enum`        | Assigned role on acceptance                            |
| `status`       | `enum`        | `'pending'` / `'accepted'` / `'expired'` / `'revoked'` |
| `accepted_at`  | `timestamptz` | When the invite was accepted                           |
| `accepted_by`  | `uuid`        | FK to `user_identity.id`                               |
| `invited_by`   | `uuid`        | FK to `user_identity.id` (admin who sent it)           |
| `created_at`   | `timestamptz` | When invite was created                                |
| `expires_at`   | `timestamptz` | `created_at + interval '7 days'`                       |

---

## RLS Policies

| Policy                     | Role                     | Table            | Access                         | Condition                                                                                          |
| -------------------------- | ------------------------ | ---------------- | ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Admin full access          | `authenticated`          | `invitation`     | SELECT, INSERT, UPDATE, DELETE | `is_admin_in_workspace(auth.uid(), workspace_id)`                                                  |
| Token lookup (accept page) | `anon` / `authenticated` | `invitation`     | SELECT                         | `token = {provided_token}` (limited columns: `id`, `workspace_id`, `status`, `role`, `expires_at`) |
| Service role writes        | `service_role`           | `invitation`     | ALL                            | Used by `accept-invitation` Edge Function for status transitions and related inserts               |
| Profile creation           | `service_role`           | `profile`        | INSERT                         | Used by `accept-invitation` to create profile on behalf of new user                                |
| Company member creation    | `service_role`           | `company_member` | INSERT                         | Used by `accept-invitation` to add user to workspace                                               |

**Note:** The accept-invitation Edge Function uses service role for write operations because the accepting user does not yet have RLS-visible membership in the workspace at the time of acceptance. This is a controlled exception -- the Edge Function validates the token before performing any writes.

---

## Edge Functions

### create-invitation

| Aspect       | Detail                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path         | `supabase/functions/create-invitation/index.ts`                                                                                                                           |
| Auth         | JWT (admin only)                                                                                                                                                          |
| `verify_jwt` | `true`                                                                                                                                                                    |
| Input        | `{ workspace_id, email?, phone?, invite_type, role }`                                                                                                                     |
| Validation   | Zod schema, admin role check via `is_admin_in_workspace()`                                                                                                                |
| Actions      | (1) Insert `invitation` row, (2) Dispatch email via SendGrid or SMS via Twilio based on `invite_type`, (3) Return `{ invitation_id, token }` (token only for `link` type) |
| Error cases  | Not admin (403), invalid input (400), duplicate pending invite for same email/phone (409)                                                                                 |

### accept-invitation

| Aspect       | Detail                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Path         | `supabase/functions/accept-invitation/index.ts`                                                                                                                                                        |
| Auth         | JWT (authenticated user)                                                                                                                                                                               |
| `verify_jwt` | `true`                                                                                                                                                                                                 |
| Input        | `{ token }`                                                                                                                                                                                            |
| Validation   | Zod schema, token exists, not expired, status is `pending`                                                                                                                                             |
| Actions      | (1) Validate token, (2) Check user not already member, (3) Create `company_member`, (4) Create `profile` (status: trainee), (5) Create `trainee_journey`, (6) Update `invitation` status to `accepted` |
| Atomicity    | All writes wrapped in a transaction -- if any step fails, all roll back                                                                                                                                |
| Error cases  | Invalid token (404), expired (410), already accepted (409), already member (409)                                                                                                                       |

---

## E2E Test Scenarios

### Happy paths

| #   | Scenario                            | Steps                                                                                    | Expected                                                                                              |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Email invite, new user, accept      | Admin sends email invite -> employee clicks link -> creates account -> accepts           | `invitation.status = 'accepted'`, `profile` created with `status: 'trainee'`, user lands on dashboard |
| 2   | Email invite, existing user, accept | Admin sends email invite -> existing user clicks link -> signs in -> accepts             | New `profile` + `company_member` created in workspace, user redirected to dashboard                   |
| 3   | SMS invite, new user, accept        | Admin sends SMS invite -> employee clicks link -> creates account -> accepts             | Same as #1 but via SMS channel                                                                        |
| 4   | Shareable link, new user, accept    | Admin copies link -> shares out-of-band -> employee clicks -> creates account -> accepts | Same as #1 but via link channel                                                                       |
| 5   | Admin creates invite                | Admin opens InviteStep -> enters email -> submits                                        | `invitation` row created with `status: 'pending'`, email dispatched                                   |
| 6   | Admin creates SMS invite            | Admin enters phone number -> submits                                                     | `invitation` row created, SMS dispatched                                                              |
| 7   | Admin copies shareable link         | InviteStep mounts -> link auto-generated                                                 | Link contains valid token matching `invitation` row                                                   |

### Error paths

| #   | Scenario                    | Steps                                                | Expected                                            |
| --- | --------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| 8   | Expired invite              | Employee clicks invite link after 7 days             | Error page: "This invitation has expired"           |
| 9   | Invalid token               | Employee navigates to `/invite/{random-uuid}`        | Error page: "Invitation not found"                  |
| 10  | Already accepted            | Employee clicks same invite link again               | Message: "This invitation has already been used"    |
| 11  | Already a member            | User who is already in workspace clicks invite       | Message: "You're already a member" + dashboard link |
| 12  | Duplicate invite prevention | Admin tries to invite same email with pending invite | Error (409): duplicate pending invitation           |

---

## Acceptance Criteria

1. **Invitation creation**: Calling `create-invitation` with valid admin JWT and `invite_type = 'email'` inserts a row in `invitation` with `status: 'pending'` and a UUID `token`, and dispatches an email via SendGrid containing the accept URL.

2. **SMS dispatch**: Calling `create-invitation` with `invite_type = 'sms'` and a valid `+47` phone number inserts an `invitation` row and dispatches an SMS via Twilio with the invite URL.

3. **Shareable link**: Calling `create-invitation` with `invite_type = 'link'` inserts an `invitation` row with no dispatch. The token is returned to the admin for manual sharing.

4. **Token validation**: The `/invite/[token]` page performs a SELECT on `invitation` and renders the correct state: accept form (pending + not expired), error (expired), error (already accepted), error (not found).

5. **New user acceptance**: After `signUp()` succeeds and `handle_new_user()` creates `user_identity`, calling `accept-invitation` with the token creates `company_member`, `profile` (status: `trainee`), and `trainee_journey` (status: `not_started`) in a single transaction, and updates `invitation.status` to `'accepted'`.

6. **Existing user acceptance**: An authenticated user calling `accept-invitation` with a valid token creates `company_member` and `profile` in the target workspace without creating a new `user_identity`.

7. **Token expiry**: Invitations with `created_at + 7 days < now()` are treated as expired. The accept page shows an expiry message. The `accept-invitation` Edge Function returns 410 Gone.

8. **Idempotency**: Accepting an already-accepted invitation returns 409 Conflict, not a duplicate profile.

9. **Already a member**: If the user already has a `company_member` record in the target workspace, `accept-invitation` returns 409 with a message indicating existing membership.

10. **RLS enforcement**: Unauthenticated users can only SELECT limited columns from `invitation` (for token lookup). Only admins in the workspace can INSERT/UPDATE/DELETE invitations. Profile and company_member writes during acceptance use service role via the Edge Function.

11. **Trainee mode**: The created profile has `status: 'trainee'`, which activates the sandboxed trainee experience with a 48-hour escalation timer tracked via `trainee_journey`.

12. **Transaction atomicity**: If any write fails during acceptance (company_member, profile, trainee_journey, or invitation update), the entire transaction rolls back. No partial state.
