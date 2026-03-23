---
title: "Handoff: Cascade Architecture Plan Revision"
status: in_progress
updated: 2026-03-20
created: 2026-03-20
module: cross-cutting
tags: [handoff, cascade, architecture, plan-revision]
---

# Handoff: Cascade Architecture Plan Revision

## Mission

**Revise the implementation plan** at `docs/superpowers/plans/2026-03-20-cascade-architecture-foundation.md` to incorporate five architectural research answers, year wheel concept, and UI/UX planning. Then run any remaining diligence needed.

## Context Files (read in order)

1. `CLAUDE.md` — project conventions
2. `docs/INVESTIGATION_OPERATING_HOURS_CORE_STRUCTURE.md` — investigation + design decisions (Parts A-E)
3. `docs/superpowers/plans/2026-03-20-cascade-architecture-foundation.md` — current plan (26 tasks, needs revision)
4. `.claude/projects/-home-sxtnl-dev-smartout-ai/memory/project_cascade_architecture.md` — all locked decisions
5. This file — what to do

## What Was Decided (locked, don't re-debate)

- **Propagation:** Reactive dataflow DAG + Terraform plan/apply UX + event-sourced audit
- **Seasons ARE the periods.** No `season_period` table. Year = `planning_cycle` containing seasons.
- **`planning_event` table** for demand modifiers (festivals, holidays, weather, internal events, recurring cultural dates)
- **`change_proposal` table** persists cascade preview as immutable artifact (Terraform saved plan)
- **`shift_function` ENUM:** opening | closing | supporting | rush_hour | sub_supply
- **Anchor system:** start/end_anchor_type (fixed|open|close) + offset_min on template shifts
- **Cascade engine:** engine_process with simulation (ghost cards) + execution (confirmed writes) modes
- **Season status:** draft | ready | archived (NOT "active") + `is_active` boolean
- **Department type:** operational | administrative | hybrid (on department table)
- **Compliance:** XACML PEP/PDP pattern, CDS Hooks model, risk-stratified (hard_gate|soft_warning|info_only|monitor)
- **Learning loop:** EWMA exponential smoothing, no ML, bootstrap from industry benchmarks
- **Bootstrap:** Templates produce REAL records. Same cascade engine for bootstrap and steady-state.
- **Events scraping:** Local municipality calendars, Norwegian cultural calendar (Kanelbollens dag, Morsdag, 17. mai etc), weather APIs, booking integrations

## What the Plan Needs (the revision)

### 1. Add Phase 0: Extended Schema

New migrations for:

- `planning_cycle` — year wheel container (workspace_id, name, start_date, end_date, total_revenue_target, status). `EXCLUDE USING gist` prevents overlapping cycles.
- `planning_cycle_id` FK on `season` table
- `EXCLUDE USING gist` on season date ranges within a planning_cycle (no overlapping seasons)
- `planning_event` — events/happenings table (workspace_id, planning_cycle_id, name, category ENUM, source ENUM, event_date, end_date, demand_multiplier, expected_covers, confidence, is_recurring, recurrence_rule, external_source_url, hours_override_id FK)
- `change_proposal` — persisted cascade preview (workspace_id, initiated_by, trigger_layer, status ENUM, changes JSONB, preview JSONB, risk_score, applied_at)
- `planning_factors` — planned vs actual tracking (factor_type, dimension, period_date, planned_value, actual_value, variance_pct)
- `adjustment_factors` — EWMA learning state (factor_type, dimension, season_id, adjustment_ratio, alpha, observation_count, confidence)
- `compliance_rule` — future enforcement rules (enforcement_point, severity ENUM, condition, applicable_when, bypass policy)
- `enforcement_decision` — audit log of compliance decisions

### 2. Revise Phase 1 Migrations

- Task 2: Also add `planning_cycle_id UUID FK` to season table
- Task 2: Add `EXCLUDE USING gist` constraint on season(planning_cycle_id, daterange(start_date, end_date))

### 3. Add Bootstrap Engine Phase

- Template-to-records pipeline: industry JSON → cascade engine → real DB records
- Same code path as steady-state cascade
- Minimum viable data: one day's operating hours → one shift → one session → one hook → one task
- Support for historical data import (scraped from Brønnøysund, booking systems, previous year)

### 4. Add UI/UX Planning (NOT YET DONE)

This is the gap. The plan has backend tasks but minimal UI specification. Need:

- **Operating hours settings redesign:** Department selector + season selector + 7-day grid + overrides section
- **Cascade preview UI:** How does the "Forhåndsvis endringer" modal look? Diff view? Risk score display?
- **Vaktlista view:** Column layout (slot_order), ghost cards, simulation surface, confirm flow
- **Year wheel UI:** How does the admin see/manage the planning cycle, seasons, events?
- **Template shift editor:** How does the user define anchor types, shift functions, slot order?
- **Event calendar:** How does the admin see/add/scrape events in the year wheel?

### 5. Run Remaining Diligence

The plan was written without running the **mechanics mapping investigation** (18 questions about existing engine_dispatch, push notifications, session generation, activity trail, realtime subscriptions). Key questions:

- How does engine_dispatch currently handle action types? (need to know before adding 6 cascade handlers)
- How does dispatch_push_notification work? (need to reuse pattern for cascade notifications)
- How does activity_trail persist audit data? (need to know schema for cascade audit)
- What realtime subscriptions exist on schedule tables? (cascade changes should trigger updates)

**Recommended:** Dispatch 4 parallel agents to answer these before finalizing Phase 4 (Edge Functions) of the plan.

## What NOT to Change

- Phase 1 migration SQL is correct (Tasks 1-12) — just add planning_cycle FK to Task 2
- Pure functions (Tasks 14-15) are correct
- Cascade type definitions (Task 13) are correct
- Telemetry events (Task 16) are correct
- The overall 6-step cascade pipeline is correct

## Deliverable

A revised plan document at the same path, with:

- Phase 0 added (extended schema)
- Phase 1 revised (planning_cycle FK)
- Bootstrap phase added
- UI/UX planning section added (wireframe-level descriptions)
- Mechanics investigation results incorporated into Phase 4
- All tasks with checkbox syntax, exact file paths, SQL/code
