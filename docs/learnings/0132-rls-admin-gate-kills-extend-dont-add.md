---
id: L-0132
title: "RLS admin-gate kills 'extend, don't add' argument"
status: accepted
date: 2026-04-23
type: architecture
created: 2026-04-23
updated: 2026-04-23
related_adrs: [ADR-0200]
related_learnings: [L-0130]
module: cascade
tags: [rls, schema-design, extend-vs-add, row-level-security, council]
---

# L-0132 — RLS admin-gate kills "extend, don't add" argument

## Context

Hospitality gap analysis council (2026-04-23) weighed "extend `schedule_absence` with preference enum values" against "new tables for availability + preference". The "extend, don't add" argument — cheaper migration, fewer types, one consumer query — has real weight when the existing table's contract can absorb the new use case.

It cannot here. `schedule_absence` has an `is_admin_in_workspace`-gated INSERT policy. The new use case is **employee self-service**. Extending `absence_type` to include `'preference_unavailable'` / `'preference_rank'` would require one of:

1. **Weaken the admin gate** — drop `is_admin_in_workspace` from INSERT, rely on higher-layer checks to keep absences admin-only. Breaks the existing absence flow's contract: every existing admin-owned INSERT path silently gains a bypass.
2. **Branch the policy on `absence_type`** — `CREATE POLICY ... WITH CHECK (is_admin_in_workspace(workspace_id) OR (absence_type IN ('preference_unavailable','preference_rank') AND profile_id = auth.uid()))`. Load-bearing conditional RLS that breaks on the *next* `absence_type` value unless the reviewer notices. Policy logic carrying enum-case semantics is fragile by construction.
3. **Add a parallel policy** — keep admin policy for formal types, add employee policy for preference types. Two INSERT policies on the same table evaluated in union; both must stay coherent as the enum grows. Half-measure — doubles the RLS surface and still couples two unrelated use cases through one table.

All three options trade schema economy for RLS complexity. The trade is bad: RLS complexity is where CVE-class bugs live (L-0066 / L-0097), and schema economy on a single table is not worth a load-bearing policy branch.

## Discovery

**When an existing table has an admin-gated RLS policy, the "extend, don't add" heuristic fails if the new use case is not admin-gated.** The apparent economy (one table vs two) turns into RLS debt (policy branching on a discriminator column). RLS debt is not a fair trade for schema surface reduction — it moves complexity from a type-checked, reviewable surface (schema + types) to an untyped, easily-missed surface (policy expressions).

**Clean new table beats rewriting existing table's RLS.** Migration cost: one new table, one new type, one new authority seed, one new capability. RLS cost: one clean policy per op (INSERT / SELECT / UPDATE / DELETE) reflecting the actual writer. Total surface added is comparable to, and often less than, rewriting the existing policy plus validating every existing consumer of the old table.

**Heuristic for schema-design reviewers.** Before accepting "extend, don't add":

- Does the target table have an RLS INSERT policy? Check `information_schema.policies` / migration history.
- Does the new use case match that policy? Specifically: would the proposed writer pass the existing INSERT `WITH CHECK`?
- If not, the "extend" path requires RLS surgery. Quote the surgery explicitly in the PR and compare against "new clean table".

In most cases, once surgery is quoted explicitly, the new-table path wins on review.

## Impact

**`smartout-database-guide` skill.** Add a pre-extend check to the database-brainstorm section: "before expanding a `type` / `status` / `kind` column on table X, verify that the new rowset's writer matches X's existing RLS INSERT policy. If not, consider a new table."

**Companion to L-0130.** L-0130 named the three-test rule (lifecycle / RLS / authority); this learning is the RLS-axis expansion. Reviewers applying L-0130 use L-0132 as the specific "RLS differs" detail for policy-gated tables.

**Anti-pattern named.** "Policy-branch for enum value" — adding `WHERE discriminator_column = 'new_value'` branches to an RLS policy as the only way to support a new writer. The anti-pattern is *visible* as extra predicate complexity in the policy expression, which is a grep-able signal in future migrations.

**Does NOT apply to uniform-writer tables.** If a table has permissive RLS or a writer-agnostic policy (e.g., service-role-only or workspace-any-member), enum expansion is fine. L-0132 is specific to admin-gated (or role-gated) INSERT policies.

## References

- ADR-0200 — employee availability three-table model (the concrete application of this learning).
- L-0066 — default-allow capability authority = CVE-class trap (adjacent: RLS complexity is where CVE-class bugs live).
- L-0097 — C4 authority defaults are not free (adjacent: authority-surface complexity).
- L-0130 — cascade layer separation forces table count (sibling — three-test rule; this learning is the RLS axis of the same test).
- Council session 2026-04-23 (hospitality gap analysis).
- `schedule_absence` INSERT policy (project migration history).

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
