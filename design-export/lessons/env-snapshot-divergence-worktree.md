---
topic: env-snapshot-divergence-worktree
status: active
updated: 2026-06-01T01:14:22Z
created: 2026-06-01T01:14:22Z
supersedes:
metadata:
  type: reference
---

# Decision lesson — env-snapshot-divergence-worktree

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

The session-start `gitStatus` env snapshot is **not authoritative** for the live
tree — it can reflect a **different worktree/branch** than the one the live repo is
on. When files listed in the snapshot are absent from the live `git status`, the
default hypothesis is **sibling-checkout divergence** (e.g. `~/wsl/smartout.ai` vs
`~/wsl/smartout.ai-wt-2`), NOT data loss. **Verify before treating as loss:**
`git -C <sibling> status`, `find <sibling> -name <file>`, and check both worktrees
via `git worktree list`. Only after both checkouts are searched and a rescue/autosnap
tag is confirmed absent should a file be declared lost.

Concretely, on 2026-06-01 these 6 files appeared in the `refac/smartout` env snapshot
but were absent from the live `refactor/smartout` tree (`smartout.ai-wt-2`):
`.mcp.json`, `apps/web/src/app/dashboard/_hooks/use-assign-task.ts`,
`use-create-quick-task.ts`, `_actions/assign-task-action.ts`,
`_actions/create-quick-task-action.ts`, `docs/IMPLEMENTATION-HARNESS.md`.
Treat as sibling-checkout work pending verification — do NOT assume lost.

## Why

Two earlier data-loss events this campaign (git clean/reset wiping untracked work)
trained a fast "it vanished" reflex. But the env snapshot is captured once at session
start and is branch/worktree-specific; a later checkout or a sibling worktree makes it
diverge from the live tree without anything being lost. Defaulting to "lost" triggers
needless recovery panic and risks destructive re-restore over good state. The safe
default is verify-both-checkouts-first. See
[[commit-early-untracked-is-vulnerable]] and [[stale-branch-refac-vs-refactor]].

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-06-01T01:14:22Z — initial: env-snapshot gitStatus is worktree/branch-specific and not authoritative for live tree; absent files default to sibling-checkout divergence (smartout.ai vs smartout.ai-wt-2), verify both worktrees + rescue/autosnap tags before declaring loss; recorded the 6 specific files (.mcp.json, 2 task hooks, 2 task actions, IMPLEMENTATION-HARNESS.md) as pending-verification, not lost.
