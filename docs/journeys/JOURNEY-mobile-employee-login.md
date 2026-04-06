---
title: "User Journeys — Mobile Employee Login"
status: done
updated: 2026-04-06
created: 2026-04-06
module: mobile
tags: [mobile, auth, login, otp, workspace, journey]
---

# User Journeys — Mobile Employee Login

> Complete auth flow on mobile: Welcome → Verify → Workspace Select → App.
> Four entry paths converge into a single post-auth flow.

---

## Journey: Employee — Direct Login (Path 4: E-post + Passord)

**Precondition:** Employee has an existing Smartout account with e-post and passord. App is installed.

1. Employee opens app → AuthProvider checks session → No session → Redirects to `/(auth)/welcome`
2. Employee sees Welcome screen with 4 options → Taps "Logg inn eller opprett konto" (orange CTA)
3. System navigates to `/(auth)/verify` with `flow=login` → Employee sees "Velkommen tilbake" heading, Google SSO button, e-post + passord form
4. Employee enters e-post and passord → Taps "Logg inn" → System calls `supabase.auth.signInWithPassword()`
5. Supabase validates credentials → Returns session with JWT → AuthProvider picks up session via `onAuthStateChange`
6. System navigates to `/(auth)/workspace-select` → Fetches all active profiles for user
7. If 1 profile → Auto-redirect to `/(app)` (shift hub)
8. If >1 profiles → Shows workspace list → Employee taps workspace → System stores selected profile → Navigates to `/(app)`
9. Push notification token registered for selected profile

**Postcondition:** Employee is authenticated, on the correct workspace, sees the shift hub home screen.

**Error paths:**

- Wrong e-post/passord → "Feil e-post eller passord." inline error, form preserved
- Network error → "Kunne ikke koble til serveren. Prøv igjen." inline error
- Supabase rate limit → Generic auth error shown
- 0 profiles (orphaned user) → Redirected to pending screen

---

## Journey: Employee — Google SSO Login (Path 4 variant)

**Precondition:** Employee has a Google account linked to their Smartout account.

1. Employee navigates to login screen (same as Path 4 steps 1-3)
2. Employee taps "Fortsett med Google" → System calls `supabase.auth.signInWithOAuth({ provider: "google" })`
3. System opens Google sign-in flow → Redirect URI: `smartout://auth/callback` (native) or origin-based (web)
4. Google authenticates → Supabase creates/matches user → Session returned
5. AuthProvider picks up session → Continues to workspace-select (same as Path 4 steps 6-9)

**Postcondition:** Same as Path 4.

**Error paths:**

- Google auth cancelled → No session change, stays on login screen
- OAuth error → "Noe gikk galt med Google-innlogging." error shown
- No matching Supabase account → New account created via Google SSO (Supabase default)

---

## Journey: Employee — Invitation Link (Path 1: Deep Link)

**Precondition:** Employee received an invitation link from their leader. App is installed.

1. Employee taps invitation link (`https://app.smartout.ai/invite?token=...`) → App opens via deep link
2. System renders `InviteEntry` with pre-filled token → Auto-validates against `invitation` table
3. If valid → Shows workspace name + logo + "Bli med" CTA
4. Employee taps "Bli med" → System navigates to `/(auth)/verify` with `flow=invite`, workspace context, and token
5. Employee verifies identity via SMS OTP or e-post magic link (see OTP/Magic Link journeys below)
6. After successful auth → `handlePostAuth()` calls `accept-invitation` Edge Function with token
7. Edge Function creates profile for user in the workspace → AuthProvider routes to workspace-select → Auto-redirect to app

**Postcondition:** Employee is authenticated, profile created in workspace, on the shift hub.

**Error paths:**

- Invalid/expired token → "Ugyldig eller utløpt invitasjon." error, manual entry available
- Workspace not found → "Fant ikke arbeidsplassen knyttet til denne invitasjonen." error
- accept-invitation fails → Error logged (non-blocking), user still authenticated but may not see workspace

---

## Journey: Employee — Workspace Code (Path 2: 6-tegns kode)

**Precondition:** Employee received a 6-character join code from their leader.

1. Employee taps "Jeg har en kode" on Welcome screen → `CodeEntry` component renders
2. Employee enters 6-character code → System auto-calls `lookup_workspace_by_code()` RPC on 6th character
3. If found → Shows workspace name + logo + "Bli med" CTA
4. Employee taps "Bli med" → System navigates to `/(auth)/verify` with `flow=code` and workspace context
5. Employee verifies via SMS OTP or e-post magic link
6. After auth → `handlePostAuth()` routes to workspace-select → Profile already exists (code = authorization) → Auto-redirect to app

**Postcondition:** Employee authenticated, workspace entered, on shift hub.

**Error paths:**

- Invalid code → "Ingen arbeidsplass funnet med denne koden." error
- RPC error → Generic error, retry available

---

## Journey: Employee — Workspace Search (Path 3: Finn arbeidsplass)

**Precondition:** Employee knows their workplace name but has no invitation or code.

1. Employee taps "Finn min arbeidsplass" on Welcome screen → `WorkspaceSearch` renders
2. Employee types workspace name (min 3 chars) → System calls `search_workspaces()` RPC
3. Results appear → Employee taps their workplace → Confirms with "Send forespørsel"
4. System navigates to `/(auth)/verify` with `flow=search` and workspace context
5. Employee verifies via SMS OTP or e-post magic link
6. After auth → `handlePostAuth()` creates inbound `invitation` row (direction=inbound, status=pending)
7. System redirects to `/(auth)/pending` → "Forespørsel sendt" screen

**Postcondition:** Join request created, employee on pending screen waiting for admin approval.

**Pending → Approved flow:**

1. Pending screen subscribes to Supabase Realtime on `profile` table (INSERT where user_id = current user)
2. Also polls every 30 seconds as fallback
3. When admin approves → Profile created → Realtime fires → System redirects to workspace-select → Auto to app
4. Employee can also tap "Sjekk status" manually
5. Employee can sign out and try a different path

**Error paths:**

- No results → Empty state in search list
- RPC error → "Kunne ikke søke. Prøv igjen."
- Admin never accepts → Employee stays on pending screen, can sign out

---

## Journey: Employee — SMS OTP Verification

**Precondition:** Employee is on the verify screen with a non-login flow (invite/code/search).

1. SMS tab is active by default → Employee enters Norwegian mobile number (8 digits)
2. System normalizes to +47 format → Calls `supabase.auth.signInWithOtp({ phone })`
3. Supabase sends 6-digit code via SMS → Screen switches to OTP input (6 boxes)
4. Employee enters code → Auto-verifies on 6th digit via `supabase.auth.verifyOtp()`
5. If valid → Session created → `handlePostAuth()` runs flow-specific logic

**Postcondition:** Employee authenticated via phone number.

**Error paths:**

- Invalid phone format → "Skriv inn et gyldig norsk mobilnummer (8 siffer)"
- SMS send failed → "Kunne ikke sende kode. Prøv igjen."
- Wrong code → "Feil kode. Sjekk SMS-en og prøv igjen."
- Code expired → Employee taps "Fikk du ikke kode? Send på nytt" → Resets to phone input

---

## Journey: Employee — E-post Magic Link Verification

**Precondition:** Employee is on the verify screen, switches to "E-post" tab.

1. Employee taps "E-post" tab → Email input shown
2. Employee enters e-post → Taps "Send innloggingslenke"
3. System calls `supabase.auth.signInWithOtp({ email })` → Magic link sent
4. Screen shows "Sjekk innboksen din" with confirmation text
5. Employee opens email → Taps magic link → Supabase processes callback → Session created
6. AuthProvider picks up session → Routes to workspace-select (or pending for search flow)

**Postcondition:** Employee authenticated via email magic link.

**Error paths:**

- Invalid email → "Skriv inn en gyldig e-postadresse"
- Send failed → "Kunne ikke sende lenke. Prøv igjen."
- Link expired → Employee returns to app, taps "Fikk du ikke e-post? Prøv igjen"
- Link opened on different device → Session created on that device only

---

## Journey: Employee — Password Reset (from Mobile)

**Precondition:** Employee is on login screen, has forgotten password.

1. Employee taps "Glemt passord?" link → System calls `supabase.auth.resetPasswordForEmail()` with the entered email
2. If email is empty → Inline prompt to enter email first
3. Supabase sends password reset email → Toast confirmation shown
4. Employee opens email → Taps reset link → Opens web-based password update flow
5. After updating password → Employee returns to app → Logs in with new password

**Postcondition:** Password updated, employee can log in.

**Error paths:**

- No email entered → "Skriv inn e-postadressen din først" prompt
- Email not found → Supabase returns success (prevents enumeration) → Generic "sjekk e-post" message
- Reset link expired → Must request new link

---

## Journey: Employee — Create Account (from Mobile)

**Precondition:** Employee is on login screen, does not have an account.

1. Employee taps "Opprett konto" link → System navigates to Welcome screen
2. Employee chooses one of the 4 paths (invite, code, search, or login)
3. For invite/code/search: OTP flow creates the account automatically
4. For login path: Employee would need to use Google SSO (which auto-creates) or be directed to web signup

**Note:** Mobile does not have a standalone signup form — account creation is handled through the invitation/OTP flows or Google SSO. The "Opprett konto" link redirects to Welcome where the user can choose the appropriate onboarding path.

---

## Session Persistence

- **Native (iOS/Android):** Supabase tokens stored in `expo-secure-store` (encrypted)
- **Web:** Supabase tokens in `localStorage`
- Auto token refresh enabled — session survives app restarts
- Push notification token registered on every sign-in event
- Sign-out resets push registration flag for re-registration on next sign-in

---

## Known Bugs & Limitations (2026-04-07 audit)

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| B3 | CRITICAL | Code entry flow (Path 2) never creates profile or invitation — user stuck on pending | Pre-existing, needs ADR |
| B6 | HIGH | Google OAuth callback not handled on native — `detectSessionInUrl: false` + no route for `smartout://auth/callback` | Pre-existing |
| B7 | LOW | Pending screen Realtime subscription is dead — `profile` table not in `supabase_realtime` publication. 30s polling compensates. | Pre-existing |
| B8 | MEDIUM | Pending screen has no rejection feedback — admin rejection leaves user stuck | Pre-existing |
| B9 | MEDIUM | Push token registered for first profile, not selected workspace | Pre-existing |
| B10 | LOW | Google OAuth loading state resets immediately on native (button re-tappable) | Pre-existing |
| B11 | MEDIUM | Search flow silently skips invitation if `workspace.company_id` is null | Pre-existing |
| B12 | LOW | Search flow uses `invite_type: "link"` instead of a "search" value | Pre-existing, enum lacks "search" |
