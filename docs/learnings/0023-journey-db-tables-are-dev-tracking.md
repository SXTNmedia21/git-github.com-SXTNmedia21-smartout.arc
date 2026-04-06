---
title: Journey DB tables are dev-tracking artifacts
status: done
updated: 2026-04-06
created: 2026-04-06
module: ai-agent
tags: [journey, database, architecture, council]
---

# Learning 0023: Journey DB Tables Are Dev-Tracking Artifacts

## Discovery

The `journey` and `journey_step` tables (ADR-0031, migration `20260301140000_journey_system.sql`) track the 68 user journeys through a 13-status development lifecycle during the Bubble.io migration rebuild. They are QA/PM artifacts — not runtime user progress tables.

The 12 store-listing journeys in `apps/mobile/store-listing/journeys/` are a separate, parallel system of markdown specs (USER-GUIDE.md, EVENT-SEQUENCE.md, RESCUE-PROMPTS.md). These are also not runtime.

Neither system tracks whether a real employee actually completed a journey.

## Why This Matters

Any future plan that proposes "repurposing the journey table for runtime tracking" must be redirected to the Domain Process Engine (`engine_process` + `engine_state` + `engine_trigger`). The journey table has workspace-scoped dev-tracking semantics (status: idea→active, assignee_id, linear_issue_id) that are incompatible with per-user runtime progress.

## Correct Pattern

Runtime journey progress tracking should use:
- `engine_process` — journey blueprint (compiled from journey definitions)
- `engine_state` — per-user instance (tracks current step, timestamps, context)
- `engine_trigger` — event matching (telemetry event → advance step)
- `engine_delayed_trigger` — timeout detection (stuck user → rescue)

## Source

Council session 2026-04-06: "Journey Inference as Agent Harness". Verified by System Steward and Supervisor against codebase. Migration comment confirms: "tracks the 68 user journeys through a 13-status lifecycle during the Bubble.io migration."
