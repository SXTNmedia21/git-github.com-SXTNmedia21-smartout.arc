---
title: "Journey — Recurring ADR-0303 violation caught by CI lint"
feature: audit-fdb12-staff-event-rls
journey: recurring-rule-violation-caught-by-ci
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [journey, ci, lint, adr-0303, governance]
---

# Journey: Future developer ships migration violating ADR-0303 — CI lint blocks PR

**Role:** developer authoring a new migration on workspace-scoped table

**Precondition:** ADR-0303 accepted. `scripts/check-rls-with-check.ts` shipped. `.github/workflows/check-rls.yml` runs on PR.

## Happy Path

1. Developer writes migration `supabase/migrations/<ts>_new_thing.sql` containing:
   ```sql
   CREATE POLICY "jwt_manage_new_thing" ON public.new_thing
     FOR ALL USING (workspace_id IN (...));
   ```
2. Developer opens PR
3. CI workflow `check-rls.yml` runs `scripts/check-rls-with-check.ts`
4. Script parses migration SQL, finds `FOR ALL USING(...)` policy on `workspace_id`-scoped table without WITH CHECK
5. Script exits 1. Workflow fails. PR is blocked.
6. Failure message: "ADR-0303: workspace-scoped table `new_thing` has FOR ALL policy without WITH CHECK. Use per-verb policies with symmetric WITH CHECK on workspace_id. See `supabase/migrations/20260605120000_shift_approval_rls_with_check.sql` for canonical pattern."
7. Developer rewrites migration with per-verb + WITH CHECK pattern
8. PR re-runs lint → exits 0 → merges

**Postcondition:** No new `FOR ALL` no-WITH-CHECK policies land on workspace-scoped tables.

## Error Paths

- **False positive (lint flags an intentional pattern)** — developer can override with `-- @rls-exempt: <ADR-NNNN-rationale>` comment line. Lint respects it but logs to audit-trail.
- **Lint misses a violation** — captured by next `/audit smoke` run, ADR-0303 enforcement improvement loop.

## Verification

- [ ] `scripts/check-rls-with-check.ts` exists + runs from CLI
- [ ] Run against intentional bad fixture: exits 1 with clear message
- [ ] Run against current `staff_event` migration (post-T1 fix): exits 0
- [ ] `.github/workflows/check-rls.yml` job present in workflow list
- [ ] PR-time test: amend an existing PR with bad-policy fixture (or just trust the dry-run)

**Mark `status: verified` when first 4 checked.**
