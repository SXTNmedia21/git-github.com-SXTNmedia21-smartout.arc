---
title: "ADR-0357 — Drop parallel access-token store; cookies + getUser() are the single source of auth handoff for Server Actions"
status: accepted
updated: 2026-05-18
created: 2026-05-18
module: onboarding
tags: [adr, auth, supabase, server-actions, onboarding, join]
---

# ADR-0357 — Drop parallel access-token store for Server Action auth handoff

## Status
Accepted — 2026-05-18.

## Context
Public `/join` wizard threw 500 on Server Action submit (`completeSignup`) in
production on 2026-05-18 with `AuthApiError: Invalid Refresh Token: Already Used`
followed by `Error: Not authenticated`. Root cause:

- Step 1 `attemptSilentAuth` ran `supabase.auth.signUp` and saved the resulting
  `access_token` (A1) on the wizard state under `_accessToken`.
- During steps 2-5 the Supabase browser client auto-rotated R1→R2 — cookies
  were updated, wizard state was not.
- Step 6 POSTed to the Server Action which called `supabase.auth.getUser()`
  server-side. The SSR helper (`@supabase/ssr` `createServerClient`) sets
  `autoRefreshToken: false`, but `@supabase/auth-js` `__loadSession`
  (GoTrueClient.ts:1138-1160) still triggers `_callRefreshToken` on token
  expiry regardless of that flag. That refresh attempt raced the client
  rotation → 400 `refresh_token_already_used`. Fallback to
  `admin.auth.getUser(_accessToken=A1)` also failed because A1 was stale.

The `_accessToken` parallel store was a defensive workaround predicated on the
incorrect assumption "cookies may not be available to the Server Action in the
same request cycle after signUp." In practice cookies ARE available — but
they get stale as soon as a single client-side rotation happens.

## Decision
Cookies are the single source of truth for auth handoff to Server Actions.

1. **Client (wizard-definition.onComplete)** — before invoking any
   Server Action that requires auth: `await supabase.auth.getSession()`
   (triggers refresh if expired) followed by `await supabase.auth.getUser()`
   (forces a verified roundtrip and persists any rotation to cookies). Only
   THEN issue the action call. The two-step is intentional: `getSession()`
   handles the routine refresh, `getUser()` proves the resulting token
   round-trips against the auth server.
2. **Server (Server Action)** — call `supabase.auth.getUser()` ONCE. Trust
   the result. Do NOT call `getSession()` server-side first — it triggers
   refresh on expiry (see GoTrueClient.ts:1138-1160) and races concurrent
   client rotations.
3. **Wizard state** — no `_accessToken` or analogous parallel store. The
   wizard never holds Supabase tokens in JavaScript state.

## Consequences
- Removes the 500 root cause for the routine signUp → wait → submit flow
  (Journeys 1, 3 in `JOURNEY-join-auth-prefetch-loop-fixes.md`).
- Multi-tab concurrent rotation remains a residual ~ms race window for
  scenarios where two tabs run Supabase client side-by-side; documented as
  a known limitation, not in scope for this ADR.
- Expired-session restore from localStorage (Journey 2) still throws
  `Not authenticated` — UX rescue is follow-up work, not closed by this
  ADR.
- Future Server Action handlers (`/onboarding`, `/login`, etc.) MUST
  follow the same handoff pattern. PRs that reintroduce a wizard-state
  access-token field are blocked.

## Alternatives considered
- **`refreshSession()` client-side before action** — races identically to
  the original failure. Rejected.
- **Server `getSession()` first, fallback to `getUser()`** — still races
  because `getSession()` refreshes on expiry (see above). Rejected; was
  the initial fix attempt (commit 668434c7c) and corrected here.
- **Keep `_accessToken` but refresh it before submit** — adds complexity
  and still leaves a parallel-state drift class. Rejected.

## Related
- L-0177 (silent fallback on body-supplied workspace_id) — same class of
  defensive parallel-state anti-pattern.
- @supabase/auth-js source: `src/GoTrueClient.ts:1138-1160` (__loadSession),
  `src/GoTrueClient.ts:1973-2023` (_callRefreshToken).
- Supabase docs: https://supabase.com/docs/guides/auth/server-side/nextjs

## Open follow-ups
- Prod-only assert that `NEXT_PUBLIC_ROOT_DOMAIN` is set in
  `packages/supabase/src/client.ts` + `server.ts` to prevent
  client/server cookie-domain drift (separate sortie).
- Recovery UX for Journey 2 (expired-session restore) — route to /login
  with deep-link return-to /join state restoration (separate sortie).
