---
title: Implementation Plan — min-dag Telemetry
status: draft
created: 2026-05-31
updated: 2026-05-31
module: min-dag
tags: [plan, telemetry, min-dag]
---

# Implementation Plan — min-dag Telemetry Wiring

Gate at end of this plan: all `control_points` in `control.json` = `true` → gate flips to `PASS`.

---

## Blockers to resolve first (gate currently FAIL)

### BLOCKER-1 — 7 events missing from registry

**Owner:** telemetry package  
**File:** `packages/telemetry/src/registry.ts`

Add the following event interfaces and register them in the `EventDestinationMap`:

```typescript
// min_dag.nav.quick_action — employee taps quick-action tile
export interface MinDagNavQuickAction extends BaseEvent {
  event: "min_dag.nav.quick_action";
  properties: {
    metadata: {
      destination: "mine-vakter" | "min-lonn" | "meldinger" | "opplaering" | "oppgaver" | "avvik";
      surface: "web" | "mobile";
    };
  };
}

// min_dag.news.item_opened — employee opens a news item
export interface MinDagNewsItemOpened extends BaseEvent {
  event: "min_dag.news.item_opened";
  properties: {
    entity: EntityRef; // entity_type: "announcement" | "birthday" | "message"
    metadata: {
      surface: "web" | "mobile";
      unread: boolean;
    };
  };
}

// min_dag.task.manual_opened — employee opens procedure manual from task detail
export interface MinDagTaskManualOpened extends BaseEvent {
  event: "min_dag.task.manual_opened";
  properties: {
    entity: EntityRef; // entity_type: "session_task"
    metadata: {
      task_id: string;
      has_manual: boolean;
    };
  };
}

// min_dag.task.comment_submitted — employee adds comment to task
// NOTE: requires backend table decision first (see BLOCKER-2)
export interface MinDagTaskCommentSubmitted extends BaseEvent {
  event: "min_dag.task.comment_submitted";
  properties: {
    entity: EntityRef; // entity_type: "session_task"
    metadata: {
      task_id: string;
      comment_length: number;
    };
  };
}

// min_dag.brief.why_opened — employee reveals morning brief sources
export interface MinDagBriefWhyOpened extends BaseEvent {
  event: "min_dag.brief.why_opened";
  properties: {
    metadata: {
      surface: "web" | "mobile";
    };
  };
}

// mobile.shift.break_requested — pre-mutation intent before break_started
export interface MobileShiftBreakRequested extends BaseEvent {
  event: "mobile.shift.break_requested";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      shift_id: string;
    };
  };
}
```

Destinations for all new events (suggested):

- `min_dag.*` → `["posthog", "logger"]` (analytics + debug; no audit trail for read-path events)
- `min_dag.task.comment_submitted` → `["posthog", "logger", "activity_trail"]` (mutation)
- `mobile.shift.break_requested` → `["posthog", "logger"]`

---

### BLOCKER-2 — Clock-in mutation hook not confirmed for employee self-service

**Surface:** EL-01 (web) + MOB-04 (mobile clock-out)  
**Current state:** Design calls `toast("Stemplet inn 08:14")` — no real DB write.  
**Required:** Confirm write path for employee self-clock-in:

1. Does `time_entry` already have an employee-accessible RPC (`fn_clock_in_self`)?
2. Or is this gated to manager via `session-hook-executor` only?
3. Confirm `schedule_day_booking.employee_id` FK and RLS policy for employee self-service.

**Action:** Check `supabase/functions/` for existing clock-in fn, then wire `shift punched_in` event after confirmed INSERT.

---

### BLOCKER-3 — Task toggle not wired to DB in min-dag surface

**Surface:** EL-07, EL-08 (web)  
**Current state:** `toggle()` mutates local `doneIds` state only — no Supabase call.  
**Required:**

1. Add `useMutation` that calls `session_task` UPDATE `status = 'completed'` (or invokes `session-hook-executor` edge fn).
2. On success: emit `"session_task completed"` with `{ task_id, profile_id }`.
3. On undo: emit compensating event or suppress (discuss with product — undo is UX-only or real DB rollback?).
4. Invalidate `sessionTaskKeys.forDate(workspaceId, today)` after mutation.

**Hook to use:** `use-session-tasks-for-date.ts` (already exists; add companion mutation hook).

---

## Implementation Steps (after blockers resolved)

### Step 1 — Registry additions

- [ ] Add 6 event interfaces to `packages/telemetry/src/registry.ts`
- [ ] Register all 6 in `EventDestinationMap` with `posthog` + `logger` destinations
- [ ] `min_dag.task.comment_submitted` gets `activity_trail` in addition
- [ ] Run `pnpm turbo typecheck` — must pass 0 errors

### Step 2 — Clock-in wiring (EL-01)

- [ ] Confirm RPC / edge fn for employee self-clock-in
- [ ] Wire `onClick` on "Stemple inn" button to real mutation
- [ ] Emit `"shift punched_in"` with `{ shift_id, time_entry_id, punch_time, is_adhoc: false, gps_verified: false }`
- [ ] Handle error state (toast on failure)

### Step 3 — Task toggle wiring (EL-07, EL-08)

- [ ] Create `useToggleSessionTask` mutation hook in `packages/data/src/day-session/`
- [ ] Hook calls `supabase.from("session_task").update({ status: "completed" }).eq("id", taskId)`
- [ ] On success: emit `"session_task completed"` (or `"task completed"` with `source: "session"`)
- [ ] Invalidate `sessionTaskKeys.forDate` after mutation
- [ ] Undo path: decide if undo reverses DB write or is display-only; document decision as ADR

### Step 4 — Quick action nav events (EL-12–15, EL-16, EL-02)

- [ ] Wrap `setRoute(...)` calls with `emit("min_dag.nav.quick_action", { destination, surface: "web" })`
- [ ] For routes that emit their own `"page viewed"` / `"shift list_viewed"` — do not double-emit; use one or the other

### Step 5 — News item events (EL-17, EL-18)

- [ ] Wire `onClick` on news rows to emit `"min_dag.news.item_opened"` with `{ entity_type, entity_id, unread }`
- [ ] For EL-17: consider calling `notification.marked_read` if announcement is tied to a notification row

### Step 6 — Task detail events (EL-09, EL-10)

- [ ] EL-09 (Åpne manual): emit `"min_dag.task.manual_opened"` with `{ task_id }`
- [ ] EL-10 (Kommentér): requires backend decision first (BLOCKER-2 sub-issue); wire after table confirmed

### Step 7 — Brief "Hvorfor?" (EL-05)

- [ ] Optional: emit `"min_dag.brief.why_opened"` on first toggle (not on close)
- [ ] Product call: is this worth tracking? Low signal, high noise — mark as optional

### Step 8 — Mobile wiring (MOB-03, MOB-04, MOB-05, MOB-06, MOB-07)

- [ ] MOB-03 (Ta pause): wire to `shift break_started` via clock edge fn
- [ ] MOB-04 (Klokk ut): wire to `shift punched_out`
- [ ] MOB-05 (Se alle oppgaver): emit `"min_dag.nav.quick_action"` with `{ destination: "oppgaver", surface: "mobile" }`
- [ ] MOB-06 (Rapportér avvik): emit `"min_dag.nav.quick_action"` with `{ destination: "avvik", surface: "mobile" }`
- [ ] MOB-07 (Meld til leder): SmartoutChat.open() already emits `"mobile.chat.message_sent"`

### Step 9 — Final validation

- [ ] All 21 elements accounted for in map
- [ ] 5 mutations have confirmed backend hooks or explicit ADR flagging them as future work
- [ ] 15 events all confirmed in registry
- [ ] `pnpm turbo typecheck` passes
- [ ] Update `control.json`: set all `control_points` to `true`, flip `gate` to `PASS`, clear `blockers`

---

## ADR candidates

| Decision                                                              | Scope          |
| --------------------------------------------------------------------- | -------------- |
| Undo path for task toggle — UX-only or DB compensating write?         | `session_task` |
| Task comment storage — `session_task` JSONB column or separate table? | schema         |
| Brief "Hvorfor?" tracking — opt-in (posthog only) or skip entirely?   | product        |
| Employee self-clock-in RLS policy — separate RPC or shared edge fn?   | auth/RLS       |
