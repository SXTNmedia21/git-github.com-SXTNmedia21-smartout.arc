---
title: "Project-local `.claude/scripts/*.sh` copies drift from global `~/.claude/scripts/`"
id: LEARNING_0263
status: canonical
layer: learning
created: 2026-05-14
updated: 2026-05-14
tags: [scripts, close-feature, sync-campaign, drift, maintenance]
---

# Learning-0263: Project-local `.claude/scripts/*.sh` copies drift from global `~/.claude/scripts/`

## Context

The Smartout repo maintains two copies of core lifecycle scripts:

| Global (user-machine) | Project-local (git-tracked) |
|---|---|
| `~/.claude/scripts/close-feature.sh` | `.claude/scripts/close-feature.sh` |
| `~/.claude/scripts/sync-campaign.sh` | `.claude/scripts/sync-campaign.sh` |

Global scripts are edited in place and are NOT commit-tracked. Project-local scripts are git-tracked under `development`. When a bug fix is applied, it must be applied to BOTH copies — 4 file edits per change.

Drift surfaced 2026-05-14 in the Council on close-feature pipeline traps: the `sync(...)` commit message typo, the `|| true` swallowed push, and the missing Gate 0 pre-flight check all existed in both copies. Each required a separate edit. Without a deliberate dual-site discipline, the copies will drift independently.

## Discovery

The 2026-05-14 Council mandated 4-site edits for Change A (sync→chore), 2-site edits for Change B (push exit-code), and 2-site edits for Change C (Gate 0). Steward Phase 3 missed the 4-site scope (global + project-local × 2 scripts) and only recommended single-site fixes; Phase 5 reversed this on on-disk verification.

## Impact

Any future script change affecting `close-feature.sh` or `sync-campaign.sh` requires editing both the global and project-local copies. Checklist:

1. `~/.claude/scripts/close-feature.sh` (global, not git-tracked)
2. `~/.claude/scripts/sync-campaign.sh` (global, not git-tracked)
3. `.claude/scripts/close-feature.sh` (project-local, git-tracked)
4. `.claude/scripts/sync-campaign.sh` (project-local, git-tracked)

A separate consolidation sortie should evaluate symlinking or sourcing the global scripts from project-local wrappers to eliminate drift surface. Deferred — out of scope for this Council.

## References

- Council 2026-05-14 — close-feature pipeline traps, Change A/B/C verdict
- L-0261 (`|| true` swallows push hook failures) — same 4-site surface
- L-0262 (commitlint `sync` type invalid) — same 4-site surface
- Steward Phase 5 Chair Self-Reversal on 4-site scope (8th L-0147 precedent)

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
