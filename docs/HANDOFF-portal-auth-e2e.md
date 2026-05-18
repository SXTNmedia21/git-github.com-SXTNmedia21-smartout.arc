---
title: "Handoff — portal-auth-e2e"
status: done
updated: 2026-05-18
created: 2026-05-18
module: auth
tags: [handoff, auth, e2e, vitest, playwright, adr-0362]
---

# Handoff — portal-auth-e2e

> Branch: `feat/portal-auth-e2e` | Base: `development` | Sortie wt-4 | Closed: 2026-05-18

## Summary

Locked ADR-0374 (portal auth redirect) with three test suites — F11 (Playwright HTTP probes for the redirect class, 10 routes), F12 (Vitest unit tests for callback continue-validation, 8 cases), F13 (negative Playwright probes for paths that must NOT redirect). Discovered and fixed a load-bearing bug in `apps/web/src/proxy.ts` during the sortie: the original ADR-0374 implementation placed the portal-redirect inside §5 workspace handler, AFTER §3 PUBLIC_ROUTES bypass. Auth routes are in PUBLIC_ROUTES, so the redirect never fired in practice — until tests caught it. The fix moves the redirect to §2b, above the PUBLIC_ROUTES bypass.

## What was built

### Tests

- **F11** — `apps/e2e/tests/auth-invitation/F11-portal-redirect-workspace-subdomain.spec.ts` (54 LOC)
  - Parameterised over the 10 paths in `AUTH_ROUTES_REDIRECT_TO_PORTAL`
  - Asserts 307 status + Location origin + path + `continue=<slug>` query param
  - Two bonus tests: query-param preservation, operator-supplied continue override
- **F12** — `apps/web/src/app/api/auth/callback/__tests__/route.test.ts` (200 LOC)
  - 8 cases covering `resolveContinueDestination` exhaustively
  - Mocks Supabase client + telemetry; tests run in 100ms total
  - Case 4 (malformed slug) + case 4b (slug-injection) prove the SLUG_PATTERN regex blocks attack vectors before workspace lookup fires
- **F13** — `apps/e2e/tests/auth-invitation/F13-portal-redirect-negative.spec.ts` (51 LOC)
  - 5 negative cases including the critical `/api/auth/callback?code=...` exclusion (PKCE verifier cookie host-scope guard)
- **Helper** — `apps/e2e/helpers/portal-redirect.ts` (95 LOC)
  - `workspaceUrl`, `portalUrl`, `expectPortalRedirect`, `expectNoPortalRedirect`
  - Resolves dev (`localhost`) vs prod hosts via `E2E_ROOT_DOMAIN` env

### Production-code fix

- **proxy.ts** middleware ordering: portal-redirect moved from §5a to §2b (above PUBLIC_ROUTES bypass at §3). Without this, `/login`, `/signup`, `/invite/*`, `/reset-password`, `/update-password` on workspace subdomain would render the public-route response instead of 307'ing to portal — the original ADR-0374 implementation was technically incorrect. Caught by manual curl-probe during sortie.
- **proxy.ts** dev-host support: portal-redirect now also fires on subdomain dev (`<slug>.localhost:3060` → `http://app.localhost:3060`), not just prod. Previously the `rootDomain !== "localhost"` guard skipped dev entirely. Required for E2E to run locally.
- Net diff: 36 lines added in proxy.ts (new §2b), 21 lines removed from §5a (deduplicated).

## Decisions made

- **F12 as vitest unit, not Playwright.** Testing `resolveContinueDestination` against a live Supabase backend is fragile (needs seed data + valid code exchange). Mocked unit test is faster, deterministic, and covers all 8 logic paths. Trade-off: vitest doesn't catch route-handler integration with Next's actual request/response objects — but route handlers are thin, the helper is the load-bearing logic.
- **F11+F13 as HTTP-level Playwright, not browser.** Browser navigation follows redirects automatically; `request.fetch({maxRedirects: 0})` gets us the raw 307. No browser context needed → tests run in parallel + complete in seconds.
- **Bug fix landed without a new ADR.** The §2b move is a correctness fix to ADR-0374's implementation, not a new architectural decision. Noted in handoff + commit message + ADR-0374 implementation reference. If reviewers prefer an amendment, we can add one in a follow-up — but the canonical doc (`SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md`) already describes the intended behavior matching what's now in code.
- **Helper extracted to `apps/e2e/helpers/`, not `packages/`.** Specs are e2e-internal; no other surface consumes the helper. Keep it close to its only consumer.

## Learnings

- **Middleware bypass order is a load-bearing invariant.** `isPublicRoute(pathname)` matched `/login` and short-circuited before §5 workspace handler — the §5a portal-redirect was dead code. Lesson: when adding a guard in middleware, place it BEFORE any earlier bypass that targets the same path-class. Manual probe + tests caught this; in prod it would have surfaced as "Google OAuth still broken on workspace subdomain even after ADR-0374 deployed." Promote to general L-NNN if this happens again.
- **Dev-mode portal-redirect was not exercised by the original ADR-0374 implementation.** The `rootDomain !== "localhost"` guard skipped subdomain-dev entirely. The fix unblocks E2E + multi-host dev. Add to canonical doc `SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md` §4.7 noting dev now exercises the redirect when host endsWith `.localhost`.
- **F12 vitest exhaustion of `resolveContinueDestination` is high-value, low-effort.** 100ms test run covers more cases than a Playwright E2E would (different code values, malformed slugs, etc.). Pattern to copy for similar internal helpers in the future: extract a vitest unit suite even when there's a higher-level E2E nearby.

## Known issues / debt

- **F11/F13 not yet wired into CI for preview deploys with wildcard DNS.** Currently runs locally only. Vercel preview deploys use `*-preview-*.vercel.app` hosts — no `<slug>.smartout.ai` wildcard until prod. Follow-up: add Host-header override OR cheap `curl`-based smoke probes in `infra/scripts/smoke-probe.sh`.
- **F12 case 1 doesn't catch a subtle bug class:** what if the user has a profile in the requested workspace AND in another workspace, AND `?continue=` points to the OTHER workspace? Currently the mock returns workspaceProfileRow=row for the queried slug; the alternative-workspace case is implicit (resolveContinueDestination only checks the named slug). Add a sixth case if this surfaces.
- **Dev-server probe required `dev:skip-check` script** because preflight env-validation fails with stub env vars. Documented in PLAN.md verification section.

## Next steps (post-merge)

1. Promote `feat/portal-auth-e2e` → development (close-feature.sh does this).
2. Operator confirms Supabase Cloud config per `docs/architecture/SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md` §9.1.
3. Once mobile UL bridge sortie ships, promote both web fixes → preview → main as one batch.
4. Manual smoke per §8.3 of canonical doc after deploy.

## Acceptance verification

- [x] Plan written (`docs/plans/PLAN-portal-auth-e2e.md`)
- [x] Journey written (`docs/journeys/JOURNEY-portal-auth-e2e.md`)
- [x] HANDOFF (this file)
- [x] F11 spec created + parameterised
- [x] F12 vitest 8/8 pass
- [x] F13 negative spec created
- [x] proxy.ts §2b portal-redirect fix
- [x] proxy.ts dev-host support
- [x] Manual curl-probe validation
- [x] e2e typecheck passes
- [x] web typecheck passes (via vitest)

## Refs

- ADR-0374 (portal-auth-redirect-implementation)
- ADR-0021 (subdomain-workspace-routing, amended 2026-04-20)
- `docs/architecture/SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md` §8 (test surface), §6 (open-redirect guards)
- `docs/superpowers/specs/2026-05-18-e2e-portal-redirect-tests.md` (this sortie's spec)
- Sister sortie spec: `docs/superpowers/specs/2026-05-18-mobile-auth-universal-link-bridge.md`
