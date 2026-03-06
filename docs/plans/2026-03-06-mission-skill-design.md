---
title: "Design — /mission skill"
status: done
updated: 2026-03-06
created: 2026-03-06
module: meta
tags: [design, skill, mission, journey-package]
---

# Design — /mission Skill

## Problem

The journey package pipeline has `/roadmap` (scope) and `/journey` (deep spec) but no skill to transform journey steps into executable Stage Engine missions. Developers create missions ad-hoc, leading to inconsistent observability and missing failure signals.

## Solution

A `/mission` skill that reads a Journey deep spec and produces:

1. **Mission.md** — Design doc with stages, tools, guardrails, observability contract
2. **Seed SQL** — Idempotent migration for `engine_missions` + `engine_stages`

## Three Pillars

| Pillar | What it means | How it's enforced |
|--------|--------------|-------------------|
| Results | Every mission defines measurable success per stage and per session | Success criteria field required |
| Trackability | Every mission defines timing thresholds, failure signals, Guardian watches | Observability contract section required |
| Triggerability | Every mission defines how to start and test | Trigger + dev test invocation required |

## Key Design Decisions

1. **Not 1:1 with journey steps** — Multiple journey steps can merge into one mission stage. UI-only steps don't become stages.
2. **Observability is mandatory** — No mission ships without timing thresholds and failure signals (abandon, rage_quit, stuck, loop, timeout).
3. **Prerequisite: Journey must exist** — The skill reads journey steps as input. No journey = run `/journey` first.
4. **Builds on existing patterns** — Uses same SQL template as `/mission-training`. Same tool categories (engine HTTP + client). Same chain rules.

## Pipeline Position

```
/roadmap → /journey → /mission → /mission-training (iterate) → /journey-test
```

## Files

- Skill: `.claude/skills/mission.md`
- Output: `docs/Roadmaps/{slug}/Mission.md` + `supabase/migrations/` seed SQL
