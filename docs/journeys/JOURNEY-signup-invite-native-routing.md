---
title: "Journey — Signup/invite emails land native on mobile"
feature: signup-invite-native-routing
status: draft
updated: 2026-05-22
created: 2026-05-22
module: auth
tags: [journey, auth, mobile, signup, invite, token_hash, universal-link]
---

# Journeys — Signup / invite native routing

> Scope provisional until P0 confirms which flows mobile actually drives via email
> `redirectTo`. If a flow is web-only (no mobile email entry), its journey is
> removed at closure with a note — not invented.

## Journey: Employee accepts invite from the mobile app

**Precondition:** Admin invited the employee; GoTrue "Invite user" email sent with a
`token_hash` link honoring the conditional template (ADR-0390 pattern). Employee
opens the email on the phone with the app installed.

1. User taps "Bli med" / accept → OS opens Universal Link
   `app.smartout.ai/m/<invite-route>?token_hash=…&type=invite` → app.
2. App verifies `token_hash` in-app (`verifyOtp({token_hash, type:"invite"})`) →
   session → routes into the join/onboarding flow.
**Postcondition:** Employee authenticated in the app, in onboarding. No browser detour.
**Error paths:** stale/used token → inline error + path to request a new invite;
app not installed / desktop → web fallback verifies server-side (existing web invite UX);
redirectTo not allow-listed → degrades to web invite (safe).

## Journey: New user confirms signup from the mobile app

**Precondition:** User signed up; GoTrue "Confirm signup" email sent. (P0 confirms
whether mobile drives email signup at all — may be out of scope if invite-only.)

1. User taps "Bekreft" → Universal Link `…/m/<signup-route>?token_hash=…&type=signup`
   → app verifies in-app → lands in the app.
**Postcondition:** Account confirmed, authenticated natively.
**Error paths:** as above (stale token, no-app fallback, allow-list miss → web).

## Journey: Web signup/invite still works (regression guard)

**Precondition:** User on a desktop browser, no `redirectTo` (web call site).
1. Email link → `…/api/auth/callback?token_hash=…&type=<signup|invite>&next=<path>`.
2. Callback verifies server-side → lands on the existing web route, logged in.
**Postcondition:** Web signup/invite unchanged by the mobile work (else-branch
byte-identical to current template).
**Error paths:** bad token_hash → `/login?error=Invalid_link`.
