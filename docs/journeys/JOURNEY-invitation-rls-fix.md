---
title: "User Journeys — Invitation Flow Core Fixes"
status: done
updated: 2026-04-06
created: 2026-04-06
module: onboarding
tags: [journey, invitation, auth, security]
---

# User Journeys — Invitation Flow

## Journey: Admin Invites Team Members (Single)

**Precondition:** Admin is logged in, on `/dashboard/people`

1. Admin clicks "Inviter ansatt" button
2. Admin fills in name, email, role, department, employment type
3. Admin selects channels (email, SMS, link)
4. Admin clicks submit
5. System calls `create-invitation` Edge Function (single mode)
6. System inserts invitation row with `status: pending`
7. System dispatches email via SendGrid and/or SMS via Twilio
8. System returns invite token to client
9. Admin sees generated link + toast: "Invitasjon opprettet (e-post + lenke)"

**Postcondition:** Invitation exists in DB, email/SMS sent, invite link available

**Error paths:**

- SendGrid key missing: email silently skipped, link still generated
- Invalid email: Edge Function returns 400
- Non-admin user: Edge Function returns "Insufficient permissions"

## Journey: Admin Invites Team Members (CSV Batch)

**Precondition:** Admin is logged in, on `/dashboard/people`, CSV file ready

1. Admin clicks "Inviter ansatt" and switches to CSV mode
2. Admin uploads CSV file
3. System parses CSV, shows preview with column mapping
4. Admin confirms mapping and clicks submit
5. System calls `create-invitation` Edge Function (batch mode) with `skip_dispatch: true`
6. System inserts all invitation rows
7. System does NOT send emails (CSV import skips dispatch)
8. Admin sees toast: "{N} invitasjoner importert"

**Postcondition:** Invitations exist in DB, no emails sent, admin can dispatch manually later

**Error paths:**

- CSV parse error: shown in mapping dialog
- Duplicate emails: DB insert may fail for duplicates

## Journey: New User Accepts Invitation

**Precondition:** Invitee received email/SMS/link, has no Smartout account

1. Invitee clicks invite link → navigates to `/invite/{token}`
2. System calls `get_invitation_by_token` RPC (anon, no JWT needed)
3. RPC returns full invitation data including `email_account_exists: false`
4. Page shows create-account form: name (pre-filled), email, phone, password, confirm password
5. Invitee fills in any missing fields and creates password
6. Invitee clicks "Godta invitasjon"
7. System calls `accept-invitation` Edge Function with password
8. Edge Function creates auth user, user_identity, profile (status: active), company_member
9. If employee: creates employment_contract + employee_payroll_profile
10. Edge Function marks invitation as accepted
11. Edge Function emits telemetry: activity_trail + engine_event (`invitation.accepted`)
12. Client signs in with new credentials
13. Client redirects to `/welcome?workspace={name}&name={firstName}`

**Postcondition:** User has account, profile in workspace (status: active), invitation marked accepted

**Error paths:**

- Token not found: shows "Invitasjonen ble ikke funnet"
- Already accepted: shows "Denne invitasjonen er allerede brukt"
- Expired: shows "Denne invitasjonen har utlopt"
- Password too short: shows "Passordet ma vaere minst 8 tegn"
- Passwords don't match: shows "Passordene er ikke like"
- Account creation fails: shows error from Edge Function

## Journey: Existing User Accepts Invitation (New Workspace)

**Precondition:** Invitee received link, already has Smartout account (different workspace)

1. Invitee clicks invite link → navigates to `/invite/{token}`
2. System calls `get_invitation_by_token` RPC
3. RPC checks `auth.users` and returns `email_account_exists: true`
4. Page shows sign-in form: name (pre-filled), email (read-only), password
5. Page shows info banner: "Du har allerede en Smartout-konto. Logg inn for a godta invitasjonen."
6. Invitee enters existing password
7. Invitee clicks "Logg inn og godta"
8. System signs in with existing credentials
9. System calls `accept-invitation` Edge Function WITH auth JWT
10. Edge Function detects authenticated user (email matches invite), skips user creation
11. Edge Function creates profile in new workspace (status: active), company_member
12. If employee: creates employment_contract + employee_payroll_profile
13. Edge Function emits telemetry
14. Client redirects to `/dashboard`

**Postcondition:** Existing user now has profile in additional workspace

**Error paths:**

- Wrong password: shows "Feil passord. Prov igjen."
- Already member: Edge Function returns "Already a member of this workspace", redirects to dashboard

## Journey: Re-click After Acceptance

**Precondition:** Invitee already accepted, clicks link again

1. Invitee clicks invite link → `/invite/{token}`
2. System calls `get_invitation_by_token` RPC
3. RPC finds invitation with `status: accepted`
4. RPC returns only `{ status: "accepted" }` (no PII)
5. Page shows: "Denne invitasjonen er allerede brukt"

**Postcondition:** No state change, no PII exposed
