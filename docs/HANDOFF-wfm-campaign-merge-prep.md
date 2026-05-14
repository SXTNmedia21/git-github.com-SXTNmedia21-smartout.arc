---
title: HANDOFF — WFM Campaign Merge Prep
status: done
updated: 2026-05-14
created: 2026-05-14
feature: wfm-campaign-merge-prep
module: governance
tags: [handoff, governance, campaign, learning-renumber]
---

# HANDOFF — WFM Campaign Merge Prep

## Summary

Sub-sortie that resolved PHASE 4 verifier P0-1 (learning ID collision L-0252..L-0255 between `campaign/world-best-wfm` and `development`). Renumbered campaign-side learnings strictly above dev tip L-0263 to L-0264..L-0267 + updated 9 cross-reference files.

## Decisions made

- **No new ADR.** Operational doc-coherence fix, not architectural decision.
- **Renumber CAMPAIGN side, not dev.** Dev landed L-0261/L-0262/L-0263 (council script-fix) earlier today and was already on origin. Renumbering dev-side would invalidate landed council references.
- **L-0209 7th occurrence note appended** to log entry; rule already enforced in `run-council` SKILL.md Phase 8 Step 0 (covers both ADR + learning numbers via `git log --all`).

## Learnings discovered

- Pre-commit hook ENOENT on prettier in fresh worktree → `pnpm install` from worktree root populates `node_modules`. (Sibling to `learning_worktree_missing_pnpm_symlinks` + new Gate 0 in close-feature.sh v8.)
- G3 council learnings (L-0252..L-0255) were log-only entries with no physical `.md` files. Renumber path = log row + frontmatter (where present) + cross-refs only; no `git mv`.

## Cross-reference touch-list

| File | Sites |
|---|---|
| `docs/learnings/0000-learning-log.md` | 4 campaign rows + L-0209 7th-occurrence append |
| `docs/HANDOFF-world-best-wfm-campaign.md` | 3 (summary, table, G3-findings) |
| `docs/HANDOFF-scheduler-greedy.md` | 2 (L-0266, L-0267) |
| `docs/HANDOFF-pos-lightspeed-mvp.md` | 1 (L-0264 section) |
| `docs/HANDOFF-shift-marketplace.md` | 2 (L-0265, L-0267) |
| `docs/decisions/0320-pos-driven-hour-factor-calibration.md` | 1 (L-0265) |
| `docs/decisions/0321-swap-marketplace-convergence.md` | 1 (L-0264) |
| `docs/journeys/JOURNEY-scheduler-mobile.md` | 1 (L-0267) |
| `docs/council/COUNCIL-LOG.md` | 1 (G3 record line 1896) |
| `~/.claude/projects/.../memory/council_meta.md` | 7th-occurrence note (user-machine-level, not git-tracked) |

## Known issues / debt

- None. All cross-refs updated atomically in commit `705fcb241`.

## Next steps

- Close sub-sortie via `close-feature.sh` (this run).
- Eventual `campaign/world-best-wfm` → `development` PR (Pontus only) — campaign now ID-clean for clean merge.
- PHASE 4 V1 noted P1: intent-classifier prompt body lacks Norwegian routing examples for new caps. Sortie-12 follow-up; non-blocking.

## ADRs / learnings shipped

- ADRs: none
- Learnings: none net-new (this sortie RENUMBERS existing G3 council learnings; no new learning created)
- Note appended to existing L-0209 log row: 7th-occurrence today
