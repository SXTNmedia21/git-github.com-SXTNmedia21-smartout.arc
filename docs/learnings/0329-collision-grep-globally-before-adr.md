---
title: "Collision-grep globally before reserving a symbol — one flagged occurrence usually hides a second"
id: LEARNING_0329
status: canonical
layer: learning
created: 2026-05-23
updated: 2026-05-23
tags: [council, naming, collision, ontology, adr, l-0147-family]
---

# Learning-0329: Collision-grep globally before reserving a symbol

## Context

Council 2026-05-23 reviewed the InlineConfirmCard HITL primitive (ADR-0398). The chair (Steward Phase 3) flagged one naming collision: the proposed component name `ProposalCard` overlapped with the `change_proposal` C4 governance table. Supervisor reviewing in parallel grep-confirmed the collision count is actually **2** sites in the React codebase:

- `apps/web/src/app/dashboard/settings/_components/ChangeProposalsPanel.tsx:50` — existing `ProposalCard` React component for C4 governance.
- `apps/web/src/app/dashboard/schedule/proposed-plan/_components/ProposedPlanClient.tsx:238` — second existing `ProposalCard` React component for the cascade-proposal flow.

The chair's Phase 3 review had spotted the ontology overlap with the table but had NOT grepped the React component surface. The collision count went from 1 (declared) → 2 (actual) → confirmed during Phase 5 synthesis.

## Discovery

**When one reviewer flags a naming collision, the actual collision count is usually higher.** Symbol reuse compounds — once one developer chose `ProposalCard` for governance, a second developer doing schedule work reached for the same name, because the cascade vocabulary of "proposal" is broad. The first hit is the visible one; the second hit is silent until somebody renames.

The chair's Phase 3 prose-level reasoning ("change_proposal collision") missed the file-level evidence ("two React components also named ProposalCard"). The supervisor's grep caught it. This is sibling to L-0147 (single-axis reviewer insufficient) and L-0176 (docstring claims vs body evidence) — the meta-pattern is **prose review misses code-trace evidence**.

## Impact

**Hard rule for Phase 3 reviewers handling ADRs that propose a new component/type/symbol name:**

1. Before accepting any naming proposal, grep the symbol globally across the codebase:
   ```
   grep -rln "export.*<Symbol>" packages/ apps/ services/
   grep -rln "^<Symbol> *=" packages/ apps/ services/
   grep -rln "^class <Symbol> " packages/ apps/ services/
   grep -rln "^function <Symbol>" packages/ apps/ services/
   ```
2. Grep the table/column dimension separately:
   ```
   grep -rn "<symbol_snake_case>" supabase/migrations/ packages/supabase/src/
   ```
3. Report the count + file:line of every hit. If count ≥ 1, the ADR MUST either rename the proposed symbol OR document explicit collision tolerance with rationale.

**Promotion criteria (sibling to L-0147 promotion threshold):** if this learning recurs on a 3rd council session, promote to a Phase 3 hard rule in run-council SKILL.md under "Naming-Collision Mandate."

**For ADR-0398 specifically:** symbol `ProposalCard` is banned for new code. `InlineConfirmCard` for HITL primitives; existing `ProposalCard` instances (settings + schedule) retain current scope.

## References

- ADR-0398 — InlineConfirmCard Primitive (the ADR that surfaced this pattern).
- L-0147 family — single-axis reviewer insufficient; sibling promotions.
- L-0176 — docstring claims vs body evidence (same prose-vs-code class).
- `apps/web/src/app/dashboard/settings/_components/ChangeProposalsPanel.tsx:50`
- `apps/web/src/app/dashboard/schedule/proposed-plan/_components/ProposedPlanClient.tsx:238`

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
