---
title: "Module 4: Operations & Task Management"
id: MODULE_04
version: "1.0"
status: canonical
layer: module
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
  - MODULE_02
  - MODULE_03
tags:
  - operations
  - department-session
  - session-hooks
  - tasks
  - gamification
  - sign-off
tables:
  - department_session
  - department_schedule
  - session_task
  - session_hook
  - recurring_task_config
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Module 4: Operations & Task Management

> **Smartout.ai** — Functional documentation for migration
> Version 1.0 | February 2026
>
> **Scope change:** This module was originally titled "Oppgavehåndtering (Task Management)" in the index. After architectural analysis, it has been elevated to **Operations & Task Management** because it introduces the **Department Session** — the daily operational container that binds shifts, procedures, tasks, and accountability into a single auditable unit.

---

## 1. The Core Insight

A restaurant doesn't think in "tasks." It thinks in **days**.

Every day, each department opens, runs, and closes. Within that daily arc, shifts start and end, procedures execute, routines trigger, problems arise and get handled, and at the end someone in charge signs off: _"Today is done. Here's what happened."_

This module introduces the **Department Session** — a daily operational container that is automatically created for every active department, every day, within the active season. It is the runtime equivalent of what Season is at the planning level.

**Season** = the battlefield you prepare.  
**Department Session** = the daily battle.

---

## 2. Conceptual Model

```
Season (operational period)
  │
  │  generates daily...
  │
  ├── Department Session (Kitchen — Monday Feb 24)
  │     │
  │     ├── Schedule: opens 10:00, closes 22:00
  │     │
  │     ├── Hooks (timed triggers)
  │     │     ├── PRE_OPEN  (08:00) → "Prep Kitchen" procedure
  │     │     ├── OPEN      (10:00) → "Opening Kitchen" procedure
  │     │     ├── MID_DAY   (14:00) → "Temperature Check" routine
  │     │     ├── PRE_CLOSE (21:00) → "Last Orders" procedure
  │     │     └── CLOSE     (22:00) → "Closing Kitchen" procedure
  │     │
  │     ├── Shifts (people working this session)
  │     │     ├── Shift: "Opening Shift" (08:00–16:00) — Anna (Kokk)
  │     │     ├── Shift: "Opening Shift" (08:00–16:00) — Erik (Sous Chef)
  │     │     ├── Shift: "Mid Shift" (12:00–20:00) — Lise (Kokk)
  │     │     └── Shift: "Closing Shift" (16:00–23:00) — Ole (Kokk)
  │     │
  │     ├── Task Board (all tasks for this session)
  │     │     ├── From hooks → procedure steps (scheduled)
  │     │     ├── From routines → recurring checks (timed)
  │     │     ├── ASAP tasks (ad-hoc, created during session)
  │     │     └── Inherited tasks (from absent shifts)
  │     │
  │     └── Sign-off
  │           ├── Status: OPEN / PENDING_SIGNOFF / CLOSED
  │           ├── Signed by: Ole (Closing Shift, authority: manager)
  │           ├── Incomplete tasks: comments required
  │           └── Handoff notes for next session
  │
  ├── Department Session (Service — Monday Feb 24)
  │     └── ... same structure ...
  │
  └── Department Session (Bar — Monday Feb 24)
        └── ... same structure ...
```

---

## 3. Naming Changes

Based on architectural clarity, the following renames are proposed:

| Old Name                               | New Name               | Reason                                                                            |
| -------------------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| **Job** (Kokk, Servitør)               | **Position**           | "Job" was ambiguous — confused with shift work packages. Position = what you are. |
| **Job** (Opening shift, Closing shift) | **Shift Template**     | Pre-configured shift package with procedures, locations, expected work.           |
| _(new concept)_                        | **Department Session** | Daily operational container per department. The "day" as a managed entity.        |
| _(new concept)_                        | **Session Hook**       | Timed trigger point within a session (open, mid-day, close, custom).              |
| "Maintenance Task"                     | **Recurring Task**     | Clearer. Location-bound, scheduled, flexible timing, trackable.                   |
| "ASAP Task"                            | **Ad-hoc Task**        | Real-time, manager-created, assignable to team/position/location/person.          |

---

## 4. Position (replaces Job as role type)

Position is what you _are_. It defines your skills, your pay grade, your training requirements. It lives in Module 2 (Org Structure) as an extension of Department.

```
position
  position_id          uuid (PK)
  department_id        fk → department
  workspace_id         fk → workspace
  season_id            fk → season | null (null = permanent)
  name                 string (Kokk, Servitør, Bartender, Oppvaskhjelp)
  slug                 string
  description          string | null
  color                string | null
  icon                 string | null
  skill_requirements   jsonb | null
  min_role_level       string | null
  sort_order           integer
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

This is the same schema as the current `job` table in Module 2, renamed for clarity. A person can work different Positions on different days — Position is assigned per Shift, not per Profile.

---

## 5. Department Schedule

Before we can create sessions, each department needs to know _when it operates_. This is configured per season and can vary by weekday and specific calendar dates.

```
department_schedule
  schedule_id          uuid (PK)
  department_id        fk → department
  workspace_id         fk → workspace
  season_id            fk → season (which season this schedule belongs to)

  -- Weekly defaults
  schedule_type        weekly | date_override

  -- For weekly: which day(s)
  weekday              integer | null (0=Mon, 1=Tue... 6=Sun; null for date_override)

  -- For date_override: specific date (Christmas, events, etc.)
  specific_date        date | null

  -- Hours
  open_time            time (e.g., 10:00)
  close_time           time (e.g., 22:00)
  is_closed            boolean (true = department doesn't operate this day)

  -- Metadata
  label                string | null ("Christmas Eve", "Sommertider", etc.)
  priority             integer (higher wins; date_override > weekly)
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

**Resolution logic:** For any given date, the system finds the applicable schedule:

1. Check `date_override` for exact date → if found, use it
2. Fall back to `weekly` for that weekday in the active season
3. Fall back to `weekly` for that weekday in the default season
4. No schedule found → department is closed

**Season setup experience:** When an admin creates a new season, they're prompted: _"Set operating hours for each department."_ They can copy from default and adjust, or start fresh. This is part of "setting up the battlefield."

---

## 6. Department Session

The daily operational container. Auto-generated, one per department per operating day. This is where the day _lives_.

```
department_session
  session_id           uuid (PK)
  department_id        fk → department
  workspace_id         fk → workspace
  season_id            fk → season

  -- Time
  date                 date
  scheduled_open       time (from department_schedule)
  scheduled_close      time (from department_schedule)
  actual_open          timestamp | null (first punch-in)
  actual_close         timestamp | null (sign-off timestamp)

  -- Status lifecycle
  status               upcoming | active | pending_signoff | closed | missed

  -- Sign-off
  signed_off_by        fk → profile | null
  signed_off_at        timestamp | null
  signoff_notes        text | null (handoff notes for next session)
  signoff_type         clean | with_exceptions

  -- Aggregates (materialized for dashboards)
  total_shifts         integer
  shifts_completed     integer
  total_tasks          integer
  tasks_completed      integer
  tasks_incomplete     integer
  tasks_overdue        integer
  incidents_count      integer

  created_at           timestamp
  updated_at           timestamp
```

**Status lifecycle:**

```
upcoming       Session exists but department hasn't opened yet
     │
     ▼  (first punch-in OR scheduled open time reached)
active         Department is operating. Tasks are live. Hooks are firing.
     │
     ▼  (scheduled close time reached OR last shift ends)
pending_signoff  All operations should be done. Awaiting sign-off.
     │
     ▼  (authorized person signs off)
closed         Session is sealed. Audit trail complete. Handoff notes saved.

missed         No one showed up. No punch-ins. Flagged for review.
```

**Auto-generation:** Sessions are created automatically based on `department_schedule`. A nightly job (or Edge Function) generates sessions for the upcoming period (e.g., 7 days ahead). Alternatively, sessions are generated on-demand when the schedule is published.

**The "missed" status** is critical for accountability — if a department was supposed to operate but nobody punched in, the session stays open and gets flagged.

---

## 7. Session Hooks

Hooks are timed trigger points within a session. They fire procedures, routines, or notifications at specific times relative to the session's open/close.

```
session_hook
  hook_id              uuid (PK)
  department_id        fk → department
  workspace_id         fk → workspace
  season_id            fk → season | null (null = default/permanent)

  -- Identity
  name                 string ("Opening prep", "Temperature check", "Closing routine")
  hook_type            pre_open | open | scheduled | pre_close | close | custom

  -- Timing
  trigger_offset       integer (minutes relative to anchor)
  trigger_anchor       open | close (offset from session open or close time)
  -- Example: trigger_anchor=open, trigger_offset=-120 → 2 hours BEFORE opening
  -- Example: trigger_anchor=open, trigger_offset=60 → 1 hour AFTER opening
  -- Example: trigger_anchor=close, trigger_offset=-60 → 1 hour BEFORE closing

  -- Recurrence within session (for things like "every 4 hours")
  repeat_interval      integer | null (minutes; null = fires once)
  repeat_until_anchor  open | close | null (stop repeating relative to...)
  repeat_until_offset  integer | null

  -- What it triggers
  action_type          procedure | routine | notification | custom
  action_ref_id        uuid | null (procedure_id, routine_id, etc.)

  -- Assignment
  assigned_to_type     shift_template | position | team | location | any_on_shift
  assigned_to_ref      uuid | null
  -- "any_on_shift" = anyone currently clocked in at the department can complete it

  -- Priority
  priority             critical | high | normal | low
  is_required          boolean (must be completed for clean sign-off)

  -- Weekday filter (hooks don't always fire every day)
  active_weekdays      integer[] | null (null = every day; [0,1,2,3,4] = Mon-Fri only)

  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

**Hook types explained:**

| Type        | Typical timing             | Example                                               |
| ----------- | -------------------------- | ----------------------------------------------------- |
| `pre_open`  | 1–3 hours before open      | Prep kitchen, receive deliveries, mise en place       |
| `open`      | At opening time            | Turn on systems, final checks, open doors             |
| `scheduled` | Custom time during session | Temperature checks, stock rotation, mid-service tasks |
| `pre_close` | 1–2 hours before close     | Last orders, start breakdown, cleaning                |
| `close`     | At closing time            | Final cleaning, register settlement, lock up          |
| `custom`    | Any offset                 | Special events, delivery windows, inspection prep     |

**Repeating hooks:** For things like temperature logging that happen every 4 hours:

```
name: "Temperature check — walk-in fridge"
hook_type: scheduled
trigger_anchor: open
trigger_offset: 60          (first check: 1 hour after opening)
repeat_interval: 240         (every 4 hours after that)
repeat_until_anchor: close
repeat_until_offset: 0       (stop at closing)
priority: critical
is_required: true
```

This would generate task instances at: open+1h, open+5h, open+9h, etc., until closing.

---

## 8. Session Task Instance

When a hook fires (or a manager creates an ad-hoc task), a **task instance** is created. This is the actual trackable unit of work — the thing someone sees on their phone and completes.

```
session_task
  task_id              uuid (PK)
  session_id           fk → department_session
  workspace_id         fk → workspace

  -- Origin (where did this task come from?)
  source_type          hook | ad_hoc | inherited | routine
  source_ref_id        uuid | null (hook_id, or null for ad_hoc)

  -- From governance (if applicable)
  procedure_id         fk → procedure | null
  procedure_step_id    fk → procedure_step | null
  routine_id           fk → routine | null

  -- Content
  title                string
  description          text | null
  instructions         text | null (from procedure step, if applicable)
  category             string | null (cleaning, safety, prep, service, admin, haccp, custom)

  -- Assignment
  assigned_to_type     profile | position | team | location | zone | any_on_shift
  assigned_to_ref      uuid | null
  claimed_by           fk → profile | null (who actually picked it up)

  -- Timing
  scheduled_at         timestamp | null (when it should be done)
  due_at               timestamp | null (deadline)
  started_at           timestamp | null
  completed_at         timestamp | null

  -- Status
  status               pending | available | in_progress | completed | skipped | overdue | escalated

  -- Priority & urgency
  priority             critical | high | normal | low
  is_required          boolean (required for clean session sign-off)

  -- Completion data (full trackability)
  completed_by         fk → profile | null
  completion_notes     text | null
  completion_data      jsonb | null (temperature readings, measurements, photos, etc.)
  deviation_flagged    boolean (was there a problem?)
  deviation_notes      text | null

  -- Inheritance
  inherited_from_shift fk → shift | null (if inherited from absent shift)

  -- Audit
  created_by           fk → profile | null (null = system-generated)
  created_at           timestamp
  updated_at           timestamp
```

**Status lifecycle:**

```
pending          Task exists but isn't due yet
     │
     ▼  (scheduled_at reached)
available        Task is ready to be claimed/worked on
     │
     ├──▶ in_progress    Someone claimed it and started
     │         │
     │         ▼
     │    completed       Done. Data captured. Trackable.
     │
     ├──▶ skipped         Intentionally skipped (requires comment if is_required)
     │
     └──▶ overdue         due_at passed without completion → escalation triggered
              │
              ▼
         escalated        Runbook activated, management notified
```

**Category system** enables compliance reporting:

- Filter all tasks by `category: cleaning` + `location: Inside Restaurant` → full cleaning compliance report
- Filter by `category: haccp` → all food safety tasks with timestamps, who did them, deviations
- Filter by `completed_by` → everything a specific employee did today/this week/this month

---

## 9. Shift Template

A Shift Template is a pre-configured work package. It defines what a shift _contains_ — which procedures, which locations/zones, what's expected. It lives at the department level.

```
shift_template
  template_id          uuid (PK)
  department_id        fk → department
  workspace_id         fk → workspace
  season_id            fk → season | null (null = permanent)

  -- Identity
  name                 string ("Opening Shift", "Closing Shift", "1. vakt", "Midtvakt")
  slug                 string
  description          string | null
  color                string | null (UI)
  icon                 string | null

  -- Timing defaults
  default_start_time   time | null (e.g., 08:00)
  default_end_time     time | null (e.g., 16:00)
  default_break_minutes integer | null

  -- Location scope
  locations            uuid[] | null (which locations this shift covers)
  zones                uuid[] | null (which zones within those locations)

  -- Position scope
  default_position_id  fk → position | null (typical position for this shift)

  -- Procedures attached
  -- (via junction table: shift_template_procedure)

  -- Capacity
  min_staff            integer | null (minimum people needed on this template)
  max_staff            integer | null

  sort_order           integer
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

**Junction: Shift Template ↔ Procedure**

```
shift_template_procedure
  id                   uuid (PK)
  template_id          fk → shift_template
  procedure_id         fk → procedure
  is_required          boolean
  sort_order           integer
  created_at           timestamp
```

**How it works in practice:**

The admin creates shift templates during season setup:

```
Department: Kitchen
  ├── "Opening Shift" (08:00–16:00)
  │     ├── Locations: Inside Kitchen
  │     ├── Zones: Prep area, Walk-in
  │     ├── Default position: Kokk
  │     ├── Procedures:
  │     │     ├── "Open Kitchen" (required)
  │     │     ├── "Receive Deliveries" (required Mon/Wed/Fri)
  │     │     └── "Mise en Place" (required)
  │     └── Min staff: 2
  │
  ├── "Mid Shift" (12:00–20:00)
  │     ├── Locations: Inside Kitchen
  │     ├── Default position: Kokk
  │     ├── Procedures:
  │     │     └── "Service Prep" (required)
  │     └── Min staff: 1
  │
  └── "Closing Shift" (16:00–23:00)
        ├── Locations: Inside Kitchen
        ├── Default position: Kokk
        ├── Procedures:
        │     ├── "Close Kitchen" (required)
        │     ├── "Deep Clean Stations" (required)
        │     └── "Stock Take" (required Fri)
        └── Min staff: 1
```

When a manager creates a shift in the scheduler (Module 3), they pick a template. The shift inherits the template's defaults — time, location, procedures — but any field can be overridden for that specific instance.

---

## 10. Shift (updated model)

The Shift entity is updated to reference templates and sessions. This replaces the simplified model from Module 3.

```
shift
  shift_id             uuid (PK)
  workspace_id         fk → workspace
  session_id           fk → department_session | null (linked when session is generated)
  template_id          fk → shift_template | null (null = custom/ad-hoc shift)

  -- People
  profile_id           fk → profile | null (assigned employee; null = open shift)
  position_id          fk → position | null (what position they work this shift)
  team_id              fk → team

  -- Time
  start_time           timestamp
  end_time             timestamp
  break_minutes        integer | null
  actual_start         timestamp | null (punch-in)
  actual_end           timestamp | null (punch-out)
  work_hours           decimal | null (calculated)

  -- Location scope (can override template)
  locations            uuid[] | null
  zones                uuid[] | null

  -- Status
  status               draft | published | active | completed | cancelled
  is_published         boolean
  day_category         morning | midday | afternoon | evening | night | weekend

  -- Publishing
  published_at         timestamp | null
  published_by         fk → profile | null

  created_at           timestamp
  updated_at           timestamp
```

**Shift → Session binding:** When a shift starts (punch-in), the system:

1. Finds or creates the `department_session` for that department + date
2. Links the shift to the session
3. Loads procedures from the shift template
4. Creates `session_task` instances for each procedure step
5. Checks: are there other shifts for this session that are unfilled? If yes → mark their procedures as `available` for inheritance

---

## 11. Shift Inheritance (Coverage Logic)

This is one of Smartout's most powerful features: if someone doesn't show up, the work doesn't disappear.

**Scenario:**

- Kitchen has 3 shifts today: Opening (Anna), Mid (empty/no-show), Closing (Ole)
- Mid Shift template includes "Afternoon Temperature Check" procedure
- Nobody punched in for Mid Shift

**What happens:**

1. When Mid Shift's `scheduled_at` passes with no punch-in, system flags it
2. Mid Shift's procedure tasks are created as `session_task` with `source_type: inherited`
3. `assigned_to_type` is changed to `any_on_shift` (anyone currently working in the department)
4. `inherited_from_shift` references the missed Mid Shift
5. Anna (still on Opening) and Ole (who punches in for Closing) both see these tasks
6. First person to claim it gets it

**The key principle:** Tasks belong to the **session**, not to the shift. The shift is how they normally get assigned, but the session ensures nothing falls through the cracks.

---

## 12. Ad-hoc Tasks

Managers can create tasks in real-time during a live session. These are for situations not covered by templates and hooks.

**Assignment targets:**
| Target | Example |
|--------|---------|
| **Profile** | "Anna, restock the walk-in" |
| **Position** | "All Servitører: reset tables for event" |
| **Team** | "Lunch Crew: team meeting at 14:00" |
| **Location** | "Inside Restaurant: check all emergency exits" |
| **Zone** | "Section 1: deep clean — spill on floor" |
| **Any on shift** | "Whoever is free: take out trash" |

**Priority levels:**
| Level | Meaning | Notification |
|-------|---------|-------------|
| `critical` | Stop what you're doing | Push + SMS + sound alert |
| `high` | Do this next | Push notification |
| `normal` | Add to task list | In-app notification |
| `low` | When you have time | Silent, appears in task list |

Ad-hoc tasks are created as `session_task` with `source_type: ad_hoc` and `created_by` = the manager who created it.

---

## 13. Recurring Tasks (replaces "Maintenance Tasks")

Recurring tasks are location-bound, scheduled, lower urgency, and assignable to anyone at that location. They exist independently of shifts and hooks — they're the background maintenance that keeps the place running.

```
recurring_task_config
  config_id            uuid (PK)
  workspace_id         fk → workspace
  season_id            fk → season | null

  -- What
  title                string ("Clean windows", "Descale coffee machine", "Check fire extinguishers")
  description          text | null
  category             string (cleaning, maintenance, safety, inventory, admin, custom)
  procedure_id         fk → procedure | null (if this follows a specific procedure)

  -- Where
  location_id          fk → location | null
  zone_id              fk → zone | null
  asset_id             fk → asset | null

  -- When
  frequency            daily | weekly | biweekly | monthly | quarterly | custom
  frequency_config     jsonb | null (for custom: cron expression or specific dates)
  active_weekdays      integer[] | null (null = all days)
  preferred_time       time | null (when during the day it should ideally be done)

  -- Who (soft assignment — anyone at location can do it)
  preferred_team_id    fk → team | null
  preferred_position   fk → position | null

  -- Priority
  priority             normal | low
  is_required          boolean
  max_delay_hours      integer | null (how long after preferred_time before it's flagged overdue)

  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

**How it materializes:** A scheduled job generates `session_task` instances from `recurring_task_config`:

- `source_type: routine` (or a new `recurring` type)
- `assigned_to_type: any_on_shift` at the configured location
- Tasks appear on the session's task board alongside hook-triggered and shift tasks

**Difference from hook-triggered procedures:**

|                     | Hook → Procedure                          | Recurring Task             |
| ------------------- | ----------------------------------------- | -------------------------- |
| **Bound to**        | Session timeline (relative to open/close) | Calendar (frequency-based) |
| **Urgency**         | Variable (can be critical)                | Usually normal/low         |
| **Assigned to**     | Shift template / position / team          | Location — anyone present  |
| **Governance link** | Always via Policy → Protocol → Procedure  | Optional procedure link    |
| **Example**         | "Open kitchen at 10:00"                   | "Clean windows — weekly"   |

---

## 14. Session Sign-off

Every session must be closed. The last person leaving with sufficient authority signs off on the day.

### 14.1 Sign-off Flow

```
Session status: active
  │
  ▼  (scheduled close time approached OR last shift ending)
System prompts: "Session ending. X tasks incomplete."
  │
  ▼  (authorized person initiates sign-off)
Sign-off screen shows:
  ├── ✅ Completed tasks (count + list)
  ├── ⚠️ Incomplete required tasks (must add comment for each)
  ├── ⏭ Skipped tasks (must add reason)
  ├── 🚨 Deviations flagged (review required)
  └── 📝 Handoff notes (free text for next session)
  │
  ▼  (person confirms and signs)
Session status: closed
  └── signoff_type: clean (all done) or with_exceptions (incomplete items documented)
```

### 14.2 Authority Levels for Sign-off

Not everyone can close a session. Sign-off requires authority:

| Role        | Can sign off?                    |
| ----------- | -------------------------------- |
| Employee    | No                               |
| Team Leader | Yes, for their team's department |
| Manager     | Yes, for departments they manage |
| Admin/Owner | Yes, for any department          |

If no one with authority is on the closing shift, the system escalates:

1. Push notification to department manager
2. After timeout → notification to admin
3. Session stays `pending_signoff` until resolved (never auto-closes)

### 14.3 What Gets Sealed

When a session is signed off:

- All task statuses are frozen
- Completion data is immutable (audit trail)
- Handoff notes become visible to the next session
- The session's aggregate metrics are calculated and stored
- Payroll-relevant data is finalized for the shifts within this session

### 14.4 Missed Sessions

If `scheduled_open` passes and no one punches in:

- Session status → `missed` (after a configurable grace period, e.g., 30 min)
- Alert to department manager and admin
- Stays in reporting as a gap

### 14.5 Unsigned Sessions

If a session stays `pending_signoff` for more than a configurable time (default: 4 hours past close):

- Dashboard alert: "Kitchen — Feb 24 was not signed off"
- Blocks next session from being signed off cleanly (chain of accountability)
- Manager can retroactively sign off with a note

---

## 15. Task Board UI (Conceptual)

Each active session has a task board visible to everyone working in that department. The mobile app is the primary interface; the web dashboard shows the same data in a wider layout.

### 15.1 Views

| View            | Description                                                                       |
| --------------- | --------------------------------------------------------------------------------- |
| **Timeline**    | Tasks ordered by `scheduled_at` — shows what's coming up, what's now, what's done |
| **By Person**   | Grouped by who it's assigned to / claimed by                                      |
| **By Status**   | Kanban-style: Pending → In Progress → Done                                        |
| **By Category** | Grouped by category (Cleaning, HACCP, Prep, Service, etc.)                        |

### 15.2 Task Card Content

Each task card shows:

- Title and category badge
- Priority indicator (color/icon)
- Assigned to (person, position, or "Anyone")
- Scheduled time and due time
- Status indicator
- Source badge: 🔄 Hook, 👤 Ad-hoc, ↗️ Inherited, 📋 Recurring
- Tap to expand: full instructions, procedure steps, completion form

### 15.3 Claiming & Completing

- Tasks assigned to `any_on_shift` show a "Claim" button
- Once claimed, only the claimer (or a manager) can complete it
- Completion may require: checkbox only, notes, photo, measurement (configurable per task/procedure)
- HACCP tasks always require completion data (temperature, signature, etc.)

---

## 16. Full Task Tracking & Compliance Reporting

Every `session_task` captures the full audit trail. This enables powerful compliance reporting.

### 16.1 What's Captured Per Task

| Field                  | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `completed_by`         | Who did it                                                   |
| `completed_at`         | When they finished                                           |
| `started_at`           | When they started                                            |
| `scheduled_at`         | When it was supposed to happen                               |
| `due_at`               | The deadline                                                 |
| `category`             | Classification for reporting                                 |
| `completion_notes`     | Free text                                                    |
| `completion_data`      | Structured data (temperature readings, photos, measurements) |
| `deviation_flagged`    | Problem occurred                                             |
| `deviation_notes`      | What went wrong                                              |
| `source_type`          | Where the task came from                                     |
| `inherited_from_shift` | If it was inherited from an absent shift                     |

### 16.2 Compliance Report Queries

```
"Show me all cleaning tasks for Inside Restaurant, last 30 days"
→ Filter: category=cleaning, location=Inside Restaurant, date range

"When was the walk-in fridge last checked?"
→ Filter: asset=Walk-in Fridge, category=haccp, sort by completed_at desc

"Show all overdue tasks for Kitchen department this week"
→ Filter: department=Kitchen, status=overdue, date range

"Which employees completed the most tasks this month?"
→ Group by: completed_by, count, date range

"Show all sessions with exceptions (not clean sign-off)"
→ Filter: signoff_type=with_exceptions

"Show unsigned sessions"
→ Filter: status=pending_signoff, date < today
```

---

## 17. Information Layer: Notes, Day Brief & Handoff

The Department Session isn't just tasks — it's also the **information container** for the day. Three connected systems form an information cycle that keeps everyone informed.

```
Notes accumulate (anytime, anyone)
  → Day Brief compiles (AI-generated, pushed before session)
    → Session runs (tasks, operations, events)
      → Handoff captures (end of shift/session, structured)
        → Feeds into next session's Day Brief
```

### 17.1 Session Notes

Low-friction, high-value information capture. Anyone can add a note to any date. Notes are the raw information layer — unstructured, timestamped, categorized.

```
session_note
  note_id              uuid (PK)
  workspace_id         fk → workspace

  -- Targeting
  target_date          date (which day is this note about?)
  department_id        fk → department | null (null = workspace-wide)
  session_id           fk → department_session | null (linked when session exists)
  location_id          fk → location | null

  -- Content
  title                string | null (optional short headline)
  body                 text (the actual note content)
  category             info | warning | request | customer | supply | event | staffing | other
  priority             normal | important | urgent

  -- Visibility
  visibility           workspace | department | team | shift
  visibility_ref_id    uuid | null (team_id or shift_id if scoped)

  -- Attachments
  attachments          jsonb | null ([{url, filename, type}])

  -- Lifecycle
  is_actionable        boolean (does this need someone to do something?)
  action_status        null | pending | in_progress | resolved
  resolved_by          fk → profile | null
  resolved_at          timestamp | null

  -- Who
  created_by           fk → profile
  created_at           timestamp
  updated_at           timestamp
```

**How notes are created:**

| Context                | Example                                                                    | UX                                         |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| **From calendar**      | Manager clicks on Saturday, adds "Private event 20 pax, setup by 18:00"    | Date picker + note form                    |
| **From session board** | Shift lead writes "Walk-in fridge making noise, maintenance called"        | Quick-add on active session                |
| **From mobile**        | Waiter in service: "Customer Nilsen complained about wine selection"       | Quick note button, voice-to-text supported |
| **From phone/voice**   | Manager calls Smartout: "We're out of sugar, need to buy before tomorrow"  | Mr. Botsson transcribes and creates note   |
| **Future dates**       | Admin adds note on next Thursday: "Health inspector visiting, be prepared" | Calendar note on future date               |
| **From handoff**       | Closing shift lead: "Oven 2 not reaching temperature, needs service"       | Part of handoff flow, auto-categorized     |

**Actionable notes:** When `is_actionable: true`, the note appears as a to-do that someone needs to resolve. It shows up on the session board alongside tasks but is visually distinct (information vs. task). When resolved, it's marked with who resolved it and when.

**Categories enable filtering:**

- `customer` → all customer feedback for a period
- `supply` → all supply/inventory notes
- `warning` → all warnings and alerts
- `event` → upcoming events and special occasions
- `staffing` → staffing-related notes (call-outs, availability changes)

### 17.2 Day Brief

The Day Brief is an AI-compiled summary that tells each team what they need to know before they start. Generated automatically, pushed to team channels and individual employees.

```
day_brief
  brief_id             uuid (PK)
  workspace_id         fk → workspace
  session_id           fk → department_session
  department_id        fk → department
  date                 date

  -- Content (AI-generated)
  summary              text (natural language summary of what matters today)
  sections             jsonb [
    { type: "staffing", content: "3 shifts today. Anna on opening, Erik mid, Ole closing. Lise called in sick — mid shift needs coverage." },
    { type: "notes", content: "Customer Nilsen has a reservation at 19:00, prefers corner table. Health inspector may visit (note from admin, Feb 20)." },
    { type: "carryover", content: "From yesterday: Oven 2 still needs service — maintenance confirmed for Wednesday." },
    { type: "tasks", content: "12 scheduled tasks today. Temperature checks at 11:00, 15:00, 19:00. Deep clean scheduled for walk-in (weekly)." },
    { type: "events", content: "Private event 20 pax arriving at 18:00, setup starts 16:00." },
    { type: "warnings", content: "Walk-in fridge noise reported yesterday — monitor temperature closely." },
    { type: "previous_handoff", content: "Ole (closing yesterday): All tasks completed. Dishwasher descaled. New wine delivery expected by 10:00." }
  ]

  -- Delivery
  generated_at         timestamp
  delivered_to         jsonb [{channel: "team_chat", ref: "kitchen_chat_id"}, {channel: "push", profiles: [...]}]
  delivery_status      generated | delivered | failed

  -- Source tracking (what went into this brief)
  source_notes         uuid[] (note IDs that contributed)
  source_handoff_id    uuid | null (previous session's handoff)
  source_session_id    uuid | null (previous session)

  created_at           timestamp
```

**Generation logic:**

The Day Brief is generated by the AI (Operation Engine / Mr. Botsson) using:

1. **Notes** targeting this date and department (including future-dated notes from the past)
2. **Previous session's handoff** notes and unresolved items
3. **Schedule data** — who's working, any gaps, any changes
4. **Unresolved actionable notes** carried over from previous sessions
5. **Upcoming tasks** — what's scheduled, what's critical
6. **Events** — reservations, special occasions, inspections
7. **Warnings** — deviations, equipment issues, compliance alerts

**Timing:** Generated ~30 minutes before the first shift starts (or at a configured time). Can be regenerated if new critical notes are added.

**Delivery channels:**

- Team chat (posted in the department's chat channel)
- Push notification to all employees on today's schedule
- Available on the session board in the app
- Optional: voice call brief via Mr. Botsson for managers who prefer audio

### 17.3 Handoff

The Handoff is the structured knowledge transfer at the end of a shift or session. It captures what happened, what's unresolved, and what the next team needs to know.

```
session_handoff
  handoff_id           uuid (PK)
  workspace_id         fk → workspace
  session_id           fk → department_session

  -- Who
  handed_off_by        fk → profile
  shift_id             fk → shift | null (if shift-level handoff vs. session-level)

  -- Content
  handoff_type         shift_end | session_close | emergency | custom

  -- Structured sections
  summary              text (free text overview)
  completed_items      text | null ("What we got done")
  incomplete_items     text | null ("What's still open")
  incidents            text | null ("What went wrong")
  next_session_notes   text | null ("What the next team needs to know")

  -- AI-extracted structured data (from voice or text)
  extracted_events     jsonb | null ([{type, description, severity, action_needed}])
  extracted_notes      uuid[] | null (auto-generated session_notes from handoff content)

  -- Method
  method               text | voice | ai_call
  voice_recording_url  string | null (if voice handoff)
  voice_transcript     text | null (AI transcription)

  -- Delivery
  delivered_to         jsonb | null ([{channel, ref}])

  created_at           timestamp
```

**Three handoff methods:**

| Method      | How it works                                                                                                                                                               | Best for                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Text**    | Manager types a structured handoff in the app                                                                                                                              | Quick end-of-shift notes                        |
| **Voice**   | Manager calls Smartout or uses in-app voice recorder. AI transcribes and extracts structured data.                                                                         | Busy closing shifts, hands-full scenarios       |
| **AI Call** | Smartout (Mr. Botsson) calls the closing shift lead, conducts a structured interview: "How was service? Any incidents? Anything for tomorrow?" AI extracts and structures. | Ensures handoff happens even when people forget |

**Voice AI handoff flow (via Mr. Botsson):**

```
System detects: closing shift approaching, no handoff started
  → Mr. Botsson initiates call to shift lead (or sends prompt)
  → Structured conversation:
      "Hi Ole, wrapping up the kitchen tonight. How was service?"
      "Any incidents or deviations to report?"
      "Anything the morning team needs to know?"
      "Any equipment issues?"
  → AI extracts:
      - Events → creates session_notes with category
      - Unresolved items → marks as actionable
      - Equipment issues → flags for maintenance
      - General notes → feeds into next Day Brief
  → Handoff saved, session ready for sign-off
```

**Handoff → Notes pipeline:** When the AI processes a handoff (voice or text), it can auto-generate `session_note` entries from the extracted content. E.g., if Ole says "Oven 2 still not working," the system creates a note with `category: warning`, `is_actionable: true`, targeted at the next day.

### 17.4 The Information Cycle

```
DAY 1 (Monday)
  │
  ├── Notes added throughout the week targeting Monday
  │     "Private event 20 pax" (added Thursday)
  │     "Health inspector might visit" (added Friday)
  │
  ├── Day Brief generated (Monday 07:30)
  │     Compiles: notes + Sunday's handoff + schedule + tasks
  │     Pushed to Kitchen team chat + Service team chat
  │
  ├── Session runs (Monday 10:00–22:00)
  │     Notes added during session:
  │       "Customer Nilsen loved the new menu" (info)
  │       "Walk-in temp reading high — checked, OK after reset" (warning)
  │       "Sugar delivery tomorrow, need someone to receive at 08:00" (actionable → Tuesday)
  │
  ├── Shift handoff (Ole, closing, 22:00)
  │     Voice handoff via Mr. Botsson
  │     AI extracts: delivery note → auto-creates Tuesday note
  │
  └── Session sign-off (Ole, 22:15)
        Handoff saved. Session closed.

DAY 2 (Tuesday)
  │
  ├── Day Brief generated (Tuesday 07:30)
  │     Includes: Monday's handoff, the sugar delivery note,
  │     any carryover actionable items
  │
  └── ... cycle continues
```

---

## 18. AI Operations Layer

The AI isn't a feature bolted on top — it's the **nervous system** of every session. It continuously monitors all incoming data, processes it, routes it to the right people, fills in gaps, and makes the session operationally intelligent. The Operation Engine (Mr. Botsson) runs as a persistent background agent for every active session.

### 18.1 What the AI Watches

The AI has a real-time feed of everything happening in a session:

| Data Stream          | What it monitors                                                             | Frequency     |
| -------------------- | ---------------------------------------------------------------------------- | ------------- |
| **Punch clock**      | Who punched in, who's late, who's missing                                    | Real-time     |
| **Task status**      | Task completion, overdue tasks, skipped tasks                                | Real-time     |
| **Notes**            | New notes added, actionable items, warnings                                  | Real-time     |
| **Schedule**         | Shift changes, cancellations, swaps                                          | Real-time     |
| **Hook triggers**    | Which hooks fired, which procedures materialized                             | On trigger    |
| **Completion data**  | HACCP readings, deviation flags, measurements                                | On submission |
| **Communication**    | Team chat messages, escalation responses                                     | Real-time     |
| **External signals** | Weather (for outdoor locations), reservation systems, delivery confirmations | Periodic      |

### 18.2 What the AI Does

The AI performs six continuous functions during every active session:

#### 18.2.1 TRIAGE — Classify and Route

Every incoming piece of information is evaluated:

```
Input arrives (note, task completion, punch-in, chat message, etc.)
  │
  ├── Classify: What is this? (information, action needed, deviation, emergency)
  ├── Relevance: Who needs to know? (specific person, team, department, workspace)
  ├── Urgency: How quickly? (immediate, next break, end of shift, next day)
  ├── Route: Which channel? (push, in-app, chat, SMS, voice call)
  └── Enrich: Add context (who's on shift, what procedures are active, history)
```

**Example:** A note is added: "Customer allergic to nuts arriving at 19:00, table 7."

- **Classify:** Action needed — affects kitchen and service
- **Relevance:** Kitchen team (food prep) + Service team (table 7 server)
- **Urgency:** Before 19:00 — high priority
- **Route:** Push to kitchen shift lead + assigned server for table 7
- **Enrich:** Attach allergen protocol procedure, flag existing menu items

#### 18.2.2 MONITOR — Detect Anomalies and Gaps

The AI continuously compares _what should be happening_ with _what is actually happening_:

| Condition                     | Detection                                           | Action                                                                    |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| **Late punch-in**             | Shift starts in 10 min, no punch-in                 | Notify employee → if no response, notify shift lead → escalate to manager |
| **No-show**                   | 30 min past shift start, no punch-in                | Trigger inheritance logic, notify manager, suggest available replacements |
| **Task overdue**              | `due_at` passed, status ≠ completed                 | Remind assigned person → escalate to shift lead → escalate to manager     |
| **Critical task missed**      | Required task with `priority: critical` not started | Immediate alert to all on-shift + manager                                 |
| **Deviation pattern**         | Same task flagged with deviation 3+ times this week | Alert manager with pattern analysis and suggested corrective action       |
| **Temperature out of range**  | HACCP reading exceeds threshold                     | Trigger runbook, escalate immediately, log compliance event               |
| **Understaffing**             | Fewer people on shift than `min_staff` on template  | Alert manager, suggest open-shift posting or recall                       |
| **Session approaching close** | 1 hour before scheduled close, tasks incomplete     | Summary push to shift lead: "X tasks remaining, Y require sign-off"       |
| **Unsigned session**          | Session `pending_signoff` past grace period         | Escalation chain: shift lead → manager → admin                            |

#### 18.2.3 COMPILE — Synthesize Information

The AI takes raw data and produces structured, actionable summaries:

| Output                 | When                                     | What it compiles                                                                     |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| **Day Brief**          | Pre-session (~30 min before first shift) | Notes + previous handoff + schedule + tasks + events + warnings                      |
| **Shift Brief**        | When employee punches in                 | Personal task list + relevant notes + team status + what happened before their shift |
| **Mid-session Digest** | Configurable (e.g., every 4 hours)       | Progress update: tasks done/remaining, notes added, deviations, staffing status      |
| **Pre-close Summary**  | 1 hour before session close              | What's done, what's still open, who needs to complete what, handoff prep             |
| **Handoff Extraction** | After handoff submitted                  | Extract structured events/notes from free text or voice, create actionable items     |

**Shift Brief** is a new concept worth highlighting — when an employee punches in mid-day (e.g., the closing shift), they get a personalized brief:

- "Here's what happened so far today"
- "These tasks are assigned to you"
- "These tasks were inherited (mid-shift was empty)"
- "Important notes: [customer allergy, oven 2 still down, delivery arrived]"

This is compiled automatically from session data. No one needs to write it.

#### 18.2.4 PREDICT — Anticipate Issues

The AI uses historical data and current session state to predict problems before they happen:

| Prediction                | Based on                                                    | Action                                                                                                                       |
| ------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Coverage gap**          | Tomorrow's schedule has no closing shift for Kitchen        | Alert manager: "Kitchen closing shift empty for Wednesday. Suggest: [available employees]"                                   |
| **Task bottleneck**       | 5 tasks due between 14:00–15:00, only 2 people on shift     | Suggest: redistribute, deprioritize non-critical, or flag understaffing                                                      |
| **Compliance risk**       | Temperature checks missed twice this week                   | Proactive alert: "HACCP compliance at risk. 2 missed checks this week. Next check due in 1 hour."                            |
| **Handoff likely missed** | Closing shift lead has skipped handoff 3 of last 5 sessions | Auto-trigger AI call handoff 30 min before shift end                                                                         |
| **Employee overload**     | Employee has 12 tasks today, average is 6                   | Flag to shift lead: "Anna has 2x average task load. Consider redistribution."                                                |
| **Recurring deviation**   | Same procedure fails quality check repeatedly               | Suggest: "Procedure 'Prep Cold Station' has 40% deviation rate. Review procedure steps or assign to more experienced staff." |

#### 18.2.5 ACT — Automated Operations

Some operations happen automatically without human intervention:

| Trigger                      | Automated action                                                           |
| ---------------------------- | -------------------------------------------------------------------------- |
| Hook fires                   | Create session tasks from procedure, assign to appropriate person/role     |
| Shift no-show confirmed      | Activate inheritance, redistribute tasks, notify team                      |
| Recurring task schedule met  | Materialize task instance in session                                       |
| Note marked `is_actionable`  | Add to session task board as information card, track resolution            |
| Critical deviation submitted | Trigger runbook, escalate, log compliance event                            |
| Session sign-off completed   | Freeze task statuses, calculate aggregates, prepare handoff for next brief |
| Day Brief time reached       | Compile and deliver brief to all channels                                  |
| Handoff submitted            | Extract structured data, create follow-up notes, queue for next brief      |

#### 18.2.6 LEARN — Pattern Recognition Over Time

The AI builds knowledge over time to improve operations:

| Learning                   | How it's used                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| **Task duration patterns** | Refine `estimated_minutes` on procedures: "Opening Kitchen actually takes 45 min, not 30"    |
| **Staffing patterns**      | "Fridays need +1 kitchen staff based on task completion data"                                |
| **Deviation patterns**     | "Walk-in fridge temperatures spike on delivery days — suggest check 1 hour after delivery"   |
| **Employee capabilities**  | "Anna completes prep tasks 30% faster than average — consider for time-critical assignments" |
| **Note patterns**          | "Supply issues are noted every Monday — suggest automated restock reminder on Fridays"       |
| **Handoff quality**        | "Sessions with voice handoffs have 20% fewer carryover issues than text-only"                |

This data feeds into the Business Engine (Module 12) for strategic insights and into the season setup for better planning.

### 18.3 AI Decision Authority Levels

Not all AI actions are equal. Clear authority boundaries prevent the AI from overstepping:

| Level                | AI can...                           | Example                                                                                |
| -------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| **Autonomous**       | Act without asking                  | Create tasks from hooks, generate briefs, send routine reminders, calculate aggregates |
| **Notify + Suggest** | Alert a human and propose an action | "Coverage gap detected. Suggest posting open shift. [Post] [Dismiss]"                  |
| **Notify only**      | Alert a human, no proposed action   | "Temperature deviation logged. Review required."                                       |
| **Escalate**         | Pass to a higher authority          | "Unsigned session for 24+ hours. Escalating to admin."                                 |
| **Never**            | Cannot do this                      | Change schedules, approve payroll, override sign-offs, delete data                     |

**The principle:** AI handles the operational noise. Humans make the decisions. The AI's job is to ensure no decision is missed, no information is lost, and everyone has what they need exactly when they need it.

### 18.4 AI Event Log

Every AI action is logged for transparency and debugging:

```
ai_session_event
  event_id             uuid (PK)
  session_id           fk → department_session
  workspace_id         fk → workspace

  -- What happened
  event_type           triage | monitor | compile | predict | act | learn
  action               string (specific action taken: "task_created", "alert_sent", "brief_generated", etc.)
  description          text (human-readable description of what the AI did and why)

  -- Context
  trigger_source       string (what triggered this: "hook_fired", "task_overdue", "note_created", etc.)
  trigger_ref_id       uuid | null (ID of the triggering entity)

  -- Result
  result_type          success | failed | escalated | suppressed
  result_ref_ids       uuid[] | null (IDs of created/modified entities)

  -- Authority
  authority_level      autonomous | notify_suggest | notify | escalate
  human_response       approved | dismissed | modified | pending | null
  human_response_by    fk → profile | null
  human_response_at    timestamp | null

  created_at           timestamp
```

**Why this matters:**

- **Transparency:** Manager can see exactly what the AI did during a session: "Why did Anna get a push notification at 14:32?" → "HACCP temperature check was overdue by 15 minutes, AI sent reminder to assigned person."
- **Debugging:** If something goes wrong, the event log shows the chain of decisions
- **Learning validation:** See if AI predictions were accurate, if suggestions were accepted
- **Compliance:** Auditors can verify that automated actions followed governance rules

### 18.5 AI Configuration per Workspace

Workspaces can tune AI behavior:

```
ai_operations_config (part of workspace settings / Policy)

  -- Monitoring sensitivity
  late_punchin_threshold     integer (minutes before alerting, default: 10)
  noshow_threshold           integer (minutes before confirming no-show, default: 30)
  task_overdue_grace         integer (minutes after due_at before escalating, default: 15)

  -- Brief timing
  day_brief_offset           integer (minutes before first shift, default: 30)
  shift_brief_enabled        boolean (default: true)
  mid_session_digest_enabled boolean (default: false)
  mid_session_interval       integer (hours, default: 4)

  -- Handoff
  auto_handoff_call_enabled  boolean (default: false — opt-in)
  handoff_call_offset        integer (minutes before shift end, default: 30)
  missed_handoff_threshold   integer (consecutive misses before auto-call activates, default: 3)

  -- Predictions
  predictions_enabled        boolean (default: true)
  coverage_lookahead_days    integer (how far ahead to predict coverage gaps, default: 7)

  -- Notification preferences
  ai_notification_channel    push | sms | email | voice (default notification method)
  quiet_hours_start          time | null
  quiet_hours_end            time | null

  -- Authority overrides
  autonomous_task_creation   boolean (default: true — hooks create tasks automatically)
  autonomous_inheritance     boolean (default: true — no-show triggers auto-inherit)
  autonomous_escalation      boolean (default: true — overdue tasks auto-escalate)
```

---

## 19. How It All Connects

### 19.0 Reconciliation: Routine (Core) vs. Session Hook

The Governance model defines a **Routine** as "scheduled execution of a Procedure." This module defines a **Session Hook** as "a timed trigger within a session that fires procedures." These are related but serve different purposes — and it's important to clarify how they connect.

```
GOVERNANCE LAYER (Core)
  Routine = the DEFINITION
  "Temperature check should run every 4 hours, assigned to kitchen team"
  Lives in: Protocol → Routine
  Has: trigger_config (cron/event), assigned_to, control_list linkage

OPERATIONS LAYER (Module 4)
  Session Hook = the MATERIALIZER
  "Today, in this session, fire the temperature check at 11:00, 15:00, 19:00"
  Lives in: department → session_hook
  Has: trigger_offset, repeat_interval, priority, weekday filter

SESSION LAYER (Runtime)
  Session Task = the INSTANCE
  "At 11:00 today, create a task: Temperature Check — Walk-in Fridge"
  Lives in: department_session → session_task
  Has: assigned person, status, completion data, audit trail
```

**The relationship:**

- A **Routine** defines WHAT should happen and HOW OFTEN (governance intent)
- A **Session Hook** translates that into WHEN it fires within a daily session (operational schedule)
- A **Session Task** is the actual work item created when the hook fires (runtime instance)

**In practice:** When an admin creates a Policy ("Temperature must be logged every 4 hours") with a Protocol containing a Routine, the system can auto-generate the corresponding Session Hook. Or the admin can manually configure hooks. Either way, the Hook is the bridge between governance rules and daily operations.

**Control Lists** still trigger as defined in the Routine: after a session task from a routine-linked hook is completed, the control list fires per the configured frequency (every time, every Nth time, never). The control list becomes a session task of its own with `source_type: control_list`.

### 19.1 Escalation Model

When a task goes overdue or a critical event occurs, the system follows a structured escalation chain. This builds on the Runbook concept from Core Governance but applies specifically to session operations.

**Default escalation chain for overdue tasks:**

```
Task due_at passes
  │
  ├── Grace period (configurable, default: 15 min)
  │     AI sends reminder to assigned person
  │
  ├── Level 1: +15 min after grace
  │     Notify team leader (team.leader_profile_id)
  │     Task status → overdue
  │
  ├── Level 2: +30 min after Level 1
  │     Notify department manager
  │     If critical priority → also SMS
  │
  └── Level 3: +30 min after Level 2
       Notify admin/owner
       Task status → escalated
       If HACCP/safety → trigger Runbook
```

**Escalation varies by priority:**

| Priority   | Grace period | L1 (team lead) | L2 (manager)  | L3 (admin)    |
| ---------- | ------------ | -------------- | ------------- | ------------- |
| `critical` | 0 min        | Immediate      | +10 min       | +20 min       |
| `high`     | 10 min       | +15 min        | +30 min       | +60 min       |
| `normal`   | 15 min       | +30 min        | +60 min       | +120 min      |
| `low`      | 30 min       | +60 min        | No escalation | No escalation |

**Runbook integration:** When a task is linked to a Procedure that has an associated Runbook (via Protocol), and the task gets a deviation flag or hits Level 3 escalation, the Runbook activates automatically. The Runbook's own escalation chain and Control List take over from there.

**Configurable:** Escalation timing is configurable per workspace via Policy (`policy_type: operations`). The defaults above are sensible starting points.

### 19.2 Gamification Connection

Module 4 is where the majority of points are **earned** in Smartout. Every operational action maps to the gamification layer defined in Core Architecture.

**Point-earning actions:**

| Action                                        | Base points | Modifier                             |
| --------------------------------------------- | ----------- | ------------------------------------ |
| Complete a session task on time               | 10          | ×1.5 if critical priority            |
| Complete a session task early (before due_at) | 10 + bonus  | +5 per 15-min early block            |
| Claim and complete an inherited task          | 15          | (reward for covering gaps)           |
| Complete all shift tasks (100% completion)    | 25          | Shift completion bonus               |
| Clean session sign-off (all tasks done)       | 50          | Department-level bonus               |
| Zero deviations in a session                  | 20          | Compliance bonus                     |
| Complete HACCP task with data                 | 15          | Safety bonus                         |
| Submit handoff                                | 10          | +5 if voice handoff (higher quality) |
| Add a useful session note                     | 5           | (encourages information sharing)     |

**Point-reducing events:**

| Event                                                        | Penalty |
| ------------------------------------------------------------ | ------- |
| Task overdue (hit Level 1 escalation)                        | -5      |
| Task escalated to Level 2+                                   | -10     |
| Deviation flagged without corrective action                  | -10     |
| No-show (shift not covered)                                  | -25     |
| Session sign-off with exceptions (incomplete required tasks) | -15     |
| Missed handoff                                               | -10     |

**Boosters apply here:** When a manager activates a booster (e.g., "2× points for HACCP tasks this week"), it multiplies the base points for matching session tasks. Boosters are defined at the Season/workspace level and filter by task category, department, or team.

**Leaderboard feeds:**

- Individual: sum of all points from session tasks across all sessions
- Team: aggregate of team members' points within a season
- Department: aggregate across department sessions
- Workspace: global leaderboard — competitive across all Smartout workspaces

**Points are Season-scoped.** When a season ends, scores are archived. New season = fresh competition. Default season accumulates ongoing.

### 19.3 Versioning: Templates, Hooks, and Procedures

**Question: what happens when an admin changes a shift template or hook mid-season?**

**Shift Templates — snapshot at shift creation:**

- When a manager creates a shift from a template, the shift captures a **snapshot** of the template's procedures at that moment
- If the template is later modified, already-created shifts keep their original procedures
- New shifts created from the updated template get the new version
- This prevents a mid-season template change from silently altering already-published shifts

**Session Hooks — effective immediately (for future sessions):**

- Hook changes take effect from the next session forward
- Already-generated session tasks from previous hooks are not modified
- If a hook is deactivated, it stops firing in future sessions but doesn't remove tasks from current/past sessions

**Procedures (Core Governance) — versioned via Protocol:**

- Protocol has a `version` field (1.0, 1.1, 2.0)
- When a Procedure is updated, the Protocol version increments
- Session tasks link to the specific `procedure_step_id` at creation time — they reference the step as it was, not as it currently is
- Historical data always reflects what the employee actually did, not the current procedure definition

**The principle:** Once a task is materialized in a session, it's a standalone record. Changes to definitions affect future materializations only. History is never rewritten.

### 19.4 Conflict and Deduplication

When multiple sources (hooks, shift templates, recurring task configs) could create overlapping tasks:

**Deduplication rules:**

- Same `procedure_id` + same `session_id` + same `scheduled_at` (within 30-min window) = potential duplicate
- System creates the task from the first source and marks subsequent duplicates as `suppressed` in the AI event log
- Priority wins: if two sources define the same procedure but different priorities, the higher priority is used
- Assignment wins: specific person > specific position > specific team > any_on_shift

**Conflict resolution:**

- Two hooks fire at the same time for the same person → tasks are created for both (person has two tasks, not a conflict)
- A shift template and a hook both trigger the same procedure → deduplicated (one task, attributed to whichever source has higher priority)
- A recurring task and a hook overlap → hook takes priority (hooks are session-specific and intentional; recurring tasks are background)

### 19.5 The Full Chain

```
Season
  └── Department Schedule (when does each department operate?)
        └── Department Session (daily instance)
              │
              ├── INFORMATION LAYER
              │     ├── Session Notes (from anyone, anytime, categorized)
              │     ├── Day Brief (AI-compiled, pushed to teams)
              │     └── Handoff (end-of-shift knowledge transfer)
              │
              ├── TASK LAYER
              │     ├── Session Hooks → Session Tasks (timed triggers)
              │     ├── Shift Templates → Procedures → Session Tasks
              │     ├── Recurring Tasks (location-bound, scheduled)
              │     ├── Ad-hoc Tasks (real-time from managers)
              │     └── Inherited Tasks (from absent shifts)
              │
              ├── AI LAYER (continuous background agent)
              │     ├── Triage (classify, route, enrich incoming data)
              │     ├── Monitor (detect anomalies, gaps, threshold breaches)
              │     ├── Compile (briefs, digests, summaries)
              │     ├── Predict (coverage gaps, bottlenecks, compliance risks)
              │     ├── Act (automated task creation, inheritance, escalation)
              │     └── Learn (patterns, durations, staffing insights)
              │
              ├── PEOPLE LAYER
              │     ├── Shifts (who is working)
              │     ├── Positions (what role they fill)
              │     └── Teams (how they're grouped)
              │
              ├── GAMIFICATION LAYER
              │     ├── Points earned from task completion
              │     ├── Boosters active for current season
              │     └── Penalties for compliance failures
              │
              └── ACCOUNTABILITY LAYER
                    ├── Task completion tracking (full audit)
                    ├── Escalation chains (overdue → team lead → manager → admin)
                    ├── AI event log (what the AI did and why)
                    ├── Session sign-off (daily closure)
                    └── Compliance reporting (filterable history)
```

### 19.2 Integration Points

| Module                   | Integration                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------- |
| **0. Core / Governance** | Policy → Protocol → Procedure/Routine → materializes as Session Tasks              |
| **2. Org Structure**     | Department, Location, Zone, Asset, Position — all referenced by sessions and tasks |
| **3. Scheduling**        | Shifts are created from Shift Templates, linked to Sessions when started           |
| **5. HACCP**             | HACCP procedures execute as session tasks with structured completion data          |
| **6. Training**          | Readiness determines which procedures an employee is qualified to perform          |
| **7. Absence**           | Absent employees trigger shift inheritance logic                                   |
| **8. Payroll**           | Session data feeds payroll: hours, shifts, overtime context                        |
| **9. Communication**     | Day Brief pushed to team channels. Task notifications. Handoff delivery.           |
| **10. Dashboards**       | Session aggregates + note analytics power operational dashboards                   |
| **12. AI (Mr. Botsson)** | Generates Day Briefs, conducts voice handoffs, extracts structured data from notes |

### 19.3 Module Boundary

**This module owns:**

- Department Schedule
- Department Session (lifecycle, sign-off)
- Session Hooks
- Session Task (the runtime instance)
- Session Notes
- Day Brief (generation, delivery)
- Handoff (all methods)
- AI Operations Layer (triage, monitor, compile, predict, act, learn)
- AI Session Event Log
- AI Operations Config
- Shift Template
- Shift Template ↔ Procedure junction
- Recurring Task Config
- Ad-hoc task creation
- Inheritance logic

**This module does NOT own (but consumes):**

- Procedure, Routine, Runbook, Control List (owned by Core/Governance)
- Position (owned by Org Structure)
- Shift scheduling & publishing (owned by Module 3 — Scheduling)
- Absence data (owned by Module 7)
- Payroll calculations (owned by Module 8)
- AI engines (owned by Module 12 — but called by this module)
- Chat channels (owned by Module 9 — but Day Brief is delivered there)

---

## 20. Data Entities Summary

### New entities introduced by this module

| Entity                       | Purpose                                       | Key relationships                     |
| ---------------------------- | --------------------------------------------- | ------------------------------------- |
| **department_schedule**      | Operating hours per department per season     | Department, Season                    |
| **department_session**       | Daily operational container                   | Department, Season                    |
| **session_hook**             | Timed triggers within a session               | Department, Season, Procedure/Routine |
| **session_task**             | Runtime task instance (the actual work item)  | Session, Procedure, Profile           |
| **session_note**             | Information notes targeted at dates/sessions  | Session, Department, Profile          |
| **day_brief**                | AI-generated daily summary                    | Session, Department                   |
| **session_handoff**          | End-of-shift/session knowledge transfer       | Session, Shift, Profile               |
| **ai_session_event**         | AI action log for transparency and audit      | Session                               |
| **ai_operations_config**     | Per-workspace AI tuning (via Policy/settings) | Workspace                             |
| **shift_template**           | Pre-configured shift work package             | Department, Season, Position          |
| **shift_template_procedure** | Junction: template ↔ procedure                | Shift Template, Procedure             |
| **recurring_task_config**    | Location-bound recurring task definitions     | Location, Zone, Asset, Procedure      |

### Modified entities

| Entity       | Change                                                             |
| ------------ | ------------------------------------------------------------------ |
| **position** | Renamed from `job` in Module 2. Same schema.                       |
| **shift**    | Added `session_id`, `template_id`. Updated to reference new model. |

---

## 21. Proposed Core Architecture Changes

This module introduces concepts that may need to be reflected in Core Architecture v2:

1. **Rename `job` → `position`** across all documentation and schemas
2. **Add `department_schedule`** — possibly a Core extension since Payroll and Reporting also need operating hours
3. **Consider if `department_session` should be Core** — multiple modules depend on "what happened today" (Payroll, Reporting, HACCP, Communication). It might qualify under the rule: "If multiple modules need it → Core."
4. **Consider if `session_note` should be Core** — notes are referenced by Communication (chat), Dashboards, AI, and potentially Onboarding. The note system is a general information layer, not operations-specific.
5. **Reconcile Routine (Core) and Session Hook (Module 4)** — Clarify in Core that Routine is the governance definition, and Session Hook is the operational materializer. May need a `routine_id` on `session_hook` to formalize the link.
6. **Gamification points schema** — Core defines the gamification layer conceptually but has no data model for points. This module needs a `points_event` table or similar to record point-earning actions. Should live in Core since Training, Onboarding, and other modules also award points.

These changes should be discussed and decided before implementation begins.

---

## 22. Design Decisions (Resolved)

### 22.1 Multi-Department Sessions — Auto-Switch

When an employee works across departments (Kitchen 08:00–14:00, Bar 14:00–20:00), the app **auto-switches context** based on the active shift and punch-in.

**How it works:**

- Employee punches into Kitchen shift → app context = Kitchen Session
- Kitchen shift ends, employee punches into Bar shift → app context auto-switches to Bar Session
- No manual session switching needed
- The employee belongs to both `department_session` records; their shifts link them
- If Kitchen has overdue tasks when they switch to Bar, a notification carries over: "You left Kitchen with 2 incomplete tasks" — but the active context is now Bar

**For the data model:** The `shift.session_id` determines context. When the active shift changes, the UI context follows.

### 22.2 Employee Mobile Experience — Feed-First

The primary mobile view is a **unified feed** — a stream of tasks, notes, briefs, and messages ordered by relevance and time. The employee doesn't think in sessions or shifts; they think in "what do I need to do right now."

**Feed composition:**

```
Feed (personalized, real-time)
  │
  ├── Day Brief (pinned at top when session starts)
  │     "Good morning Anna. Here's what you need to know today..."
  │
  ├── Shift Brief (when you punch in, if mid-day start)
  │     "Here's what happened before your shift..."
  │
  ├── Active Tasks (sorted by due_at, priority)
  │     🔴 Temperature check — Walk-in Fridge (due in 15 min)
  │     🟡 Prep cold station (due 11:00)
  │     ⚪ Clean dishwasher filters (flexible)
  │
  ├── Notes (relevant to your department/team/location)
  │     📝 "Customer Nilsen, table 7 at 19:00, nut allergy"
  │     📝 "Sugar delivery expected 10:00 tomorrow"
  │
  ├── Messages (from team chat, manager, system)
  │     💬 "Ole: Can someone cover my mid-shift Friday?"
  │
  └── Inherited Tasks (if applicable)
        ↗️ "Mid-shift empty — 2 tasks available to claim"
```

**Context is implicit, not navigated.** The feed pulls from whichever session the employee is currently in (auto-switched per 22.1). Managers and team leads see the same feed but with additional session-level overview accessible via a tap.

**Deep-dive available:** Tapping any feed item opens the full context — task details with procedure steps, note thread, message conversation, session board.

### 22.3 Gamification Points — Configurable + AI-Suggested

Point values are **configurable per workspace** (admin sets the values) with **AI recommendations** based on behavioral data.

**How it works:**

- System ships with sensible defaults (the values in Section 19.2)
- Admin can adjust any point value via workspace settings (Policy: `policy_type: gamification`)
- AI analyzes engagement data over time and suggests adjustments:
  - "HACCP task completion dropped 15% this month. Suggest increasing HACCP task points from 15 → 25."
  - "Handoff completion is at 95%. Current bonus of +5 for voice handoff may be unnecessary."
  - "Inherited task claims are low. Suggest increasing from 15 → 30 to incentivize coverage."
- AI suggestions appear as recommendations in admin dashboard — admin approves, modifies, or dismisses
- AI never changes point values autonomously (follows authority level: notify + suggest)

**Configuration stored as:**

```
gamification_config (via Policy, policy_type: gamification)
  rules_json: {
    points: {
      task_complete_ontime: 10,
      task_complete_early_bonus_per_15min: 5,
      task_inherited_claimed: 15,
      shift_100_completion: 25,
      session_clean_signoff: 50,
      session_zero_deviations: 20,
      haccp_task_complete: 15,
      handoff_submitted: 10,
      handoff_voice_bonus: 5,
      note_added: 5
    },
    penalties: {
      task_overdue_l1: -5,
      task_escalated_l2: -10,
      deviation_no_corrective: -10,
      noshow: -25,
      session_signoff_with_exceptions: -15,
      handoff_missed: -10
    },
    visibility: "full" | "personal_only" | "managers_only"
  }
```

### 22.4 Actionable Notes — AI-Decided Task Creation

When someone adds a note, the **AI evaluates the content** and auto-creates an ad-hoc task if it detects an action is needed. The note remains as information; the task is the trackable action.

**How it works:**

```
User adds note: "We're out of sugar, need to buy it before tomorrow"
  │
  AI evaluates:
  ├── Contains action language? YES ("need to buy")
  ├── Has a deadline? YES ("before tomorrow")
  ├── Assignable? SOFT (no specific person, but supply-related → location manager)
  │
  AI creates:
  ├── session_note (the information record, category: supply)
  └── session_task (ad-hoc, auto-generated)
        title: "Buy sugar"
        description: "Noted: out of sugar. Needs restocking before tomorrow."
        source_type: ad_hoc
        source_ref_id: → session_note.note_id
        priority: normal
        due_at: tomorrow, session open time
        assigned_to_type: any_on_shift (or AI picks best match)
        created_by: null (system/AI-generated)
```

**AI classification examples:**

| Note content                             | AI assessment                      | Action                                                                     |
| ---------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| "Customer Nilsen loved the new menu"     | Information only, no action needed | Note only, `is_actionable: false`                                          |
| "Oven 2 making strange noise"            | Warning, action needed             | Note + task: "Inspect Oven 2", category: maintenance, priority: high       |
| "Private event Saturday 20 pax"          | Event, prep action needed          | Note + task: "Prepare for Saturday event (20 pax)", due: Saturday pre-open |
| "Health inspector might visit this week" | Warning, no specific action        | Note only, `is_actionable: false`, but flagged in Day Brief as warning     |
| "We ran out of napkins during service"   | Supply issue, action needed        | Note + task: "Restock napkins", category: supply, priority: normal         |
| "Great teamwork today, thanks everyone!" | Positive feedback, no action       | Note only, but flagged for engagement/morale tracking                      |

**Override:** If the AI creates a task the user didn't intend, the task can be dismissed by any team lead+. If the AI misses an action, any user can manually create a task from a note (tap note → "Create task"). The AI learns from both corrections.

**Logged:** All AI note-to-task decisions are recorded in `ai_session_event` for transparency: "AI created task 'Buy sugar' from note #XYZ. Confidence: 0.87. Reason: action language detected, deadline inferred."

### 22.5 Gamification Visibility — Configurable Per Workspace

Admins decide how much of the gamification layer employees can see:

| Setting         | What employees see                                                        | What managers see                                   |
| --------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| `full`          | Personal score, team score, department leaderboard, workspace leaderboard | Everything + individual employee scores + analytics |
| `personal_only` | Their own points and achievements only                                    | Everything                                          |
| `managers_only` | Nothing — gamification runs silently                                      | Full visibility + analytics                         |

**Default:** `personal_only` — employees see their own progress without competitive pressure. Admin can upgrade to `full` when the culture supports it.

**Stored in:** `gamification_config.rules_json.visibility` (see 22.3)

---

## 23. Migration Notes

Specific considerations for migration from Bubble to Next.js/Supabase:

**Session & Tasks:**

- `department_session` auto-generation should be an Edge Function or database trigger, not client-side
- `session_task` table will be high-volume — needs proper indexing on `session_id`, `status`, `category`, `completed_by`, `scheduled_at`
- Hook evaluation (checking offsets, generating tasks) runs as a scheduled Edge Function, e.g., every 5 minutes
- Inheritance logic should be an Edge Function triggered by: (a) shift no-show timeout, (b) manual trigger by manager
- Sign-off flow should use Supabase Realtime for live task count updates
- Task completion data (photos, measurements) stored in Supabase Storage, referenced by URL in `completion_data` jsonb
- RLS: employees see only tasks assigned to them or `any_on_shift` in their department; managers see all tasks in their department(s)
- The `session_task` table should be partitioned by date for query performance over time
- Offline support (React Native): tasks can be completed offline with local queue, synced when connection returns
- Recurring task generation: nightly Edge Function creates instances for the next N days based on `recurring_task_config`

**Information Layer:**

- `session_note` needs full-text search — consider `pg_trgm` extension or Supabase full-text search for searching notes across sessions
- Day Brief generation calls the AI (Operation Engine) via Edge Function, triggered ~30 min before first shift or at configured time
- Day Brief delivery to team chat requires integration with Module 9 (Communication) — the brief is posted as a structured message
- Voice handoff recordings stored in Supabase Storage with transcription processed via Ultravox/Whisper
- AI extraction from handoffs (structured event/note creation) runs as an async Edge Function after handoff submission
- Notes targeting future dates need a query pattern: "all notes where `target_date` = X, regardless of `created_at`"
- Actionable notes with `action_status: pending` should surface in the session board even if created days/weeks earlier
- RLS for notes: respect `visibility` scope — workspace-wide notes visible to all, department notes to department members, team notes to team members

**AI Operations:**

- AI monitoring runs as a persistent process — either a long-running Edge Function or an n8n workflow that polls session state every 1–5 minutes
- Day Brief and Shift Brief generation should be async Edge Functions calling the AI with session context as structured prompt
- AI event log (`ai_session_event`) will be high-volume — consider write-optimized table with periodic archival
- Handoff voice processing pipeline: Twilio/Ultravox captures audio → Supabase Storage → Edge Function triggers transcription → AI extracts structured data → creates notes/tasks
- AI prediction functions (coverage gaps, bottleneck detection) can run as scheduled n8n workflows (e.g., nightly for next-day predictions, hourly during active sessions)
- `ai_operations_config` can be implemented as a Policy (`policy_type: ai_operations`) with `rules_json` containing the configuration — leverages existing governance model
- AI authority levels enforced at the Edge Function layer — autonomous actions execute directly, notify/suggest actions create pending items that require human response
- Rate limiting on AI notifications to prevent alert fatigue — configurable per workspace via `ai_operations_config`

---

_This document redefines Module 4 from simple task management to a comprehensive operational model built around the Department Session. It bridges the governance framework (Core Architecture) with daily restaurant operations, ensuring every task is trackable, every day is accountable, every piece of information is captured, and no work falls through the cracks. The AI layer ensures nothing is missed, everyone is informed, and the system gets smarter over time._
