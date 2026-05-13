---
title: "Journey — analyze-workspace rejects unauthenticated callers"
feature: audit-fef05-analyze-workspace-auth
journey: anon-rejected
status: verified
verified_at: 2026-05-14
e2e_test: supabase/functions/analyze-workspace/auth_test.ts
created: 2026-05-14
updated: 2026-05-14
module: onboarding
tags: [journey, edge-function, auth, f-ef-05]
---

# Journey: analyze-workspace EF gates anonymous callers

**Role:** anonymous caller (attacker) vs legitimate server-internal caller (web BFF)

**Precondition:** F-EF-05 fix shipped. `verify_jwt=false` in config.toml (correct — service-role bearer
pattern, not JWT passthrough). `verifyInternalAuth` applied at handler entry point.

**Caller context determined:** server-internal (post-workspace-provisioning). `onboarding_session` RLS
uses `auth.uid() = user_id` — JWT-scoped — confirming non-pre-workspace path. ADR-0123 exception does NOT
apply. Service-role gate (ADR-0029 + `verifyInternalAuth`) is the correct fix.

## Happy Path (attack prevented)

1. Anonymous caller POSTs `analyze-workspace` without a valid `SUPABASE_SERVICE_ROLE_KEY` Bearer token
2. `verifyInternalAuth(req)` returns `{ ok: false, response: Response(401) }` before any try-block
3. Handler returns `{ "error": "unauthorized" }` with status 401
4. No `onboarding_session` row touched. No DB side-effect.

## Happy Path (legitimate server-internal caller)

5. Web BFF attaches `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` to the request
6. `verifyInternalAuth(req)` returns `{ ok: true }`
7. Handler creates service-role Supabase client, validates `sessionId` from body
8. AI analysis (currently mock) generated and written to `onboarding_session` row via service-role client
9. Response: `{ success: true, ai_analysis: { ... } }`

**Postcondition:** No anon writes to `onboarding_session`. Legitimate server-side flow unbroken.

## Verification

- [x] config.toml `verify_jwt = false` retained — matches service-role bearer pattern (same as `gather-workspace-intelligence`)
- [x] Deno test: `verifyInternalAuth` called before try-block (S4 — auth gate ordering)
- [x] Deno test: rejection branch returns `authResult.response` (S4 — anon → 401)
- [x] Deno test: DB client uses `SUPABASE_SERVICE_ROLE_KEY` not `SUPABASE_ANON_KEY` (S5 — golden path)
- [x] Deno test: ADR-0029 reference comment present (S2)
- [x] Deno test: `sessionId` validated as non-empty string before DB write (S3-equivalent input validation)
- [x] Synthesis F-EF-05 → CLOSED (see docs/audits/2026-05-14-adr-contract-validation/00-SUMMARY.md)
- [x] `pnpm --filter web typecheck` → 0 errors

5/5 tests pass. `deno test --allow-read supabase/functions/analyze-workspace/auth_test.ts`
