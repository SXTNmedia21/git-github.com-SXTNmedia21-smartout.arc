---
title: "Journey — 3 RLS gaps closed (overtime_cap, tips_settings, agent_whisper)"
feature: audit-cleanup-mediums
journey: rls-tightened
status: verified
verified_at: 2026-05-14
e2e_test: null
created: 2026-05-14
updated: 2026-05-14
module: cross-cutting
tags: [journey, rls, ADR-0029, ADR-0299, f-db-13, f-db-14, f-db-15]
---

# Journey: dual-auth + WITH CHECK enforced on 3 tables

**Role:** API-key consumer of workspace-api; attacker probing forge-by-body

**Precondition:** 3 migrations applied.

## Happy Path

1. API-key request reads `overtime_cap_policy` → succeeds via new `api_key_read_*` policy (was: empty result)
2. JWT user UPDATEs `tips_workspace_settings` with forged workspace_id → BLOCKED by WITH CHECK
3. Admin INSERTs `agent_session_whisper` with forged workspace_id → BLOCKED by WITH CHECK (per-verb policies)

**Postcondition:** Dual-auth + sister-sweep WITH CHECK pattern applied consistently.

## Verification

- [ ] Migration `api_key_read_overtime_cap_policy` applies clean
- [ ] Migration `tips_workspace_settings_with_check` applies clean
- [ ] Migration `agent_session_whisper_per_verb` applies clean
- [ ] pgTAP test (or smoke SQL) confirms WITH CHECK rejects forge attempt
- [ ] API-key consumer reads overtime_cap_policy successfully
- [ ] Synthesis F-DB-13/14/15 → CLOSED

**Mark verified when checked.**
