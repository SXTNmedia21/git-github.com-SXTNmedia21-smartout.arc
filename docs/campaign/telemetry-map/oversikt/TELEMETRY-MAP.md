---
title: Telemetry Map — Oversikt (Today Dashboard / Daily Control Center)
status: draft
created: 2026-05-31
updated: 2026-05-31
domain: oversikt
module: dashboard/oversikt
tags: [telemetry, oversikt, cockpit, dashboard]
---

# Telemetry Map — Oversikt

Design source: `/mnt/c/Users/sxtnl/Downloads/Smartout.ai_re-designe/apps/web/pages/oversikt.jsx`
Registry: `packages/telemetry/src/registry.ts` (16 160 lines)

---

## Summary

| Metric                        | Value |
| ----------------------------- | ----- |
| Interactive elements total    | 19    |
| Elements mapped               | 19    |
| Mutations (write-side)        | 5     |
| Events required (new)         | 11    |
| Events in registry (existing) | 8     |
| Events missing from registry  | 11    |
| Hooks found (existing)        | 6     |
| Hooks missing / needs wiring  | 3     |

---

## Element-by-Element Map

### 1 — Brief: "Hvorfor?" toggle (show/hide sources)

- **Component:** `Brief`
- **Interaction:** `onClick={() => setShowWhy(s => !s)}`
- **Type:** UI toggle (read-only, no mutation)
- **Proposed event:** `oversikt.brief_why_toggled`
- **Payload:** `{ shown: boolean, workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`
- **Category:** `navigation`
- **Registry status:** MISSING
- **Hook:** none needed (pure UI state)
- **Noop candidate:** No — this is a meaningful user-intent signal (Botsson transparency funnel)

---

### 2 — Brief action button: "Åpne Avvik #214"

- **Component:** `Brief` — `acts[b1]`
- **Interaction:** `onClick` → sets done, calls `toast("Avvik #214 åpnet")`
- **Type:** MUTATION — opens a deviation (routes to oppgaver/deviation workflow)
- **Proposed event:** `oversikt.brief_action_taken`
- **Payload:** `{ action_id: "b1", action_label: "Åpne Avvik #214", entity_type: "deviation", workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`, `activity_trail`
- **Category:** `operations`
- **Registry status:** MISSING
- **Hook:** Reuse `deviation viewed` (registry line 1420) for downstream; new `oversikt.brief_action_taken` needed for the surface-level event
- **Note:** In production this will trigger deviation detail drawer — needs `deviation viewed` emitted at draw-open time

---

### 3 — Brief action button: "Send kveldsvakt til Jonas"

- **Component:** `Brief` — `acts[b2]`
- **Interaction:** `onClick` → mutation: sends shift request / broadcast to Jonas H.
- **Type:** MUTATION — triggers a broadcast/notification
- **Proposed event:** `oversikt.brief_action_taken`
- **Payload:** `{ action_id: "b2", action_label: "Send kveldsvakt til Jonas", entity_type: "shift", workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`, `activity_trail`
- **Category:** `operations`
- **Registry status:** MISSING (same new event as #2, different payload)
- **Hook:** `useSendBroadcast` → emits `communication.broadcast_sent` (registry line 1326/13903) — hook EXISTS, needs wiring from brief-action path
- **Note:** Shares `oversikt.brief_action_taken` event type with #2 and #3; discriminated by `action_id`

---

### 4 — Brief action button: "Påminn 2 om vaktendring"

- **Component:** `Brief` — `acts[b3]`
- **Interaction:** `onClick` → mutation: sends reminders to 2 employees
- **Type:** MUTATION — reminder send
- **Proposed event:** `oversikt.brief_action_taken`
- **Payload:** `{ action_id: "b3", action_label: "Påminn 2 om vaktendring", recipient_count: 2, workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`, `activity_trail`
- **Category:** `communication`
- **Registry status:** MISSING
- **Hook:** `communication.broadcast_sent` covers the send; `oversikt.brief_action_taken` covers the surface intent
- **Note:** `reminder sent` (registry line 6433) exists but is for system reminders; this is manager-initiated from the brief surface

---

### 5 — Pulse tile: "På vakt nå" (4/5 on shift)

- **Component:** `Pulse` — `onClick={() => setRoute("vaktplan")}`
- **Type:** Navigation (read-only) — routes to vaktplan page
- **Proposed event:** `oversikt.pulse_tile_clicked`
- **Payload:** `{ tile: "on_shift", target_route: "vaktplan", workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`
- **Category:** `navigation`
- **Registry status:** MISSING
- **Hook:** none (pure navigation)
- **Backend hook:** `useShiftDayStats` (EXISTS — `schedule_shift` + `timesheet.time_entry`)

---

### 6 — Pulse tile: "Må løses" (3 tasks)

- **Component:** `Pulse` — `onClick={() => setRoute("oppgaver")}`
- **Type:** Navigation — routes to oppgaver
- **Proposed event:** `oversikt.pulse_tile_clicked`
- **Payload:** `{ tile: "must_resolve", target_route: "oppgaver", workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`
- **Category:** `navigation`
- **Registry status:** MISSING (same event as #5, different payload)
- **Hook:** `use-cockpit-first-screen.ts` operational queue (EXISTS)

---

### 7 — Pulse tile: "Til godkjenning" (3 approvals)

- **Component:** `Pulse` — `onClick={() => setRoute("avstemming")}`
- **Type:** Navigation — routes to avstemming
- **Proposed event:** `oversikt.pulse_tile_clicked`
- **Payload:** `{ tile: "pending_approvals", target_route: "avstemming", workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`
- **Category:** `navigation`
- **Registry status:** MISSING
- **Hook:** `use-pending-approvals.ts` (EXISTS in hooks dir)

---

### 8 — Pulse tile: "Ulest" (2 unread)

- **Component:** `Pulse` — `onClick={() => setRoute("kommunikasjon")}`
- **Type:** Navigation — routes to kommunikasjon
- **Proposed event:** `oversikt.pulse_tile_clicked`
- **Payload:** `{ tile: "unread", target_route: "kommunikasjon", workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`
- **Category:** `navigation`
- **Registry status:** MISSING
- **Hook:** No dedicated hook found; reads from `communication.broadcast_sent` trail

---

### 9 — Pulse tile: "Dekning i dag" (92%)

- **Component:** `Pulse` — `onClick={() => setRoute("vaktplan")}`
- **Type:** Navigation — routes to vaktplan
- **Proposed event:** `oversikt.pulse_tile_clicked`
- **Payload:** `{ tile: "coverage_today", target_route: "vaktplan", workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`
- **Category:** `navigation`
- **Registry status:** MISSING
- **Hook:** `use-staffing-coverage.ts` / `use-cockpit-first-screen.ts` (EXISTS)

---

### 10 — Header button: "Dagsrapport"

- **Component:** `OversiktPage` header
- **Interaction:** `onClick={() => toast("Dagsrapport generert")}`
- **Type:** MUTATION — triggers day report generation
- **Proposed event:** `oversikt.dagsrapport_requested`
- **Payload:** `{ workspace_id, actor_id, date: string }`
- **Destinations:** `posthog`, `logger`, `activity_trail`
- **Category:** `operations`
- **Registry status:** MISSING — no existing report-generation event in registry
- **Hook:** MISSING — no `use-generate-day-report` hook exists; needs to be built (F0.4 scope or new sortie)

---

### 11 — ActionQueue: row click (navigate to oppgaver)

- **Component:** `ActionQueue` — `<div className="aq-row" onClick={() => setRoute("oppgaver")}>`
- **Type:** Navigation
- **Proposed event:** `oversikt.action_queue_row_clicked`
- **Payload:** `{ action_id: string, kind: string, severity: string, target_route: "oppgaver", workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`
- **Category:** `navigation`
- **Registry status:** MISSING
- **Hook:** routes to oppgaver page; `oppgaver.view_opened` (registry line 8793) fires on arrival — no new hook needed

---

### 12 — ActionQueue: CTA button (e.g. "Løs nå", "Åpne", "Godkjenn", "Klargjør")

- **Component:** `ActionQueue` — `<button className="aq-btn">` with `e.stopPropagation()`
- **Type:** MUTATION — marks action as done + triggers toast with undo
- **Proposed event:** `oversikt.action_cta_clicked`
- **Payload:** `{ action_id: string, kind: "Avvik"|"Godkjenning"|"Levering", severity: string, cta_label: string, workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`, `activity_trail`
- **Category:** `operations`
- **Registry status:** MISSING
- **Hook:** Depends on `kind`:
  - `Avvik` → needs `deviation viewed`/`deviation updated` hook wiring (EXISTS: lines 1397, 1420)
  - `Godkjenning` → needs `approval resolved` (EXISTS: line 6425) or `payroll.deviation_acknowledged` (line 10687)
  - `Levering` → no matching hook — MISSING, needs new hook or session_task completion
- **Note:** Undo action (toast `undo`) has no separate telemetry needed (optimistic UI rollback, not a committed mutation)

---

### 13 — ActionQueue: "Alle oppgaver" link button

- **Component:** `ActionQueue` panel header
- **Interaction:** `onClick={() => setRoute("oppgaver")}`
- **Type:** Navigation
- **Proposed event:** `oversikt.pulse_tile_clicked` (reuse with `tile: "all_tasks_link"`) OR new `oversikt.nav_link_clicked`
- **Payload:** `{ source: "action_queue_header", target_route: "oppgaver", workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`
- **Category:** `navigation`
- **Registry status:** MISSING
- **Hook:** none needed
- **Noop candidate:** Borderline — could use generic `page viewed` but domain event preferred for funnel analysis

---

### 14 — Roster: "Finn vikar" button (gap fill)

- **Component:** `Roster` roster-gapfill row
- **Interaction:** `onClick={() => toast("Forespørsel sendt til 3 kvalifiserte")}`
- **Type:** MUTATION — triggers open-shift offer to qualified staff
- **Proposed event:** `oversikt.gap_fill_requested`
- **Payload:** `{ shift_date: string, department: string, shift_window: "17-23", candidate_count: 3, workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`, `activity_trail`, `engine_event`
- **Category:** `shift_marketplace`
- **Registry status:** MISSING for this surface trigger; downstream event `shift_offer.posted` (registry line 15474) EXISTS and should be emitted by the mutation hook
- **Hook:** `open_shift created` (line 2299) + `shift_offer.posted` (line 15474) — hooks EXIST but surface-level `oversikt.gap_fill_requested` intent event is MISSING

---

### 15 — Feed: "Alle" link button (navigate to kommunikasjon)

- **Component:** `Feed` panel header
- **Interaction:** `onClick={() => setRoute("kommunikasjon")}`
- **Type:** Navigation
- **Proposed event:** `oversikt.nav_link_clicked`
- **Payload:** `{ source: "feed_header", target_route: "kommunikasjon", workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`
- **Category:** `navigation`
- **Registry status:** MISSING
- **Hook:** none needed

---

### 16 — Receipts: "Påminn N som ikke har lest" button

- **Component:** `Receipts`
- **Interaction:** `onClick={() => { setNudged(true); toast(...) }}`
- **Type:** MUTATION — sends read-receipt nudge to unread recipients
- **Proposed event:** `oversikt.receipt_nudge_sent`
- **Payload:** `{ recipient_count: number, announcement_context: string, workspace_id, actor_id }`
- **Destinations:** `posthog`, `logger`, `activity_trail`
- **Category:** `communication`
- **Registry status:** MISSING — `botsson nudge_shown/accepted/dismissed` (lines 3926–3961) are Botsson-initiated nudges, not manager-initiated; `reminder sent` (line 6433) is system-triggered; no manager-push nudge event exists
- **Hook:** `useSendBroadcast` could be reused but semantic mismatch (this is a reminder, not a broadcast); needs dedicated hook or `communication.broadcast_sent` with `kind: "read_nudge"`

---

### 17 — RiskTomorrow: risk item action buttons ("Løs", "Se")

- **Component:** `RiskTomorrow` — `<span className="raction">{r.a}</span>`
- **Interaction:** Static text rendering in design — NO `onClick` attached in oversikt.jsx
- **Type:** NOOP candidate — rendered as text, not a button in this design file
- **Proposed event:** none (design-incomplete; will need `oversikt.risk_item_clicked` when wired)
- **Registry status:** N/A — design gap
- **Note:** Should become `oversikt.risk_item_clicked` when onClick is added in production. Flag for implementation.

---

### 18 — OversiktPage: page load (view event)

- **Component:** `OversiktPage` mount
- **Type:** Page view (implicit, no onClick)
- **Proposed event:** `page viewed` (EXISTS in registry line 389) with `{ path: "/dashboard/oversikt" }`
- **Destinations:** `posthog`
- **Category:** `navigation`
- **Registry status:** EXISTS — generic `page viewed` event covers this
- **Hook:** `useCockpitFirstScreen` (EXISTS — data fetch on mount)

---

### 19 — CreateButton (window.CreateButton)

- **Component:** `OversiktPage` header — `{window.CreateButton ? <window.CreateButton /> : null}`
- **Type:** External component — telemetry owned by CreateButton's own implementation
- **Proposed event:** owned by CreateButton (not in scope for oversikt map)
- **Registry status:** OUT_OF_SCOPE
- **Noop candidate:** Yes — this is a shell-level component with its own telemetry

---

## Budget-Tile Hollow Risk (Critical Flag)

The `useDayBudget` hook reads `workspace_budget` table (`period_type='daily'`). Per task spec: **workspace_budget is 0-seeded** (no rows in dev/staging). This means:

- All budget-derived KPI tiles will render `null` / `—` in staging
- No budget events will fire from budget tiles until F0.4 seed or migration adds rows
- **Risk:** If/when budget tiles are added to the oversikt pulse row (foreseeable F0.4 scope), they will silently show empty state with no observable error — looks like "working" but returns zero data
- **Mitigation required:**
  1. Add `oversikt.budget_empty_state_shown` event (or reuse existing empty-state pattern)
  2. Flag `workspace_budget` as `needs-seed` in F0.4 scope tracker
  3. `useDayBudget` currently has no telemetry on the null fallback path — needs instrumentation

---

## Hook Coverage Summary

| Hook                             | Table(s)                                                                                                    | Status                       | Used by Element                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------- |
| `use-cockpit-first-screen.ts`    | `schedule_shift`, `deviation`, `session_task` via ops                                                       | EXISTS                       | Pulse #5, #6, #9                             |
| `use-shift-day-stats.ts`         | `schedule_shift`, `timesheet.time_entry`                                                                    | EXISTS                       | Pulse #5                                     |
| `use-day-budget.ts`              | `workspace_budget`                                                                                          | EXISTS, 0-SEEDED             | Budget tiles (future)                        |
| `use-day-timeline-events.ts`     | `schedule_day_booking`, `session_note`, `session_task`, `deviation`, `session_hook`, `timesheet.time_entry` | EXISTS                       | Feed (indirect)                              |
| `use-send-broadcast.ts`          | `channel_message`, `announcement_meta`                                                                      | EXISTS                       | Brief #3, Receipts #16                       |
| `use-create-quick-task.ts`       | `session_task`                                                                                              | EXISTS                       | (not directly in oversikt.jsx but available) |
| Gap-fill hook (open_shift)       | `schedule_shift`, `open_shift`                                                                              | MISSING from oversikt wiring | Roster #14                                   |
| Day-report generation hook       | (no table)                                                                                                  | MISSING entirely             | Header #10                                   |
| Levering/delivery checklist hook | `session_task` / `session_hook`                                                                             | MISSING from oversikt wiring | ActionQueue #12 (Levering)                   |
