---
name: Engine dispatcher sequential step constraint
description: Dispatcher resume loop is strictly sequential; parallel-branch wait_for_event patterns silently fail at step boundaries
type: project
---

The engine-dispatch resume loop (index.ts:440-441) matches `action_payload.event === event_type` for the state's CURRENT step only. Steps are sequential (`current_step + 1`). This means:

- A ticket at step 2 (`wait_for_event('resolved')`) will NOT resume when `sla_breached` fires — step 2 listens for 'resolved', not 'sla_breached'.
- The `engine_trigger` path SPAWNS new states starting at step 1. A breach trigger on `helpdesk_query_lifecycle` spawns a new state that enters `waiting` at step 1 — never reaches steps 3+.
- `step_group` column exists in `engine_step` schema (same group = parallel) but the dispatcher does NOT read it — dead metadata.

**Why:** Discovered during T2 blueprint migration for helpdesk SLA Phase 2 (2026-04-28).

**How to apply:**
- When two events need to compete for the same state (e.g., resolved vs sla_breached), you cannot model them as sequential steps in one process.
- Safe workarounds: (A) separate breach-handler process triggered by the breach event, (B) dispatcher `context_patch` hook for cross-cutting state writes, (C) `event_any_of` support in dispatcher (Approach C, rejected as too risky for Phase 2).
- Document this constraint in migration headers whenever a blueprint step is unreachable by the trigger-spawn path.
- The pre-canned event + `engine_delayed_trigger` mechanism (T5/T6 openTicket/resolveTicket) works correctly regardless of whether the blueprint steps are reached via dispatcher.
