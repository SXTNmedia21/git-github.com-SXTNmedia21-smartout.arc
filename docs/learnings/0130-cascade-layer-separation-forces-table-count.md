---
id: L-0130
title: "Cascade layer separation forces table count"
status: accepted
date: 2026-04-23
type: architecture
created: 2026-04-23
updated: 2026-04-23
related_adrs: [ADR-0200]
related_learnings: [L-0029, L-0132]
module: cascade
tags: [cascade, invariant, schema-design, rls, authority, council]
---

# L-0130 — Cascade layer separation forces table count

## Context

Hospitality gap analysis council (2026-04-23) considered whether to add new employee-availability primitives (soft unavailability + ranking preferences) by extending `schedule_absence` with additional `absence_type` enum values. The "extend, don't add" heuristic is usually cheap and correct — one table is less surface than three.

Three forces pushed back:

1. **Lifecycle owner differs** — `schedule_absence` rows are created by managers (or self-service flows that route through manager approval); the new availability rows are created by employees without approval gate.
2. **RLS shape differs (L-0132)** — `schedule_absence` INSERT is `is_admin_in_workspace`-gated. Extending with employee-writable enum values would require splitting the policy on `absence_type` — load-bearing conditional RLS that breaks on next enum value.
3. **Authority shape differs** — absence is `confirm` / min_role=manager; availability self-set is `suggest` / min_role=employee; availability query-others is `read_only` / min_role=manager. Three distinct authority rows per workspace.

A single-table collapse with a `kind`-style discriminator would have to carry three authority shapes, three RLS shapes, and three lifecycle owners — the discriminator doing structural work that table-splitting does better and more legibly.

## Discovery

**When trying to collapse semantically-different cascade data into one table, apply the three-test rule:**

1. **Different lifecycle owner?** — does one rowset come from admins and another from employees? Or one from a cron job and another from a human action?
2. **Different RLS policy shape?** — would the INSERT / UPDATE / DELETE policies have to branch on a discriminator column?
3. **Different authority default?** — is one rowset `suggest` while another is `confirm` or `read_only`? Does min_role differ?

**Any "yes" → separate tables.** Any two "yes" answers → separate tables AND separate capabilities. All three "yes" → the collapse is papering over a cascade invariant violation.

This generalizes cascade invariant #2 ("every datum has one role in the cascade") into a schema-design test. The invariant itself is abstract; the three-test rule makes it actionable at PR time.

## Impact

**Schema-design reviews gain a three-test checklist.** When a PR proposes an enum expansion on an existing table (especially `absence_type`, `status`, `kind`, `type` columns), the author must answer all three tests in the PR description. If any answer is "yes", the reviewer pushes back on the enum expansion and asks for a table split.

**CLAUDE.md / database-guide skill.** Add the three-test rule to `smartout-database-guide` skill's schema-design section as a required thought step before any enum expansion on a table with mixed lifecycle owners. Skill already enforces database brainstorm (2026-03-22 feedback); the three-test rule is a specific sharpening.

**Council Phase 2.5 / Phase 3 gain a test for this specific smell.** For any proposal that "extends table X with new enum value", fact-check asks: what is X's RLS INSERT shape? Does the new enum value's use case pass that RLS? If no, flag as three-test failure.

**Does NOT apply to low-structure enum expansions.** Expanding `status` on a table whose RLS does not branch on `status`, whose lifecycle is uniform, and whose authority is uniform is fine — the three-test rule returns three "no" answers. The rule catches the *semantic* collapse, not every enum expansion.

**Anti-pattern named.** "Enum-filter ceremony" — reading a table as `WHERE kind = X` to simulate what a separate table would have expressed directly. When the consumer query always filters on the discriminator, the discriminator is the table.

## References

- ADR-0200 — employee availability three-table model (the decision this learning surfaced).
- L-0029 — four parallel permission mechanisms is ontology smell (related: count mechanisms; this learning counts tables).
- L-0132 — RLS admin-gate kills "extend, don't add" argument (the specific RLS evidence for the hospitality case).
- Cascade invariant #2 (`docs/architecture/` or project-level cascade reference) — "every datum has one role".
- Council session 2026-04-23 (hospitality gap analysis).

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
