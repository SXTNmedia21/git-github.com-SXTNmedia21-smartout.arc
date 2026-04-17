---
name: worktree
description: Use when creating a new git worktree for feature work. Enforces plan-file propagation so subagents don't spawn against empty plans. Triggers on "create worktree", "new worktree", "start feature in worktree", or before dispatching parallel agents to a worktree.
---

# Create Feature Worktree

1. Verify plan file is committed to main repo (`git log --oneline -5 -- plans/`)
2. Create worktree: `git worktree add ../wt-<name> feat/<branch>`
3. `cp` plan file into worktree if needed
4. Verify plan is readable in worktree before dispatching agents
