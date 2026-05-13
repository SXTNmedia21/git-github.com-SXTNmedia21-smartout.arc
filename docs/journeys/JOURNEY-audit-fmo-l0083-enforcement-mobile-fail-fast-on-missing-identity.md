---
title: "Journey — Mobile fails fast on missing identity"
feature: audit-fmo-l0083-enforcement
journey: mobile-fail-fast-on-missing-identity
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: mobile
tags: [journey, fail-fast, getProfileContext]
---

# Journey: Mobile mutation with null workspace_id throws explicitly

**Role:** mobile mutation hook caller

**Precondition:** Remediation applied.

## Happy Path

1. Hook tries to emit with `workspace_id = null`
2. `getProfileContext()` throws "missing workspace_id — login required"
3. Caller surfaces user-friendly error
4. No emit() call with empty string

**Postcondition:** activity_trail unpolluted. Routing intact.

## Verification

- [ ] Mobile vitest: missing-identity scenario throws
- [ ] No emit() in any branch with empty-string fallback
- [ ] ADR-0134 invariant 2 upheld

**Mark verified when checked.**
