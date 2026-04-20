---
title: "strike-mcp verification — 2026-04-18 results log"
status: in_progress
updated: 2026-04-18
created: 2026-04-18
module: strike-mcp
tags: [notes, verification, mcp]
---

# strike-mcp verification — results log

Companion to `docs/plans/PLAN-strike-mcp-verification.md`. Append results as each phase runs.

## Environment

- Session: restarted in wt-6 at `<fill-in>`
- `BUBBLE_APP_URL`: `https://smartout.io`
- `BUBBLE_API_TOKEN`: sourced from `op://smartout_ai_prod/bubble/api-token`
- `SUPABASE_URL`: `<fill-in — local>`
- `SUPABASE_ANON_KEY`: `<fill-in — local>`
- Local Supabase status: `<fill-in output of npx supabase status>`

## Phase A — Static (completed 2026-04-17)

| Check | Result | Notes |
|---|---|---|
| `pnpm install` | ✅ | Done in 11.5s |
| `pnpm -F @smartout/strike-mcp typecheck` | ✅ | 0 errors |
| `pnpm -F @smartout/strike-mcp build` | ✅ | `dist/index.js` produced (after tsconfig fix) |
| `pnpm -F @smartout/strike-mcp test` | ✅ | 394/394 tests after fixing `tests/config.test.ts:49` |

**Fixes committed:**
- `ae3c2d74` on `feat/strike-mcp-verification` — tsconfig + `.mcp.json` + `.mcp.json.example` + test assertion
- `8269fafc` on `development` — mirror tsconfig + `.mcp.json` + `.mcp.json.example`

**Bugs surfaced (all from commit `dc6360d9` monorepo integration, 2026-04-17):**
1. `tsconfig.json` `rootDirs: ["./src","./scripts"]` caused `tsc` to emit `dist/src/index.js` while `package.json` `bin` + `start` expected `dist/index.js` → `node dist/index.js` broken.
2. Both `.mcp.json` at repo root and `services/strike-mcp/.mcp.json.example` still referenced legacy standalone path `/home/sxtnl/dev/strike-mcp/dist/index.js`.
3. `tests/config.test.ts:49` hard-coded legacy `/home/sxtnl/dev/strike-mcp/mappings` path.

## Phase B — Live MCP smoke per tool

**2026-04-18 first attempt: BLOCKED on prereqs.** Attempted inside the original Claude Code session (launched before `.mcp.json` was fixed). Results:

| Prereq | Status |
|---|---|
| `BUBBLE_API_TOKEN` exported | ❌ unset |
| `BUBBLE_APP_URL` exported | ❌ unset |
| Local Supabase running | ✅ `http://127.0.0.1:54321` (Studio 54323, Mailpit 54324) |
| strike-mcp MCP registered | ❌ `ToolSearch` returned no `mcp__strike-mcp__*` — `.mcp.json` change took effect after session start |

**Resolution:** Must launch a fresh Claude Code session with `BUBBLE_API_TOKEN` in the environment. Per secrets-protocol, the token is never read into AI context — it travels through shell env or `op run` wrapper only.

_Populated as each tool runs. Format: tool → input → excerpt of output → pass/fail._

### 1. list_workspaces
_Input:_ `{}`
_Output:_ `<pending>`
_Result:_ `<pending>`

### 2. inspect_workspace
_Input:_ `<pending>`
_Output:_ `<pending>`
_Result:_ `<pending>`

### 3. research_entity (workspace)
_Input:_ `{entity: "workspace"}`
_Output:_ `<pending>`
_Result:_ `<pending>`

### 3b. research_entity (locations)
_Input:_ `{entity: "locations"}`
_Output:_ `<pending>`
_Result:_ `<pending>`

### 4. plan_migration
_Input:_ `<pending>`
_Output:_ `<pending>`
_Result:_ `<pending>`

### 5. migrate_workspace
_Input:_ `<pending>`
_Output:_ `<pending>`
_Result:_ `<pending>`

### 6. migrate_locations
_Input:_ `<pending>`
_Output:_ `<pending>`
_Result:_ `<pending>`

### 7. bundle_migration
_Input:_ `<pending>`
_Output:_ `<pending>`
_Result:_ `<pending>`

### 8. preview_sql
_Input:_ `<pending>`
_Output:_ `<pending>`
_Result:_ `<pending>`

### 9. verify_target_empty
_Input:_ `<pending>`
_Output:_ `<pending>`
_Result:_ `<pending>`

## Phase C — Perspective / edge cases

_Populated as each scenario runs._

| # | Scenario | Result | Notes |
|---|---|---|---|
| C1 | `inspect_workspace` unknown id | pending | |
| C2 | `research_entity` unknown entity | pending | |
| C3 | `research_entity` re-run preserves reviewed | pending | |
| C4 | `migrate_workspace` before research | pending | |
| C5 | `bundle_migration` before staging | pending | |
| C6 | `verify_target_empty` populated target | pending | |
| C7 | `migrate_locations` empty workspace | pending | |
| C8 | `plan_migration` no mappings | pending | |

## Summary

_Filled at end of Phase C before HANDOFF._
