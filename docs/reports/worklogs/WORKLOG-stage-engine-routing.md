---
title: "Worklog — stage-engine-routing"
status: in_progress
updated: 2026-03-18
created: 2026-03-03
module: ai
tags: [stage-engine, onboarding, lise, mission]
---

# Worklog — stage-engine-routing

> Branch: `feat/stage-engine-routing` | Worktree: wt-3 | Started: 2026-03-03

## Status: 🟡 In Progress

## Done

- [x] Route wizard/start through stage engine (a6e5da9)
- [x] Add tuning_notes column to engine_stages
- [x] Add system_prompt column to engine_missions
- [x] Update Stage/Mission types in session.ts
- [x] Inject tuning notes in buildStagePrompt
- [x] Pass mission.system_prompt as base prompt in session-manager + stage-manager
- [x] Create onboarding-interview mission seed (6 stages with Lise persona)

## Remaining

- [ ] Run migration locally (npx supabase db reset or apply)
- [ ] Seed onboarding mission data
- [ ] Test end-to-end: wizard/start → stage engine → Ultravox call
- [ ] Fix pre-existing agent-router.ts typecheck errors (@smartout/ai subpath imports)

## Decisions

| Date       | Decision                                                    | Reason                                                    |
| ---------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| 2026-03-18 | Lise's prompt is mission-level system_prompt, not hardcoded | Allows per-mission agent personality without code changes |
| 2026-03-18 | tuning_notes are TEXT, not JSONB                            | Plain text coaching hints, no structure needed            |
| 2026-03-18 | Seed uses ON CONFLICT DO UPDATE                             | Idempotent — safe to re-run during development            |

## Log

| Date       | Time  | Event                                           |
| ---------- | ----- | ----------------------------------------------- |
| 2026-03-03 | 19:39 | Feature started                                 |
| 2026-03-18 | —     | Route wizard/start done (commit a6e5da9)        |
| 2026-03-18 | —     | Migration, types, prompt-builder, seed SQL done |
