---
name: campaign-boot
description: Use at the start of any master-refactor campaign session, or when an agent boots into the worktree and needs to be oriented and current. Brings the campaign UP — regenerates the live dashboard from control.json, orients against ORIENTATION + manifest, surfaces wave/next/blockers, mounts the operating skills, loads the agent's own memory. The managed startup the orchestrator does not do by hand. Symptoms — "where are we", "boot the campaign", "bring up the dashboard", "what's next", stale dashboard, fresh session needing orientation.
updated: 2026-06-03
---

# Campaign Boot

The **managed startup** for a master-refactor session. One invocation brings the campaign UP — current,
oriented, mounted. It is the executable form of `docs/campaign/AGENT-ONBOARDING.md` Phase 1, plus the one
thing nobody does by hand: **regenerate the board so it is never stale.**

Run this first. Every session.

## Steps (in order)

1. **Regenerate the board.** Rewrite `docs/campaign/MISSION-DASHBOARD.html` + `MISSION-MANIFEST.md`
   rollups **from `docs/campaign/telemetry-map/*/control.json`** — current domain status, wave progress,
   the rollup counts. The board is machine-rewritten on every boot, never hand-edited, never stale.
2. **Orient.** Read `docs/campaign/ORIENTATION.md` (north-star) + `MISSION-MANIFEST.md` (waves · milestones).
3. **State check — on disk, not from memory:**
   - `git log --oneline -5` — what landed last.
   - which domains are at **L3** (a row in `activity_trail`) vs **L2** (emit wired) vs **mapped**.
   - what is `blocked` (read `control.json`), and the op/web status (L3 needs a running app).
4. **Mount.** `work-mode-core` (always) + `work-mode-orchestrator` (if you conduct).
5. **Load your memory.** `.claude/agent-memory/<agent_id>/` — your facts from prior runs.
6. **Surface.** Report in ≤6 lines: current wave · next domain · blockers · L3 count · dashboard path.
   No wall of text — the boot's output is a glance, not a essay.

## Rails

- **Evidence on disk.** Every state claim is read (`git log`, `control.json`, `activity_trail`) — never
  relayed, never remembered. A FAIL verdict is also a claim; diagnose before believing it.
- **Single `.sxtn` writer.** If a second instance owns `.sxtn`, boot **read-only** — orient + regenerate
  the board (a `docs/` file, safe), but do not mutate `.sxtn`.
- **No ghost.** The board shows real control.json numbers; if a domain has no data, it reads as mapped/empty,
  never invented.

## Output shape (what the human sees)

```
Wave W1 (light fan-out) · next: oppgaver · L3: 1/10 (min-dag) · blocked: none
op/web: down (L3 deferred) · last: 5bbc9cfbf Phase-1 complete · board ↻ docs/campaign/MISSION-DASHBOARD.html
Mounted: work-mode-core. Memory: 3 facts. Ready.
```

## Cross-references

- `docs/campaign/AGENT-ONBOARDING.md` — the full onboarding (Phase 0 bootstrap + Phase 1 = these steps).
- `work-mode-orchestrator` move 4 — board-regen is also a per-wave routine; boot does it at session start.
- `docs/campaign/ORIENTATION.md` — north-star this boot reads.
