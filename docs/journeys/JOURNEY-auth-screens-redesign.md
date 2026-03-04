---
title: "User Journeys — Auth Screens Redesign"
status: review
updated: 2026-03-29
created: 2026-03-03
module: auth
tags: [auth, login, signup, reset-password, ui, journeys]
---

# User Journeys — Auth Screens Redesign

> **MERK**: `/login`, `/signup` og `/reset-password` finnes i koden. Men `/update-password` og `/auth/error` rutene er IKKE implementert ennaa. Journeyene for password update og auth error er planlagt.

## Journey: New User Signs Up

**Precondition:** User has no existing Smartout account. User navigates to `/signup`.

1. User opens `/signup` → System renders split-screen layout: left side shows AuthBrandPanel with SmartoutLogo, animated gradient mesh, and floating accent elements; right side shows AuthFormWrapper with sign-up form
2. User sees email, password, and confirm password fields (shadcn/ui Input with `--brand-orange` focus rings) → User fills in email address
3. User enters password → System validates minimum length and complexity client-side → Validation errors appear inline beneath the field
4. User enters confirm password → System validates passwords match client-side
5. User clicks "Sign Up" (CTA button with `--brand-orange` accent) → System calls `supabase.auth.signUp({ email, password })` → Button shows loading state
6. Supabase creates the user in `auth.users` → `handle_new_user()` trigger creates `user_identity` row → Supabase sends confirmation email
7. System shows success message → User is redirected to `/login` or confirmation instructions depending on email verification settings

**Postcondition:** User account created in `auth.users` with corresponding `user_identity` row. User can now log in after email verification (if required).

**Error paths:**

- Email already registered → Supabase returns error → System shows "An account with this email already exists" inline
- Password too weak → Client-side validation prevents submission, inline error shown beneath password field
- Passwords do not match → Client-side validation prevents submission, inline error shown beneath confirm password field
- Network error → System shows generic error toast, form remains filled so user can retry
- Supabase rate limit hit → System shows "Too many attempts, please try again later"

---

## Journey: Existing User Logs In

**Precondition:** User has an existing verified Smartout account. User navigates to `/login`.

1. User opens `/login` → System renders split-screen layout: AuthBrandPanel on left (animated gradient mesh, SmartoutLogo), login form on right inside AuthFormWrapper
2. User enters email address into the email field (shadcn/ui Input with `--brand-orange` focus ring on focus)
3. User enters password
4. User clicks "Log In" (CTA button with `--brand-orange` styling) → System calls `supabase.auth.signInWithPassword({ email, password })` → Button shows loading state
5. Supabase validates credentials → Returns session with JWT → System stores session
6. System checks if user has a workspace → If yes, redirects to `{slug}.smartout.ai/dashboard` → If no workspace, redirects to `/onboarding`

**Postcondition:** User is authenticated with a valid Supabase session. User lands on their workspace dashboard or onboarding flow.

**Error paths:**

- Wrong email or password → Supabase returns "Invalid login credentials" → System shows error inline above the form
- Email not verified → Supabase returns error → System shows "Please verify your email first" with option to resend
- Account locked/rate limited → System shows "Too many failed attempts, try again later"
- Network error → System shows generic error toast, form remains filled

---

## Journey: User Resets Password

**Precondition:** User has an existing account but has forgotten their password. User navigates to `/reset-password`.

1. User opens `/reset-password` → System renders split-screen layout: AuthBrandPanel on left, password reset request form on right inside AuthFormWrapper
2. User enters their email address → User clicks "Send Reset Link" (CTA with `--brand-orange` accent)
3. System calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/update-password' })` → Button shows loading state
4. Supabase sends a password reset email containing a magic link → System shows success message: "Check your email for a reset link"
5. User opens their email → User clicks the reset link → Supabase processes the auth callback, exchanging the token for a session
6. Browser redirects to `/update-password` with an active session → System renders split-screen layout with the update password form
7. User enters new password → User enters confirm new password → System validates match and strength client-side
8. User clicks "Update Password" → System calls `supabase.auth.updateUser({ password: newPassword })` → Button shows loading state
9. Supabase updates the password hash → System shows success message → System redirects to `/login`

**Postcondition:** User's password is updated. User can log in with the new password. Old password no longer works.

**Error paths:**

- Email not found → Supabase still returns success (to prevent email enumeration) → User sees generic "check your email" message
- Reset link expired → Supabase callback fails → System redirects to `/auth/error` with expired token message
- Reset link already used → Supabase callback fails → System redirects to `/auth/error`
- Passwords do not match on update page → Client-side validation prevents submission
- New password too weak → Client-side validation prevents submission, inline error shown
- Session expired before submitting new password → `updateUser` fails → System shows error, prompts user to request a new reset link
- Network error on either step → Error toast shown, form remains filled

---

## Journey: User Encounters Auth Error

**Precondition:** User arrives at `/auth/error` due to a failed authentication callback (invalid token, expired link, or malformed URL).

1. Supabase auth callback fails (expired reset link, invalid magic link, malformed token) → Supabase redirects to `/auth/error` with error details in URL parameters
2. System renders split-screen layout: AuthBrandPanel on left, error content on right inside AuthFormWrapper
3. System parses error parameters from the URL → System displays a user-friendly error message explaining what went wrong (e.g., "This link has expired", "Invalid authentication token")
4. System shows actionable next steps: a link to `/login` ("Back to login") and/or a link to `/reset-password` ("Request a new link") depending on the error type
5. User clicks one of the provided links → System navigates to the chosen page

**Postcondition:** User understands what went wrong and has a clear path forward to retry authentication.

**Error paths:**

- No error parameters in URL → System shows a generic "Something went wrong" message with link back to `/login`
- Unknown error code → System shows generic error message with link back to `/login`

---

## Journey: Mobile User Logs In

**Precondition:** User accesses `/login` on a mobile device (viewport width below the responsive breakpoint).

1. User opens `/login` on a mobile browser → System renders the responsive layout: AuthBrandPanel is hidden (CSS `hidden` on small screens) → Only the right-side form panel is visible, taking full width
2. User sees the SmartoutLogo above the login form (rendered within the AuthFormWrapper for mobile) → Form fields and CTA button use full available width
3. User enters email and password → Focus rings use `--brand-orange` accent → Input fields are appropriately sized for touch targets
4. User taps "Log In" → System calls `supabase.auth.signInWithPassword({ email, password })` → Button shows loading state
5. Supabase validates credentials → Returns session → System redirects to dashboard or onboarding

**Postcondition:** Same as desktop login journey. User is authenticated and redirected appropriately. The experience is fully functional without the brand panel.

**Error paths:**

- Same error paths as the desktop login journey apply
- Soft keyboard covers form → Form container scrolls to keep active input visible
- Touch target too small → All interactive elements meet minimum 44px touch target size via shadcn/ui defaults and Tailwind spacing
