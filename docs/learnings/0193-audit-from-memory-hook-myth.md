---
title: "Audit-from-memory drift — pre-commit hook #7 'blocks development' claim was false; always read hooks before citing them"
id: L_0193
status: accepted
layer: learning
created: 2026-05-04
updated: 2026-05-04
references:
  - ./0117-grep-based-structural-claims-must-be-code-traced.md
---

# L-0193: Audit-from-memory drift — pre-commit hook #7 'blocks development' claim was false; always read hooks before citing them

## Why

During the 2026-05-04 P0 doc-rewrite session, deploy-conductor audited its own knowledge bundle (KNOWLEDGE.md). The bundle contained a claim — also propagated in the council briefing — that "pre-commit hook #7 blocks direct commits to the development branch." This claim had survived 2 sessions without challenge.

End-to-end hook-read in the deploy-conductor bundle falsified it. Reading `.husky/pre-commit` directly revealed:

- The file runs 13 checks at most (not a numbered "#7" structure at all)
- None of the checks block commits to the `development` branch
- The branch-guard logic targets `main` and `preview` only
- The FF-ancestry check only fires on the `preview` branch (checking that the incoming push is a fast-forward from `development`)

The claim "hook #7 blocks development" appears to have originated from a mis-reading of the hook structure in a prior session — possibly confusing check numbering in RUNS.md notes with actual hook file structure. It was then carried forward as "known fact" into the KNOWLEDGE.md bundle and cited in briefings.

This is the same class of error as L-0117 (grep-based structural claims must be code-traced), but applied to agent self-knowledge rather than codebase claims. The agent was confidently wrong about its own operating environment.

Cross-reference: L-0117 (2026-04-22, 5th occurrence — promoted to hard rule: structural claims require Read citation file:line, not grep counts) and L-0193 are now 2 occurrences of "hook-myth pattern." A third occurrence warrants a `deploying` skill § "Hooks" trap entry.

## How to apply

Before citing any pre-commit or pre-push hook behavior in a plan, briefing, or skill:

1. Run `cat .husky/pre-commit` and `cat .husky/pre-push` — read the actual files.
2. For each claimed behavior, identify the exact lines that implement it.
3. Verify the branch guard logic: `grep -n "branch\|main\|preview\|development" .husky/pre-commit .husky/pre-push`.
4. Do NOT rely on memory or prior session notes for hook behavior claims — hooks change with commits.

Agent self-knowledge bundles (KNOWLEDGE.md, SKILL.md) are not exempt from this rule. An agent auditing its own knowledge bundle must apply the same code-trace discipline to operational-environment claims as it would to codebase claims.

## Pattern signature

- Claim about hook behavior cited in a plan or briefing
- Claim traces to "known from prior session" or KNOWLEDGE.md, not to a Read of the hook file
- Claim involves a specific numbered check, specific branch, or specific blocking behavior
- The claim is not challenged because it sounds plausible

When all four: read the hook file before the next sentence.

## References

- `.husky/pre-commit` — actual hook file (read this, not memory)
- `.husky/pre-push` — pre-push hook (FF-ancestry check on preview only)
- `./0117-grep-based-structural-claims-must-be-code-traced.md` — L-0117: sibling pattern (grep audit inflation)
- `.claude/agents/deploy-conductor/RUNS.md` — 2026-05-04 P0 doc-rewrite entry, L-0193 capture
