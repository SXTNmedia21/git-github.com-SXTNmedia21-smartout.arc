---
title: "Plan — tooling-optimization"
status: done
updated: 2026-04-06
created: 2026-04-06
module: developer-experience
tags: [plan]
---

# Plan — tooling-optimization

> Branch: `feat/tooling-optimization` | Worktree: wt-9 | Module: developer-experience | Started: 2026-04-06

**Spec:** [2026-04-06-developer-tooling-optimization-design.md](../../superpowers/specs/2026-04-06-developer-tooling-optimization-design.md)
**Implementation plan:** [2026-04-06-developer-tooling-optimization.md](../../superpowers/plans/2026-04-06-developer-tooling-optimization.md)

## Goal

Optimize Smartout's Claude Code tooling — skills, plugins, MCP, session memory — and slim CLAUDE.md by moving domain content into authoritative skills.

## Tasks

- [x] Task 1: Create smartout-database-guide skill
- [x] Task 2: Create smartout-cascade-developer skill
- [x] Task 3: Create smartout-edge-function-guide skill
- [x] Task 4: Create smartout-nordic-split skill
- [x] Task 5: Delete 18 irrelevant global skills
- [x] Task 6: Fix 5 symlinks
- [x] Task 7: Commit deleted repo skill files
- [x] Task 8: Configure n8n and Sentry MCP servers
- [x] Task 9: Remove duplicate plugins
- [x] Task 10: Install claude-mem plugin
- [x] Task 11: Move 5 skills from global to repo-local
- [x] Task 12: Slim CLAUDE.md (566 → 347 lines)
- [x] Task 13: Update agent definitions
- [x] Task 14: Update tool-index skill
- [x] Task 15: Verification
- [ ] Task 16: smartout-agent-dev rewrite (SEPARATE BRANCH — deferred)

## Acceptance Criteria

- [x] CLAUDE.md under 350 lines (347)
- [x] 5 skill pointers in CLAUDE.md
- [x] All repo-local skill frontmatter valid
- [x] No broken symlinks
- [x] No duplicate plugins
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated
- [ ] User journeys written
