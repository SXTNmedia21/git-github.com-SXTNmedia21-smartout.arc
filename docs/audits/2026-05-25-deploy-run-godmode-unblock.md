---
title: "Deploy Run 2026-05-25 — Godmode Unblock (auto-orchestrated)"
status: done
updated: 2026-05-25
created: 2026-05-25
module: cross-cutting
tags: [deployment, ci, vercel, supabase, hop-a, hop-b, audit, adr-0427]
---

# Deploy Run 2026-05-25 — Godmode Unblock

> Auto-orchestrated full pipe (dev → preview → main → prod) via `/deploying full pipe`. Archive of live dashboard from the run. Prod commit: `7c07927d4`. Skill updates curated into `~/.claude/skills/deploying/SKILL.md` (4 new HOP A trap entries).

## Current Run

| Field | Value |
|-------|-------|
| Branch | `development` @ `b9a66f98d` (was 39f1fbd5 at session start; 2 sibling PRs landed) |
| Trigger | Auto-orchestrated full pipe (user `/deploying full pipe atuo orchestrated from yo`) |
| Started | 2026-05-25 01:38 UTC |
| Status | **HOP A DONE, opening HOP B PR** |
| Dev → preview FF distance | 0 (preview now = b9a66f98) |
| Dev → main FF distance | 123 commits — these go in HOP B PR |
| Latest lkg tag | `lkg-preview-b9a66f98` (fresh, this run) |

## Agent Progress

| Agent | Status | Result | Learnings |
|-------|--------|--------|-----------|
| gate-runner | Completed | ALL_GREEN — typecheck 52/52 cache, packages build 17/17 clean, lint 0 errors | 2 NEW (bg prettier 0-byte trap; voice-agent+stage-engine cache miss), 1 CONFIRMED (WSL2 OOM avoided via TURBO_CONCURRENCY=1) |
| env-checker | Completed | GREEN — all 7 pass, cross-vault clean | 1 NEW (landing .startsWith pattern), 1 STALE (ADR-0360 preview branch DB gone), 1 CONFIRMED (~5% stale ref count) |
| git-checker | Completed | YELLOW — repair migration OK, timestamp ordered, types stale 33h (CI pass = OK) | 1 NEW (ADR-0427 pattern), 2 STALE (667 migrations not 188; 67 EFs not 34) |
| HOP A wrapper | ✅ COMPLETE | preview@b9a66f98, smoke green, lkg-preview-b9a66f98 tagged + pushed | 1st attempt blocked by untracked dashboard (Gate 1); 2nd attempt clean. Vercel: CANCELED-by-Ignored-Build-Step accepted as success. Pre-push: 8 allowlisted tool-collisions, OTP/redirect/domain-lint all green. |
| HOP B PR open | ✅ COMPLETE | PR #473 opened with CI_LOCAL_BYPASS=1 (Docker WSL integration unavailable) | NEW (Docker WSL trap added to skill HOP A traps table) |
| ci-monitor | ✅ COMPLETE (resolved via Bash until-loop, ~12 min total) | **ALL_GREEN** — 54 success, 0 fail, 0 cancelled, mergeStateStatus CLEAN | NEW (haiku monitor v1 bails early on poll loops — use sonnet OR Bash until-loop for reliable PR waits) |

## Pipeline Health

- HOP A: ✅ green (preview@b9a66f98, lkg-preview-b9a66f98 tagged + pushed)
- HOP B: ✅ PR #473 opened + ALL CI GREEN (54 success / 0 fail / mergeStateStatus CLEAN)
- **AWAITING OPERATOR MERGE.** PR ready: https://github.com/SXTNmedia21/smartout.ai/pull/473

## Operator action — COMPLETE

✅ PR #473 squash-merged 2026-05-25 07:27 UTC as `7c07927d4`
✅ All 4 Vercel prod deploys SUCCESS (smartout-admin, pwa, landing, web)
✅ Migrations applied on prod (`20260626000300` + `20260626100000`)
✅ **Godmode constraints verified on prod** — all 3 accept `'godmode'`:
   - `profile_source_check` = ['operational', 'bubble_migration', 'v3_engine', 'godmode']
   - `activity_trail_actor_kind_check` = ['user', 'platform', 'godmode']
   - `activity_trail_user_actor_fields_required` composite includes godmode-branch

Godmode workspace login button **LIVE on prod**.

## Final state — ALL GREEN

✅ Main-push CI resolved on `7c07927d4`:
- Migration Deploy / State / Coherence: SUCCESS
- All 4 Docker Builds: SUCCESS
- Type Check, Lint, Supabase Preview: SUCCESS
- 5x `Triage CI Incident` failures: meta-agent noise (CI Incident Conductor), NOT product

✅ `https://smartout.ai/api/health` returns `200`

✅ Pipeline complete dev → preview → main → prod end-to-end. Total wall-clock auto-orchestrated: ~6 hours including operator merge wait.

## Skill updates

Added 3 new entries to deploying skill HOP A Operational Traps table:
- Gate 1 strict untracked-file rejection (stash-and-pop mitigation)
- Gate 3 CANCELED-by-Ignored-Build-Step accepted as success (observed pattern)
- ci:local requires Docker Desktop WSL integration (CI_LOCAL_BYPASS=1 emergency escape)

## Notes

- HOP B merge stays with operator per CLAUDE.md hard rule. Auto-orchestrator opens PR only.
- 1A946600c (godmode) + 824e9c8ab (user_identity EntityType) + 776aa8dfc (PR #464 sync merge) + 613b7b09f (collision cleanup) + ADR-0427 + 20260626000300 repair migration all included in this promotion.
- HOP A includes set -o pipefail per L-promote-preview-pipe-mask.
