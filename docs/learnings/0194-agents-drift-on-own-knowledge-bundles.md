---
title: "Agents drift on their own knowledge bundles — same fact-check rigor applies to self-bundles as to external docs"
id: L_0194
status: accepted
layer: learning
created: 2026-05-04
updated: 2026-05-04
references:
  - ./0193-audit-from-memory-hook-myth.md
  - ./0195-knowledge-md-staleness-confusion-vectors.md
---

# L-0194: Agents drift on their own knowledge bundles — same fact-check rigor applies to self-bundles as to external docs

## Why

During the 2026-05-04 P0 doc-rewrite session, deploy-conductor ran a self-audit of its KNOWLEDGE.md bundle. The audit surfaced 4 own-knowledge-bundle drifts that had accumulated since the agent was created on 2026-05-03:

1. **ADR-0262 → ADR-0265**: KNOWLEDGE.md §11 still referenced ADR-0262 (deploy-conductor's bootstrap ADR, superseded by ADR-0265 accepted in the same session). All citations in PLAYBOOK.md and operator Q&A carried the wrong number forward.
2. **F2/F3 status flip**: KNOWLEDGE.md had F2 and F3 reversed (F2 = secrets seeded, F3 = ruleset flip). Actual: F2 = ruleset flip, F3 = secrets seeded. The flip meant the Reflection Protocol would have generated wrong follow-up advice if operator asked "what's left on F3?"
3. **Dev SHA stale**: KNOWLEDGE.md §1 held a SHA from the bootstrap snapshot (9c2442382) that was no longer current dev HEAD.
4. **§14 Telegram-tap missing**: ADR-0271 sub-specs added a Telegram-tap step to the deploy lifecycle, but §14 of KNOWLEDGE.md had no entry for the tap protocol.

These drifts accumulated in < 24 hours. The agent's Reflection Protocol (run at the end of each session entry in RUNS.md) is retrospective — it catches drift after it has already existed for one session. The protocol does NOT prevent silent accumulation between runs.

The root cause is architectural: Claude Code agents have no "ambient re-read" mechanism. SESSION.md is deprecated (ADR-0075). There is no automatic injection of own-bundle content at each tool call. The agent only reads its own KNOWLEDGE.md when explicitly called to do so (session start, Reflection Protocol). Between those reads, the bundle can drift from reality.

## How to apply

1. **At session start, explicitly read KNOWLEDGE.md §1 and the 2 most recently updated sections** (not just the frontmatter). This is now encoded in deploy-conductor's agent boot sequence in RUNS.md.
2. **At every ADR acceptance or status change**: same-session update to KNOWLEDGE.md §11 (cross-references). Do not defer ADR updates to "next session."
3. **After every sortie or campaign merge to development**: re-verify KNOWLEDGE.md facts that reference SHA, branch state, or task status.
4. When auditing a knowledge bundle (self-audit or external): apply the same Read-citation requirement as L-0117 demands for codebase claims. "Bundle says X" is not evidence; "bundle says X, file reads Y" is evidence.
5. **Agent deploy-conductor**: Reflection Protocol already requires curation after each run. Add to the curation checklist: "Does §11 cite the current ADR number? Do §1 deployment gates match the real ruleset?"

## Pattern signature

- Agent was created or last audited > 12h ago
- A new ADR was accepted in the interim
- A status flag (F1/F2/F3 or equivalent) changed state in the interim
- Agent is called to act on a claim from its own bundle

When all four: re-read the relevant KNOWLEDGE.md section before acting, even if you "know" the answer.

## References

- `.claude/agents/deploy-conductor/RUNS.md` — 2026-05-04 P0 doc-rewrite entry, 4 bundle-drifts documented
- `.claude/agents/deploy-conductor/KNOWLEDGE.md` — the bundle that drifted
- `./0193-audit-from-memory-hook-myth.md` — L-0193: sibling pattern (hook claim from memory)
- `./0195-knowledge-md-staleness-confusion-vectors.md` — L-0195: immediate vs deferred staleness cost
