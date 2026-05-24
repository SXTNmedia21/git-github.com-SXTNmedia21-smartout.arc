---
id: ADR-0420
title: schedule.publish_week — irreversible bulk-write semantics + push-storm mitigation
status: draft
date: 2026-05-25
author: System Council (system-steward chair)
related: ADR-0066, ADR-0078, ADR-0095, ADR-0133, ADR-0204, ADR-0288, ADR-0309, ADR-0367
tags: [scheduling, capability, schedule, publication, c4-gate, push, irreversible]
---

# ADR-0420 — schedule.publish_week semantics

## Context

Council 2026-05-25 gap 7: `schedule.publish_week` — capability tool to publish a week's shifts to employees. No existing tool. Hardest proposal in the 10-gap set: irreversible, bulk-write, triggers downstream cascade.

Three compounding semantics to lock:

1. **Dual publication state.** `schedule_shift.is_published` BOOLEAN (`20260301300000_schedule_shift_table.sql:61`) AND `schedule_shift.status` ENUM (`'created'|'assigned'|'published'|'active'|'completed'|'unpublished'`, lines 16-23). Both must be set atomically.
2. **Push-storm risk.** `trg_push_shift_published` (`20260418120000_push_dispatch_triggers.sql:92`) fires per-row. A 30-shift week = 30 push events to N employees. Tx + rate-limit hazard.
3. **Temporal lock interaction.** `trg_schedule_shift_temporal_lock` (`20260428130000_schedule_shift_temporal_lock.sql:147-151`) blocks UPDATE/DELETE on past shifts. Publishing retroactively (past-shift week) needs explicit behavior.

Plus pre-existing TOCTOU race in `scheduler.accept_proposal` (`tools.ts:432-437` status-check then UPDATE without row lock) — `publish_week` MUST NOT inherit.

## Decision

`schedule.publish_week(planning_cycle_id | { date_from, date_to, department_id })` writes single state transition wrapped in `mutateWithGate` with row-level lock.

### Semantics

- **Channel:** chat-only (ADR-0288 spirit — irreversible C4 act). Hard voice-reject in execute body: `if (ctx.channel !== "chat") return "publish_week er ikke tilgjengelig via stemme (ADR-0288)."`
- **Authority:** `confirm` min_role `manager`. Mirror `scheduler.accept_proposal` pattern.
- **Atomicity:** ONE transaction wraps:
  1. `SELECT shift_id, is_published, status, shift_date FROM schedule_shift WHERE workspace_id=$ws AND <date range + dept> FOR UPDATE`
  2. Filter past shifts (return them in summary as `skipped_past_shifts[]`, do not UPDATE — temporal lock would reject anyway)
  3. UPDATE eligible shifts: `is_published = true, status = 'published'` atomically (single UPDATE with WHERE)
  4. emit `scheduler.week_published` ONCE with `{ published_count, skipped_past_count, push_dispatch_count }` (NOT per row)
- **Push-storm mitigation:** add `publish_batch_id` column (NEW MIGRATION) on `schedule_shift`. `trg_push_shift_published` updated to coalesce by `publish_batch_id` — fire ONE push per (employee, batch) instead of one per (employee, shift). Per-employee push body: "N nye vakter publisert for uke X".
- **Dual-state canonical rule:** `status = 'published'` is the canonical state. `is_published BOOL` is a denormalized convenience flag kept in sync by trigger (NEW MIGRATION: `trg_sync_is_published_with_status`). Future migrations may drop `is_published` once consumers migrate to `status`.

### Out of scope for V1

- Re-publishing a shift after edit (would need `unpublished → published` state transition — separate ADR)
- Publishing partial week (only some departments) — V1 publishes full date-range × department scope as single bundle
- Notification preferences per employee (Phase 2)

## Consequences

- 2 new migrations: (a) `schedule_shift.publish_batch_id` column + index, (b) trigger update `trg_push_shift_published` to coalesce by batch + `trg_sync_is_published_with_status`
- Cascade trigger interaction: `department_session_lifecycle` engine process — scheduling D3 spine flags this seed as "not confirmed." Verify seed exists before publish_week ships, OR explicit decision that session_lifecycle is NOT triggered by publish (only by clock-in)
- Pre-existing TOCTOU race in `scheduler.accept_proposal` (`tools.ts:432-437`) flagged as separate fix sortie — `publish_week` uses `SELECT FOR UPDATE` from day 1
- One new telemetry event: `scheduler.week_published`
- Manager confirms via chat ("Publiser uke 26 — 19 vakter") → mutateWithGate evaluates → atomic UPDATE + push coalesce → manager sees summary count

## Status

Draft — implementation deferred to Phase 3 of "Sett opp juni for meg" sortie chain (HIGHEST RISK). Blocked on:
- L-0348 (solver column drift) — must close first (publish_week reads schedule_shift just like solver)
- G9 profile_id BFF forgery — must close (irreversible audit trail integrity)
- ADR-0420 implementation requires explicit decision on `department_session_lifecycle` engine process seed

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-05-25
- `supabase/migrations/20260301300000_schedule_shift_table.sql:15-23,60-61` (dual state)
- `supabase/migrations/20260418120000_push_dispatch_triggers.sql:92` (push trigger)
- `supabase/migrations/20260428130000_schedule_shift_temporal_lock.sql:147-151` (temporal lock)
- `packages/ai/src/capabilities/scheduler/tools.ts:432-437` (TOCTOU race precedent — DO NOT inherit)
- ADR-0288 (chat-only for irreversible), ADR-0309 (bundle proposal), ADR-0367 (day line area-anchored runtime)
