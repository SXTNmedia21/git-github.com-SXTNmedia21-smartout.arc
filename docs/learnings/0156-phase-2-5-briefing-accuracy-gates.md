---
title: "Phase 2.5 briefing accuracy gates — schema and grep verification"
id: LEARNING_0156
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [council, phase-2-5, fact-check, briefing-accuracy, schema-verification]
---

# Learning-0156: Phase 2.5 briefing accuracy gates — schema and grep verification

## Context

ADR-0216 council 2026-04-28 — Phase 2.5 fact-check ran 12 verification claims against codebase, returned VERIFIED on 9, FALSE on 2, INCOMPLETE on 1. Phase 3 reviewers caught 2 additional briefing inaccuracies the fact-check missed:

**Briefing claim 1 (FALSE — Agent-Coord caught):** "session-manager.ts does NOT read `engine_sessions.mode` (mode is on engine_missions)."

**Reality:** `engine_sessions` HAS a `mode` column added 2026-03-02 per migration `20260302000200_engine_sessions_mode.sql:7-9`, with CHECK `('mission', 'agent')`. session-manager.ts:32 has explicit `.eq("mode", "mission")` filter. The briefing confused two distinct columns sharing a name on different tables:
- `engine_sessions.mode` — CHECK ('mission', 'agent') — execution mode
- `engine_missions.mode` — CHECK ('sequential', 'free', 'hybrid') — flow mode

Both exist. Both are read by session-manager. Different vocab.

**Briefing claim 2 (FALSE — Supervisor caught):** "engine_state is phantom — stage-engine has zero reads."

**Reality:** Stage-engine has zero reads, but 8 OTHER domains read it (139 sites total). The briefing scoped its claim to stage-engine without stating the scope, leaving readers to infer "phantom = unused." See L-0155 for full scope failure.

## Discovery

Phase 2.5 fact-check verified the SHAPE of claims (does the file exist? does the function call exist?) but not their COMPLETENESS (is the claim's stated scope the actual scope?). A claim like "no engine_state reads in stage-engine" is technically true and would pass shape-verification — but the claim's hidden implication "engine_state is unused" is the load-bearing assertion that Phase 2.5 didn't audit.

Pattern signature:
- Briefing claim has explicit scope ("X in Y") that reader naturally generalizes to broader scope ("X is unused")
- Phase 2.5 verifies the explicit scope only
- Phase 3 reviewer notices generalization gap
- Phase 5 reversal

A second pattern from same council:
- Briefing claim references a column or field that "doesn't exist on table T"
- Reality: column EXISTS on T (added by later migration the briefing didn't trace)
- Phase 2.5 verifies the function call but not the schema state
- Phase 3 code-tracer catches via direct schema grep

## Impact

**Phase 2.5 hard rule additions:**

1. **Schema-state verification.** For any briefing claim about a column existing or not existing on a table, fact-checker MUST run:
   ```bash
   grep -n "ALTER TABLE <table>\|CREATE TABLE <table>" supabase/migrations/*.sql
   ```
   AND check `packages/supabase/src/database.types.ts` for current canonical shape. Report `\d <table>` equivalent: column list + types + nullability + CHECK constraints.

2. **Scope-explicit grep.** Any "no X in Y" claim must be checked at the BROADER scope as well. Fact-checker reports both "narrow scope hits: 0" AND "broad scope hits: N." Reader sees both numbers, makes informed judgment.

3. **Briefing timestamp.** Fact-check report must include "Verified against schema YYYY-MM-DD" timestamp matching the latest migration committed. If the latest migration is newer than briefing's reference date, flag as STALE-BRIEFING — re-verify before Phase 3.

4. **Claim-scope audit.** For each verified claim, fact-checker writes one sentence: "This claim's stated scope is X. The natural generalization is Y. Y is/is-not also true." The "is-not" form is the trap.

## References

- ADR-0216 (engine_state vs engine_sessions ontology)
- L-0155 (schema-deletion plans require full-codebase grep)
- L-0117 (audit inflation pattern — scope claims must be quantified)
- L-0143 (pattern claims should be quantified, not generalized)
- Council 2026-04-28 ADR-0216 Phase 2.5 + Phase 3
- Migration `20260302000200_engine_sessions_mode.sql` (engine_sessions.mode column)

---
