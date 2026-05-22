---
title: "Journey — Mobile password reset (native /m/ bridge)"
status: draft
updated: 2026-05-22
created: 2026-05-22
module: auth
tags: [journey, auth, mobile, reset-password, token_hash]
---

# Journeys — Mobile password reset via /m/ bridge

## Journey: Employee resets password from the mobile app

**Precondition:** Employee has a Smartout account, is on the mobile app login
(`(auth)/verify`, flow=login), forgot password. GoTrue "Reset Password" template
emits a `token_hash` recovery link honoring `{{ .RedirectTo }}`.

1. User taps "Glemt passord?" → enters email → taps send.
   → App calls `resetPasswordForEmail(email, { redirectTo: ".../m/update-password" })`.
   → User sees "Sjekk e-posten din".
2. User opens the email on the phone → taps "Sett nytt passord".
   → OS opens the Universal Link `app.smartout.ai/m/update-password?token_hash=…&type=recovery`.
   → `/m/update-password` verifies the `token_hash` server-side (recovery session)
     and relays into the app (or renders the set-password form).
3. User enters + confirms a new password → submits.
   → `updateUser({ password })` on the live recovery session → success.
**Postcondition:** Password changed; user is authenticated in the app (or returns
to login to sign in). No browser detour.

**Error paths:**
- Stale/used/expired token_hash → bridge shows "Lenken er ugyldig eller utløpt.
  Be om en ny." with a path back to request a fresh reset.
- App not installed / desktop click → ADR-0368 store-fallback / scheme-relay.
- Open-redirect attempt in params → rejected (validateReturnTo / allow-list).

## Journey: Web reset still works (regression guard)

**Precondition:** User on web `app.smartout.ai/reset-password`.
1. Enter email → "Send lenke" → recovery email with `token_hash` link to
   `/api/auth/callback?token_hash=…&type=recovery&next=/update-password`.
2. Click link → callback verifies server-side → lands on `/update-password`
   logged in → set password.
**Postcondition:** Web reset unchanged by the mobile work.
**Error paths:** bad token_hash → `/login?error=Invalid_link`.
