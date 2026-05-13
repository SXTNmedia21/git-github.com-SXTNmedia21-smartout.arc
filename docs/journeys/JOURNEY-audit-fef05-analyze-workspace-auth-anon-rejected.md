---
title: "Journey — analyze-workspace rejects unauthenticated callers"
feature: audit-fef05-analyze-workspace-auth
journey: anon-rejected
status: draft
verified_at: null
e2e_test: null
created: 2026-05-14
updated: 2026-05-14
module: onboarding
tags: [journey, edge-function, auth, f-ef-05]
---

# Journey: analyze-workspace EF gates anonymous callers

**Role:** anonymous caller (attacker) vs legitimate /join user

**Precondition:** F-EF-05 fix shipped. Either `verify_jwt=true` OR ADR-0123 pre-workspace allowlist with session-token scope.

## Happy Path (attack prevented)

1. Anonymous caller POSTs `analyze-workspace` without JWT and without valid pre-workspace session token
2. Handler rejects: 401 (or 403 if invalid session-token) — `{ "error": "unauthorized" }`
3. No `onboarding_session` row created. No DB side-effect.

## Happy Path (legitimate caller)

4. /join wizard user with valid pre-workspace session token (or authenticated user, depending on chosen path) POSTs
5. Handler authenticates → proceeds → creates `onboarding_session` row scoped to caller
6. Response: success envelope with workspace draft

**Postcondition:** No anon writes to `onboarding_session`. Legitimate flow unbroken.

## Verification

- [ ] config.toml `verify_jwt` flag matches handler expectation
- [ ] Vitest: anon call → 401/403, no DB write
- [ ] Vitest: legitimate call → 200, DB row created
- [ ] If pre-workspace path: RLS scoped to session-token, not blanket anon
- [ ] Synthesis F-EF-05 → CLOSED with commit SHA

**Mark verified when checked.**
