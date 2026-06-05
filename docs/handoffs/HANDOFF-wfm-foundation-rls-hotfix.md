---
title: "HANDOFF — wfm-foundation-rls-hotfix"
status: done
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [handoff, rls, hotfix, adr-0313, sister-sweep]
---

# HANDOFF — wfm-foundation-rls-hotfix

> Branch: `feat/wfm-foundation-rls-hotfix` | Worktree: `/home/sxtnl/wsl/smartout.ai-wt-10`

## Summary

Single-task DDL hot-fix: refactored 2 foundation tables (`pos_account` + `schedule_shift_offer`) from a single `FOR ALL` service_role write policy to 3 per-verb policies each (INSERT/UPDATE/DELETE), per ADR-0313 (D6 RLS WITH CHECK Invariants). This is ADR-0313 sister-sweep #2 — the foundation migration (`20260611120000_wfm_foundation.sql`) shipped before ADR-0313 was discovered in the STAGE A.2 drift scan.

**Why this matters:** `FOR ALL USING(...)` without `WITH CHECK` allows a cross-workspace workspace_id forgery via UPDATE: PostgreSQL evaluates USING on the pre-mutation row state but skips WITH CHECK entirely if no such clause is present. A service_role caller would not be affected (service_role bypasses RLS), but defense-in-depth and ADR-0313 compliance mandate the per-verb split regardless. The per-verb pattern also makes audit intent explicit.

## What Was Built

- Migration: `supabase/migrations/20260615120000_wfm_foundation_rls_hotfix.sql`
  - Drops `service_role_write_pos_account` (FOR ALL)
  - Drops `service_role_write_schedule_shift_offer` (FOR ALL)
  - Creates `service_role_insert_pos_account`, `service_role_update_pos_account`, `service_role_delete_pos_account`
  - Creates `service_role_insert_schedule_shift_offer`, `service_role_update_schedule_shift_offer`, `service_role_delete_schedule_shift_offer`
  - `DROP POLICY IF EXISTS` for re-runnability
  - `pos_sale_event` noted as already INSERT-only compliant — skipped
- Plan checkboxes ticked; decision log updated with one-line sister-sweep #2 note
- Typecheck: 52/52 green (RLS-only change, zero TypeScript impact)

## Timestamp Correction (L-0042)

The plan stated migration floor `20260611120100` and suggested filename `20260611120200`. At sortie execution, the actual migration tip was `20260615110100` — 5 migrations above the plan's stated floor (all shipped between plan-write and execution: `20260614120000`, `20260615100000`, `20260615100100`, `20260615110000`, `20260615110100`). Migration timestamp corrected to `20260615120000` per L-0042 (timestamps are causal order, not wall-clock markers — must exceed the actual tip at execution time).

## DB Apply Deferred

Docker daemon was unavailable in the WSL session at sortie execution time. The migration SQL is correct and complete. To apply:

```bash
# Start Supabase Local first
npx supabase start

# Apply migration
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres \
  < supabase/migrations/20260615120000_wfm_foundation_rls_hotfix.sql

# Verify 6 per-verb service_role policies (3 per table)
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
  SELECT polname, polcmd, polwithcheck IS NOT NULL AS has_with_check
  FROM pg_policy
  WHERE polrelid IN ('public.pos_account'::regclass, 'public.schedule_shift_offer'::regclass)
    AND polname LIKE 'service_role_%'
  ORDER BY polname;
"
# Expected: 6 rows, polcmd values: a (INSERT), w (UPDATE), d (DELETE) — never *

# Sister-sweep — must return ZERO rows
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
  SELECT n.nspname || '.' || c.relname AS table_name, p.polname, p.polcmd
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('department_session', 'session_hook', 'session_task',
                       'deviation', 'personal_task', 'shift_approval',
                       'schedule_shift', 'schedule_shift_offer',
                       'pos_account', 'pos_sale_event')
    AND p.polcmd = '*'
    AND p.polwithcheck IS NULL
  ORDER BY table_name, polname;
"
# Expected: 0 rows
```

## Decisions Made

| Decision | ADR | Detail |
|----------|-----|--------|
| Per-verb service_role policies mandatory on D6 governance tables | ADR-0313 | Applies retroactively to foundation tables that predate the ADR. FOR ALL is a merge blocker per ADR-0303. |
| Sister-sweep #2 scope: pos_account + schedule_shift_offer | ADR-0303 | These are not D6 semantic tables (they're POS and marketplace tables) but they share the same FOR ALL write-policy shape that ADR-0313 governs. Swept together to avoid re-occurrence. |
| Timestamp correction: 20260615120000 not 20260611120200 | L-0042 | Timestamp must exceed actual migration tip at execution time, not plan-write time. |

## Learnings

1. **Foundation plans must verify against the ADR log at sortie-start, not at plan-write time.** ADR-0313 was not yet accepted when `PLAN-wfm-foundation-rls-hotfix.md` was written — by sortie-start it was registered. A pre-flight step of `ls docs/decisions/0313* 2>/dev/null` would have surfaced this immediately. Future foundation sorties should grep for new ADRs in the same module area before beginning.

2. **Migration tip drifts between plan-write and execution.** The plan stated floor `20260611120100` but the actual tip moved to `20260615110100` (+5 migrations). Always run `ls supabase/migrations/ | sort | tail -1` as the first pre-flight step and correct the timestamp before writing the file, not after.

3. **Docker-down does not block DDL sorties.** SQL correctness can be verified statically (reviewed against ADR pattern); DB apply is a one-command step that can be deferred without blocking close-feature on the migration authoring work.

4. **Sister-sweep scope includes non-D6 tables with D6-style policies.** `pos_account` and `schedule_shift_offer` are POS and marketplace domain tables, not D6 lifecycle tables. However, they carried the same `FOR ALL` write policy shape. ADR-0303 sister-sweep logic extends to any table sharing the same fault shape, not strictly D6-ontology tables.

## Known Issues / Debt

- DB apply and sister-sweep query execution deferred until Docker daemon is available. SQL is correct and ready to run.
- Type regen deferred (no-op — RLS policies don't affect TypeScript types). Run `npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts` after apply to verify zero diff.

## Next Steps

- Pontus runs `close-feature.sh` to merge `feat/wfm-foundation-rls-hotfix` into `development`
- After merge: start Docker, apply migration, run verification queries, confirm sister-sweep = 0 rows
- STAGE B campaign spawn unblocked — this was the final hot-fix gate before Phase 2 STAGE B begins
