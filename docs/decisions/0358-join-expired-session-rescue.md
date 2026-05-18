---
title: "ADR-0358 — Join expired-session rescue flow"
status: accepted
updated: 2026-05-18
created: 2026-05-18
module: onboarding
tags: [adr, auth, supabase, server-actions, onboarding, join, ux]
---

# ADR-0358 — Join expired-session rescue flow

## Status
Accepted — 2026-05-18.

## Context

Prior to this sortie, a user who filled the /join wizard, closed the tab, and returned
hours later would hit a 500 "Not authenticated" when clicking **Fullfør** on Step 6
Summary. The session cookie had expired; `completeSignup` threw `throw new Error("Not
authenticated")`; the Next.js Server Action runtime surfaced this as a 500 to the client.

Two failure modes existed:

1. **Load-time:** localStorage has a valid wizard envelope; user is not authenticated;
   wizard hydrates and shows Step 6 — user clicks Fullfør and hits 500.
2. **Submit-time:** user WAS authenticated when /join loaded, but the 60-minute access
   token expired during a long session on Steps 3-5; clicking Fullfør hits 500.

ADR-0357 (same sortie, prior feature) eliminated the `_accessToken` parallel store and
added a `getSession()` + `getUser()` client-side prefetch before the Server Action POST.
This covers token rotation races but does NOT cover cold sessions (tab closed, cookies
expired, no refresh possible).

## Decision

Eight-phase implementation to detect expired sessions and route the user to /login for
re-auth, then resume the wizard at Step 6 after login.

### Phase 1 — `validateReturnTo` utility (`apps/web/src/lib/safe-redirect.ts`)
Open-redirect guard for the `?return_to=` query parameter. Allowlist: `/join`,
`/onboarding`, `/dashboard`. Any other path or absolute/protocol-relative URL returns null.

### Phase 2 — Versioned localStorage envelope (`apps/web/src/app/join/_lib/storage.ts`)
Three functions replace raw `localStorage.getItem/setItem/removeItem` calls:
- `saveJoinState(state)` — wraps state in `{ schemaVersion, savedAt, state }`.
- `loadJoinState()` — validates schema version + TTL (24 h); purges stale/legacy entries.
- `clearJoinState()` — removes the key on successful signup completion.

`JOIN_STORAGE_TTL_MS = 24h` and `JOIN_STORAGE_SCHEMA_VERSION = 1` are exported from
`types.ts`. Increment `JOIN_STORAGE_SCHEMA_VERSION` to force a clean purge when the
envelope shape changes.

ADR-0357 invariant: the envelope NEVER stores Supabase access tokens.

### Phase 3 — `CompleteSignupResult` discriminated union (`setupActions.ts`)
`completeSignup` returns `CompleteSignupResult` instead of throwing:
- `{ ok: true; workspaceId; slug }` — success.
- `{ ok: false; reason: "session_expired" }` — `getUser()` returned null.
- `{ ok: false; reason: "system_error"; message? }` — unexpected DB/provisioning failure.

`throw new Error("Not authenticated")` is replaced by `return { ok: false, reason: "session_expired" }`.
Other `throw` statements in the provisioning block are replaced by `return { ok: false, reason: "system_error", message }`.

### Phase 4 — `/login` `return_to` + expired-session banner (`login/page.tsx`)
- `useSearchParams()` reads `return_to` and `reason`.
- `validateReturnTo()` guards `return_to` before it is used in the post-login redirect.
- After successful login, `routerRef.current.push(returnTo)` replaces the hardcoded `/dashboard`.
- When `reason === "expired"`, a `bg-muted border-border rounded-lg p-3 text-sm` banner
  displays: "Sesjonen er utløpt — logg inn for å fortsette der du slapp."
- Google OAuth `redirectTo` is NOT modified — OAuth callback parity is out of scope (F1).

### Phase 5 — `ExpiredSessionGate` load-time check (`_components/ExpiredSessionGate.tsx`)
Client component that fires on mount:
1. Calls `loadJoinState()`. If no envelope with `account.email` → noop.
2. Calls `supabase.auth.getUser()`. If user present → noop.
3. Emits `join.session_expired_rescued` telemetry (best-effort).
4. Calls `window.location.replace("/login?return_to=/join&reason=expired")`.

`ExpiredSessionGate` wraps the wizard in `join/page.tsx`.

### Phase 6 — Telemetry (same commit, ADR-0112 requirement)
Two events registered in `packages/telemetry/src/registry.ts`:
- `join.session_expired_rescued` — load-time gate fired; destinations: posthog + logger.
- `join.session_expired_at_submit` — submit-time gate fired; destinations: posthog + logger.

Both are pre-auth: `workspace_id = null`, `actor_id = "anonymous"`. No `activity_trail`
(no resolved workspace or actor). No `engine_event` (no workflow to advance).

Emit call-sites:
- `ExpiredSessionGate.tsx` before `window.location.replace`.
- `wizard-definition.ts` `onComplete` in the `result.reason === "session_expired"` branch.

## Consequences

### Positive
- 500 "Not authenticated" at submit time is eliminated for expired-session users.
- Load-time gate catches the case before the user even clicks Fullfør.
- `CompleteSignupResult` discriminated union makes the error domain explicit and testable.
- `validateReturnTo` prevents open-redirect via `?return_to=`.
- Versioned localStorage envelope enables future schema migrations without manual cleanup.

### Negative
- OAuth path does NOT honor `return_to` (out of scope for F1). Users who used Google
  OAuth to create their account will land on `/dashboard` after re-auth, not `/join`.
- Load-time gate fires one `supabase.auth.getUser()` call on every `/join` load when an
  envelope exists. Cost: one network round-trip to Supabase Auth (~50 ms). Acceptable
  for a public flow that happens once per user.

### Out of scope (F1)
- OAuth `/api/auth/callback?next=` safe-redirect parity.
- Resume-to-exact-step (F1 lands on Step 6 Summary unconditionally).
- Multi-tab concurrent rotation (documented residual in ADR-0357).

## References
- ADR-0357 — Drop parallel access-token store (predecessor sortie, same branch).
- ADR-0112 — Intent-enum registration must happen in same commit as capability ship.
- L-0176 — Docstrings must not claim compliance until body satisfies.
- L-0177 — Never silently fallback on missing workspace_id.
