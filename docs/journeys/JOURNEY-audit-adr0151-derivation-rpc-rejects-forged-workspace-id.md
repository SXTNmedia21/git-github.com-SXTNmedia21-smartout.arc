---
title: "Journey — submit_own_pii rejects forged workspace_id"
feature: audit-adr0151-derivation
journey: rpc-rejects-forged-workspace-id
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
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

- [ ] `complete-data.tsx` no longer passes body-supplied p_workspace_id
- [ ] RPC derives workspace from auth.uid() OR validates body matches JWT
- [ ] Mobile smoke: complete-data flow still works
- [ ] Synthesis F-MO-06 → CLOSED

**Mark verified when checked.**
