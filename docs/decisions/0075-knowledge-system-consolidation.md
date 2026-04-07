---
title: "Knowledge System Consolidation — DASHBOARD/SESSION vs Second Brain + claude-mem"
id: ADR_0075
status: accepted
version: 1.1
layer: decision
created: 2026-04-07
updated: 2026-04-07
---

# ADR-0075: Knowledge System Consolidation

> **v1.1 Amendment (2026-04-07)** — Council retrospective the same day flagged that ADR-0075 was violated by the commit that shipped ADR-0075 (`cb7c7c60` was committed directly to development in violation of this ADR's own resolved Open Q3). The husky hooks added by ADR-0075 enforced filesystem invariants but not branch discipline. v1.1 adds:
>
> 1. **Husky Hook #7 (branch guard)** — mechanically blocks direct non-merge commits to `development`/`preview`/`main`. Two parallel Claude sessions can no longer overwrite each other on `development`. See `.husky/pre-commit` lines 197+.
> 2. **Husky Hook #8 (ORIENTATION anchor)** — `docs/ORIENTATION.md` must reference ADR-0075. Prevents accidental drift removing the source-of-authority link.
> 3. **ORIENTATION.md promoted to Boot Sequence step 0** in both `~/.claude/CLAUDE.md` and project `CLAUDE.md`. Previously self-described as "North Star" but not actually read at session start. Now load-bearing.
> 4. **ORIENTATION.md self-listed as tier 0** in its own trust hierarchy ("derived from ADR-0075"). Closes the self-reference gap where the file's authority was implicit.
>
> Council also identified two follow-up ADRs to write later:
> - **ADR-0076** — Build-agent verification evidence contract (raw output mandatory in HANDOFF DoD sections, `docs/templates/handoff.md` template, close-feature.sh grep gate)
> - **ADR-0078** — Dev-time agent infrastructure parity (`dev_session` table, sealed envelope subagent prompts, `dev.*` telemetry family). ADR-0077 number reserved/skipped.
>
> Council session log entry: `docs/council/COUNCIL-LOG.md` 2026-04-07 entry "Three-issue retrospective: build-agent gap, parallel sessions, ADR-0075 v1.1".

## Context and Problem Statement

## Context and Problem Statement

The repo currently maintains two markdown files — `docs/DASHBOARD.md` and `docs/SESSION.md` — that overlap substantially with two other knowledge systems we already own: the Second Brain vault (`~/dev/second-brain-v2`, with its append-only `ops/activity-log.md`) and claude-mem (cross-session observational memory via MCP).

The overlap produces three concrete problems:

1. **DASHBOARD.md's `Session History` table** (150+ rows like `2026-04-06 | feature-x | started | wt-2, module: foo`) is a worse version of `activity-log.md`. Same information, less discipline (mutable, hand-edited, prone to drift).
2. **SESSION.md's `What was done` + `Where we stopped` narrative** is a worse version of claude-mem. claude-mem auto-extracts observations from every session (e.g. observation 561 "Employee Contract Management Feature Completed" landed without any manual log). The manual narrative grows stale immediately and is hand-updated by slash commands.
3. **`new-feature.sh` templates a fresh `docs/decisions/0000-decision-log.md` on every feature start**, wiping prior ADRs from the working tree (caught during journey-harness-poc verification 2026-04-07). The underlying script bug is fixable in 2 lines, but the fact that a per-feature script touches a per-repo artifact is a design smell — ADRs should not be something the feature-start script owns.

At the same time, some content *must* stay in the repo: worktree state is a git-native concern, and architectural decisions (ADRs) are code-review material that belongs in git blame, diffs, and PR reviews.

The question is: **which tracking responsibilities belong in-repo vs which belong in Second Brain / claude-mem, and how do we migrate without breaking the slash-command workflow?**

## Decision Drivers

- **Single source of truth per concern.** Duplication across DASHBOARD.md, SESSION.md, activity-log.md, and claude-mem creates drift and cognitive overhead.
- **Match storage to lifetime.** "What's live right now" ≠ "what happened historically" ≠ "what was the narrative arc." Each has a different natural home.
- **Keep git-native things in git.** Worktrees, branches, and ADRs are part of the code review loop.
- **Don't lose safety nets.** SESSION.md is today's safety net when claude-mem or Second Brain is unreachable. Any migration must preserve session-start orientation even when MCP servers are down.
- **Minimize slash-command churn.** The 4 commands (`/start-feature`, `/end-session`, `/close-feature`, `/status`) encode the current structure. Rewriting them is acceptable cost but not free.
- **Fix the `new-feature.sh` decision-log bug regardless.** Whether or not we consolidate, the script should not wipe repo-level artifacts.

## Considered Options

1. **Status quo + bugfix only** — Fix `new-feature.sh` to not wipe the decision log. Leave DASHBOARD.md and SESSION.md as-is. Keep all duplication. ~5 minutes.

2. **Migrate everything to Second Brain + claude-mem** — Delete DASHBOARD.md, SESSION.md, and decision-log from the repo. Move all tracking to the vault and mem. Slash commands become vault-writers.

3. **Consolidation with clear boundaries (RECOMMENDED)** — Keep git-native state in the repo (slimmed), move history/narrative to the systems designed for them, rewrite slash commands to match. See "Decision Outcome" for the boundary definition.

## Decision Outcome

Chosen option: **"Option 3 — Consolidation with clear boundaries"**, because it eliminates duplication without relocating content that genuinely belongs in git, and because the migration cost (~1.5h) is recovered quickly in reduced daily friction and eliminated drift.

### The boundary definition

| Content | Current home | New home | Rationale |
|---|---|---|---|
| Active worktrees table | `docs/DASHBOARD.md` | `docs/DASHBOARD.md` (slimmed) | Git-native, fast lookup, no MCP round-trip |
| Free slots | `docs/DASHBOARD.md` | `docs/DASHBOARD.md` (slimmed) | Derived from `git worktree list` |
| Pending journeys | `docs/DASHBOARD.md` | `docs/DASHBOARD.md` (slimmed) | Tied to feature branches — journey files live in repo |
| **Session history table** | `docs/DASHBOARD.md` | **`~/dev/second-brain-v2/ops/activity-log.md`** | Audit trail — exactly what activity-log is for |
| **Recent closures table** | `docs/DASHBOARD.md` | **`~/dev/second-brain-v2/ops/activity-log.md`** | Historical event stream — audit territory |
| **"What was done" narrative** | `docs/SESSION.md` | **claude-mem (auto-extracted) + `~/.claude/projects/.../memory/`** | Cross-session memory — already being captured automatically |
| **"Where we stopped" / in-flight context** | `docs/SESSION.md` | **`~/.claude/projects/.../memory/` (auto-memory)** | Ephemeral continuity — already exists as a system |
| **"Known blockers" / "Pending decisions"** | `docs/SESSION.md` | **claude-mem + activity-log** | Operational state — fits mem |
| Decision log (ADRs) | `docs/decisions/` | `docs/decisions/` **(unchanged)** | Code-review material, belongs in git blame + PRs |
| Individual ADR files | `docs/decisions/NNNN-*.md` | unchanged | Same reason |

### What the slimmed DASHBOARD.md looks like

Target: **~30–40 lines**, three sections only:

```markdown
---
title: Development Dashboard
status: live
updated: <auto>
---

# Development Dashboard

> Pure git state. Regenerated by /status. No history — see ops/activity-log.md.

## Active Worktrees
| # | Branch | Module | Status | Progress |
| -- | ------ | ------ | ------ | -------- |
| wt-1 | feat/foo | module-x | in_progress | … |
...

## Free Slots
| # | Available |
...

## Pending Journeys
| Worktree | Feature | Journey File | Status |
...
```

No session history. No recent closures. No history at all. The file is pure "what's live in git right now" and should be trivially regeneratable from `git worktree list` + filesystem scans.

### Slash command contract changes

| Command | Before | After |
|---|---|---|
| `/start-feature` | Appends to DASHBOARD session history + updates SESSION.md | Adds row to DASHBOARD active worktrees table + writes event to activity-log via `log-activity.sh session claude "feature-start:foo wt-N"` |
| `/end-session` | Rewrites SESSION.md narrative + appends to DASHBOARD history | Writes narrative to activity-log + triggers claude-mem session_digest + updates auto-memory if in-flight context exists |
| `/close-feature` | Writes HANDOFF + DASHBOARD history + SESSION | Writes HANDOFF to repo + activity-log event + updates active worktrees table |
| `/status` | Reads DASHBOARD | Regenerates DASHBOARD from `git worktree list` + journey file scan; also tail of activity-log for recent activity |

### Safety nets for when systems are down

- **If claude-mem MCP is unreachable at session start:** read DASHBOARD.md for worktree state + `activity-log.md` tail directly (it's a flat markdown file, no MCP needed). Degraded mode but functional.
- **If Second Brain vault is not sync'd or Obsidian is closed:** `activity-log.md` is a plain file on disk — still writable via `log-activity.sh`, still readable via `tail`. Obsidian is a UI, not a runtime dependency.
- **If `~/.claude/projects/.../memory/` is missing:** fall back to DASHBOARD + activity-log. Memory is an accelerator, not a requirement.

**The key invariant:** DASHBOARD.md + activity-log.md together must be sufficient to orient at session start, even with everything else down. This is strictly an improvement over today, where SESSION.md is the sole continuity file and a single stale edit breaks orientation.

### Migration path

Sequenced to minimize daily disruption:

1. **Fix `new-feature.sh`** — 2-line change: "do not touch decision log if it already exists." ~5 min. Decoupled from migration.
2. **Slim DASHBOARD.md** — cut session history + recent closures sections. Keep active worktrees + free slots + pending journeys. ~15 min.
3. **Rewrite slash commands** — 4 commands, update their bash scripts to write to activity-log instead of DASHBOARD/SESSION sections. ~45 min.
4. **Delete SESSION.md** — after verifying claude-mem + activity-log cover the same ground. Final step. ~5 min.
5. **Update `CLAUDE.md`** — boot sequence changes to "read DASHBOARD.md + tail activity-log + query claude-mem if available." ~10 min.
6. **Smoke test** — `/start-feature → /end-session → /status → /close-feature` round trip on a throwaway branch. ~15 min.

Total: ~1.5 hours. Should fit in a single focused session.

### Out of scope (deliberately)

- Migrating ADRs to the vault. They stay in `docs/decisions/`.
- Migrating module docs (`docs/modules/*.md`), architecture docs, protocols. They stay in repo — they're reference documentation, not state.
- Killing the `docs/plans/` directory. Per-feature implementation plans stay in repo (they're part of the feature branch artifact).
- Second Brain vault structure changes. This ADR does not redesign the vault.

## Rules & Consequences

- **Good, because** single source of truth per concern — no more hand-merging session history tables across worktrees.
- **Good, because** DASHBOARD.md becomes trivially regeneratable, eliminating the `new-feature.sh` templating-bug category entirely (beyond the immediate bugfix).
- **Good, because** activity-log already captures what session history was trying to capture — we're using an existing system instead of building a second one.
- **Good, because** claude-mem is already auto-extracting session narratives — the SESSION.md manual updates are redundant work.
- **Good, because** the boundary is crisp and defensible: git-native state in git, audit/narrative/memory in the systems designed for them.

- **Bad, because** slash command rewrite is a non-trivial change and could temporarily break daily workflow during the migration hour.
- **Bad, because** claude-mem MCP being unavailable at session start becomes more noticeable — the safety net is activity-log tail + DASHBOARD, which is slightly less rich than SESSION.md's curated narrative.
- **Bad, because** activity-log lives in a different git repo (second-brain-v2), so "everything about this session" is no longer in a single `git log` command. Trade-off: cross-project continuity vs single-repo grep.
- **Bad, because** once SESSION.md is deleted, any CLAUDE.md references or external tooling that assumes its existence will break. Must be grep'd before deletion.

- **Agent Impact:**
  - Claude at session start reads DASHBOARD.md (thin), tails activity-log, optionally queries claude-mem via MCP. No more SESSION.md read.
  - Slash commands emit events via `log-activity.sh` instead of appending to markdown tables.
  - `new-feature.sh` stops templating any file that already exists in the repo.
  - When writing about "what happened this session," Claude writes to activity-log via the script, not by editing SESSION.md.
  - CLAUDE.md boot-sequence paragraph must be updated in the same PR that deletes SESSION.md to avoid instructing agents to read a file that doesn't exist.

## Open Questions — Resolved 2026-04-07

1. **Should `/end-session` still write a human-readable markdown summary somewhere?**
   **Resolved: Option (a) — write a single long-form entry to activity-log.md.** No parallel file. The long-form entry serves as "the story of the day" and is chronologically ordered with other events, so `tail -n 200 activity-log.md` at session start gives both narrative and audit in one read.

2. **Is activity-log.md the right sink for "feature closed" events, or should those also appear in a repo-local closures log?**
   **Resolved: activity-log only. No repo-local closures log.** Rationale: `git log --merges` on the development branch provides the closure audit for smartout.ai specifically, and activity-log provides the cross-project view. Duplicating to a repo-local `docs/closures.md` would recreate the exact drift problem this ADR is solving.

3. **Should we migrate in a feature branch or on development directly?**
   **Resolved: Feature branch `feat/knowledge-consolidation` in a fresh worktree.** Rationale: (a) CLAUDE.md enforces worktree discipline for all feature work regardless of whether it's product or tooling, (b) slash command rewrites have real risk of temporarily breaking daily workflow, a feature branch gives a rollback point, (c) the migration commit(s) will be easier to review as a coherent unit. Note: some pieces live outside the smartout.ai repo (`~/.claude/commands/*`, `~/.claude/scripts/new-feature.sh`) and cannot be worktree-isolated — those edits will be made live but staged last in the sequence so the repo-side changes are already committed and reversible.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
