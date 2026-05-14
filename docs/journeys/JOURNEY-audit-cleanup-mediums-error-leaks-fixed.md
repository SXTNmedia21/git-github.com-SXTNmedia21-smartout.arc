---
title: "Journey — 3 Edge Functions stop leaking error details"
feature: audit-cleanup-mediums
journey: error-leaks-fixed
status: draft
verified_at: null
e2e_test: null
created: 2026-05-14
updated: 2026-05-14
module: cross-cutting
tags: [journey, edge-function, error-leak, f-ef-06, f-ef-07, f-ef-08]
---

# Journey: activate-workspace + heartbeat-dispatcher + google-places-intelligence return opaque errors

**Role:** 3rd-party / unauthenticated caller hitting failing path

**Precondition:** F-EF-06/07/08 fixes shipped.

## Happy Path

1. activate-workspace catches DB/runtime exception → returns 500 `{"error":"internal"}` (no raw PG string)
2. heartbeat-dispatcher same — full detail in `console.error` only
3. google-places-intelligence exception → HTTP 500 `{"success":false,"error":"internal"}` (was HTTP 200 + leaked string)

**Postcondition:** No information leak in 500 responses. Server logs retain detail.

## Verification

- [ ] activate-workspace 500 body has no `error.message` string
- [ ] heartbeat-dispatcher 500 same
- [ ] google-places-intelligence: HTTP code is 500 on exception, body opaque
- [ ] console.error captures full detail on all 3
- [ ] Synthesis F-EF-06/07/08 → CLOSED

**Mark verified when checked.**
