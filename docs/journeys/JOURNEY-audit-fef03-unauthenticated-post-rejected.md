---
title: "Journey — unauthenticated POST rejected on 5 intelligence EFs"
feature: audit-fef03-intelligence-ef-auth
journey: unauthenticated-post-rejected
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: edge-functions
tags: [journey, security, edge-functions, f-ef-03]
---

# Journey: Unauthenticated POST to intelligence EFs rejected

**Role:** attacker / quota-burner

**Precondition:** 5 intelligence EFs deployed with new auth perimeter (per T2). Audit baseline 2026-05-13 had them accepting any POST.

## Happy Path (attacker prevented)

1. Attacker runs `curl -X POST https://<project>.supabase.co/functions/v1/gather-workspace-intelligence -H 'Content-Type: application/json' -d '{...}'`
2. Auth perimeter rejects: 401 with body `{"error":"Unauthorized"}`
3. No external API call made (no Scrapling/Serper/Google Places/Brreg quota consumed)
4. Telemetry event `edge_function.auth_failure` emitted with EF name + IP hash
5. Same for `google-places-intelligence`, `web-search-intelligence`, `scrape-website`, `search-brreg`

**Postcondition:** All 5 EFs return 401 to unauthed callers. Money vector closed. Audit synthesis F-EF-03 → CLOSED.

## Error Paths

- **EF returns 200 with empty body** — auth failed open, partial regression. Re-verify pattern integrity.
- **EF returns 500** — handler crash, not auth rejection. Investigate.
- **Auth bypass via Authorization-header probing** — auth check is presence-only not value-validated. Re-audit pattern.

## Verification

- [ ] curl unauthed POST to each of 5 EFs → 401
- [ ] curl with bogus Authorization header → 401
- [ ] Supabase logs show no external API call from unauth POST
- [ ] Telemetry registry has `edge_function.auth_failure` event

**Mark `status: verified` when all four checked.**
