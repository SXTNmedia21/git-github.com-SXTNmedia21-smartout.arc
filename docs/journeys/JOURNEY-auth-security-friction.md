---
title: User Journeys — Auth Security & Friction
status: done
updated: 2026-03-30
created: 2026-03-30
module: auth
tags: [auth, otp, sandbox, security, journeys]
---

# User Journeys — Auth Security & Friction

## Journey: New User — Join Wizard Registration

**Precondition:** User has no Smartout account. Visits `/join`.

1. User enters company name, industry, city, email → System validates fields
2. User enters password + confirm password → System validates min 8 chars + match
3. On confirm password blur → System silently calls `signUp()` with email/password
4. If email already exists → System tries `signInWithPassword()` → shows error if wrong password
5. If signup succeeds → System stores `_accessToken` in wizard state (invisible to user)
6. User proceeds through steps 2-5 (business, identity, hours, menu) → System persists to localStorage
7. User reaches step 6 (Summary) → System shows review of all entered data
8. User clicks "Fullfør" → System calls `completeSignup()` server action with access token
9. System provisions workspace with `status: 'sandbox'` and `verification_deadline: +48h`
10. System redirects to `/dashboard`
11. Dashboard layout detects `email_confirmed_at === null` → renders VerificationGate overlay
12. System auto-sends OTP to user's email
13. User enters 6-digit code → System verifies via `supabase.auth.verifyOtp()`
14. On success → System updates `workspace.status` to `'active'`, overlay disappears

**Postcondition:** User has verified email, active workspace, full dashboard access.

**Error paths:**

- Wrong password for existing email → "Denne e-posten er allerede registrert. Sjekk passordet ditt." Retry allowed.
- Password too short → Field marked invalid, user corrects before proceeding.
- OTP wrong code → "Feil kode. Prøv igjen." Digits cleared, focus returns to first field.
- OTP expired → "Koden har utløpt. Send en ny." Resend button available.
- OTP max attempts (5) → "For mange forsøk. Prøv igjen om 15 minutter."
- OTP resend → 60-second countdown, then "Send kode på nytt" link appears.

---

## Journey: Existing User — Password Login

**Precondition:** User has a verified Smartout account.

1. User visits `/login` → System shows login form with password tab active
2. User enters email + password → clicks "Logg inn"
3. System calls `signInWithPassword()` → success
4. System plays "logging-in" animation → redirects to `/dashboard`

**Postcondition:** User is on dashboard with full access.

**Error paths:**

- Wrong credentials → "Feil e-post eller passord."
- Supabase unreachable → "Kunne ikke koble til databasen."
- Rate limited (5/60s) → blocked at Upstash layer, generic error shown.

---

## Journey: Existing User — OTP Login

**Precondition:** User has a verified Smartout account.

1. User visits `/login` → System shows login form
2. User clicks "Engangskode" tab → System shows email input + "Send kode" button
3. User enters email, clicks "Send kode" → System calls `signInWithOtp({ shouldCreateUser: false })`
4. System shows "Hvis denne e-posten finnes, har vi sendt en kode" (never reveals email existence)
5. System shows OtpVerificationForm with 6-digit inputs
6. User enters code (or pastes from email) → System auto-submits
7. On success → System plays "logging-in" animation → redirects to `/dashboard`

**Postcondition:** User is on dashboard. Email verification confirmed as side effect.

**Error paths:**

- Email doesn't exist → Same UI shown ("Hvis denne e-posten finnes..."). No code arrives. User can retry.
- Wrong code → "Feil kode. Prøv igjen."
- OTP rate limited (3/15min) → blocked at Upstash layer.

---

## Journey: Unverified User — Dashboard Access (Sandbox)

**Precondition:** User completed wizard but hasn't verified email. Workspace is in `sandbox` status.

1. User navigates to `/dashboard` → System renders dashboard behind overlay
2. VerificationGate checks `email_confirmed_at` → null → shows OTP overlay
3. System auto-sends OTP to user's email
4. User enters 6-digit code → verified
5. System updates workspace to `active`, overlay fades away

**Postcondition:** Workspace is active, full access granted.

**Error paths:**

- User tries to navigate to blocked route (integrations, API keys, invites, export) → middleware redirects to `/dashboard`
- User doesn't verify within 48h → cleanup Edge Function deletes workspace + orphaned user

---

## Journey: Sandbox Route Blocking (Middleware)

**Precondition:** Workspace has `status: 'sandbox'`.

1. User navigates to `/dashboard/settings/integrations` → Middleware checks workspace status via cached lookup
2. Middleware finds sandbox status → redirects to `/dashboard`
3. Same for: `/dashboard/settings/api-keys`, `/dashboard/team/invite`, `/dashboard/export`, `/api/onboarding-agent`

**Postcondition:** User remains on dashboard. Blocked routes inaccessible until verification.

**Error paths:**

- Cache stale (max 30s) → next request picks up updated status.

---

## Journey: Automated Sandbox Cleanup (Cron)

**Precondition:** Sandbox workspace exists with `verification_deadline` in the past.

1. Cron triggers `cleanup-sandbox-workspaces` Edge Function (recommended: daily at 03:00)
2. Function authenticates via `WATCHDOG_CRON_SECRET` bearer token
3. Function queries `workspace` where `status = 'sandbox'` AND `verification_deadline < now()`
4. For each expired workspace:
   a. Fetches `company_member` rows (to identify users)
   b. Deletes workspace (CASCADE handles engine tables)
   c. Checks each user — if no other workspaces, deletes user from auth
5. Returns `{ cleaned: N, errors: N, total: N }`

**Postcondition:** Expired sandboxes removed. Orphaned users cleaned up.

**Error paths:**

- Missing WATCHDOG_CRON_SECRET → 401 Unauthorized
- Individual workspace deletion fails → logged, continues with next workspace, returns 207 Multi-Status
