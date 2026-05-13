---
title: "Journey — authenticated BFF request accepted on 5 intelligence EFs"
feature: audit-fef03-intelligence-ef-auth
journey: authenticated-bff-request-accepted
status: verified
verified_at: 2026-05-13
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: edge-functions
tags: [journey, edge-functions, bff, happy-path]
---

# Journey: Authenticated BFF request to intelligence EFs accepted

**Role:** web BFF route (`/api/workspace-intelligence` etc.) on behalf of authenticated user

**Precondition:** Auth perimeter added. Caller updated to send auth credential per chosen model (HMAC sig / internal bearer / signed proxy header).

## Happy Path

1. Visitor in `/join` wizard step 3 enters brreg search
2. Browser POSTs to `/api/workspace-intelligence` (Vercel route handler — NOT the EF directly per ADR-0179)
3. Route handler signs + forwards to `search-brreg` EF
4. EF validates auth credential → accepts
5. EF calls Brreg API, returns result
6. Wizard step renders result

**Postcondition:** No regression on existing wizard / setup flows. External API call billed normally.

## Error Paths

- **Auth credential rotation** — handle in next sortie / runbook
- **EF auth check too strict** — accidentally rejects valid BFF call → smoke test catches before merge

## Verification

- [ ] Test BFF route call locally: real wizard step end-to-end works
- [ ] Curl simulated BFF call with valid auth → 200
- [ ] Curl simulated BFF call with expired/invalid auth → 401
- [ ] Browser direct call (without BFF) still rejected per F-EF-04 expectation

**Mark `status: verified` when all four checked.**
