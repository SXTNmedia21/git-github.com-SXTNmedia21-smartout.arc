---
title: "Journey — Webhook 500 responses no longer leak DB errors"
feature: audit-webhook-hygiene
journey: error-leak-fixed
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: cross-cutting
tags: [journey, webhook, security, error-leak, f-wh-01, f-wh-02]
---

# Journey: docuseal + livekit webhooks return opaque 500 to caller

**Role:** webhook caller (3rd party)

**Precondition:** F-WH-01 + F-WH-02 fixes shipped.

## Happy Path

1. docuseal webhook hits DB error during update
2. Handler logs full error server-side (console.error)
3. Returns 500 with body `{"error":"internal"}` — no raw PG message
4. livekit-webhook missing env vars → fails-closed 500 with `"missing config"` (no env names leaked)

**Postcondition:** No information leak. Server logs retain detail.

## Verification

- [ ] docuseal 500 body contains no raw DB error message
- [ ] livekit null env → 500 with generic message
- [ ] console.error captures full detail server-side
- [ ] Synthesis F-WH-01 + F-WH-02 → CLOSED

**Mark verified when checked.**
