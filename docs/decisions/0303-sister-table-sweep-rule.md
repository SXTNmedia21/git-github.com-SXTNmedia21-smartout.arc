---
title: "Sister-table sweep mandatory on D6 governance findings"
id: ADR_0303
status: accepted
layer: decision
created: 2026-05-13
updated: 2026-05-13
module: security
tags: [rls, governance, audit, d6, sortie-protocol]
---

# ADR-0303: Sister-table sweep mandatory on D6 governance findings

## Context

The 2026-05-13 ADR-contract-validation audit (`docs/audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md`) surfaced F-DB-09 as CRITICAL: four D6 sister tables (`department_session`, `session_hook`, `deviation`, `personal_task`) retained the exact `FOR ALL USING(...)` no-WITH-CHECK shape that ADR-0299 Sortie A had closed three days earlier on `shift_approval`. ADR-0299 framed the gap as a **class-pattern** (defense-in-depth on D6 mutation surfaces) but Sortie A scoped only the one named table. The 2026-05-10 audit slice that re-verified Sortie A's closure inherited the same scope and missed the sister tables.

This is a **class-pattern miss**, not a coincidence. The closure protocol around Sortie A did not include a "sweep all sister tables sharing the same fault shape" step. The same root cause produced 4 follow-up findings (F-DB-09 × 3 tables + F-DB-10 for `personal_task`).

Pattern is now a third-occurrence on the campaign (Sortie 1 `session_task` 2026-05-12 → Sortie A `shift_approval` 2026-05-13 → Sortie A.2 sweep 2026-05-13). Per L-0202 promotion convention, recurring class-misses are promoted to ADR scope.

## Decision

**Every audit finding on a D6 governance / RLS pattern MUST trigger a sister-table sweep before the close-feature gate accepts the fix.**

Rules:

1. **Definition of "sister table":** any table sharing the same Cascade dimension (D6 in this ADR's case) AND the same governance pattern (RLS shape, role gate, actor-derivation, telemetry contract). When a sortie ships a migration with `ALTER POLICY` / `DROP POLICY` / `CREATE POLICY` on a D6 table, every other D6 table is a sister-table candidate.
2. **Owner of the fix runs the sweep.** Sortie author writes a sweep SQL (see §Sweep query) and pastes the result in the HANDOFF + plan acceptance criteria. Zero matches required to claim closure of the gap class.
3. **Auditor confirms in next run.** `adr-contract-audit` slice 07 (db-rls-telemetry) treats the original sortie's HANDOFF as the contract; if sister tables surface in the next audit with the same fault shape, the gap class is reopened and the original ADR is amended (see ADR-0299 example).
4. **Scope is D6 governance only.** This ADR does not mandate sweeps for every domain pattern (the cost would be prohibitive on cross-cutting changes like telemetry registry edits). The trigger is specifically "RLS / role-gate / actor-derivation pattern on a D6 mutation surface" — the place where `auth.uid()`-vs-`workspace_id`-vs-body-payload divergence is most exploitable per ADR-0151.

## Sweep query (canonical shape)

Sister-sweep query for the `FOR ALL USING(...)` no-WITH-CHECK fault shape on D6 tables:

```sql
-- Find any policy on a D6 table that uses FOR ALL (cmd='*') without a WITH CHECK clause.
-- D6 tables (per ADR-0298 cascade ontology):
--   schedule_shift, shift_approval, department_session, session_hook,
--   session_task, deviation, personal_task, emma_task, schedule_day_task,
--   schedule_absence
SELECT
  c.relname           AS table_name,
  p.polname           AS policy_name,
  p.polcmd            AS cmd,    -- '*' = FOR ALL, 'r' = SELECT, 'a' = INSERT, 'w' = UPDATE, 'd' = DELETE
  pg_get_expr(p.polqual,  p.polrelid) AS using_expr,
  pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expr
FROM pg_policy p
JOIN pg_class  c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'schedule_shift', 'shift_approval', 'department_session', 'session_hook',
    'session_task', 'deviation', 'personal_task', 'emma_task',
    'schedule_day_task', 'schedule_absence'
  )
  AND p.polcmd = '*'                  -- FOR ALL
  AND p.polwithcheck IS NULL          -- no WITH CHECK
ORDER BY c.relname, p.polname;
```

Zero rows = sister-sweep clean. Any rows = sister-tables to close in the same (or follow-up) sortie before declaring the gap class shut.

The sweep query template lives in `docs/decisions/0303-sister-table-sweep-rule.md` (this ADR) and SHOULD be parameterized per fault class (e.g. swap `polwithcheck IS NULL` for the relevant fault shape on telemetry / actor-derivation / channel-policy gaps as they arise).

## Consequences

- **Good:** large reduction in audit findings repeating the same root cause across sister tables. F-DB-09 / F-DB-10 illustrate the cost — the 2026-05-13 audit produced 4 NEW CRITICAL findings (sister-table re-occurrence of ADR-0299's exact gap shape) which Sortie A.2 must now spend a separate sortie cycle to close.
- **Good:** explicit close-feature gate prevents "ADR fixed it but the gap class re-emerges three days later" pattern.
- **Bad:** small extra cost per D6 governance sortie (one SQL query + HANDOFF row). Acceptable: a 5-minute sweep avoids a multi-day sortie cycle on sister-table closure.
- **Bad:** ADR scope is D6-only. Future class-misses on D1-D5 governance (e.g. operating-hours writer contract, season-budget RLS) may need separate sweep rules. Defer to those ADRs.

## Agent Impact

- **`smartout-database-guide` skill MUST teach the sister-sweep step.** Add to the skill's "before declaring an RLS fix complete" checklist: "Run sister-sweep query from ADR-0303 over all D6 tables; zero matches required."
- **`adr-contract-audit` skill MAY auto-run sweep query as part of slice 07 (db-rls-telemetry).** Optional automation; manual run by sortie author is the canonical contract (the slice runs read-only against live DB and surfaces drift in the next audit, but does not block close-feature).
- **`smartout-cascade-developer` skill MUST cross-reference ADR-0303** when discussing D6 RLS patterns — the sweep is part of the D6 governance contract, not an optional step.
- **Close-feature gate (future enhancement):** `close-feature.sh` may grow a `check-sister-sweep-recorded.sh` hook that scans the HANDOFF for "Sister-sweep: 0 rows" before allowing the merge. Out of scope for this ADR; tracked as follow-up.

## Status

- `proposed` — council decides accept. Sortie A.2 ships under this ADR as the first sweep-verified closure. Promotion to `accepted` expected once council confirms (a) the D6-only scoping is the right line, (b) the sweep-query SQL is the right shape (vs `polqual IS NULL` or other fault patterns), and (c) the close-feature gate enhancement is desired in v1 or deferred.

## 2026-05-13 acceptance + enforcement

Promoted from proposed to accepted on the same day F-DB-12 (audit `2026-05-13-adr-contract-validation-02`) validated the rule's necessity. Enforcement ships in Sortie A.3 via `scripts/check-rls-with-check.ts` + `.github/workflows/check-rls.yml`.

---

> Registered in `docs/decisions/0000-decision-log.md`. Relates to ADR-0151 (actor forgery), ADR-0298 (D6 task ontology + RLS WITH CHECK mandate), ADR-0299 (Sortie A shift_approval closure — the originating gap), ADR-0287 (`gate_action` mandatory on mutation tools — analogous class rule).
