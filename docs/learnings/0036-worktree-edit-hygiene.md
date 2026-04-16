---
title: Learning 0036 — Worktree Edit Hygiene
status: captured
created: 2026-04-16
updated: 2026-04-16
module: meta-process
tags: [learning, git, worktree, process, ci-hygiene]
---

# Learning 0036 — Worktree Edit Hygiene

## Context

During the 2026-04-16 session: an Edit was made to `docs/superpowers/specs/2026-04-09-agent-harness-foundation-design.md` in the main repo (`/home/sxtnl/dev/smartout.ai`, branch `development`) BEFORE a worktree was later created for the feature. The `new-feature.sh` script fetched fresh from `origin/development` into `/home/sxtnl/dev/smartout.ai-wt-4`, forking from a commit that did NOT include the spec edit. The feature branch never received the change. Council Phase 3 (Steward, same session) caught the gap only because the reviewer read the actual file in wt-4 rather than trusting the orchestrator's earlier report.

## What we learned

Once a worktree is created for a feature, **every subsequent edit related to that feature must happen inside the worktree**. Editing in the main repo (or another worktree) creates a silent split: the main repo keeps the edit uncommitted on `development`, the feature branch is missing context it should have. The split is invisible from any single directory — `git status` in the worktree is clean, `git status` in the main repo shows an unrelated uncommitted change.

## Why this matters

Planning documents, decision-log updates, and related spec edits belong in the same PR as the implementation. Drift between docs and code is the exact problem ADR-0075 tried to solve via the activity-log. A misplaced Edit breaks that contract.

## How to detect

Before any Edit on a file that could be feature-scoped:
- `pwd` — am I inside the worktree?
- `git branch --show-current` — am I on the feature branch, not `development`?
- `git worktree list` — does a worktree for this feature exist and is it the one I'm in?

## How to recover

If an Edit was made in the wrong tree:
1. If not yet committed: `cp` the file from the wrong tree into the worktree, stage + commit inside the worktree, then `git checkout --` the file in the wrong tree to discard.
2. If already committed: `git cherry-pick <sha>` from the wrong tree into the worktree, then revert the commit in the wrong tree (or let it sit until a separate PR picks it up).

## Related

- ADR-0075 — activity-log as append-only audit
- Council session 2026-04-16 — Botsson Runtime Review Phase 5 flagged this as a meta-process gap
