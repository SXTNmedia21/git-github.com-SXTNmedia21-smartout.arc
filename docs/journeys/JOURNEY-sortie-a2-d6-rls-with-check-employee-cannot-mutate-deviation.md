---
title: "Journey — Employee cannot mutate deviation (role gate added)"
feature: sortie-a2-d6-rls-with-check
journey: employee-cannot-mutate-deviation
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [journey, rls, security, deviation, role-gate]
---

# Journey: Employee-tier user cannot mutate deviation

**Role:** employee (lowest tier in `company_member.role`)

**Precondition:** User is `role = employee` in workspace A. Existing `deviation` row in workspace A. Pre-A.2 state allowed any workspace member to INSERT/UPDATE/DELETE on `deviation` (no role gate at all).

## Happy Path (role gate enforces)

1. Employee opens day-control view → sees deviation row (SELECT still allowed for any member — read transparency)
2. Employee attempts to attribute deviation to a different shift via `UPDATE deviation SET shift_id = '<other>' WHERE id = '<row>'`
3. Postgres evaluates UPDATE policy → role check `is_manager_or_above_in_workspace(auth.uid(), workspace_id)` → false → policy fails
4. Postgres returns `42501`
5. Same for INSERT (employee attempts to fabricate deviation) and DELETE (employee attempts to suppress deviation)

**Postcondition:** Deviation row unchanged. Employee can read for transparency but cannot mutate. Audit trail unbroken.

## Error Paths

- **App path expects employee writes to deviation** (e.g. self-attestation of late arrival) → council escalation: either lift role gate to "owner or self-attest path uses Server Action with service-role + audit", or split deviation into two tables (manager-attestation vs employee-self-attestation).
- **Employee already wrote deviation rows in pre-A.2 history** — those rows remain. No retroactive enforcement. Document in handoff.

## Verification

- [ ] Implementation matches the steps above (deviation has 4 per-verb policies, INSERT/UPDATE/DELETE gated on `is_manager_or_above_in_workspace`)
- [ ] E2E test exists and passes — pgTAP `supabase/tests/rls/sortie_a2_deviation.sql` (employee throws, manager lives)
- [ ] Manually verified no production app path breaks (T4 audit task in PLAN)

**Mark `status: verified` in frontmatter when all three boxes are checked.**
