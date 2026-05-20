---
title: "Handoff — payroll-lovsen-phase-7d-adr-amendments"
feature: lovsen-phase-7d-adr-amendments
status: done
created: 2026-05-17
updated: 2026-05-17
module: payroll
tags: [handoff, payroll, lovsen, phase-7d, adr-amendments]
---

# Handoff — payroll-lovsen-phase-7d-adr-amendments

## Summary

Sortie 1 of 3 in the Phase 7d-followup execution series. Shipped 2 new ADRs (0355 + 0356),
2 ADR amendments (ADR-0353 §A+§D + ADR-0351 Option C), 3 learnings (L-0292/0293/0294),
and 1 SKILL.md promotion (L-0147 chair self-reversal protocol from advisory to enforced hard
rule in `~/.claude/skills/run-council/SKILL.md`). No migration code, no schema changes, no
capability code. Purely documentation. Blocks Sortie 2 (migration sortie) and Sortie 3
(delegation tools sortie), both of which are sequencing-gated on these ADR amendments
landing on `campaign/payroll`.

Prior agents A, B, C in this sortie shipped: ADR-0355 + ADR-0356 (commit c70848f4a),
ADR-0353 + ADR-0351 amendments (commit a228199b0), L-0292 + L-0293 + L-0294 (commit
065544193). Agent D (this handoff) ships: registrations + JOURNEY + HANDOFF + L-0294 fix.

---

## Decisions Made

### ADR-0355 — `workspace_union_binding` Lifecycle + Cache Trigger

New `public.workspace_union_binding` table is the canonical lovsen union binding record,
separate from cascade's `workspace_framework_binding`. APPEND-ONLY semantics per ADR-0076:
INSERT only, no UPDATE/DELETE, `effective_to` stamped on old row at switch time. FK syntax
corrected to `workspace(workspace_id)` (not `workspace(id)` — the FK bug in ADR-0353 §A
original). Cache trigger on `payroll.workspace_settings` maintains denormalized
`is_tariff_bound` boolean + `active_union_id` UUID for golden-case determinism without hot-
read JOIN. Trigger is SECURITY DEFINER + locked search_path per L-0172. `tariff_snapshot`
lives in `payroll` schema. Backfill: Sortie 2 migration writes `BOOTSTRAP-BACKFILL`
amendment_classifier rows for 4 live workspaces. This ADR was born from the Gap 4 L-0147
self-reversal: ADR-0353 §A named a table that conflicts with an existing cascade table.

### ADR-0356 — Cascade-Namespace Delegation Pattern

Generalizes ADR-0240 journey-delegation pattern into a cross-namespace capability write rule.
Any payroll capability tool writing to tables owned by a different ADR-0173 frozen-4
namespace MUST delegate via a tool in the owning namespace's capability. Specifically:
payroll capability MUST NOT directly write `public.workspace_union_binding` or
`public.supplement_rule` — MUST call `cascade.bind_workspace_union` and
`cascade.add_supplement_rule` delegation tools respectively. Delegation tools ship in
Sortie 3. Until Sortie 3 closes, Phase 7f capability tools are BLOCKED. ADR-0204
`gatedMutation` mandatory on delegation tools. Audit trail requires `delegated_via` field.
Born from Gap 5 reversal (ADR-0173 frozen-4 cross-namespace violation caught by
payroll-engine code-tracer in Phase 7d-followup council).

### ADR-0353 §A Self-Reversal (L-0147 Gap 4)

Original ADR-0353 §A proposed creating `public.workspace_framework_binding`. This table name
already exists in cascade schema with a different structure. Phase 3 chair APPROVED; payroll-
engine code-tracer and database code-tracer both cited the conflict in Phase 3. Chair
reversed in Phase 5 per L-0147 protocol: amendment block placed at TOP of §A with "Original
content is RETAINED below as historical record but is NO LONGER LOAD-BEARING." Redirects
to ADR-0355 as the new contract.

### ADR-0353 §D Self-Reversal (L-0147 Gap 4 continuation)

Original ADR-0353 §D specified `shift_pay_calculation_event.tariff_binding_id` FK as an
existing column. Column does not exist in current schema. Amendment block documents the gap:
Sortie 2 migration must add this column. The §D original content is retained but the column
addition is a Sortie 2 delivery, not a pre-existing fact.

### ADR-0351 Option C Self-Reversal (L-0147 Gap 5)

Original ADR-0351 Option C specified a PostgreSQL CHECK constraint that included a cross-
table subquery into `workspace_settings.is_tariff_bound`. PostgreSQL CHECK constraints cannot
contain subqueries referencing other tables — this is structurally invalid SQL. Three
reviewers (database code-tracer, payroll-engine code-tracer, supervisor) cited this. Chair
reversed in Phase 5. Amendment: replace pseudo-SQL CHECK with BEFORE INSERT/UPDATE TRIGGER
spec per L-0172 SECURITY DEFINER + locked search_path pattern. Target table:
`public.supplement_rule`. ADR-0356 delegation pattern applies to the tool that writes this
table.

---

## Learnings Discovered

### L-0292 — Pre-Council Schema-Reality-Check Pattern

Reading 5 most-cited tables/columns from any schema-migration briefing BEFORE Phase 2
dispatch caught all 5 falsifications in this council in under 3 minutes. Without the pre-
council read, all 5 would have survived Phase 3 as unverified briefing claims, reaching Phase
5 only via reviewer code-trace. Promoted to council-orchestrator Phase 1 INTAKE guidance.

### L-0293 — Denormalized Cache + Canonical Lifecycle Pattern

When a hot-read field is load-bearing for golden-case determinism (payroll-engine non-
negotiable principle 4), the valid pattern is: canonical APPEND-ONLY table (audit lineage) +
denormalized cache on settings (hot-read without JOIN) + SECURITY DEFINER trigger syncing
them. Gap 4 reversal is the worked example. Both structures are required; cache-only loses
audit trail; canonical-only adds JOIN to hot path at period-close volume.

### L-0294 — At-Least-9th L-0147 Chair Self-Reversal Precedent

Counting is contested between authors (L-0261 "8th", L-0289 "6th"). Counting ambiguity
itself is signal — the pattern fires so often authors disagree on count. SKILL.md promotion
eliminates ambiguity by enforcing the protocol structurally. Phase 9 Step 4 threshold (3+
occurrences) long exceeded. Promoted to SKILL.md hard rule in Phase 5 §1.5 with canonical
format block + 9-entry precedent table + Common Mistakes row.

---

## Known Issues / Debt

- **Sortie 2 NOT YET OPENED.** Migration sortie blocked on this sortie closing to
  `campaign/payroll`. Estimated scope: `public.workspace_union_binding` table + RLS + FK
  on `workspace_settings` for `active_union_id` + `is_tariff_bound` column + cache trigger
  (SECURITY DEFINER) + `tariff_binding_id` column on `shift_pay_calculation_event` +
  golden-month fixture update + determinism re-run. Timestamp ≥ `20260618000000`.

- **Sortie 3 NOT YET OPENED.** Delegation tools (`cascade.bind_workspace_union` +
  `cascade.add_supplement_rule`) blocked on Sortie 2 schema landing. Sortie 3 is
  sequencing-gated on Sortie 2 migration merging to `campaign/payroll`.

- **Phase 7f capability tools BLOCKED.** `setup_workspace_tariff`, `change_workspace_tariff`,
  `add_supplement_override` (ADR-0353 §B + §C + ADR-0351) all gated on ADR-0356 enforcement
  — must delegate via Sortie 3 tools before Phase 7f capability tools can ship.

- **L-0294 precedent count contested.** L-0261 says 8th, L-0289 says 6th, this document
  records as 9th-at-minimum. Counting divergence is documented in L-0294 as evidence of
  pattern frequency. No corrective action needed beyond SKILL.md promotion (done).

- **SKILL.md change is user-global, not git-tracked.** `~/.claude/skills/run-council/SKILL.md`
  updated but lives outside the repo. Verify with a test council after Sortie 1 closes to
  confirm the promoted L-0147 rule is loading correctly.

- **358 cert-cells carry pre-pivot lineage.** BOOTSTRAP-BACKFILL (Phase 7c follow-on) blocked
  on Sortie 3 delegation tools shipping. Re-derive via `derive_supplement_set` once Sortie 3
  closes.

---

## Next Steps

1. **Sortie 1 close:** Orchestrator runs `close-feature.sh` from main repo. This sortie's
   branch (`feat/payroll-lovsen-phase-7d-adr-amendments`) merges to `campaign/payroll`.

2. **Sortie 2:** Open `feat/payroll-phase-7d-followup-migration` sub-sortie. Migration scope
   per ADR-0355 + ADR-0353 amendment + ADR-0351 amendment. Timestamp ≥ `20260618000000`.
   Run `pnpm supabase db lint` + `pnpm turbo typecheck` before close.

3. **Sortie 3:** Open `feat/payroll-phase-7d-cascade-delegation-tools` sub-sortie. Implement
   `cascade.bind_workspace_union` + `cascade.add_supplement_rule` delegation tools per
   ADR-0356. Load `payroll-engine-developer` + `smartout-database-guide` skills.

4. **Phase 7f:** Capability tools (`setup_workspace_tariff`, `change_workspace_tariff`,
   `add_supplement_override`) after Sortie 3 delegation tools land. Per ADR-0356 frozen-4
   enforcement: tools must delegate, not direct-write.

5. **BOOTSTRAP-BACKFILL (Phase 7c follow-on):** Re-derive 358 cert-cells via
   `derive_supplement_set` once Sortie 3 delegation tools ship and Bubble workspace bindings
   are seeded.
