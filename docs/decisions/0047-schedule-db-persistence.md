---
title: "Schedule DB Persistence with TanStack Query"
id: ADR_0047
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-03-01
---

# ADR-0047: Schedule DB Persistence with TanStack Query

## Context and Problem Statement

The schedule module used local `useReducer` + React Context for all state management (ADR-0032). This was intentional for fast UI iteration, but the types were designed for 1:1 database mapping. Now the UI is stable and we need real persistence, multi-user sync, and audit trails.

## Decision Drivers

- Need persistent schedule data across page reloads and sessions
- Multiple managers may edit the same week simultaneously
- Norwegian labor law compliance requires audit trail of schedule changes
- Rollback capability needed for accidental changes
- Must maintain optimistic UI responsiveness during DB operations

## Considered Options

1. **Incremental migration** — Keep useReducer for UI commands, add TanStack Query underneath
2. **Full TanStack Query replacement** — Replace entire reducer with query/mutation hooks
3. **Server Actions + TanStack Query** — Server Actions for writes, TanStack for reads

## Decision Outcome

Chosen option: **"Full TanStack Query replacement"**, because it eliminates dual-state coordination, uses a single source of truth (query cache), and follows the industry standard pattern for server state in React.

## Architecture

- **Data layer:** Direct supabase-js calls (no Edge Function gateway for dashboard ops)
- **Query keys:** Structured factory (`scheduleKeys`) for granular invalidation
- **Mutations:** All with optimistic cache updates + error rollback
- **Realtime:** Supabase Realtime subscriptions per workspace+week, invalidate queries on remote changes
- **Audit:** DB trigger on all 8 schedule tables → `schedule_audit_log` with JSONB old/new data
- **Rollback:** `rollback_audit_entry()` RPC function reverses any audit entry
- **Conflicts:** Last write wins, Realtime shows updated state
- **UI state:** Lightweight React Context for selection, clipboard, modals (no DB persistence)

## New Tables

| Table                   | Purpose                  |
| ----------------------- | ------------------------ |
| schedule_absence        | Employee absences        |
| schedule_template       | Reusable shift templates |
| schedule_template_shift | Template shift entries   |
| schedule_open_shift     | Unassigned shifts        |
| schedule_day_message    | Daily messages           |
| schedule_day_task       | Daily operational tasks  |
| schedule_day_booking    | Reservations/bookings    |
| schedule_audit_log      | Row-level audit trail    |

## Rules & Consequences

- **Good, because** single source of truth in query cache, no state sync bugs
- **Good, because** automatic audit trail via DB triggers (no missed changes)
- **Good, because** optimistic updates keep UI snappy
- **Bad, because** larger upfront refactor (1283 lines of context replaced)
- **Bad, because** `dummyEmployees` still needed until profile query is built
- **Agent Impact:** Use mutation hooks (`useCreateShift.mutate(...)`) instead of `dispatch()`. Use `useScheduleUI()` for selection/clipboard state. All schedule data queries go through `_hooks/use-*.ts` files.

---

> Registered in `docs/decisions/0000-decision-log.md`.
