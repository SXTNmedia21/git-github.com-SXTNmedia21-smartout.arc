---
topic: concurrent-instances-wipe-shared-sxtn
status: active
updated: 2026-05-31T21:18:40Z
created: 2026-05-31T21:18:40Z
supersedes:
metadata:
  type: feedback
---

# Decision lesson — concurrent-instances-wipe-shared-sxtn

> Managed by sxtn-lesson-capture (mode: decision). Decision block = canonical truth.

---

## Decision

**Two Claude instances writing the same worktree `.sxtn/` concurrently WILL wipe each other's control surface.** Never run more than one instance against a shared worktree `.sxtn/` without isolation. `.sxtn/` (config.yaml, worklist.json, triggers.json, trigger-registry.json, autonomous-loop.active, enforce-gates, heartbeat.active) is mutable shared state with no locking — a second instance's re-arm/re-init can delete the first's files. Before arming a loop or writing `.sxtn/`, confirm sole ownership of that worktree; if a parallel instance exists, ONE instance owns `.sxtn/` and the others stay read-only. Recovery after a wipe: stop concurrent writers first, then re-seed config + registry from the plugin and rebuild the worklist — re-arming into active contention just repeats the loss.

## Why

2026-05-31 redesign-wiring: I armed the loop (autonomous-loop.active + enforce-gates + heartbeat) and built worklist.json in `smartout.ai-wt-2/.sxtn/`. A parallel "harness" instance re-armed/re-touched the same `.sxtn/` — disk then showed config.yaml, init-metadata.yaml, worklist.json, triggers.json, trigger-registry.json, AND the arm flags all GONE, heartbeat process dead, only heartbeat.log/dashboard (last writes) left. The other instance reported "loop running" — false; its read caught the beat's final log write, not the wiped flags. This is the cross-contamination class CLAUDE.md L-0316 warns about (parallel agents sharing a root without physical worktree isolation clobber staged files) — here applied to `.sxtn/` control state. Disk is truth; a confident "it's running" from a sibling instance must be disk-verified. Relates to [[loop-arms-in-project-not-plugin-source]] (arm flag lives in the worktree `.sxtn/` — exactly the surface that got wiped).

---

## History

<!-- appended on each UPDATE, oldest first -->

- 2026-05-31T21:18:40Z — initial: concurrent instances on a shared worktree .sxtn/ wipe each other; one owner per .sxtn/, others read-only; recover by stopping writers then re-seed + rebuild, not re-arm into contention.
