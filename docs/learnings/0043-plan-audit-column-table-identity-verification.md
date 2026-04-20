---
title: "Audit claims about column→table identity must be verified against information_schema, not source migrations or grep"
id: LEARNING_0043
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [migrations, plans, council, fact-check, database, audit, process]
---

# Learning-0043: Plan-audit column→table identity claims must be verified against `information_schema`

## Context

2026-04-17 Week 1 Audit Remediation plan (PR1) claimed two columns needed FK constraints:

- `profile.active_contract_id` → `employment_contract(contract_id)`
- `employee_payroll_profile.seeded_from_framework_binding_id` → `workspace_framework_binding(id)`

Plan-level execution hit `ERROR: column p.active_contract_id does not exist` at Step 1.1 (orphan count query). Full fact-check via `information_schema.columns` revealed:

1. `active_contract_id` lives on **`public.workspace`**, not `public.profile`.
2. `seeded_from_framework_binding_id` lives on **`public.tariff_rate_table`**, not `public.employee_payroll_profile` (the latter has `seeded_from_template_id` referencing a different table).

Supervisor's independent code-trace confirmed both errors and found that **ADR-0124 itself repeated the same column→table mappings from the audit.** Three authored artifacts (audit → plan → ADR) all inherited the same mistake because none verified the source-of-truth.

Additional audit errors surfaced by Supervisor during PR3 fact-check:

- 4 claimed public-site `<img>` files did not exist (`Hero.tsx`, `Gallery.tsx`, `TextImage.tsx`, `MenuPreview.tsx` — real files have `Public` suffix).
- 3 other claimed `<img>` files (`MemberPanel.tsx`, `ConfirmBusiness.tsx`, `GiveSlide.tsx`) were false positives — the plan's grep regex missed multi-line JSX.
- Plan's PR3 named 8 target files; only 1 (`MessageBubble.tsx`) actually matched reality. Real scope is 12-13 files, most not in the plan.

## Discovery

Audits produce mappings (column X lives on table Y, file X contains pattern Y) but these mappings are **derivative claims** — they come from scanning migrations, running greps, or introspecting the audit author's mental model. Any of those introspection paths can drift from live DB state:

- **Migration scanning** picks up historical intent, not current state (a column can be added then moved to another table by a later migration; only `information_schema` is canonical).
- **Grep patterns** can be fragile — missing multi-line matches, `<img[[:space:]]` requiring whitespace after `<img`, or missing directory moves.
- **Author mental model** drifts — "the active_contract_id on profile" feels natural if the author thinks about profiles first; it may have been on profile once, or the author confused `profile.active_contract_id` with `workspace.active_contract_id`.

### The invariant

**`information_schema.columns` is ground truth. Migration files are intent. Plan documents are derivative. ADRs are derivative.** For every column claim a plan makes, verify against `information_schema.columns` directly:

```sql
SELECT table_schema || '.' || table_name AS tbl, column_name
FROM information_schema.columns
WHERE column_name IN ('col_a', 'col_b', ...)
ORDER BY column_name, tbl;
```

For every file claim, verify with `ls -la`. For every grep claim, use ripgrep's own counter (not a bash regex) and spot-check at least 2 results by opening the files.

### Phase 2.5 fact-check was insufficient

The first 2026-04-17 council's Phase 2.5 verified count-style claims (barrel importers = 16, orphan FKs = 2, emit calls, waitForTimeout counts, Edge Function count). It did **not** verify **identity-style claims** (column X lives on table Y, file X has content Y). A plan built on wrong identity claims fails at execution no matter how accurate the counts are.

### Four classes of audit error observed on this plan

| Class | Example | Detection |
|---|---|---|
| Wrong source table | `profile.active_contract_id` (actual: `workspace.*`) | `information_schema.columns` |
| Wrong target table | `employee_payroll_profile.seeded_from_framework_binding_id` (actual: `tariff_rate_table.*`) | `information_schema.columns` |
| Non-existent files | `sections/Hero.tsx` (actual: `HeroPublic.tsx`) | `ls -la` or glob |
| Grep regex blind spots | `<img[[:space:]]` missed multi-line JSX | ripgrep's real counter + spot-check |

All four leaked past a Phase 2.5 fact-check that only verified counts.

## Impact

**Process changes (must ship with or before the next plan-authoring session):**

- **`run-council` skill Phase 2.5** MUST verify identity claims, not just counts. For every column reference in a plan's Verified Facts section, run the `information_schema.columns` query above. For every file reference, `ls -la`. For every grep count, spot-check ≥ 2 results.
- **`writing-plans` skill** should include a "Verified Facts" template with explicit identity-verification columns (`information_schema` evidence for DB claims, `ls -la` output for file claims, sample grep hits for pattern claims).
- **ADR template** should note: ADRs that reference specific columns/tables must cite the evidence source (`information_schema` output, migration file:line). This prevents ADRs from inheriting audit errors silently.
- **Audit tooling itself** should emit identity-verified output by default. If an audit claims "column X on table Y", it should cite the `information_schema` row that proved it at audit time.

**Tactical implication for this plan:**

- PR1 scope narrowed from 2 FKs to 1 after fact-check. ADR-0124 amended with errata.
- PR3 scope rewritten from plan's fabricated list to the real 6-file PR3a + deferred PR3b.
- The time spent on Phase C fact-check (full audit re-verification) saved weeks of downstream rework. Always pay this cost before executing a plan that makes many specific claims.

## References

- Council session (3rd of 2026-04-17): `docs/council/COUNCIL-LOG.md#2026-04-17-task-1-audit-execution-halt`
- Prior occurrence same session (timestamp ordering): L-0042
- Supervisor's PR3 regex-bug observation: council session notes
- ADR-0124 amended with errata block reflecting corrected column→table mappings
- Fixed plan: `docs/superpowers/plans/2026-04-17-audit-remediation-week-1.md` (Verified Facts table errata block added 2026-04-17)

Evidence paths:
- `supabase/migrations/20260228140000_contract_system_foundation.sql:170-181` — `ALTER TABLE public.workspace ... ADD COLUMN active_contract_id uuid`
- `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql:317` — `CREATE TABLE IF NOT EXISTS public.employee_payroll_profile`
- `supabase/migrations/20260422400000_cascade_b_schema.sql:140-152` — section 7 alters `employee_payroll_profile` with `seeded_from_template_id`; section 8 alters `tariff_rate_table` with `seeded_from_framework_binding_id`

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
