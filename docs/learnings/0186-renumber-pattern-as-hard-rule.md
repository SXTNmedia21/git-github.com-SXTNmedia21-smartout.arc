---
title: "ADR number collisions occur in parallel sessions — allocate with buffer and verify via git log --all"
id: L_0186
status: accepted
layer: learning
created: 2026-05-04
updated: 2026-05-04
references:
  - ./0000-learning-log.md
---

# L-0186: ADR number collisions occur in parallel sessions — allocate with buffer and verify via git log --all

## Why

Parallel feature sorties and campaigns each allocate ADR numbers locally. When two branches are worked simultaneously without pushing, both may claim the same number. By the time the second branch merges, the number is already taken and a mid-session renumber is required — touching frontmatter, filenames, decision log, and every cross-reference.

Five documented occurrences in this codebase:

1. **2026-04-19 kanaler** — `0156-0159` allocated locally, found occupied on merge → bulk-renamed to `0160-0163` mid-session.
2. **2026-04-29 contracts** — `0233-0236` promoted to `0241-0244` after collision with concurrent botsson-surface-disambiguation work.
3. **2026-05-02 lovsen** — `0242-0245` renumbered to `0256-0259`.
4. **2026-05-02 payroll** — `0228-0229` renumbered to `0260-0261`.
5. **2026-05-04 pipeline** — ADR-0262 (deploy-conductor bootstrap) superseded by ADR-0265 accepted mid-session; KNOWLEDGE.md references lagged for 9 days.

The renumber itself is low-risk if caught early, but the downstream cost is high: `sed` bulk-renames over-match when numbers appear in non-ADR contexts (e.g. a botsson ADR legitimately had `id: ADR_0238` — the s/ADR_0238/ADR_0256/g pass corrupted it). Cross-references in COUNCIL-LOG, handoffs, and learnings also drift.

## How to apply

Before allocating any ADR number in a new session or branch:

1. Run `git log --all --oneline -- docs/decisions/ | head -20` — catches committed numbers on all branches, not just local HEAD.
2. Check pending sortie handoffs: `find docs -name 'HANDOFF-*.md' | xargs grep 'ADR-0'` — in-flight ADRs may not be committed yet.
3. **Allocate with a buffer** — take the next available number PLUS 3 (e.g. if `0185` is the last committed, start at `0186` and mark `0187-0189` as reserved). This absorbs concurrent work without collision.
4. After any `sed` bulk-rename: run `git status` immediately. Revert false-positive modified files (ADRs you don't own that happened to contain the old number string).
5. When closing a feature: verify the allocated numbers still resolve correctly via `grep -r "ADR_0NNN" docs/` before committing.

## Pattern signature

- Two branches active simultaneously with ADR-writing tasks
- Branch A allocates `0N` locally without pushing
- Branch B also allocates `0N` locally
- First-merged branch wins; second must renumber on merge
- Sed-rename then hits unrelated files containing the old number

## References

- `docs/decisions/0000-decision-log.md` — all accepted ADRs, shows current high-water mark
- Memory file `reference_adr_renumber_pattern.md` — 4 prior occurrences documented
