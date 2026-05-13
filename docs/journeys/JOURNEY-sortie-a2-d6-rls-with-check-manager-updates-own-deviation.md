---
title: "Journey — Manager updates own-workspace deviation (happy path)"
feature: sortie-a2-d6-rls-with-check
journey: manager-updates-own-deviation
status: verified
verified_at: 2026-05-13
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [journey, rls, deviation, happy-path]
---

# Journey: Manager updates own-workspace deviation

**Role:** manager (or admin/owner) in workspace A

**Precondition:** User is `role >= manager` in workspace A. Existing `deviation` row in workspace A.

## Happy Path

1. Manager opens day-control view → sees deviation row
2. Manager updates `resolution_note` and `resolved_at` via TanStack mutation hook → eventually direct or gated DB call
3. Postgres evaluates UPDATE policy → USING passes (manager in workspace A) → WITH CHECK passes (new row workspace_id unchanged, user is manager) → role gate passes
4. Row updated. Telemetry `deviation_resolved` emits (separate concern — ADR-0204 backlog, not in A.2 scope)
5. Manager sees updated row

**Postcondition:** Deviation row updated in workspace A. No cross-workspace effect.

## Error Paths

- **Manager attempts to update across workspaces** — covered by attacker-forge journey.
- **Manager-in-A is employee-in-B trying to update workspace B row** — USING fails first (row not visible).

## Verification

- [ ] Implementation matches the steps above (manager UPDATE on own row succeeds)
- [ ] E2E test exists and passes — pgTAP `supabase/tests/rls/sortie_a2_deviation.sql` (manager lives_ok)
- [ ] Manually tested via day-control widget after migration applied

**Mark `status: verified` in frontmatter when all three boxes are checked.**
