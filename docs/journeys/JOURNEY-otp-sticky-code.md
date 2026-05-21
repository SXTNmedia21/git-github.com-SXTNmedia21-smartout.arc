---
title: User Journeys — OTP Sticky Code Screen
status: done
updated: 2026-05-21
created: 2026-05-21
module: auth
tags: [auth, otp, login, journeys]
---

# User Journeys — OTP Sticky Code Screen

## Journey: Employee Logs In with Email Code

**Precondition:** Employee has an active account. They navigate to `/login` and select the "Logg inn med kode" tab.

1. Employee clicks the "Logg inn med kode" tab → system shows email input + "Send kode" button.
2. Employee types their email address and clicks "Send kode".
3. System calls `supabase.auth.signInWithOtp({ shouldCreateUser: false })`. On success (or enumeration-signal), system:
   - Writes `{ email, sentAt: Date.now() }` to `sessionStorage["smartout_otp_pending"]`.
   - Sets `otpSent = true` → renders `OtpVerificationForm`.
4. Employee opens their inbox, finds the 6-digit code, and types it into the digit inputs.
5. `OtpVerificationForm` calls `supabase.auth.verifyOtp({ email, token, type: "email" })`.
6. On success: `handleOtpVerified()` fires → `sessionStorage.removeItem("smartout_otp_pending")` → login animation → redirect `/dashboard` (or `return_to`).

**Postcondition:** Employee is authenticated. `smartout_otp_pending` key is removed from sessionStorage. Employee lands on the dashboard.

**Error paths:**

- **Wrong code** → `otp.error.invalid` shown, digit inputs cleared, focus back to first input. Employee can retry (up to 5 attempts).
- **Expired code** → `otp.error.expired` shown. Employee should click "Resend" (available after 60 s timer) to get a fresh code. A resend re-arms sessionStorage `sentAt`.
- **Too many attempts** (≥5) → `otp.error.tooMany` shown, inputs disabled. Employee must refresh page to start over.
- **OTP send failure** (SMTP/rate-limit) → `login.error.otp_send` shown on email step. Employee can retry after a moment.
- **Unknown email** (`otp_disabled` / "Signups not allowed") → treated as success (enumeration safety, ADR pattern). Employee sees the code screen but no code arrives; after 30 min, sticky state expires and they see the email input again.

---

## Journey: Employee Refreshes Page Mid-Flow (Sticky Code Screen)

**Precondition:** Employee has already received a code (step 3 above completed). `smartout_otp_pending` is set in sessionStorage. Employee refreshes the page or navigates away and back within the same browser tab.

1. Page reloads → `LoginContent` mounts → mount `useEffect` fires.
2. System reads `sessionStorage["smartout_otp_pending"]`. Finds `{ email, sentAt }` with `Date.now() - sentAt < 30 * 60 * 1000`.
3. System sets `email`, `authMethod = "otp"`, `otpSent = true` — WITHOUT calling `handleSendOtp` (no new code sent).
4. Employee sees the `OtpVerificationForm` pre-filled to their email, ready to accept the code already in their inbox.
5. Employee types the code → verify → success → `smartout_otp_pending` cleared → redirect dashboard.

**Postcondition:** Same as happy path above. The code that was already in the inbox is still valid.

**Error paths:**

- **Stale entry** (`sentAt` older than 30 min) → system removes the key, shows default login screen (email input). Employee must request a new code.
- **Corrupt sessionStorage** (JSON parse error) → system removes the key silently, shows default login screen.

---

## Journey: Employee Switches Back to Password Login

**Precondition:** Employee has sent an OTP code (sticky state is set). They decide to log in with a password instead.

1. Employee clicks the "Passord" tab.
2. System calls `setAuthMethod("password")`, `setOtpSent(false)`, `sessionStorage.removeItem("smartout_otp_pending")`.
3. Password form is shown. OTP sticky state is cleared — next visit to the OTP tab starts fresh.

**Postcondition:** `smartout_otp_pending` removed. Employee can log in via password.

**Error paths:**

- None. Tab switch is always allowed; sticky state is cleared regardless.
