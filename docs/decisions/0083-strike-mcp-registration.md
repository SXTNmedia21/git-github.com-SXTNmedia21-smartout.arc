---
title: "Strike MCP Registered as Dev-Only Data Source"
id: ADR-0083
status: accepted
layer: decision
created: 2026-04-08
updated: 2026-04-08
---

# ADR-0083: Strike MCP Registered as Dev-Only Data Source for Claude Code

**Status:** Accepted
**Date:** 2026-04-08

## Context and Problem Statement

The Bubble → Supabase migration is being executed entity-by-entity under Claude Code control via a local MCP server (`~/dev/strike-mcp`). For Claude Code sessions inside the `smartout.ai` repo to reach the Bubble Data API (list workspaces, inspect entity shapes, generate staging SQL), strike-mcp must be registered at the repo level.

An existing `bubble-mcp` already runs for Pontus from `~/.claude.json` with a plaintext `BUBBLE_API_TOKEN`. Strike MCP needs the same token but should be scoped to the `smartout.ai` repo rather than the global Claude Code config.

## Decision Drivers

- Migration work is ongoing and needs Bubble read access from any Claude Code session in `smartout.ai`
- Ship fast — Pontus is solo operator, no shared dev environment yet
- Keep the real Bubble API token out of git
- Strike MCP is **not** an agent runtime capability — Mr. Botsson does not call it. It is a development-time tool used by humans and Claude Code during migration.

## Considered Options

1. **Lift token to 1Password + `op run` wrapper** — cleanest per Three Laws, but adds friction and blocks the migration work Pontus is trying to do right now
2. **Commit `.mcp.json` with `${BUBBLE_API_TOKEN}` shell interpolation, token in `.env.local`** — clean separation, but relies on Claude Code's env-var substitution behavior and requires sourcing `.env.local` before launch
3. **Commit `.mcp.json` with raw token** — violates Three Laws, token in git
4. **Expose Strike MCP as a Mr. Botsson capability** through `packages/ai/capabilities` — wrong layer, runtime coupling to a one-off migration tool

## Decision Outcome

**Chosen:** Option 2 — commit `smartout.ai/.mcp.json` pointing at `/home/sxtnl/dev/strike-mcp/dist/index.js`, with `BUBBLE_API_TOKEN` supplied via shell env. The token value lives in `.env.local` (already gitignored via `.env*.local` pattern), NOT in 1Password — 1Password integration is deferred as accepted tech debt.

**Launch pattern for now:**
```bash
cd ~/dev/smartout.ai
set -a && source .env.local && set +a
claude
```
Or fold the source step into a shell alias / tmux startup hook.

**Accepted debt:** The same raw token already sits in `~/.claude.json` under the existing `bubble-mcp` entry. Both copies should eventually move behind `op://smartout_ai/Bubble/api_token`, but that is out of scope for this ADR and tracked as follow-up.

## Rules & Consequences for Agents

- **Good, because** every Claude Code session started in `smartout.ai` (with `.env.local` sourced) discovers strike-mcp automatically
- **Good, because** no secret enters git — `.env.local` is gitignored, `.mcp.json` only contains a variable reference
- **Good, because** strike-mcp stays outside the agent runtime layer (`packages/ai`) — no cascade/ontology impact, no Stage Engine coupling
- **Bad, because** developer must remember to source `.env.local` before launching Claude Code in this repo, or nothing works
- **Bad, because** absolute path to `/home/sxtnl/dev/strike-mcp/dist/index.js` means a second developer on this repo would need to relocate strike-mcp to the same path or override locally. Acceptable while Pontus is sole operator; revisit if a second dev joins.
- **Bad, because** strike-mcp must be rebuilt (`pnpm build` inside `~/dev/strike-mcp`) whenever its source changes — no auto-build hook
- **Bad, because** 1Password is explicitly skipped for this capability. Accepted debt. Revisit when the migration work settles.
- **Agent Impact:**
  - Claude Code sessions in `smartout.ai` can invoke strike-mcp tools directly (list workspaces, research entity shapes, generate migration SQL)
  - Mr. Botsson and other runtime agents must **not** depend on strike-mcp — it is a development-time tool only
  - If strike-mcp is extended with runtime-relevant capabilities, a new ADR is required to promote it into `packages/ai/capabilities`

## Follow-ups

- **(debt)** Move `BUBBLE_API_TOKEN` to 1Password and update both `smartout.ai/.mcp.json` + `~/.claude.json` bubble-mcp entry
- **(bug)** `~/dev/strike-mcp/.mcp.json.example` and design docs reference `https://smartout.bubbleapps.io` — the working URL is `https://smartout.io` (custom domain). Fix upstream.
- **(portability)** If a second dev joins, parameterize the `args` path in `.mcp.json` via env var (e.g. `${STRIKE_MCP_DIST}`) and document
