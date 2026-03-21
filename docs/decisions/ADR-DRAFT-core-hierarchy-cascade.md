---
title: "ADR-DRAFT: Core Data Hierarchy & Cascade Architecture"
status: draft
updated: 2026-03-21
created: 2026-03-20
module: cross-cutting
tags: [adr, cascade, hierarchy, operating-hours, architecture]
---

# ADR-DRAFT: Core Data Hierarchy & Cascade Architecture

> **Status:** DRAFT — awaiting Pontus decision
> **Created:** 2026-03-20
> **Scope:** Irreversible — affects every module
> **Trigger:** Investigation revealed three disconnected operating hours systems, no department-location bridge, zero cascade, and naming mismatches between docs and database.
>
> **Canonical cascade reference:** `docs/cascade-spreadsheet-overview.md` — Six Dimensions (D1-D6, confirmed 2026-03-21), corrected Riksavtalen rates, compliance enforcement levels, and complete schema gap analysis live there.

---

## 1. The Problem (from Investigation)

Six structural failures prevent autonomous operations:

1. **Department and Location are islands** — no FK, no junction, no bridge. Kitchen doesn't know it operates in the Kitchen room.
2. **Three operating hours systems** — `operating_hours` table (location-scoped), `season.opening_hours` JSONB (department-scoped by name string), `company_opening_hours` table (signup-only). None cascade.
3. **`department_session` has no planned times** — only `opened_at`/`closed_at` actual timestamps. No `planned_open`/`planned_close` from operating hours.
4. **`schedule_shift` has no department or location FK** — connects to department only indirectly via `position_id → position.department_id`. Location is a plain text `zone` field.
5. **`schedule_template` uses plain text** — `department TEXT` instead of FK. `zone TEXT` instead of FK. No procedure links.
6. **Session hooks have no time anchor** — `trigger_offset_min` exists but `department_session` has no planned open/close to offset FROM.

**Result:** Change operating hours → nothing happens. No cascade. No preview. No traceability.

---

## 2. The Design Principle

**Every entity has one job. Every relationship serves the cascade.**

The hierarchy must enable this chain:

```
Operating Hours change
  → Preview: "Here's what would change"
  → Confirm
  → department_session planned times update
  → Anchored shifts recalculate (opening/closing shifts)
  → session_hook firing times recalculate
  → session_tasks re-materialize
  → Affected employees get notified (push, same pattern as trg_push_shift_updated)
  → activity_trail logs every change with before/after
  → engine_event emits for workflow automation
```

---

## 3. The Hierarchy

### 3.1 The Two Trees (unchanged — this is correct)

```
ORGANIZATIONAL TREE                    PHYSICAL TREE
(who does what)                        (where things happen)

Workspace                              Workspace
  └── Department                         └── Location
        └── Position                           ├── Zone
              (role type)                      └── Asset
```

- Department is NEVER seasonal. Permanent org unit.
- Location is NEVER seasonal. Physical place always exists.
- Position CAN be seasonal (Grill Chef summer only).
- Zone CAN be seasonal (terrace zones summer only).
- Asset CAN be seasonal (outdoor grill summer only).

### 3.2 The Bridge: `department_schedule`

**This is the new table that connects everything.**

One record says: "Kitchen operates Monday 09:00–22:00 during Sommersesong at the Main Restaurant location."

```
department_schedule
  schedule_id          UUID PK
  workspace_id         UUID FK → workspace
  department_id        UUID FK → department (NOT NULL)
  location_id          UUID FK → location (NULLABLE — null = all locations)
  season_id            UUID FK → season (NOT NULL — default season for permanent hours)

  -- When
  schedule_type        'weekly' | 'date_override'
  weekday              INT (0=Mon..6=Sun) — NULL for date_override
  specific_date        DATE — NULL for weekly

  -- Hours
  open_time            TIME NOT NULL
  close_time           TIME NOT NULL
  is_closed            BOOLEAN DEFAULT false

  -- Classification
  department_type      'operational' | 'administrative'

  -- Metadata
  label                TEXT — "Julaften", "Sommertider"
  priority             INT — date_override > weekly > default season

  -- Audit
  is_active            BOOLEAN DEFAULT true
  created_at           TIMESTAMPTZ
  updated_at           TIMESTAMPTZ

  UNIQUE (department_id, location_id, season_id, weekday)  -- for weekly
  UNIQUE (department_id, location_id, season_id, specific_date)  -- for overrides
```

**Resolution logic** (for a given department + date):

1. Check `date_override` for exact date in active season → use it
2. Fall back to `weekly` for that weekday in active season → use it
3. Fall back to `weekly` for that weekday in default season → use it
4. No match → department is closed that day

**`department_type` lives HERE, not on the department table.** Why: the same department might be operational in one season and administrative in another (unlikely but possible). More importantly, it keeps the department table clean and permanent.

**Actually — counterpoint: `department_type` should be on `department` itself.** A Kitchen is always operational. Administration is always administrative. This doesn't change per season. Simpler. Less indirection.

> **DECISION NEEDED:** `department_type` on `department` table (simpler, always true) or on `department_schedule` (more flexible, season-variable)?

### 3.3 What Gets Deprecated

| System                        | Action    | Reason                                                                          |
| ----------------------------- | --------- | ------------------------------------------------------------------------------- |
| `operating_hours` table       | DEPRECATE | Replaced by `department_schedule` — which adds department + season dimensions   |
| `season.opening_hours` JSONB  | DEPRECATE | String-keyed, un-queryable, no cascade. Replaced by `department_schedule`       |
| `company_opening_hours` table | DEPRECATE | Signup-only artifact. Onboarding should write to `department_schedule` directly |

**Migration path:** Create `department_schedule`. Migrate existing `operating_hours` rows (workspace+location+weekday → department_schedule with null department, or per-department if season.opening_hours has data). Drop old tables after verification.

---

## 4. Naming Convention Alignment

Investigation found naming mismatches. This section aligns them.

| Module 4 Spec Name     | Actual Database Name      | Decision                                                            |
| ---------------------- | ------------------------- | ------------------------------------------------------------------- |
| `shift_template`       | `schedule_template`       | **KEEP `schedule_template`** — it's broader than Module 4's concept |
| `shift_template_shift` | `schedule_template_shift` | **KEEP** — same reasoning                                           |
| `department_schedule`  | Does not exist (NEW)      | **CREATE** as specified above                                       |
| `shift`                | `schedule_shift`          | **KEEP `schedule_shift`** — avoids collision with generic "shift"   |
| `session_hook`         | `session_hook`            | **MATCH** — already aligned                                         |
| `session_task`         | `session_task`            | **MATCH** — already aligned                                         |
| `department_session`   | `department_session`      | **MATCH** — already aligned                                         |

**Convention going forward:**

- Schedule-layer tables: `schedule_` prefix (schedule_shift, schedule_template)
- Session-layer tables: `session_` prefix (session_hook, session_task)
- Department-layer tables: `department_` prefix (department_session, department_schedule)
- Engine-layer tables: `engine_` prefix (engine_event, engine_state)

---

## 5. The Cascade Chain

### 5.1 Trigger: Operating Hours Change

When admin saves new hours in `department_schedule`:

```
1. PREVIEW (before save)
   Edge Function: cascade-preview
   Input: { department_id, changes: [{ weekday, new_open, new_close }] }
   Output: {
     affected_sessions: [ { session_id, date, old_open, old_close, new_open, new_close } ],
     affected_shifts: [ { shift_id, employee, old_end, new_end, status: 'truncated'|'removed' } ],
     affected_hooks: [ { hook_id, name, old_fire_time, new_fire_time } ],
     affected_employees: [ { profile_id, name, notification_type } ],
     financial_close_impact: [ { session_id, date, closer_shift_affected: bool } ]
   }

2. CONFIRM (admin reviews preview, clicks "Bekreft")

3. APPLY (transactional Edge Function: cascade-apply)
   a. UPDATE department_schedule (the hours themselves)
   b. UPDATE department_session SET planned_open = X, planned_close = Y
      WHERE department_id = ? AND session_date >= today AND status = 'upcoming'
   c. UPDATE schedule_shift SET end_time = Y
      WHERE shift is anchored to closing AND shift_date >= today
      (skip shifts with personal overrides or employee confirmations → flag as conflict)
   d. UPDATE session_hook firing times (recalculate offset from new open/close)
   e. INSERT activity_trail for every change (entity_type, entity_id, before, after)
   f. EMIT engine_event 'operating_hours.changed' (for workflow automation)
   g. For each affected employee: dispatch_push_notification (reuse existing pattern)

4. CONFLICTS (returned to UI)
   Shifts that were manually overridden or employee-confirmed are NOT auto-changed.
   Returned as conflicts: "Ole's shift on Dec 23 ends at 22:00 but new close is 18:00. Override?"
```

### 5.2 What Changes on Existing Tables

**`department_session` — add planned times:**

```sql
ALTER TABLE department_session ADD COLUMN planned_open TIME;
ALTER TABLE department_session ADD COLUMN planned_close TIME;
```

These are set from `department_schedule` when the session is created. `opened_at`/`closed_at` remain as actual timestamps.

**`schedule_shift` — add department and location FKs:**

```sql
ALTER TABLE schedule_shift ADD COLUMN department_id UUID REFERENCES department;
ALTER TABLE schedule_shift ADD COLUMN location_id UUID REFERENCES location;
```

Backfill `department_id` from `position_id → position.department_id`. Direct FK is better than joining through position every time.

**`schedule_template` — FK instead of text:**

```sql
ALTER TABLE schedule_template ADD COLUMN department_id UUID REFERENCES department;
-- Migrate: UPDATE schedule_template SET department_id = d.department_id FROM department d WHERE d.name = schedule_template.department
-- Then: ALTER TABLE schedule_template DROP COLUMN department;
```

**`schedule_template_shift` — add anchoring and ordering:**

```sql
ALTER TABLE schedule_template_shift ADD COLUMN slot_order INTEGER DEFAULT 0;
ALTER TABLE schedule_template_shift ADD COLUMN label TEXT; -- "Åpningsvakt", "Lukkevakt"
ALTER TABLE schedule_template_shift ADD COLUMN is_opening_shift BOOLEAN DEFAULT false;
ALTER TABLE schedule_template_shift ADD COLUMN is_closing_shift BOOLEAN DEFAULT false;
```

**`department` — add classification:**

```sql
-- Create enum
CREATE TYPE department_type AS ENUM ('operational', 'administrative');
ALTER TABLE department ADD COLUMN department_type department_type DEFAULT 'operational';
```

---

## 6. The Autonomous Operations Chain

This is how the hierarchy enables self-running operations:

```
SETUP (one-time, during onboarding or season creation)
═══════════════════════════════════════════════════════
Industry Intelligence detects: Restaurant
  → Suggests departments: Kjøkken, Sal, Bar
  → Suggests locations: Inne, Ute, Kjøkken (physical)
  → Admin confirms and optionally links dept→location in department_schedule
  → Admin sets operating hours per department per weekday
  → Admin creates shift templates with is_opening/is_closing flags
  → Admin configures session_hooks (pre_open, open, pre_close, close)
  → Admin attaches procedures to hooks and shift templates

DAILY RUNTIME (autonomous, every day)
═══════════════════════════════════════
1. GENERATE SESSIONS (nightly job or on schedule publish)
   For each operational department with hours today:
     → Create department_session with planned_open/planned_close from department_schedule
     → Activate session_hooks (calculate absolute fire times from planned times + offsets)

2. SHIFTS START
   Employee punches in → session.opened_at = now()
     → session status: upcoming → active
     → pre_open + open hooks fire → session_tasks created from linked procedures
     → Tasks assigned to employees on opening shift

3. DURING SESSION
   Scheduled hooks fire at their calculated times
     → Temperature checks, routine procedures, recurring tasks
     → Deviations flagged → push notifications to managers (existing trigger pattern)

4. SHIFTS END
   pre_close hook fires (offset from planned_close)
     → Closing procedures materialize as session_tasks
     → Financial close initiated (Module 4.5)
   close hook fires at planned_close
     → Remaining tasks flagged
     → Session status: active → pending_signoff

5. SIGN-OFF
   Manager signs off → session status: pending_signoff → closed
     → Handoff notes written to next session
     → Day Brief compiled
     → Financial close enters awaiting_approval
     → Points calculated for gamification

WHEN HOURS CHANGE (cascade with preview)
════════════════════════════════════════
Admin changes hours → preview shows all effects → confirm → cascade applies
  → Future sessions updated
  → Anchored shifts adjusted
  → Hook times recalculated
  → Employees notified
  → Everything logged in activity_trail
```

---

## 7. The Vaktlista View

With `schedule_template_shift` having `slot_order`, `label`, and `is_opening/closing`:

```
Uke 05           | 1. vakt (Åpning) | 2. vakt        | 3. vakt          | 4. vakt (Lukking)
                 | 09:00-15:00      | 12:00-16:00    | 15:00-21:30      | 16:00-21:30
─────────────────┼──────────────────┼────────────────┼──────────────────┼──────────────────
Man 26/01        | Live             | Milan          | Therese          | Lovise
Tirs 27/01       | C                | Liv 11-15      | Ellen            | Selma
                 | 09:00-14:00      | 11:00-18:00    | 12:00-18:30      | 13:00-18:30
Lør 31/01        | Klara            | Lovise         | Frida            | Selma
```

- Columns = `schedule_template_shift` rows ordered by `slot_order`
- Column headers = `label` + derived times (from department_schedule for that weekday)
- `is_opening_shift` → start_time follows `department_schedule.open_time`
- `is_closing_shift` → end_time follows `department_schedule.close_time`
- Non-anchored shifts: use their default times, with optional `day_overrides` JSONB for weekday variations
- Cells = assigned employee from published `schedule_shift` matching that template slot

---

## 8. What Needs to Be Built (ordered)

| #   | What                                                                                       | Type                 | Blocks                   |
| --- | ------------------------------------------------------------------------------------------ | -------------------- | ------------------------ |
| 1   | `department_type` enum + column on `department`                                            | Migration            | Everything operational   |
| 2   | `department_schedule` table                                                                | Migration            | Sessions, hooks, cascade |
| 3   | `planned_open`/`planned_close` on `department_session`                                     | Migration            | Hook timing              |
| 4   | `department_id` + `location_id` on `schedule_shift`                                        | Migration + backfill | Reporting, filtering     |
| 5   | `department_id` FK on `schedule_template` (replace text)                                   | Migration            | Template integrity       |
| 6   | `slot_order`, `label`, `is_opening_shift`, `is_closing_shift` on `schedule_template_shift` | Migration            | Vaktlista view           |
| 7   | Deprecate 3 old operating hours systems                                                    | Migration            | Cleanup                  |
| 8   | `department_schedule` CRUD UI (replace old opening hours settings)                         | Frontend             | Admin can set hours      |
| 9   | Session generation reads from `department_schedule`                                        | Engine dispatch      | Autonomous sessions      |
| 10  | `cascade-preview` Edge Function                                                            | Backend              | Preview before apply     |
| 11  | `cascade-apply` Edge Function                                                              | Backend              | The actual cascade       |
| 12  | Vaktlista view component                                                                   | Frontend             | 5th schedule view        |
| 13  | Template shift editor (slot_order, labels, anchoring)                                      | Frontend             | Template management      |

---

## 9. Open Decisions (for Pontus)

| #   | Question                                                           | Options                                               | My Recommendation                                                                   |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | `department_type` on department table or on department_schedule?   | dept (simpler) vs schedule (season-flexible)          | **Department table** — a kitchen is always operational                              |
| 2   | Should `department_schedule` require `location_id`?                | Required vs nullable                                  | **Nullable** — simple restaurants don't need location scoping                       |
| 3   | Cascade mechanism: Edge Function or DB triggers?                   | EF (testable) vs triggers (automatic)                 | **Edge Function** — complex logic needs to be testable and previewable              |
| 4   | Template shift day-overrides: JSONB or child table?                | JSONB (simple) vs table (queryable)                   | **JSONB** — it's display data for vaktlista, not a cascade source                   |
| 5   | Should session hooks store absolute fire time or offset?           | Absolute (simple) vs offset (recalculates on cascade) | **Offset** — so cascade can recalculate. Absolute time computed at session creation |
| 6   | Should cascade auto-apply to confirmed shifts or flag as conflict? | Auto vs conflict                                      | **Conflict** — respect employee confirmations, let manager decide                   |
