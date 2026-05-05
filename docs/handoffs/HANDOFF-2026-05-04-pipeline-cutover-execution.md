---
title: "HANDOFF — Pipeline cutover execution (fresh-context pickup)"
status: ready
created: 2026-05-04
updated: 2026-05-04
module: deployment
tags: [handoff, cutover, hop-b, db-push, branching, fresh-pickup, post-compact]
---

# HANDOFF — Pipeline Cutover Execution

> **For fresh-context agent (post-/compact):** Read top to bottom. State below is verified at handoff-write time. Re-verify SHAs + prod tail before acting.

## Mission tonight

Get prod DB updated with 95 migrations + main code synced with preview. Pontus authorized full pipeline run with hawk-mode. Strategy: Supabase Branching ephemeral dry-run first, then prod apply.

## Why fresh-context pickup

Orchestrator session has been running since 2026-05-04 evening. Pontus tired but mandate clear: "vi kan ikke pause". Plan + this handoff were written so a fresh agent can execute without re-deriving context.

## State verified at handoff-write

| Branch | SHA | Note |
|---|---|---|
| `main` | `1f5bf4807` | Untouched since 2026-05-03 |
| `preview` | `f51b1f55f` | HOP A complete 06:30, lkg-preview-f51b1f55 tagged |
| `development` | `6b0ddf7d6` | + migration #95 (88 anon REVOKE) |
| `feat/pwa-telemetry-build` | `7fb811ad3` | Sortie complete, NOT merged — separate scope |
| `wt-4` | active worktree | pwa-telemetry-build investigation done |

Production DB:
- Project: `yljaglomadbhyqpcigff`
- Tail: `20260515130400`
- Applied: 376 migrations
- 22 missing version-records (records exist in code but absent in tracking table)

Migrations to apply tonight: **95**
- 94 unapplied delta (`20260515130500` through `20260523000100`)
- 1 hardening: `20260524000000_revoke_anon_security_definer_hardening.sql` (REVOKE EXECUTE on 88 SECURITY DEFINER functions from anon)

## What plan to follow

`docs/plans/2026-05-04-pipeline-cutover-execution.md` — 6 phases, decision gates, exact commands. SELF-CONTAINED. Read top to bottom.

## Decision gates (PAUSE for operator go)

Three irreversible operator-only steps. Agent MUST pause + ask before each:

1. **Pre-Phase-2**: INSERT 22 version-records to prod (first prod write)
2. **Pre-Phase-3**: `supabase db push --linked` (irreversible 95-migration apply)
3. **Pre-Phase-4**: `git push origin main` (irreversible code-deploy)

## Critical files to read before acting

In order:

1. `docs/plans/2026-05-04-pipeline-cutover-execution.md` — THE plan
2. `docs/handoffs/HANDOFF-2026-05-04-pipeline-cutover-divergence.md` — divergence anatomy, 22 version-records list location (Section 2)
3. `docs/handoffs/HANDOFF-2026-05-04-anon-revoke-classification.md` — migration #95 details
4. `.claude/agents/deploy-conductor/STATE.md` — verified state row
5. `.claude/agents/deploy-conductor/RUNS.md` — last 3 entries

## Available tools (post-compact)

- Supabase MCP: `mcp__plugin_supabase_supabase__create_branch`, `execute_sql`, `delete_branch`, `list_migrations` (verified working)
- GitHub MCP: standard
- 1Password CLI: `op run --env-file=.env.template -- <cmd>`

## Critical traps (database-guide loaded)

- Migration timestamp ordering = CAUSAL not chronological (L-0042). Migration #95 is `20260524000000` — strictly after all 95 others, ordering correct.
- Production write: any prod SQL needs explicit per-op auth.
- 22 missing version-records: INSERT INTO `supabase_migrations.schema_migrations` with `ON CONFLICT DO NOTHING` (idempotent).

## Side-tracks (NOT tonight's mission)

- **PWA Vercel build fix** (sortie wt-4, branch `feat/pwa-telemetry-build @ 7fb811ad3`): Fix C ready to merge after cutover. Solo build:web on apps/mobile passes. NOT blocking HOP B.
- **`get_invitation_by_token` re-architecture** (1 NEEDS-REVIEW from migration #95): pre-auth signup flow function. Defer to separate sortie.
- **Pre-existing web+landing local build failure**: `@smartout/ai dist missing` on development. Vercel-side builds OK. Separate sortie post-cutover.

## Branch hard rules (no exception tonight either)

- ⛔ NEVER push to `main` directly (use the merge commit per Phase 4)
- ⛔ NEVER force-push to `main`
- ⛔ NEVER `--no-verify`
- ⛔ NEVER `git add -A`
- ⛔ Stage explicitly by name

## ADR-0265 one-time exception

Phase 4 bypasses "main only accepts PRs from preview" because DAG-split prevents PR-UI merge. Document as one-time exception in HOP B closure RUNS.md. Do NOT establish as pattern.

## Pontus's stated requirements

- "Vi kan ikke pause" — execute tonight
- "Trygg + best + raskest" — use Branching ephemeral, not direct prod apply
- "Database expert" framing — load `smartout-database-guide` skill (already loaded in writing-context, fresh agent must re-load)
- Auto-mode active — execute autonomously between decision gates, pause for irreversible ops

## What to do at /compact-resume

1. Read this HANDOFF + `docs/plans/2026-05-04-pipeline-cutover-execution.md`
2. Re-verify state: `git rev-parse origin/main origin/preview origin/development`. Should match handoff or be ahead (only on dev).
3. Re-verify prod tail via Supabase MCP `execute_sql` on `yljaglomadbhyqpcigff`: `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;` Expected `20260515130400`.
4. Acknowledge to Pontus: "fresh context, plan loaded, ready to start Phase 0".
5. Execute Phase 0 (pg_dump backup) autonomously — no operator gate needed for read-only op.
6. Pause at Phase 1 entry IF Pontus has not been seen since the compact (check via prompt history).
7. Continue per plan with decision gates respected.

## Mantra

**Branch first, dump always, push twice (verify post-each), merge once (irreversible).**
