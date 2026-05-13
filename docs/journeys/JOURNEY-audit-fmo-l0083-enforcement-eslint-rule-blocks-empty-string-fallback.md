---
title: "Journey — ESLint rule blocks empty-string fallback on identifier"
feature: audit-fmo-l0083-enforcement
journey: eslint-rule-blocks-empty-string-fallback
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: mobile
tags: [journey, l-0083, eslint, ci]
---

# Journey: Developer ships `?? ""` on identifier — ESLint blocks

**Role:** mobile developer

**Precondition:** rule shipped + wired.

## Happy Path

1. Dev writes `workspace_id = profile?.workspace_id ?? ""`
2. ESLint runs (local + CI)
3. Rule `@smartout/no-empty-string-fallback-on-id` fires: "L-0083: empty-string fallback on identifier `workspace_id` silently corrupts activity_trail. Use getProfileContext() throw or upstream guard."
4. PR blocked

**Postcondition:** No new L-0083 sites land.

## Verification

- [ ] Rule fires on fixture
- [ ] Lint runs in CI workflow
- [ ] Override pattern documented (test fixtures only)

**Mark verified when checked.**
