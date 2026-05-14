---
title: "Plan — wfm-foundation-rls-hotfix"
status: draft
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [plan, hotfix, rls, adr-0313, sister-sweep]
---

# Plan — wfm-foundation-rls-hotfix

> Branch: `feat/wfm-foundation-rls-hotfix` | Worktree: /home/sxtnl/dev/smartout.ai-wt-10 | Base: `development` | Module: scheduler | Started: 2026-05-14

## Goal

Close ADR-0313 (D6 RLS WITH CHECK Invariants) drift on 2 foundation tables shipped without per-verb policy split. PHASE 2 STAGE A.5 hot-fix gate before campaign spawn.

## Context

PHASE 1 foundation (merge `2f143f79f`) shipped 3 new tables with `FOR ALL TO service_role USING + WITH CHECK` write policies. ADR-0313 — landed before foundation merged but missed in plan — mandates per-verb policies (INSERT/UPDATE/DELETE separate) for D6 governance tables. Foundation also missed it because plan was written before ADR-0313 was discovered in PHASE 2 STAGE A2 drift scan.

**Verified scope (grep on `supabase/migrations/20260611120000_wfm_foundation.sql`):**
- `pos_account` — has `service_role_write_pos_account FOR ALL` → REFACTOR per-verb
- `pos_sale_event` — has `service_role_insert_pos_sale_event FOR INSERT WITH CHECK` only → ALREADY COMPLIANT, skip
- `schedule_shift_offer` — has `service_role_write_schedule_shift_offer FOR ALL` → REFACTOR per-verb

**Out of scope:**
- JWT-side mutation policies (none exist on these tables V1; all writes via service_role from BFF)
- POS data change (just policy refactor)
- Any change to read policies (jwt_read + api_key_read both correct already)

## Hard Constraints

- Migration timestamp floor: **must be greater than `20260611120100`** (foundation authority seed). Use `20260611120200_wfm_foundation_rls_hotfix.sql`.
- Per-verb policy pattern per ADR-0313: separate `service_role_insert_*` (FOR INSERT WITH CHECK), `service_role_update_*` (FOR UPDATE USING + WITH CHECK), `service_role_delete_*` (FOR DELETE USING).
- DROP POLICY before CREATE — `DROP POLICY IF EXISTS` for re-runnability.
- All new policies WITH CHECK predicate symmetric with USING: `auth.role() = 'service_role'` on both sides.
- No data migration required — pure DDL.

## Tasks

### Task 1 — Write migration

- [ ] Read ADR-0313 (`docs/decisions/0313-d6-rls-with-check-invariants.md`) to lock canonical per-verb pattern shape.
- [ ] Write `supabase/migrations/20260611120200_wfm_foundation_rls_hotfix.sql`. Header documents ADR-0313 sister-sweep + lists the 2 tables refactored + leaves `pos_sale_event` annotated as already-compliant.
- [ ] Per table (`pos_account` + `schedule_shift_offer`):
  - `DROP POLICY IF EXISTS "service_role_write_<table>" ON public.<table>;`
  - `CREATE POLICY "service_role_insert_<table>" ON public.<table> FOR INSERT TO service_role WITH CHECK (auth.role() = 'service_role');`
  - `CREATE POLICY "service_role_update_<table>" ON public.<table> FOR UPDATE TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');`
  - `CREATE POLICY "service_role_delete_<table>" ON public.<table> FOR DELETE TO service_role USING (auth.role() = 'service_role');`

### Task 2 — Apply locally + verify

- [ ] Apply: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260611120200_wfm_foundation_rls_hotfix.sql`
- [ ] Verify policy shape via SQL:

  ```sql
  SELECT polname, polcmd, polwithcheck IS NOT NULL AS has_with_check
  FROM pg_policy
  WHERE polrelid IN ('public.pos_account'::regclass, 'public.schedule_shift_offer'::regclass)
    AND polname LIKE 'service_role_%'
  ORDER BY polname;
  ```

  Expect 6 rows: 3 per table (insert/update/delete). polcmd should be `a` (INSERT), `w` (UPDATE), `d` (DELETE) — never `*` (FOR ALL).

- [ ] Run sister-sweep query per ADR-0303 to confirm zero remaining `polcmd='*' AND polwithcheck IS NULL` rows on D6 tables (sanity).

### Task 3 — Type regen + typecheck

- [ ] `npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts` (no op run wrap per L-0op-run-corrupts).
- [ ] `pnpm turbo typecheck` clean. Should be 52/52 (no type changes — RLS is runtime).

### Task 4 — HANDOFF + decision log

- [ ] Write `docs/HANDOFF-wfm-foundation-rls-hotfix.md` per CLAUDE.md feature closure protocol — decisions: applied ADR-0313 sister-sweep retroactively; learnings: foundation plans must verify against latest accepted ADRs in `docs/decisions/` at sortie-start (NOT just at plan-write time); next steps: STAGE B campaign spawn unblocked.
- [ ] Update `docs/decisions/0000-decision-log.md` with one-line note on ADR-0313 sister-sweep #2 (pos_account + schedule_shift_offer).

## Acceptance Criteria

- [ ] Migration applies clean
- [ ] 6 per-verb policies present (3 per table)
- [ ] Zero `FOR ALL` (polcmd='*') policies on `pos_account` + `schedule_shift_offer`
- [ ] Sister-sweep query confirms zero D6 governance gaps
- [ ] Typecheck passes 52/52
- [ ] HANDOFF written
- [ ] Decision log updated

## Estimated Duration

30-45 min agent-compressed. Pure DDL refactor + verification.

## Out of Scope

- ADR-0313 update or amendment
- Changes to JWT-side policies (none exist on these tables)
- Refactor of `pos_sale_event` (already INSERT-only compliant)
- Any data migration
- Touching read policies
