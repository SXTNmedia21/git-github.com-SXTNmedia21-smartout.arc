---
title: "Journeys — join-expired-session-rescue"
status: done
updated: 2026-05-18
created: 2026-05-18
module: onboarding
tags: [journeys, join, wizard, auth, session]
---

# Journeys — join-expired-session-rescue

Three journeys covering the expired-session recovery flow at /join. Each describes the
pre-fix failure mode and the expected post-fix behaviour.

---

## Journey 1: Load-time rescue — returning user with stale session

**Role:** Public visitor who previously filled the /join wizard, closed the tab, and returns
after the Supabase cookie has expired (> 60 min idle or explicit browser cookie clear).

**Precondition:**
- `localStorage["smartout_signup_wizard"]` contains a valid envelope (schemaVersion=1, savedAt
  within 24 h) with `state.account.email` set.
- No live Supabase session cookie — `supabase.auth.getUser()` returns `{ data: { user: null } }`.

1. User navigates to `https://app.smartout.ai/join`.
   - System: `ExpiredSessionGate` mounts. Calls `loadJoinState()` — envelope found with email.
   - System: calls `supabase.auth.getUser()`. Returns `{ user: null }`.
   - System: emits `join.session_expired_rescued` telemetry (posthog + logger).
   - System: calls `window.location.replace("/login?return_to=/join&reason=expired")`.
   - User sees: redirected to /login before the wizard fully hydrates.

2. /login page loads with `?return_to=/join&reason=expired`.
   - System: reads `return_to` via `useSearchParams()`, validates via `validateReturnTo()`.
   - System: renders expired-session banner: "Sesjonen er utløpt — logg inn for å fortsette der du slapp."
   - User sees: login form + informative banner.

3. User logs in (email + password or OTP).
   - System: `mode` transitions to `"logging-in"`.
   - System (after 1.1 s animation settle): `routerRef.current.push("/join")`.
   - User sees: redirected back to /join. Wizard hydrates and restores from envelope.

**Postcondition:** User lands on Step 6 Summary with all previously entered data restored.
Wizard session is now authenticated — Fullfør will succeed.

**Error paths:**
- Envelope savedAt > 24 h: `loadJoinState()` purges entry and returns null. `ExpiredSessionGate`
  sees no resumable state and is a noop — user sees fresh wizard (Journey 2 precondition not met).
- `supabase.auth.getUser()` network failure: Promise rejects silently (the `void` call does not
  throw to the UI). No redirect. User sees fresh wizard; submit-time rescue (Journey 2) still applies.
- `return_to` tampered (e.g. `?return_to=https://evil.com`): `validateReturnTo()` returns null;
  `returnTo` defaults to `/dashboard`. User lands on dashboard after login, not /join.

---

## Journey 2: Submit-time rescue — session expires during wizard fill

**Role:** Public visitor who opened /join, authenticated in Step 1, then idled for > 60 min
on Steps 3–5 without triggering a token refresh (focus left window, slow network, etc.).

**Precondition:**
- User IS authenticated when /join loads (ExpiredSessionGate is a noop — session alive).
- The `getSession()` + `getUser()` prefetch in `onComplete` returns null because the token
  expired and the refresh token is also invalid (long idle or cookie eviction).
- `completeSignup` Server Action receives no valid cookie.

1. User completes Steps 1–5. Clicks **Fullfør** on Step 6 Summary.
   - System: `onComplete` calls `supabase.auth.getSession()` → null. `supabase.auth.getUser()` → null.
   - System: POSTs to `completeSignup` Server Action.
   - Server: `supabase.auth.getUser()` returns `{ user: null }`.
   - Server: returns `{ ok: false, reason: "session_expired" }`.
   - Client: `onComplete` sees `result.ok === false && result.reason === "session_expired"`.
   - Client: emits `join.session_expired_at_submit` telemetry (posthog + logger, wizard_step: 6).
   - Client: calls `window.location.replace("/login?return_to=/join&reason=expired")`.
   - User sees: redirected to /login with expired-session banner.

2. User logs in at /login.
   - System: post-login redirect pushes to `/join` (via `returnTo`).
   - User sees: wizard restores from localStorage envelope (saved by `saveJoinState` at Fullfør click).
   - User sees Step 6 Summary. Clicks **Fullfør** again.
   - System: session is now fresh. `completeSignup` returns `{ ok: true }`.
   - System: clears localStorage via `clearJoinState()`.
   - User sees: redirect to `/onboarding/{workspaceId}`.

**Postcondition:** Workspace provisioned with `contract_status='onboarding'`. No data re-entry needed.

**Error paths:**
- `completeSignup` returns `{ ok: false, reason: "system_error" }`: wizard-definition throws
  the message string; wizard shell surfaces error to user without redirect.
- Envelope TTL expired between submit and re-auth: localStorage purged by `loadJoinState()`
  on next /join visit. User must refill from Step 1.

---

## Journey 3: Post-login resume — wizard restores at Step 6

**Role:** Authenticated user who was redirected from /join to /login (either Journey 1 or Journey 2)
and has just completed re-authentication.

**Precondition:**
- User is now authenticated (fresh Supabase session cookie).
- `?return_to=/join` was passed through the /login flow and validated.
- `localStorage["smartout_signup_wizard"]` contains a valid envelope from the prior session
  (savedAt < 24 h, schemaVersion=1, all step data present).

1. /login post-auth redirect fires `routerRef.current.push("/join")`.
   - User sees: /join loads.
   - System: `ExpiredSessionGate` mounts, calls `supabase.auth.getUser()` → user found.
   - System: gate is noop — does NOT redirect.

2. Wizard hydrates and calls `loadState()` → `loadJoinState()`.
   - System: envelope is valid — state restored.
   - System: WizardShell renders Step 6 Summary with all prior data.
   - User sees: wizard at summary step with their company info prefilled.

3. User clicks **Fullfør**.
   - System: `saveJoinState(state)` persists final state (overwrite — new envelope timestamp).
   - System: `onComplete` prefetches session (`getSession()` + `getUser()`), posts to `completeSignup`.
   - Server: user resolved → workspace provisioned → returns `{ ok: true }`.
   - Client: `clearJoinState()` removes envelope.
   - Client: redirects to `/onboarding/{workspaceId}`.
   - User sees: onboarding confirmation wizard.

**Postcondition:** Workspace exists. localStorage cleared. No stale envelope to trigger gate on next visit.

**Error paths:**
- Envelope savedAt > 24 h: `loadJoinState()` returns null. Wizard loads with empty state (fresh).
  User must refill. Banner not shown (no expired-session reason in URL at this point).
- `completeSignup` returns `session_expired` again (edge case: token rotated between /login
  redirect and submit): same rescue path fires again. User re-authenticates. Eventually succeeds.
