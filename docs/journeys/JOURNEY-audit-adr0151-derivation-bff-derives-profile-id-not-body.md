---
title: "Journey — BFF derives profileId from JWT, ignores body"
feature: audit-adr0151-derivation
journey: bff-derives-profile-id-not-body
status: verified
verified_at: 2026-05-14
e2e_test: apps/web/src/app/api/botsson/chat/__tests__/route.test.ts
created: 2026-05-13
updated: 2026-05-14
module: cross-cutting
tags: [journey, adr-0151, bff, derivation, se-02-01]
---

# Journey: botsson/chat BFF derives profileId from JWT, body value ignored

**Role:** authenticated user → BFF → LLM

**Precondition:** SE-02-01 fix shipped.

## Happy Path

1. User chat request hits `/api/botsson/chat`
2. Route handler reads JWT → derives `profileId_server`
3. Body may carry `primeContext.profileId` (or not) → IGNORED for identity
4. LLM system prompt interpolates `profileId_server` (derived)
5. Forge attempt: admin sends body.primeContext.profileId="<fake>" → derived value still wins
6. LLM sees correct caller identity

**Postcondition:** ADR-0151 spirit upheld. LLM context integrity preserved.

## Verification

- [x] `api/botsson/chat/route.ts` no longer reads body.primeContext.profileId into prompt — server verifies against workspace DB before interpolating
- [x] Vitest: forged body value IGNORED, derived used — 5 tests pass (`route.test.ts`)
- [x] Synthesis SE-02-01 → CLOSED

**Verified 2026-05-14. All checks passed.**
