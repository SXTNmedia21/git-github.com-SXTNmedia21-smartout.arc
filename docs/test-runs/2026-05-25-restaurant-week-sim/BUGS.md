---
title: Restaurant Week Sim — Bug List (2026-05-25)
status: in_progress
updated: 2026-07-01
created: 2026-05-25
module: security
tags: [bugs, capability-authority, cve-class, restaurant-week-sim, ADR-0421]
---

# Restaurant Week Sim — Bugs Found (2026-05-25)

Council session 2026-05-25. ADR-0421 sub-check C-G identified 13 capabilities
lacking `capability_default_registry` entries. All 13 create a CVE-class
default-allow security hole on every new workspace created after 2026-06-01
(L-0066 pattern: gate_action silently allows any caller when no authority row
exists for the capability).

Source: `supabase/migrations/20260518000000_contract_authority_seed_upsert_and_bootstrap.sql`
lines 235-244 (self-documenting comment).

---

## CVE-class gaps (L-0066 default-allow family)

### BUG-A4-02 — `kb_query` not seeded in `capability_default_registry` — FIXED

- **Severity:** CVE-class (L-0066 default-allow on new workspaces)
- **Capability:** `kb_query` (packages/ai/src/capabilities/kb_query/)
- **Effect:** Bootstrap trigger skips this capability → no `engine_authority_config`
  row → `gate_action` default-allows all callers on new workspaces.
- **Fix:** `supabase/migrations/20260701000000_capability_registry_seed_sweep.sql`
  Part A cap 1 + Part B.1. Authority: `read_only / employee`.
- **Status:** FIXED in commit `<sha>` (see git log)

---

### BUG-A4-03 — `schedule` not seeded in `capability_default_registry` — FIXED

- **Severity:** CVE-class (L-0066)
- **Capability:** `schedule`
- **Effect:** New workspaces have no authority row → default-allow on all shift queries.
- **Fix:** Migration `20260701000000` Part A cap 2 + Part B.2. Authority: `read_only / employee`.
- **Status:** FIXED in commit `<sha>`

---

### BUG-A4-04 — `training` not seeded in `capability_default_registry` — FIXED

- **Severity:** CVE-class (L-0066)
- **Capability:** `training`
- **Effect:** New workspaces have no authority row → default-allow on `getTeamReadiness`
  (team-level PII) without any gate.
- **Fix:** Migration `20260701000000` Part A cap 3 + Part B.3. Authority: `suggest / employee`.
- **Status:** FIXED in commit `<sha>`

---

### BUG-A4-05 — `operations` not seeded in `capability_default_registry` — FIXED

- **Severity:** CVE-class (L-0066)
- **Capability:** `operations`
- **Effect:** New workspaces have no authority row → `createDeviation` write bypasses
  gate_action authority check (still calls gate_action, but no row means unseeded
  default-allow on the authority layer).
- **Fix:** Migration `20260701000000` Part A cap 4 + Part B.4. Authority: `suggest / employee`.
- **Status:** FIXED in commit `<sha>`

---

### BUG-A4-06 — `profile` not seeded in `capability_default_registry` — FIXED

- **Severity:** CVE-class (L-0066)
- **Capability:** `profile`
- **Effect:** New workspaces have no authority row → `searchProfilesByName` (team PII)
  and `getContractStatus` exposed without authority gate.
- **Fix:** Migration `20260701000000` Part A cap 5 + Part B.5. Authority: `read_only / employee`.
- **Status:** FIXED in commit `<sha>`

---

### BUG-A4-07 — `memory` not seeded in `capability_default_registry` — FIXED

- **Severity:** CVE-class (L-0066)
- **Capability:** `memory`
- **Effect:** New workspaces have no authority row → `saveMemoryTool` write bypasses
  authority tier-unlock (though gate_action still runs, authority is unseeded = default-allow).
- **Fix:** Migration `20260701000000` Part A cap 6 + Part B.6. Authority: `suggest / employee`.
- **Status:** FIXED in commit `<sha>`

---

### BUG-A4-08 — `ui` not seeded in `capability_default_registry` — FIXED

- **Severity:** CVE-class (L-0066)
- **Capability:** `ui`
- **Effect:** New workspaces have no authority row → all UI tools (navigate, fill, highlight,
  showPanel, toast) exposed without authority gate on new workspaces.
- **Fix:** Migration `20260701000000` Part A cap 7 + Part B.7. Authority: `suggest / employee`.
- **Status:** FIXED in commit `<sha>`

---

### BUG-A4-09 — `contract_intake` not seeded in `capability_default_registry` — FIXED

- **Severity:** CVE-class HIGH (L-0066 + PII)
- **Capability:** `contract_intake`
- **Effect:** New workspaces have no authority row → `submitFieldGroup` (collects
  personnummer + bank account) and `declineIntake` bypass authority gate entirely.
  PII-bearing mutation without gate = highest severity in this sweep.
- **Fix:** Migration `20260701000000` Part A cap 8 + Part B.8. Authority: `confirm / employee`.
- **Status:** FIXED in commit `<sha>`

---

### BUG-A4-10 — `shift_swap` not seeded in `capability_default_registry` — FIXED

- **Severity:** CVE-class (L-0066)
- **Capability:** `shift_swap`
- **Effect:** New workspaces have no authority row → `requestSwap`, `respondToSwap`,
  `cancelSwap` bypass authority gate. `overrideSwapPipeline` (admin-only) also exposed.
- **Fix:** Migration `20260701000000` Part A cap 9 + Part B.9. Authority: `suggest / employee`.
- **Status:** FIXED in commit `<sha>`

---

### BUG-A4-11 — `shift_lifecycle` not seeded in `capability_default_registry` — FIXED

- **Severity:** CVE-class (L-0066)
- **Capability:** `shift_lifecycle`
- **Effect:** New workspaces have no authority row → `publishShift` and `approveShift`
  (manager-level mutations) bypass authority tier check.
- **Fix:** Migration `20260701000000` Part A cap 10 + Part B.10. Authority: `suggest / manager`.
- **Status:** FIXED in commit `<sha>`

---

### BUG-A4-12 — `governance` not seeded in `capability_default_registry` — FIXED

- **Severity:** CVE-class (L-0066)
- **Capability:** `governance`
- **Effect:** New workspaces have no authority row → `checkReadiness` (employee PII —
  profile_id → missing protocols) exposed without authority gate.
- **Fix:** Migration `20260701000000` Part A cap 11 + Part B.11. Authority: `read_only / employee`.
- **Status:** FIXED in commit `<sha>`

---

### BUG-A4-13 — `communication` registry gap (cross-reference)

- **Severity:** CVE-class (L-0066) — FIXED SEPARATELY
- **Capability:** `communication`
- **Note:** Was item 1 of the original 13. Fixed in ADR-0413 / migration `20260626000000`.
  Not in scope for this sweep migration. Included here for completeness of the sweep record.
- **Status:** FIXED in `20260626000000_capability_default_registry_communication.sql`

---

### BUG-A4-14 — `payroll` registry gap (cross-reference)

- **Severity:** CVE-class (L-0066) — FIXED SEPARATELY
- **Capability:** `payroll`
- **Note:** Was item 2 of the original 13. Fixed in migration `20260519160000` (ADR-0234).
  Not in scope for this sweep migration. Included here for completeness of the sweep record.
- **Status:** FIXED in `20260519160000_payroll_capability_authority_seed.sql`

---

## Summary

| Bug | Capability | Authority chosen | Fixed |
|---|---|---|---|
| BUG-A4-02 | `kb_query` | read_only / employee | 20260701000000 |
| BUG-A4-03 | `schedule` | read_only / employee | 20260701000000 |
| BUG-A4-04 | `training` | suggest / employee | 20260701000000 |
| BUG-A4-05 | `operations` | suggest / employee | 20260701000000 |
| BUG-A4-06 | `profile` | read_only / employee | 20260701000000 |
| BUG-A4-07 | `memory` | suggest / employee | 20260701000000 |
| BUG-A4-08 | `ui` | suggest / employee | 20260701000000 |
| BUG-A4-09 | `contract_intake` | confirm / employee | 20260701000000 |
| BUG-A4-10 | `shift_swap` | suggest / employee | 20260701000000 |
| BUG-A4-11 | `shift_lifecycle` | suggest / manager | 20260701000000 |
| BUG-A4-12 | `governance` | read_only / employee | 20260701000000 |
| BUG-A4-13 | `communication` | suggest / employee | 20260626000000 (ADR-0413) |
| BUG-A4-14 | `payroll` | confirm / admin | 20260519160000 (ADR-0234) |

All 13 original gaps closed as of commit `<sha>` (20260701000000 migration).
