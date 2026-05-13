---
title: "Journey — Attacker forges workspace_id on UPDATE rejected"
feature: sortie-a2-d6-rls-with-check
journey: attacker-forges-workspace-id-rejected
status: verified
verified_at: 2026-05-13
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [journey, rls, security]
---

# Journey: Attacker forges workspace_id on UPDATE — rejected

**Role:** member of multiple workspaces (admin or manager in both)

**Precondition:** User has profile rows in workspace A and workspace B. Existing row in `department_session` (or `session_hook`, or `personal_task`) in workspace A.

## Happy Path (attacker prevented)

1. Attacker authenticates as user → JWT carries identity but workspace context is per-request
2. Attacker issues `UPDATE department_session SET workspace_id = '<workspace_B_id>' WHERE id = '<workspace_A_row>'` from PostgREST/Supabase client
3. Postgres evaluates UPDATE policy → USING passes (row is in workspace A which user belongs to) → WITH CHECK evaluates new row state → workspace_id now `<workspace_B_id>` → WITH CHECK requires `auth.uid()` to belong to that workspace via `is_member_of_workspace()` → false → policy fails
4. Postgres returns `42501 new row violates row-level security policy`
5. No row mutated. Audit log captures attempt via PostgREST 403.

**Postcondition:** Row in workspace A unchanged. No cross-workspace data leak. No new row in workspace B.

## Error Paths

- **Same user is manager in BOTH workspaces** — current policy allows it (legitimate move). Verify this in test fixtures: forge-with-membership is the boundary, not forge-without-membership.
- **Bulk UPDATE across rows in mixed workspaces** — Postgres evaluates WITH CHECK per row; mixed batches partially succeed/fail. Document via pgTAP that failure mode is per-row not whole-statement-rollback.

## Verification

- [ ] Implementation matches the steps above (per-verb policies with WITH CHECK matching USING)
- [ ] E2E test exists and passes — pgTAP `supabase/tests/rls/sortie_a2_<table>.sql`
- [ ] Manually tested via psql with two-workspace fixture from `seed.sql`

Applies to: `department_session`, `session_hook`, `personal_task`. (`deviation` covered by separate role-gate journey.)

**Mark `status: verified` in frontmatter when all three boxes are checked.**
