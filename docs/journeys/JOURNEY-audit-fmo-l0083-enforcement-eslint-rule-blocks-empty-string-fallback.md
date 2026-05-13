---
title: "Journey — ESLint rule blocks empty-string fallback on identifier"
feature: audit-fmo-l0083-enforcement
journey: eslint-rule-blocks-empty-string-fallback
status: verified
verified_at: 2026-05-14
e2e_test: packages/eslint-config/test/no-empty-string-identifier-fallback.test.mjs
created: 2026-05-13
updated: 2026-05-14
module: mobile
tags: [journey, l-0083, eslint, ci]
---

# Journey: Developer ships `?? ""` on identifier — ESLint blocks

**Role:** mobile developer

**Precondition:** rule shipped + wired.

## Happy Path

1. Dev writes `workspace_id = profile?.workspace_id ?? ""`
2. ESLint runs (local + CI)
3. Rule `smartout/no-empty-string-identifier-fallback` fires:
   "L-0083: empty-string fallback on identifier `workspace_id` silently corrupts activity_trail + engine_event routing. Use `getProfileContext()` (mobile) or upstream guard — fail fast on missing identity. ADR-0134 Invariant 2."
4. PR blocked by `.github/workflows/eslint-mobile.yml` (path-filtered on `apps/mobile/**`).

**Postcondition:** No new L-0083 sites land.

## Verification

- [x] Rule fires on fixture
      (see `packages/eslint-config/test/no-empty-string-identifier-fallback.test.mjs`,
      13 invalid samples, 13 valid samples — `pnpm --filter @smartout/eslint-config test`).
- [x] Lint runs in CI workflow
      (`.github/workflows/eslint-mobile.yml` runs `pnpm --filter @smartout/mobile lint`
      + a belt-and-braces grep guard).
- [x] Override pattern documented (test fixtures + `profile-context.ts` self-doc)
      via `ALLOW_LIST_PATTERNS` in `packages/eslint-config/plugins/smartout/rules/no-empty-string-identifier-fallback.mjs`.

**Verified 2026-05-14.**
