---
title: "Sortie Spec — E2E Portal-Redirect Tests"
id: SORTIE_E2E_PORTAL_REDIRECT
status: proposed
layer: spec
created: 2026-05-18
updated: 2026-05-18
sortie: feat/e2e-portal-redirect-tests
phase: P2 follow-up to ADR-0374
estimated_complexity: small
related_adrs:
  - ADR-0021
  - ADR-0374
related_docs:
  - SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md (canonical, §8 Test Surface)
tags: [e2e, playwright, auth, subdomain, portal-redirect, regression]
---

# Sortie Spec — E2E Portal-Redirect Tests

> **Sortie type:** Sortie (from main `development`)
> **Worktree:** `~/dev/smartout.ai-wt-<N>` (next free slot)
> **Branch:** `feat/e2e-portal-redirect-tests`
> **Estimated:** 2–4 hours
> **Owner:** Claude (code)
> **Trust gate:** All new specs pass against a fresh preview deploy with no regressions in existing F1–F10 suite

---

## 1. Goal

Lock in ADR-0374 behavior with three Playwright specs so a future refactor of `proxy.ts` cannot silently break the workspace → portal redirect class. Catches regressions before they reach prod (where they look like `Invalid_link` to end users).

## 2. Why now

- ADR-0374 just landed and has zero test coverage beyond manual smoke.
- The auth-invitation E2E suite (F1–F10) covers happy-path login/signup/reset/invite but NONE exercise the workspace-subdomain redirect.
- Recurring failure class: a developer adds a new auth route, forgets to add it to `AUTH_ROUTES_REDIRECT_TO_PORTAL`, and the new route silently runs on workspace subdomains until prod surfaces a PKCE failure. Tests close this gap.

## 3. Non-goals

- Mobile E2E (different test infra entirely — Playwright doesn't run iOS/Android natively).
- Performance/load testing.
- Visual regression.
- Tests requiring real Google OAuth credentials (use mock IDP or assert pre-Google behavior only).

## 4. Acceptance criteria

- [ ] `apps/e2e/tests/auth-invitation/F11-portal-redirect-workspace-subdomain.spec.ts` created and passing.
- [ ] `apps/e2e/tests/auth-invitation/F12-callback-continue-validation.spec.ts` created and passing.
- [ ] `apps/e2e/tests/auth-invitation/F13-portal-redirect-negative.spec.ts` created and passing.
- [ ] Existing F1–F10 suite still green (no regression).
- [ ] Tests run as part of `pnpm --filter e2e test:e2e` (default config).
- [ ] At least one assertion per spec validates the `continue=<slug>` parameter is correctly preserved.
- [ ] Helper added to `apps/e2e/helpers/` if any non-trivial shared logic emerges.
- [ ] HANDOFF written.
- [ ] Typecheck pass on `apps/e2e`.

## 5. Test catalog

### F11 — workspace-subdomain → portal redirect (positive)

For each auth route, hitting `https://<slug>.<root>/<path>` returns 307 (or follows automatically) to `https://app.<root>/<path>?continue=<slug>`.

Tested paths:
- `/login`
- `/signup`
- `/join`
- `/reset-password`
- `/update-password`
- `/invite/test-token-123`
- `/confirm-email`
- `/select-workspace`
- `/welcome`

Each as a separate `test()` inside the `describe("workspace-subdomain auth routes redirect to portal")` block, parameterised via `test.describe.parallel` or `for (const path of paths)`.

Skeleton:
```ts
import { test, expect } from "@playwright/test";

const AUTH_ROUTES = [
  "/login", "/signup", "/join", "/reset-password",
  "/update-password", "/invite/test-token-123",
  "/confirm-email", "/select-workspace", "/welcome",
];

const WORKSPACE_SLUG = "acme";
const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? "smartout.ai";

for (const path of AUTH_ROUTES) {
  test(`workspace subdomain ${path} 307s to portal with continue=`, async ({ request }) => {
    const url = `https://${WORKSPACE_SLUG}.${ROOT_DOMAIN}${path}`;
    const res = await request.fetch(url, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const location = res.headers()["location"];
    expect(location).toContain(`https://app.${ROOT_DOMAIN}${path}`);
    expect(location).toContain(`continue=${WORKSPACE_SLUG}`);
  });
}
```

### F12 — callback `continue` validation (positive + boundary)

Tests the `resolveContinueDestination` logic in `apps/web/src/app/api/auth/callback/route.ts`. Requires either:
- (A) Mocking the Supabase exchange step (intercept `supabase.auth.exchangeCodeForSession`)
- (B) Setting up a real test user with profiles in known workspace slugs (E2E_TEST_USER_ID + E2E_TEST_WORKSPACE_SLUGS env)

**Recommend (B)** for fidelity, with seed data in `apps/e2e/helpers/auth-fixtures.ts` referencing `supabase/seed.sql` test users.

Cases:
1. User has profile in workspace `acme`, `?continue=acme` → final landing `acme.smartout.ai/dashboard`
2. User has profile in `acme`, `?continue=ghost` (workspace doesn't exist) → portal `/dashboard`
3. User has NO profile in `victim`, `?continue=victim` → portal `/dashboard` (not victim.smartout.ai)
4. `?continue=` malformed (uppercase, special chars, path injection) → portal `/dashboard`
5. No `continue` param → portal `/dashboard`

### F13 — portal-redirect negative tests

Things that MUST NOT redirect:
- `/api/auth/callback?code=...` on workspace subdomain → MUST stay on workspace host (PKCE verifier cookie scope)
- `/dashboard/...` on workspace subdomain → no redirect (workspace's own page)
- `/login` on portal — no infinite redirect to itself
- `/login` on localhost — no redirect (single-host dev)
- Reserved subdomain like `docs.smartout.ai/login` — pass through (handled by reserved-subdomain branch, NOT portal-redirect)

## 6. Test infrastructure decisions

### 6.1 Where to run tests

Default config `apps/e2e/playwright.config.ts` already has `baseURL` and Vercel preview targeting. F11–F13 should run against:
- Local dev OR Vercel preview deploy
- NEVER against production (open-redirect probe is benign but test users + cookies are a concern)

Add `E2E_ROOT_DOMAIN` env var to playwright config; defaults to `smartout.ai`. Local dev set to `localhost:3060` skips F11–F13 (use `test.skip()` when ROOT_DOMAIN doesn't contain a dot).

### 6.2 Test data

For F12, need at minimum:
- One test workspace with slug `e2e-acme`
- One test user with profile in `e2e-acme`
- Same user has NO profile in workspace `e2e-victim` (which exists but is foreign)
- One non-existent slug like `e2e-ghost`

Seed via `supabase/seed.sql` extension OR runtime setup helper in `apps/e2e/global-setup.ts`.

### 6.3 OAuth flow testing

F12 doesn't need Google. It can hit `/api/auth/callback?code=fakecode&continue=acme` directly with a mocked Supabase session. Use Playwright route-mocking to intercept the Supabase token endpoint OR pre-seed a valid session token via a test-only Supabase admin call.

**Recommend:** test-only signed JWT helper in `apps/e2e/helpers/auth-jwt.ts` that calls `supabase.auth.admin.generateLink({type:"recovery"|"magic_link"})` against the local Supabase instance to get a real session, then the callback can run against a real Supabase backend without involving Google.

## 7. Tasks

### T1 — Helper utilities

`apps/e2e/helpers/portal-redirect.ts` — shared assertions:
- `expectPortalRedirect(response, expectedPath, expectedSlug)` — encapsulates the 307 + Location + continue param check
- `withWorkspaceSubdomain(slug, path)` — builds the workspace URL

### T2 — F11 portal-redirect positive

Per skeleton in §5. Parameterise over `AUTH_ROUTES`.

### T3 — F12 callback continue validation

Requires §6.2 seed helpers. 5 cases in §5.

### T4 — F13 negative tests

Per §5.

### T5 — Playwright config env

Add `E2E_ROOT_DOMAIN` to `apps/e2e/playwright.config.ts` env passthrough + sample in `.env.template`.

### T6 — CI wiring

Verify the new specs run in the existing `auth-invitation` suite by listing them in `apps/e2e/runners/auth-invitation.ts` if such a runner exists; otherwise default Playwright glob picks them up.

### T7 — HANDOFF + close-feature

`docs/HANDOFF-e2e-portal-redirect-tests.md` + run close-feature.sh.

## 8. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Tests run against prod by accident | Hard-coded `E2E_ROOT_DOMAIN` check + Playwright baseURL guard + CI assertion that `baseURL` includes `preview` or `localhost` |
| Test users pollute prod data | All seed data prefixed `e2e-*`; CI cleanup hook deletes `e2e-*` rows post-run |
| Wildcard DNS for `*.smartout.ai` not configured on preview branch | Preview deploy uses generated `*-preview-*.vercel.app` host. F11–F13 may need `host: "<slug>.smartout-web-git-feature-<sha>.vercel.app"` — needs Playwright `extraHTTPHeaders` host override |
| F12 flaky due to seed-data setup race | `global-setup.ts` runs sequentially; idempotent inserts; ORDER BY created_at to detect missing fixtures |

## 9. Open questions

1. Vercel preview deploys don't have wildcard subdomain support out of the box — testing `acme.smartout.ai` on preview requires either (a) custom preview-only DNS or (b) `Host:` header override. Resolution: use (b) for F11 (request-level header), skip F12-F13 on preview (require prod-like wildcard).
2. Should F11 also probe the negative cases (workspace subdomain on `/dashboard/*` does NOT redirect)? Resolution: covered by F13.
3. Long-term: add F11–F13 to `infra/scripts/smoke-probe.sh` as cheap HTTP probes (no Playwright, just `curl -I -L`)? Resolution: yes, follow-up sortie.

## 10. References

- Canonical: `docs/architecture/SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md` §8
- ADR-0374
- Existing suite: `apps/e2e/tests/auth-invitation/F1–F10`
- Helper conventions: `apps/e2e/helpers/`
- Playwright config: `apps/e2e/playwright.config.ts`
