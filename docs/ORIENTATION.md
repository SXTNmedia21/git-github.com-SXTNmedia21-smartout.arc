---
title: "Orientation — Where to Look for What (ADR-0075)"
status: canonical
updated: 2026-04-07
created: 2026-04-07
module: meta
tags: [orientation, north-star, adr-0075]
---

# Orientation

> Agent boot-sequence cheat sheet. If you're starting a session (human or AI), read this first.
> Authoritative rationale: [ADR-0075](decisions/0075-knowledge-system-consolidation.md).

## The 30-Second Boot

```
1. pwd + git branch --show-current + git worktree list      → where am I?
2. cat docs/DASHBOARD.md                                     → what's live in git RIGHT NOW
3. tail -n 100 ~/dev/second-brain-v2/ops/activity-log.md     → what happened recently (audit)
4. claude-mem via MCP (if available)                         → cross-session narrative memory
5. ls docs/decisions/0000-decision-log.md                    → ADRs (create if missing)
```

If step 4 (MCP) is unavailable: steps 2+3 are sufficient. Do not block on MCP.

## Where does X live?

| I need to know... | Look here |
|---|---|
| What worktrees are active right now | `docs/DASHBOARD.md` (single source of truth for live git state) |
| Which worktree slots are free | `docs/DASHBOARD.md` § Free Slots |
| What journey files are pending | `docs/DASHBOARD.md` § Pending Journeys |
| What happened yesterday / last week | `~/dev/second-brain-v2/ops/activity-log.md` (append-only, grep it) |
| What decisions were made and why | `docs/decisions/0000-decision-log.md` + individual `docs/decisions/NNNN-*.md` files |
| Narrative "what was done" from past sessions | claude-mem via MCP (`mcp__plugin_claude-mem_mcp-search__search`) or tail of `activity-log.md` |
| Persistent cross-session user/feedback facts | `~/.claude/projects/<repo>/memory/MEMORY.md` (auto-memory — NOT a session scratchpad, see anti-patterns) |
| Current system state (architecture, gaps) | `docs/STATE.md` (trust hierarchy at top of file — top sections are live, cascade sections may lag) |
| Botsson Arena + Stage Engine wiring status | **`docs/architecture/BOTSSON-SYSTEM-MAP.md`** — end-to-end pipe diagram, 🟢/🟡/🔴 per component. Read before any AI-harness work. |
| Database tables, routes, packages | `docs/reference/` |
| Module business logic | `docs/modules/` |
| Architecture decisions (ADRs) | `docs/decisions/` — code-review material, always in repo |
| Feature closure handoffs | `docs/handoffs/` |

## The Trust Hierarchy

When sources disagree, trust in this order:

0. **This file (`docs/ORIENTATION.md`)** — derived from [ADR-0075](decisions/0075-knowledge-system-consolidation.md). The orientation cheat sheet authority is the ADR; if they disagree, the ADR wins and this file is patched.
1. **Code + database schema + migrations** — the only 100%-er. It runs or it doesn't.
2. **`CLAUDE.md`** (repo-level + global) — conventions and rules
3. **`docs/decisions/`** — accepted ADRs (code-review reviewed, in git blame)
4. **`docs/DASHBOARD.md`** — live worktree state (regeneratable from `git worktree list`)
5. **`activity-log.md`** — append-only event history (audit trail)
6. **`claude-mem`** — cross-session memory (auto-extracted observations)
7. **`docs/STATE.md`** + **`docs/reference/`** — human-maintained snapshots (can drift)
8. **Other docs** (modules, architecture, cross-cutting) — reference material

## Anti-patterns (what NOT to do)

- ❌ Read `docs/SESSION.md` — **deleted per ADR-0075**. Its narrative role is split between activity-log and claude-mem.
- ❌ Append session history to `DASHBOARD.md` — DASHBOARD is pure git state only. History goes to activity-log.
- ❌ Edit DASHBOARD.md manually with lots of rows — it should stay under ~50 lines. If it grows, you're putting the wrong thing in it.
- ❌ Create new tracking markdowns in `docs/` root — the root has 5 files by design (BUILD_ORDER, DASHBOARD, INDEX, ORIENTATION, STATE). New state goes in activity-log or claude-mem.
- ❌ Block on claude-mem MCP being up — it's an accelerator, not a dependency. Degraded mode (DASHBOARD + activity-log tail) is fine.

## Safety Nets

| Situation | Fallback |
|---|---|
| claude-mem MCP unreachable | `tail -n 200 activity-log.md` + `cat DASHBOARD.md` |
| Second Brain vault not sync'd | `activity-log.md` is plain disk file — still readable via `tail`, still writable via `log-activity.sh` |
| `~/.claude/projects/<repo>/memory/` missing | Fall back to DASHBOARD + activity-log. Memory is an accelerator. |
| DASHBOARD.md stale (drifted from `git worktree list`) | Run `/status` to regenerate, or trust `git worktree list` directly |
| STATE.md flagged stale | Read cascade sections with caution; top "Active Work" section is refreshed more often |

## Slash Commands

| Command | Effect |
|---|---|
| `/start-feature name N module` | Creates branch + worktree. Writes `feature-start` event to activity-log. Does not touch SESSION (deleted). |
| `/status` | Shows worktrees + regenerates DASHBOARD view. |
| `/end-session [reason]` | Writes narrative to activity-log + triggers claude-mem digest. Updates DASHBOARD worktree row status. |
| `/close-feature N` | Enforces gates (decision log, journey, typecheck), merges to development, writes `feature-closed` event to activity-log. |

---

**This file is the North Star.** If something drifts from what's described here, trust the code and update this file.
