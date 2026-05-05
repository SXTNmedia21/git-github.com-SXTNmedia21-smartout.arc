---
title: "Plan — ci-agent"
status: draft
updated: 2026-05-04
created: 2026-05-04
module: deployment
tags: [plan]
---

# Plan — ci-agent

> Branch: `feat/pipeline-autonomy-ci-agent` | Worktree: /home/sxtnl/dev/smartout.ai-pipeline-autonomy-wt-1 | Base: `campaign/pipeline-autonomy` | Module: deployment | Started: 2026-05-04
## Goal

Scaffold the autonomous `ci-incident-conductor` agent — first-responder for failed CI on every branch except `main`/`preview`, with auto-fix on a narrow allowlist, three-tier escalation (PR-comment / Telegram / Linear), and self-progressing 5-phase lifecycle. Phase 0 (log-only, 14 days) ships on this sortie's merge to `campaign/pipeline-autonomy`.

## Tasks

- [x] Write ADR-0275 with Autonomous Mode addendum
- [x] Register ADR-0275 in `docs/decisions/0000-decision-log.md`
- [x] Write memory `feedback_ci_domain_full_autonomy.md`
- [x] Scaffold agent bundle (`.claude/agents/ci-incident-conductor*`) — commit `38f2e029a`
- [x] Scaffold workflow + triage scripts + ops zone + protocol — commit `08fde16a3`
- [x] Write journey doc `JOURNEY-pipeline-autonomy-ci-agent.md`

## Acceptance Criteria

- [x] Typecheck passes: `pnpm turbo typecheck` (verified at close)
- [x] Decision log updated (ADR-0275 row added)
- [x] User journeys written (`docs/journeys/JOURNEY-pipeline-autonomy-ci-agent.md` — 4 journeys + acceptance + known limitations + queued sub-sorties)

## Known follow-ups (post-merge)

- Verify OpenRouter slug for Sonnet 4.6 before Phase 1 unlock
- Set `TELEGRAM_CHAT_ID` + `LINEAR_OPS_PROJECT_ID` as repo variables
- Pre-Phase-1 baseline: 14 days observed metrics in `log.jsonl`
