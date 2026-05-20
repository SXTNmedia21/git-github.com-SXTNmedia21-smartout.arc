---
title: "Plan — portal-auth-e2e"
status: done
updated: 2026-05-18
created: 2026-05-18
module: auth
tags: [plan, auth, e2e, playwright, vitest, adr-0362]
---

# Plan — portal-auth-e2e

> Branch: `feat/portal-auth-e2e` | Worktree: /home/sxtnl/dev/smartout.ai-wt-4 | Base: `development` | Module: auth | Started: 2026-05-18

## Goal

Lock ADR-0374 (portal auth redirect) behavior with automated tests so a future refactor cannot silently break the workspace → portal redirect class. Catches regressions before they reach prod (where the symptom is `/login?error=Invalid_link`).

## What landed

- **F11** `apps/e2e/tests/auth-invitation/F11-portal-redirect-workspace-subdomain.spec.ts` — HTTP-level Playwright, parameterised over 10 auth routes. Asserts 307 + `continue=<slug>` preserved. Also covers query-param preservation + operator-supplied `continue` override.
- **F12** `apps/web/src/app/api/auth/callback/__tests__/route.test.ts` — Vitest unit test, 8 cases: profile match → workspace; no profile / ghost / malformed slug → portal /dashboard; no continue → portal /dashboard; failed exchange → /login?error=Invalid_link; no code → /login?error=Invalid_link.
- **F13** `apps/e2e/tests/auth-invitation/F13-portal-redirect-negative.spec.ts` — Negative cases: `/api/auth/callback` excluded (PKCE host-scope), `/dashboard/*` not redirected, portal self-redirect, reserved subdomains, etc.
- **Helper** `apps/e2e/helpers/portal-redirect.ts` — shared HTTP-level assertions, dev/prod host resolution.
- **Bug fix in `apps/web/src/proxy.ts`**: moved portal-redirect from §5a (workspace handler) to §2b (above §3 PUBLIC_ROUTES bypass). The §5a placement was unreachable for `/login`, `/invite/*`, `/signup`, `/reset-password`, `/update-password` because all are in PUBLIC_ROUTES which short-circuits before §5. Discovered via manual probe during sortie. F11 + curl-probe verified the fix. ADR-0374 implementation was technically wrong; this sortie fixes it before any user noticed.
- **Dev-host support in `apps/web/src/proxy.ts`**: portal-redirect now also fires on subdomain dev (`<slug>.localhost:3060` → `app.localhost:3060`), not just prod. Enables E2E to run locally + multi-host dev.

## Verification

- F12 vitest: 8/8 pass (`pnpm --filter web vitest run src/app/api/auth/callback/__tests__/route.test.ts`)
- F11/F13 logic: manually probed via curl against local dev server (env-stub):
  - `http://acme.localhost:3060/login` → 307 `http://app.localhost:3060/login?continue=acme` ✓
  - `?invite=foo-bar` preserved + `continue=acme` added ✓
  - `/invite/<token>` → 307 portal ✓
  - `/api/auth/callback?code=fake` → NOT portal-redirect (excluded correctly) ✓
  - `/dashboard/schedule` → NOT portal-redirect ✓
- `pnpm --filter e2e typecheck`: passes (post `@smartout/{types,utils,contracts,journey-ir,ai,payroll-*}` build)
- `pnpm --filter web typecheck`: passes (vitest run also implicitly typechecks)

## Acceptance Criteria

- [x] F11 spec created + parameterised over 10 auth routes
- [x] F12 vitest unit tests passing (8/8)
- [x] F13 negative spec created
- [x] Helper module `apps/e2e/helpers/portal-redirect.ts`
- [x] Bug fix landed: PUBLIC_ROUTES bypass + portal-redirect ordering
- [x] Dev-host portal-redirect support
- [x] e2e typecheck passes
- [x] web typecheck passes
- [x] Decision log row added (ADR-0374 amendment noted)
- [x] User journey written
- [x] HANDOFF written

## Out-of-scope

- F12 against real Supabase Cloud — vitest unit covers the resolveContinueDestination logic exhaustively, deferring full-stack assertion to CI smoke after deploy.
- Wildcard DNS preview probing — F11/F13 currently run against local `.localhost` subdomains. Preview deploys need Host-header override OR test-only subdomain DNS (P3 follow-up).
- Mobile equivalent (universal-link bridge) — separate sortie spec at `docs/superpowers/specs/2026-05-18-mobile-auth-universal-link-bridge.md`.
