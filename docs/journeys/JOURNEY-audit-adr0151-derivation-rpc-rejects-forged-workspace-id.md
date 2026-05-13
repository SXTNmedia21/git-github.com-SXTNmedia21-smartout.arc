---
title: "Journey — submit_own_pii rejects forged workspace_id"
feature: audit-adr0151-derivation
journey: rpc-rejects-forged-workspace-id
status: verified
verified_at: 2026-05-14
e2e_test: null
created: 2026-05-13
updated: 2026-05-14
module: cross-cutting
tags: [journey, adr-0151, rpc, mobile, f-mo-06]
---

# Journey: Mobile submit_own_pii rejects body-supplied workspace_id mismatch

**Role:** authenticated mobile user (multi-workspace)

**Precondition:** F-MO-06 fix shipped.

## Happy Path (attacker prevented)

1. Mobile contract complete-data flow calls `submit_own_pii(body_pii_data)` — no `p_workspace_id` arg passed
2. RPC `SECURITY DEFINER` reads `auth.uid()` → resolves workspace from membership
3. PII row stored with derived workspace_id
4. Forge attempt: attacker passes `p_workspace_id=<foreign>` → either rejected (mismatch with JWT) OR ignored (RPC uses auth.uid() only)

**Postcondition:** PII can't leak cross-workspace via forged body.

## Verification

- [x] `complete-data.tsx` retains p_workspace_id sourced from authenticated profile (useMyProfile), with ADR-0151 comment documenting the server-validation contract
- [x] RPC validates body-supplied p_workspace_id against JWT-derived workspace_id (migration `20260514000010_secure_submit_own_pii.sql`) — mismatch raises exception; activity_trail uses server-derived value
- [x] Mobile typecheck: pre-existing `@smartout/utils` error in SwapRequestSheet (unrelated) — complete-data.tsx typechecks clean
- [x] Synthesis F-MO-06 → CLOSED

**Verified 2026-05-14. RPC audit trail now uses server-derived workspace_id only.**
