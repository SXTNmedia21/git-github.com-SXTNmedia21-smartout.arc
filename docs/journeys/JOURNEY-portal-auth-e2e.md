---
title: "Journey — Portal Auth E2E"
status: done
updated: 2026-05-18
created: 2026-05-18
module: auth
tags: [journey, auth, e2e, regression-test, adr-0362]
---

# Journey — Portal Auth E2E

> Test-coverage sortie. No new user-facing flows; locks behavior of ADR-0362.

---

## Journey 1: Developer adds a new auth route

**Precondition:** ADR-0362 exists; AUTH_ROUTES_REDIRECT_TO_PORTAL set in proxy.ts:37-48 covers 10 paths.

1. Developer adds a new auth surface, e.g. `/passkey-enroll`, at `apps/web/src/app/passkey-enroll/page.tsx`.
2. Developer pushes branch and opens PR.
3. CI runs `pnpm --filter web vitest run` + `pnpm --filter e2e test:e2e -- auth-invitation/F11`.
4. F11 spec iterates over the 10 routes in `AUTH_ROUTES_REDIRECT_TO_PORTAL`. New route `/passkey-enroll` is NOT in the set yet → F11 does not assert it.
5. Manual smoke: developer or reviewer notices new route is NOT redirected from workspace subdomain → PR comment says "add to AUTH_ROUTES_REDIRECT_TO_PORTAL set in proxy.ts + extend F11 spec."

**Postcondition:** new auth route gets explicit decision-point (intentionally portal-only OR intentionally workspace-allowed). Either way, the choice is visible in code review.

**Error paths:**

- Developer forgets to add to set → middleware does NOT redirect from workspace → PKCE verifier mismatch in prod → `/login?error=Invalid_link`. Caught either by reviewer or by user report. F11 doesn't auto-discover new routes, but PR diff highlights the new route's absence from the set.

---

## Journey 2: Refactor changes proxy.ts middleware order

**Precondition:** developer is restructuring proxy.ts (e.g. extracting helpers, reordering branches).

1. Developer moves portal-redirect block from §2b to a different position OR inadvertently re-places it inside §5 workspace handler.
2. F11 runs on PR — assertions fail because workspace `/login` now returns 200 (page renders) instead of 307.
3. Failure log points at the exact route + status mismatch. Developer locates the regression in their diff.

**Postcondition:** middleware order regression caught before merge. ADR-0362 invariant preserved.

**Error paths:**

- F11 false-positive due to local DNS issue (e.g. `acme.localhost` resolves to wrong port) → flake. Mitigated by `request.fetch()` with explicit URL; no DNS round-trip via OS resolver if the test env is healthy.

---

## Journey 3: Refactor changes callback continue-handling

**Precondition:** developer touches `apps/web/src/app/api/auth/callback/route.ts`.

1. Developer modifies `resolveContinueDestination` — e.g. removes the SLUG_PATTERN regex thinking the workspace-existence check is sufficient.
2. F12 case 4 ("malformed slug — uppercase rejected") fails: `?continue=ACME-UPPER` now reaches the workspace lookup, breaking the early-rejection invariant.
3. Developer realizes SLUG_PATTERN is a defense-in-depth guard against quasi-injection vectors and restores it.

**Postcondition:** open-redirect surface stays locked. SLUG_PATTERN + profile-existence are both load-bearing.

**Error paths:**

- Developer removes the profile-existence check thinking SLUG_PATTERN is enough → F12 case 2 fails ("user has no profile → portal /dashboard"). Test catches the bypass.

---

## Manual smoke (post-deploy, optional)

Same as the workspace+web auth flows in `docs/architecture/SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md` §8.3. The automated F11-F13 cover the redirect class; manual smoke confirms end-to-end with real Google OAuth.
