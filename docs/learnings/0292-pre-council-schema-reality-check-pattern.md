---
title: "L-0292 — Pre-council schema-reality-check pattern"
id: LEARNING_0292
status: canonical
layer: learning
created: 2026-05-17
updated: 2026-05-17
tags: [council, orchestration, schema-migration, pre-flight, fact-check]
related: [ADR-0355, ADR-0356, L-0147, L-0209]
---

# Learning-0292: Pre-council schema-reality-check pattern

## Context

Council 2026-05-17 Phase 7d-followup convened to review schema migration scope for ADRs
0350–0354 ratified earlier the same day. Before dispatching Phase 2 reviewers, the council
orchestrator read 5 schema files in the main repo: the existing `workspace_framework_binding`
migration, the `payroll.workspace_settings` migration (for `is_tariff_bound`), the
`public.tariff_rate_table` migration, the `supplement_rule` migrations (both `public` and
`payroll` variants), and the `shift_pay_calculation_event` migration. The pre-read took
approximately 3 minutes.

## Discovery

That pre-read caught 5 ADR-level falsifications BEFORE the briefing was finalized:

1. `workspace_framework_binding` table already exists with conflicting shape
2. `is_tariff_bound` column already exists with calc-engine direct read
3. Two parallel `supplement_rule` tables exist with different ownership
4. `tariff_binding_id` column does not exist despite the ADR claim
5. `REFERENCES workspace(id)` FK syntax bug (correct target: `workspace(workspace_id)`)

Phase 3 reviewers received a briefing that NAMED these falsifications upfront — instead of
having to discover them via code-trace and surface them as reversals. Result: 5 reviewers
code-traced 4 confirmed falsifications + 1 NEW finding (DB-tracer caught the
`workspace(id)` FK bug independently) — all within Phase 3 single round, no re-dispatch
needed.

**Counterfactual:** Without the pre-read, the briefing would have inherited ADR claims as
ground truth. Reviewers would have discovered conflicts via code-trace, but only those
reviewers actually running grep would surface them. Likely 2-3 of 5 reviewers would have
approved ADR-0353 §A as scoped, requiring Phase 5 chair self-reversal to surface the gap.
With 4 reviewers voting REJECT pre-briefing, Phase 5 had 5 reviewers all converging — no
synthesis ambiguity.

**Pattern — mandatory pre-flight steps for schema-migration councils:**

For any council touching schema migrations, capability boundaries, or cross-namespace writes,
the council orchestrator MUST read the 5 most-cited tables/columns/migration files from the
briefing topic BEFORE dispatching Phase 2 agents. Specifically:

1. Read existing migration(s) for any table named in the briefing
2. Read existing readers (`grep packages/` + `grep apps/`) for top 2 consumer file:lines
3. Verify proposed column types against existing TypeScript types
4. Verify proposed FK targets exist with the proposed PK column names
5. Grep `database.types.ts` for any new enum the briefing proposes

**Cost:** ~3–5 minutes per council.
**Benefit:** Saves 30–60 minutes per false-premised reviewer round.

## Impact

Promote to council-orchestrator skill (`~/.claude/skills/run-council/SKILL.md` Phase 1
§"INTAKE"). Add as mandatory step when the topic touches schema or capability boundaries.

Phase 2.5 fact-check still runs AFTER briefing, but the pre-flight schema-reality-check
ensures the briefing itself is accurate — a different and earlier gate.

After 3+ occurrences of pre-flight catches, promote from advisory to enforced SKILL.md hard
rule with the pattern steps quoted explicitly.

## References

- Council session 2026-05-17 Phase 7d-followup (see `docs/council/COUNCIL-LOG.md`)
- ADR-0355 (`workspace_union_binding` lifecycle — worked example of a falsification caught
  by this pre-flight)
- ADR-0356 (cascade-namespace delegation pattern — second falsification caught)
- L-0147 (chair self-reversal — pre-read shifts reversal cost from Phase 5 to Phase 2;
  complementary reduction of reversal frequency)
- L-0209 (ADR ID squatting — different pattern, same root cause: misaligned ground truth
  before council dispatch)

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
