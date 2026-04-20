---
title: "Plan — strike-mcp-verification"
status: in_progress
updated: 2026-04-18
created: 2026-04-17
module: strike-mcp
tags: [plan, verification, mcp, bubble-migration]
---

# Plan — strike-mcp-verification

> Branch: `feat/strike-mcp-verification` | Worktree: wt-6 | Module: strike-mcp | Started: 2026-04-17

## Goal

Verify every strike-mcp tool (9 tools) × every perspective (happy path + edge cases) works after monorepo integration (commit `dc6360d9`, 2026-04-17), and document a usable test matrix for future sessions.

## Scope

- **In scope:** All 9 MCP tools exposed by `services/strike-mcp/src/index.ts`, run both as unit tests and as live MCP calls from a Claude Code session with `.mcp.json` registered.
- **Out of scope:** Fixing migration logic bugs surfaced by the verification (log + separate issue). Applying generated SQL to cloud Supabase. Regenerating `v3_schema.json`.

## Tools under test

| # | Tool | Purpose | Live deps |
|---|---|---|---|
| 1 | `list_workspaces` | List all Bubble workspaces | Bubble API |
| 2 | `inspect_workspace` | Entity-type counts for one workspace | Bubble API |
| 3 | `research_entity` | Write mapping JSON + vault narrative | Bubble API, vault dir |
| 4 | `plan_migration` | Enumerate migration steps for a workspace | Bubble API |
| 5 | `migrate_workspace` | Emit staging SQL for the workspace row | Bubble API, mappings |
| 6 | `migrate_locations` | Emit staging SQL for locations | Bubble API, mappings |
| 7 | `bundle_migration` | Merge staging files into one transaction | staging dir |
| 8 | `preview_sql` | Summarize bundled SQL | staging dir |
| 9 | `verify_target_empty` | Check local Supabase is empty for the target | Supabase local |

## Phases

### Phase A — Static (done 2026-04-17) ✅

- [x] `pnpm install` — ok
- [x] `pnpm -F @smartout/strike-mcp typecheck` — 0 errors
- [x] `pnpm -F @smartout/strike-mcp build` — `dist/index.js` produced at correct path
- [x] `pnpm -F @smartout/strike-mcp test` — 394/394 after fixing stale `tests/config.test.ts:49`
- [x] Integration bugs from monorepo migration fixed (commits `ae3c2d74` on feat branch, `8269fafc` on development)

### Phase B — Live MCP smoke per tool

**Prereqs checked at start of Phase B:**
- [ ] `BUBBLE_API_TOKEN` exported in shell (from `op://smartout_ai_prod/bubble/api-token`)
- [ ] `SUPABASE_URL` + `SUPABASE_ANON_KEY` exported (local Supabase)
- [ ] Local Supabase running (`npx supabase status`)
- [ ] Claude Code session restarted so `.mcp.json` is loaded

**Matrix (happy path):**

| # | Tool | Input | Expected |
|---|---|---|---|
| 1 | `list_workspaces` | `{}` | Array of `{id, name}`, length > 0 |
| 2 | `inspect_workspace` | `{workspace_id: "<strøm-or-similar>"}` | Entity counts per type, no 404s |
| 3 | `research_entity` | `{entity: "workspace"}` | File at `mappings/workspace.json` + vault narrative |
| 3b | `research_entity` | `{entity: "locations"}` | Same for locations |
| 4 | `plan_migration` | `{workspace_id: "..."}` | Ordered step list with record counts |
| 5 | `migrate_workspace` | `{workspace_id: "..."}` | `MigrationReport` with SQL path, file has BEGIN/COMMIT + 1 INSERT |
| 6 | `migrate_locations` | `{workspace_id: "..."}` | `02_locations.sql` with 1 INSERT per location |
| 7 | `bundle_migration` | `{workspace_slug: "..."}` | `bundled.sql` merges both files under one transaction |
| 8 | `preview_sql` | `{workspace_slug: "..."}` | Summary with insert counts per table, no warnings |
| 9 | `verify_target_empty` | `{workspace_slug: "..."}` | `{empty: true}` before apply |

### Phase C — Perspective / edge cases

| # | Tool | Perspective | Expected |
|---|---|---|---|
| C1 | `inspect_workspace` | Unknown workspace id | Structured error, not crash |
| C2 | `research_entity` | Entity name not in registry | Clear error listing known entities |
| C3 | `research_entity` | Re-run after review — narrative says "No new fields", reviewed mappings preserved | |
| C4 | `migrate_workspace` | Run before `research_entity` for workspace | Refuses because mapping has `needs_review: true` |
| C5 | `bundle_migration` | Before any staging file exists | Clear error, not empty SQL |
| C6 | `verify_target_empty` | Workspace already present in Supabase | `{empty: false}` with row counts |
| C7 | `migrate_locations` | Workspace with zero locations | Staging file with `-- no rows` comment, not 0-byte file |
| C8 | `plan_migration` | Workspace with no reviewed mappings | Plan includes research steps first |

### Phase D — Document + HANDOFF

- [ ] Results written to `docs/superpowers/notes/strike-mcp-verification-2026-04-18.md`
- [ ] Any bugs surfaced → ADR or issue ticket (link from HANDOFF)
- [ ] `docs/HANDOFF-strike-mcp-verification.md` written (per `/close-feature`)
- [ ] User journey(s) documented if a new admin/operator flow was refined

## Kick-off prompt for next session

Paste as first message after restart:

> Execute Phase B of `docs/plans/PLAN-strike-mcp-verification.md`. Prereqs: check `BUBBLE_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` are exported, and local Supabase is running. Then invoke each of the 9 strike-mcp tools in order (happy path first). Record output per tool into `docs/superpowers/notes/strike-mcp-verification-2026-04-18.md` as you go. Stop on first hard failure and report.

## Acceptance Criteria

- [x] Typecheck passes
- [ ] All 9 tools exercised (Phase B)
- [ ] All 8 edge cases exercised (Phase C)
- [ ] Results notes + HANDOFF committed
- [ ] Decision log updated if integration bugs warrant an ADR
