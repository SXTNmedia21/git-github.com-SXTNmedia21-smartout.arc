---
title: "User Journeys — tooling-optimization"
status: done
updated: 2026-04-06
created: 2026-04-06
module: developer-experience
tags: [journeys, skills, claude-code, tooling]
---

# User Journeys — Developer Tooling Optimization

## Journey: Developer starts database work

**Precondition:** Developer opens Claude Code in a Smartout worktree. CLAUDE.md loads (347 lines). No database skill loaded yet.

1. Developer says "Add a new table for employee certifications"
2. Claude Code matches keyword "table" against skill triggers
3. `smartout-database-guide` skill loads automatically (96 lines of DB context)
4. Developer sees schema map, RLS patterns, migration workflow, critical traps
5. Developer follows migration workflow: create SQL file, run via docker exec, regenerate types

**Postcondition:** Developer has full DB context without always loading 60+ lines in CLAUDE.md.
**Error paths:**

- Keyword doesn't match trigger → developer gets CLAUDE.md pointer ("See smartout-database-guide skill") and can invoke manually
- Skill content is stale → `# Last synced: YYYY-MM-DD` header alerts developer to verify

## Journey: Developer works on cascade scheduling

**Precondition:** Developer opens Claude Code. CLAUDE.md loaded with cascade pointer.

1. Developer says "Work on cascade season planning"
2. `smartout-cascade-developer` skill loads (84 lines)
3. Developer sees I1+6D+4C+K1a/K1b model, dimension-to-table mapping, implementation status
4. Developer checks Phase B status (partial — 4/6 done) before planning work
5. Developer follows cascade provenance rules (source_type + source_id)

**Postcondition:** Developer has full cascade context on-demand.
**Error paths:**

- Cross-cutting work (cascade + Edge Functions) → only one skill loads. CLAUDE.md has fallback: "For full context on any domain, invoke the relevant skill."

## Journey: Developer creates Edge Function

**Precondition:** Developer needs to create a new API endpoint.

1. Developer says "Create a new Edge Function for training data"
2. `smartout-edge-function-guide` skill loads (100 lines)
3. Developer sees auth pattern decision tree: JWT-only vs dual-auth vs cron-only
4. Developer follows new endpoint checklist: handler → route → registry → scope
5. Developer adds scope to canonical scope list
6. Developer sets `verify_jwt = false` in config.toml if needed

**Postcondition:** Edge Function created with correct auth pattern and scope guard.
**Error paths:**

- Missing scope guard → skill checklist catches it
- Rolling own auth instead of using `_shared/auth-middleware.ts` → skill explicitly says "NEVER roll your own auth"

## Journey: Developer builds UI component

**Precondition:** Developer needs to build a dashboard card.

1. Developer says "Build a new KPI card component"
2. `smartout-nordic-split` skill loads (108 lines)
3. Developer sees OKLCH warm palette rules, spring physics values (stiffness 30-45, NOT framer-motion default 300)
4. Developer uses CSS variable classes (`bg-background`, not `bg-zinc-950`)
5. Developer applies 40% reduction principle: space and light over borders and boxes

**Postcondition:** Component follows Nordic Split design system.
**Error paths:**

- Using hardcoded colors → skill explicitly forbids `bg-zinc-950`, `text-zinc-100`
- Wrong spring physics → skill has correct values with "These are the CORRECT values" warning

## Journey: Admin audits Claude Code tooling

**Precondition:** Admin wants to understand current skill/plugin/MCP inventory.

1. Admin runs `/status` to see worktrees
2. Admin checks `.claude/skills/` for repo-local skills (11 skills)
3. Admin checks `~/.claude/skills/` for global skills (19 skills)
4. Admin checks `.claude/settings.local.json` for MCP servers (Playwright, n8n, Sentry)
5. Admin verifies no broken symlinks: `find ~/.claude/skills/ -type l`
6. Admin verifies no duplicate plugins in `~/.claude/plugins/installed_plugins.json`

**Postcondition:** Full inventory of Claude Code tooling visible.
**Error paths:**

- Stale skill found → check `# Last synced:` header, update if needed
- Broken symlink → copy actual file from target path
