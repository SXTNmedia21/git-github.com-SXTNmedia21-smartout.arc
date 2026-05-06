---
title: "Column-name collision in spec'd migrations — must \\d table_name before adding columns"
id: LEARNING_0208
status: canonical
layer: learning
created: 2026-05-04
updated: 2026-05-04
tags: [migration, schema, column-collision, fact-check, l-0042]
---

# Learning-0208: Column-name collision in spec'd migrations — `\d table_name` before ADD COLUMN

## Context

Welcome Mission V0 spec 2026-05-04 contained three column-collision bugs that would have failed at migration-apply time:

| Spec proposed | Reality | Failure mode |
|---|---|---|
| `engine_missions.base_instruction TEXT NULL` (M1) | `engine_missions.system_prompt` already exists (mig 20260318120000) | New column orphaned — stage-manager reads `system_prompt`, ignores `base_instruction` |
| `engine_sessions.last_activity_at` (resume-window logic in §10.8) | Column does not exist; only `updated_at`, `stage_started_at`, `created_at`, `completed_at` | Resume-window query fails at runtime |
| `profile.is_godmode` (M5 RLS in `engine_audit_outbox`) | Column is on `user_identity`, NOT `profile` | Migration fails at apply time: "column is_godmode does not exist on profile" |

All three were caught by Phase 3 reviewers via grep + database.types.ts read. None were caught by spec-author or by Phase 2.5 fact-check (which checked migration timestamp ordering but not column-name existence).

## Discovery

**The pattern:**

- Spec author imagines schema needs ("we need a base instruction column")
- Names the column based on intent ("base_instruction" — descriptive)
- Skips checking existing schema (would have found `system_prompt` already serving same purpose)
- Migration is added; Type definitions are extended; downstream code reads OLD column name

**Sister pattern — "RLS column references":**

Spec author imagines RLS policy ("only godmode can read"). Names the column based on conceptual location ("on profile, since godmode-status is a user attribute"). Skips checking actual schema (would have found `is_godmode` on `user_identity`, not `profile`). Migration applies-test fails.

**Why fact-check missed this:**

- L-0042 Phase 2.5 rule covers migration **timestamp ordering**, not column-name verification
- Phase 2.5 ran in <3 min — column-name lookup per claim was not in scope
- Phase 3 reviewers (supervisor + agent-coord) caught it because they had time to read the actual migrations

## Impact

**Promote to Phase 2.5 fact-check rubric (in addition to L-0042 timestamp rule):**

1. **For every NEW column** in proposed ALTER TABLE: run
   ```bash
   grep -rn "<column_name>" supabase/migrations/*.sql packages/supabase/src/database.types.ts
   ```
   If hits exist → column-name collision. Flag as Phase 2.5 finding.

2. **For every column referenced** in proposed RLS policy or query (e.g. `WHERE is_godmode = true`):
   ```bash
   grep -A 2 "<table_name>" packages/supabase/src/database.types.ts | grep "<column_name>"
   ```
   If no match → wrong table. Flag as Phase 2.5 finding.

3. **For every NEW table referenced as FK target:** verify the target table exists at the dependency timestamp (already in L-0042).

4. **Add to fact-check briefing template:**
   - Files to fact-check (existing rule)
   - Migration timestamps to verify (L-0042)
   - **Column names in proposed migrations to verify against existing schema** (NEW)
   - **Column names in RLS policies to verify against the table they target** (NEW)

5. **Spec-author obligation:** Before adding `ADD COLUMN x` to a migration, run `\d <table_name>` (or grep the database.types.ts file) and confirm `x` does not already exist as a different name. If a similar column exists, justify why the new one is different in the migration COMMENT and in the ADR's Considered Options section.

## Recovery actions for Welcome Mission V0

The three collisions become Phase 0 fixes (B2, B3, B4 in council Phase 5):

| Bug | Fix |
|---|---|
| `base_instruction` vs `system_prompt` | Drop `base_instruction`. Use existing `system_prompt`. Update spec ADR-0272 + WELCOME_MISSION_V0.md to reference `system_prompt`. |
| `last_activity_at` phantom column | Replace with `updated_at` (which exists on `engine_sessions`). Update WELCOME_MISSION_V0.md §10.8 + ADR-0274 Resume-semantikk. |
| `is_godmode` on `profile` | Change M5 RLS subquery: `EXISTS (SELECT 1 FROM user_identity WHERE id = auth.uid() AND is_godmode = true)`. |

## References

- L-0042: Migration timestamp ordering (the rule this learning extends)
- L-0177: Silent fallback patterns
- L-0098: Same-session staleness
- ADR-0212 (proposed): Schema regen discipline
- Council session 2026-05-04 Welcome Mission V0 — Phase 5 §5 BLOCKERs B2, B3, B4
