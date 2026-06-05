---
title: Telemetry Map — min-dag domain
status: draft
created: 2026-05-31
updated: 2026-05-31
module: min-dag
tags: [telemetry, min-dag, employee, interactive-elements]
---

# Telemetry Map — min-dag

**Design files scanned:**

- `apps/web/pages/min-dag.jsx` (primary web surface, MinDagPage)
- `apps/mobile/refs/day-widgets.jsx` (10 shared widgets)
- `apps/mobile/refs/home-screens.jsx` (MobileHomeBefore / MobileHomeDuring / MobileHomeAfter)

**Registry:** `packages/telemetry/src/registry.ts`

**Backend hooks:** `use-session-tasks-for-date.ts`, `use-day-lines-for-date.ts`,
`use-my-dashboard.ts`, `use-day-session.ts`

**Tables touched:** `department_session`, `session_task`, `session_hook`,
`day_line`, `schedule_day_booking` (+ `schedule_shift`, `time_entry` for clock-in)

---

## Legend

| Symbol | Meaning                                                 |
| ------ | ------------------------------------------------------- |
| ✅     | Event exists in registry                                |
| ❌     | Event missing from registry — must be added             |
| ⚠️     | Mutation path unconfirmed / needs hook wiring           |
| 🔇     | Noop — local UI state only, no telemetry required       |
| 🔀     | Navigation / route change — use `"page viewed"` pattern |

---

## Interactive Elements — Web (min-dag.jsx)

### Section: Shift Hero (md-shift)

| ID    | Element                | Handler                                 | Event                 | Registry      | Backend hook                                                                                                             | Notes                                                                                 |
| ----- | ---------------------- | --------------------------------------- | --------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| EL-01 | **Stemple inn** button | `onClick → toast("Stemplet inn 08:14")` | `"shift punched_in"`  | ✅ (line 844) | ⚠️ Missing — design is toast-only. Real write: `time_entry` INSERT via edge fn or RPC. `schedule_day_booking` FK needed. | **BLOCKER-2**: clock-in mutation hook not confirmed for employee self-service surface |
| EL-02 | **Se vakt** button     | `onClick → setRoute("mine-vakter")`     | `"shift list_viewed"` | ✅ (line 790) | `use-my-dashboard.ts → useMyShifts` (read-only navigation)                                                               | Pure nav — emit on route arrival, not on button click                                 |

### Section: Morning Brief (Brief component)

| ID    | Element                            | Handler                                           | Event                        | Registry       | Backend hook                         | Notes                                                 |
| ----- | ---------------------------------- | ------------------------------------------------- | ---------------------------- | -------------- | ------------------------------------ | ----------------------------------------------------- |
| EL-03 | **Spør Botsson om dagen** button   | `onClick → SmartoutBot.open()`                    | `"botsson.session.created"`  | ✅ (line 5100) | Botsson session lifecycle hook       | Emitted when session created inside SmartoutBot       |
| EL-04 | **Vis forsinket oppgave** button   | `onClick → toast("Hopper til forsinket oppgave")` | `"min_dag.nav.quick_action"` | ❌ MISSING     | Read-only scroll/focus — no DB write | Navigate-to-task shortcut; needs new nav event        |
| EL-05 | **Hvorfor? / Skjul kilder** toggle | `onClick → setShowWhy(s => !s)`                   | —                            | 🔇 NOOP        | None — local state only              | Reveals brief sources; no persistence, no side-effect |

### Section: Mine oppgaver (TaskItem)

| ID    | Element                                   | Handler                                        | Event                                           | Registry              | Backend hook                                                                                                                             | Notes                                                                                                         |
| ----- | ----------------------------------------- | ---------------------------------------------- | ----------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| EL-06 | Task row **expand chevron** click         | `onClick → setOpen(o => !o)`                   | —                                               | 🔇 NOOP               | None                                                                                                                                     | Local accordion expand; design intent = inspect detail before acting                                          |
| EL-07 | Task **checkbox** (header row)            | `onClick(e) → e.stopPropagation(); onToggle()` | `"session_task completed"` / `"task completed"` | ✅ (lines 1126, 1203) | `session_task` status `→ completed` via edge fn `session-hook-executor`. Hook: `use-session-tasks-for-date` invalidation after mutation. | **BLOCKER-3**: design uses optimistic local state (`doneIds`); real DB mutation not wired in this surface yet |
| EL-08 | **Marker ferdig** primary button (detail) | `onClick → if (!done) onToggle()`              | `"session_task completed"`                      | ✅ (line 1126)        | Same as EL-07                                                                                                                            | Same mutation path as EL-07 — de-duplicate event on single toggle                                             |
| EL-09 | **Åpne manual** button                    | `onClick → toast("Åpner manual")`              | `"min_dag.task.manual_opened"`                  | ❌ MISSING            | Read-only — opens handbook doc                                                                                                           | New event needed: `min_dag.task.manual_opened` with `task_id`                                                 |
| EL-10 | **Kommentér** button                      | `onClick → toast("Kommentar lagt til")`        | `"min_dag.task.comment_submitted"`              | ❌ MISSING            | Would write to `session_task` comment or separate comment table                                                                          | **BLOCKER-1**: event + mutation path both undefined; design is toast-only                                     |
| EL-11 | Task **undo** (from toast)                | `undo: () => setDoneIds(...)`                  | —                                               | 🔇 NOOP               | None in current design — optimistic rollback only                                                                                        | If real DB write is added, need compensating DELETE/UPDATE                                                    |

### Section: Quick Actions (md-quick)

| ID    | Element                    | Handler                                | Event                        | Registry       | Backend hook                           | Notes                                                               |
| ----- | -------------------------- | -------------------------------------- | ---------------------------- | -------------- | -------------------------------------- | ------------------------------------------------------------------- |
| EL-12 | **Mine vakter** quick tile | `onClick → setRoute("mine-vakter")`    | `"shift list_viewed"`        | ✅ (line 790)  | `useMyShifts` (read)                   | Emit on route arrival                                               |
| EL-13 | **Min lønn** quick tile    | `onClick → setRoute("min-lonn")`       | `"min_dag.nav.quick_action"` | ❌ MISSING     | Read-only navigation                   | New nav event needed or reuse `"page viewed"` with surface property |
| EL-14 | **Meldinger** quick tile   | `onClick → openChat()`                 | `"mobile.chat.message_sent"` | ✅ (line 5502) | Chat open; emitted inside SmartoutChat | Emit session event when chat opens; this tile is the trigger        |
| EL-15 | **Opplæring** quick tile   | `onClick → SmartoutBot.open() / toast` | `"my.training.viewed"`       | ✅ (line 2823) | Training/protocol assignment (read)    | Emit when training surface loads                                    |

### Section: Min uke

| ID    | Element           | Handler                             | Event                 | Registry      | Backend hook         | Notes                                   |
| ----- | ----------------- | ----------------------------------- | --------------------- | ------------- | -------------------- | --------------------------------------- |
| EL-16 | **Vakter →** link | `onClick → setRoute("mine-vakter")` | `"shift list_viewed"` | ✅ (line 790) | `useMyShifts` (read) | Same as EL-12 — one event, two triggers |

### Section: Siste nytt (news panel)

| ID    | Element                            | Handler                                 | Event                        | Registry       | Backend hook                                                     | Notes                                                                             |
| ----- | ---------------------------------- | --------------------------------------- | ---------------------------- | -------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| EL-17 | **Stort selskap i kveld** news row | `onClick → toast("Åpner kunngjøring")`  | `"min_dag.news.item_opened"` | ❌ MISSING     | Would mark notification as read: `notification.marked_read` path | Closest registry match: `"notification.marked_read"` (line 5824) — reuse or alias |
| EL-18 | **Petter fyller år** news row      | `onClick → toast("Gratulerer Petter!")` | `"min_dag.news.item_opened"` | ❌ MISSING     | Same as EL-17                                                    | Same event, `item_type: "birthday"`                                               |
| EL-19 | **Jonas melding** news row         | `onClick → openChat()`                  | `"mobile.chat.message_sent"` | ✅ (line 5502) | SmartoutChat open                                                | Reuse chat event                                                                  |
| EL-20 | **Alle →** link (news footer)      | `onClick → openChat()`                  | `"mobile.chat.message_sent"` | ✅ (line 5502) | SmartoutChat open                                                | Same as EL-19                                                                     |

---

## Interactive Elements — Mobile (home-screens.jsx)

### MobileHomeBefore

| ID     | Element                       | Handler                                      | Event                   | Registry      | Backend hook                  | Notes                                                   |
| ------ | ----------------------------- | -------------------------------------------- | ----------------------- | ------------- | ----------------------------- | ------------------------------------------------------- |
| MOB-01 | **Se vaktdetaljer** button    | `onClick` (no handler, style only in design) | `"shift detail_viewed"` | ✅ (line 799) | `useMyShifts` (read)          | Handler not wired in prototype — event target confirmed |
| MOB-02 | **Week strip** date selection | `onClick → onSelect(d.date)`                 | —                       | 🔇 NOOP       | Read-only display date change | No DB write; display-only calendar strip                |

### MobileHomeDuring

| ID     | Element                         | Handler                             | Event                        | Registry       | Backend hook                          | Notes                                                                                                               |
| ------ | ------------------------------- | ----------------------------------- | ---------------------------- | -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| MOB-03 | **Ta pause** button             | `onClick` (no handler in prototype) | `"shift break_started"`      | ✅ (line 880)  | `time_entry` pause INSERT via edge fn | **BLOCKER**: not wired in prototype; needs `mobile.shift.break_requested` pre-event or direct `shift break_started` |
| MOB-04 | **Klokk ut** button             | `onClick` (no handler in prototype) | `"shift punched_out"`        | ✅ (line 864)  | `time_entry` clock-out UPDATE         | Same pattern as EL-01; not wired                                                                                    |
| MOB-05 | **Se alle oppgaver (3)** button | `onClick` (no handler)              | `"min_dag.nav.quick_action"` | ❌ MISSING     | Nav to task list                      | New nav event needed                                                                                                |
| MOB-06 | **Rapportér avvik** quick tile  | `onClick` (no handler)              | `"min_dag.nav.quick_action"` | ❌ MISSING     | Nav to HMS avvik surface              | New nav event needed                                                                                                |
| MOB-07 | **Meld til leder** quick tile   | `onClick` (no handler)              | `"mobile.chat.message_sent"` | ✅ (line 5502) | SmartoutChat open                     | Reuse chat event                                                                                                    |

### MobileHomeAfter (post-shift)

No interactive elements with onClick handlers in current prototype — summary display only. No telemetry required at this phase.

### MobileTabBar

| ID        | Element                        | Handler                             | Event           | Registry      | Backend hook         | Notes                                             |
| --------- | ------------------------------ | ----------------------------------- | --------------- | ------------- | -------------------- | ------------------------------------------------- |
| TAB-01–04 | Hjem / Vakter / Oppgaver / Meg | `onClick` (no handler in prototype) | `"page viewed"` | ✅ (line 389) | Read-only navigation | Standard page-view pattern; emit on route arrival |

---

## Mutation Summary

| Mutation                       | Table                                 | Trigger       | Edge fn                                 | Status                                                                                  |
| ------------------------------ | ------------------------------------- | ------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| Clock-in                       | `time_entry` + `schedule_day_booking` | EL-01, MOB-04 | `session-hook-executor` or dedicated fn | ⚠️ Not wired in min-dag surface                                                         |
| Task complete                  | `session_task.status = completed`     | EL-07, EL-08  | `session-hook-executor`                 | ⚠️ Design uses local state; real mutation path exists but not connected to this surface |
| Task undo (complete → pending) | `session_task.status = pending`       | EL-11         | `session-hook-executor`                 | ⚠️ Design is optimistic-only; no compensating DB write                                  |
| Break start (mobile)           | `time_entry` pause INSERT             | MOB-03        | shift clock edge fn                     | ⚠️ Prototype handler not implemented                                                    |
| Task comment                   | TBD (no table confirmed)              | EL-10         | TBD                                     | ❌ UNDEFINED — toast only                                                               |

---

## Events Missing from Registry (must be added)

1. **`min_dag.brief.why_opened`** — user opens "Hvorfor?" source list in morning brief
2. **`min_dag.task.comment_submitted`** — employee adds comment to a session_task (mutation TBD)
3. **`min_dag.task.manual_opened`** — employee opens procedure manual from task detail
4. **`min_dag.task.expanded`** — task row accordion expanded (optional — may be kept noop)
5. **`min_dag.news.item_opened`** — news row clicked; consider aliasing to `notification.marked_read`
6. **`min_dag.nav.quick_action`** — quick action tile tapped with `destination` property (mine-vakter, min-lonn, oppgaver, avvik)
7. **`mobile.shift.break_requested`** — pre-mutation intent event before `shift break_started`

---

## Noop Candidates (confirmed — no telemetry needed)

- **EL-05** — Brief "Hvorfor?" toggle: pure local state, no persistence
- **EL-06** / **EL-11** — TaskItem expand + undo: pure local state
- **MOB-02** — MobileWeekStrip date select: display-only
- **TAB-01–04** — MobileTabBar: navigation shell handled by router
