---
title: "Plan documents are not ground truth for migration dependencies"
id: LEARNING_0042
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [migrations, plans, council, fact-check, database, process]
---

# Learning-0042: Plan documents are not ground truth for migration dependencies

## Context

On 2026-04-17, two migration-timestamp failures occurred in the same session:

1. **PR #216 (morning):** `20260417130000_gate_action_accept_entity_id.sql` referenced `gate_evaluation` (created at `20260505110000_unified_authority_gate.sql:24`). Supabase Preview failed with `relation "public.gate_evaluation" does not exist`. Fixed by retimestamping to `20260506120000` (commit `603ea951`, merged as `0989bd79`).

2. **Week 1 Audit Remediation plan (afternoon):** Task 1 proposed `20260417120000_orphan_fk_fixes_and_polymorphic_comments.sql` referencing three tables/columns not yet created at that timestamp. Caught by second council before execution.

Both plans were written by Claude + superpowers:writing-plans skill. Both passed human review. Both chose "today's wall-clock date" for the migration timestamp without verifying dependency timestamps.

## Discovery

Migration timestamps are **causal order in a dependency DAG**, not chronological markers. `supabase db reset` applies migrations in lexicographic timestamp order. A migration dated `20260417120000` runs BEFORE a migration dated `20260421100200`, regardless of when they were written. If migration A references an object created by migration B, A's timestamp must be strictly greater than B's.

This is non-obvious in a repo with future-dated migrations (the monorepo has migrations timestamped `20260421*`, `20260422*`, `20260501*`, `20260510*` as of 2026-04-17). A plan author using today's clock will consistently pick timestamps too early when the repo tip is already in the future.

### Four failure modes discovered on Task 1 alone

1. **Referenced table doesn't exist at proposed timestamp** — `workspace_framework_binding` created at `20260421200100_cascade_a2_framework_tables.sql:135`, plan's migration at `20260417120000`.
2. **Referenced table (#2) doesn't exist at proposed timestamp** — `employee_payroll_profile` created at `20260421100200_cascade_a1_domain_tables.sql:317`, same plan's migration.
3. **Referenced column doesn't exist at proposed timestamp** — `seeded_from_framework_binding_id` column added at `20260422400000_cascade_b_schema.sql:151`. Even the UPDATE backfill guard would fail, not just the ALTER TABLE.
4. **Schema qualifier wrong** — plan used `payroll.employee_payroll_profile` but actual schema is `public`. This fails at any timestamp. Independent of the ordering bug.

### Why this kept being missed

- CLAUDE.md mentions only naming convention (`YYYYMMDDHHMMSS_desc.sql`), not ordering rules.
- `smartout-database-guide` skill is silent on dependency ordering.
- `superpowers:writing-plans` has no migration-dependency checklist.
- Council Phase 2.5 fact-check historically verified claim counts (importers, emit calls) but did not verify temporal/ordering claims.
- Plan's own "Verified Facts" banner gives false assurance — verification covered WHERE (column exists, file exists) not WHEN (is it created at or before this timestamp).

### The right verification step

For every new migration a plan proposes, enumerate every referenced table, column, enum, function, view. For each, grep the migrations directory to find the creation migration. Confirm every creation timestamp is STRICTLY LESS than the proposed migration's timestamp. Also confirm the proposed timestamp is STRICTLY GREATER than the current `development` HEAD max.

## Impact

**Process changes (shipping as separate PR outside Week 1):**

- **`smartout-database-guide` skill** gains a "Migration timestamp ordering" section with: rule statement + dependency-check commands (`ls supabase/migrations/ | tail -1` for HEAD; `grep -l "<referenced_identifier>"` for dep) + "timestamps are causal, not chronological" warning.
- **`writing-plans` skill** gains a migration-dependency checklist: for each migration the plan creates, enumerate dependencies, cite source migrations, assert timestamp ordering.
- **`run-council` skill Phase 2.5** gains a fact-check step: for every proposed migration in a plan, verify dependency-timestamp ordering.
- **No ADR yet.** Skill rules are right weight. If a 3rd occurrence lands AFTER these ship, escalate to ADR and consider mandatory preflight CI check.

**Plan-authoring discipline:**

- The plan document is an intent artifact. The migrations directory is ground truth. When a plan claims "table X exists," verify the table exists AT the proposed timestamp.
- The "Verified Facts" header pattern is valuable but must cover the WHEN axis too, not just WHAT/WHERE.

## References

- Council session: `docs/council/COUNCIL-LOG.md#2026-04-17-task-1-migration-dependency-review`
- Prior occurrence same session: commit `603ea951` (PR #216 retimestamp)
- Missing plan timestamp referenced by Task 1:
  - `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql:317` (employee_payroll_profile)
  - `supabase/migrations/20260421200100_cascade_a2_framework_tables.sql:135` (workspace_framework_binding)
  - `supabase/migrations/20260422400000_cascade_b_schema.sql:151` (seeded_from_framework_binding_id column)
- Fixed plan: `docs/superpowers/plans/2026-04-17-audit-remediation-week-1.md` (migration now at `20260511100000`)
- Related: L-0040 (identity-boundary ontology), L-0041 (registry-declaration gap) — all three from 2026-04-17 council pattern of plan-artifact vs code-artifact divergence.

---

## Occurrence 4 (2026-05-14) — 4-track contracts/payroll campaign

Council Phase 5 verification on parallel sortie campaign (T1 contracts compliance + T2 trekk-consent + T3 GDPR retention + T4 D6 RLS) caught **two simultaneous occurrences** of the timestamp-past-HEAD pattern in a single fact-check pass:

- T1 plan proposed migrations `20260514100000`, `20260514100100`, `20260514100200`.
- T2 plan proposed migrations `20260514100000`, `20260514100100`.

Both **collided** with each other (identical timestamps = filesystem collision) AND **predated current `development` HEAD max** (`20260611100000` at council time, 27 days ahead of the proposed `20260514*` slots).

Plan-time was 2026-05-13 (one day before council). Plan authors picked "next day" timestamps. Repo HEAD had moved 4 weeks ahead due to parallel sortie velocity. Cloud-skip risk identical to occurrences 1–3.

Resolution post-Phase 5:
- T1 → `20260615200000`, `20260615200100` (drop `100200` per Q5 dissolution).
- T2 → `20260615110000`, `20260615110100`.
- T3 → `20260615100000`, `20260615100100` (also re-timestamped — was `20260602120000` from earlier plan-time which had its own pre-HEAD problem).

**Promotion candidate (Phase 9 rule, 4th repeat):** Promote pre-flight `verify migration timestamps > current dev HEAD max` to `/start-feature` script as fail-fast gate. Plan authors cannot remember to grep dev HEAD before picking timestamps; CI should enforce.

**Cross-pattern signal:** This is the second occurrence inside `4-track-parallel-sortie` orchestration (Phase 2.5 fact-check skill is the only gate that caught it). Lighter human review would have missed both collisions. Council fact-check pre-flight is load-bearing for parallel plan dispatches; do not skip Phase 2.5 even under autonomous-execution pressure.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
