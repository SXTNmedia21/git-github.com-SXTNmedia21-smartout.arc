---
title: "Handoff — Vaktlista View + Operating Hours Cascade System"
status: draft
updated: 2026-03-19
created: 2026-03-19
module: schedule, operations, season
tags: [vaktlista, template-shifts, operating-hours, cascade, session-hooks, department]
---

# Handoff: Vaktlista View + Operating Hours Cascade

## What triggered this

Pontus wants a 5th schedule view ("Vaktlista") showing a recurring roster grid — template shifts as columns, weekdays as rows, employees in cells. During brainstorming, we discovered this feature can't be built in isolation. Template shifts need to know about department opening hours, and changing those hours should cascade through the entire system: shifts, hooks, procedures, notifications. This document captures the full problem space and possible solutions for a dedicated design session.

---

## 1. The Vaktlista View (Surface Feature)

### What it looks like

From the reference image (docs/IMG_9411.jpeg) — a paper vaktlista from a real restaurant:

```
Uke 05           | 1st shift      | 2nd shift    | 3rd shift      | 4th shift
                 | 09.00-15/16    | 12.00-16.00  | 15.00-21.30    | 16.00-21.30
─────────────────┼────────────────┼──────────────┼────────────────┼────────────────
Man 26/01        | Live           | Milan        | Therese        | Lovise
Tirs 27/01       | C              | Liv 11-15    | Ellen          | Selma
Ons 28/01        | C              | Milan 18     | Klara          | Sharon 18
Tors 29/01       | Live           | C            | Tora           | Solveig
Fre 30/01        | Milan          | Frida        | Lovise         | Selma
                 | 09.00-14/16    | 11.00-18.00  | 12.00-18.30    | 13.00-18.30
Lør 31/01        | Klara          | Lovise       | Frida          | Selma/Ada
```

### Key characteristics

- **Columns = shift slots** (1st, 2nd, 3rd, 4th shift — identified by template shift)
- **Rows = weekdays** (Mon–Sat, grouped by week)
- **Cells = employee name** (who works that slot on that day)
- **Hours change between weekdays and weekends** (two rows of column headers)
- **1st shift starts when department opens**, 4th shift ends when department closes
- **Middle shifts** may also adjust on weekends (shorter day = compressed schedule)

### Implementation approach (agreed)

- New layout mode `"template"` alongside existing daily/weekly/monthly/list
- Uses the **existing** `schedule_template` + `schedule_template_shift` tables (not a new concept)
- Template shifts need new fields (see section 3)

---

## 2. The Deep Problem: Operating Hours as Single Source of Truth

### Current state (fragmented)

| Source                       | Scope                              | Season-aware         | Cascades         |
| ---------------------------- | ---------------------------------- | -------------------- | ---------------- |
| `operating_hours` table      | Workspace or location, per weekday | No                   | No               |
| `season.opening_hours` JSONB | Per department, per weekday        | Yes (tied to season) | No — just a blob |

Neither source connects to template shifts, schedule shifts, or session hooks. Changing hours requires manually updating everything downstream.

### Desired state

One authoritative source for "when does this department operate" that automatically cascades:

```
Department Operating Hours (per season, per weekday, with date overrides)
    ↓ derives
Template Shift Times (opening/closing shifts recalculate start/end)
    ↓ affects
Published Schedule Shifts (future shifts get updated times)
    ↓ triggers
Session Hook Timing (pre_open/open/pre_close/close offsets recalculate)
    ↓ notifies
Employees ("Your shift on Dec 23 changed: ends at 18:00 instead of 21:30")
```

### The override example

Manager sets: "Dec 23, Sal closes at 18:00 instead of 21:30"

System automatically:

1. Closing shift (4th): end_time → 18:00
2. Shift 3 (anchored to close): end_time → 18:00
3. pre_close hook: fires at 17:00 instead of 20:30
4. close hook: fires at 18:00 instead of 21:30
5. Affected employees notified of time changes

---

## 3. Template Shift — New Fields Needed

The existing `schedule_template_shift` table needs additions to support the vaktlista view and operating hours connection.

### Agreed fields

| Field              | Type    | Purpose                                                      |
| ------------------ | ------- | ------------------------------------------------------------ |
| `slot_order`       | INT     | Column position (1, 2, 3, 4) — currently no ordering concept |
| `name` / `label`   | TEXT    | "Åpningsvakt", "Mellomvakt", "Lukkevakt"                     |
| `is_opening_shift` | BOOLEAN | start_time follows department opening time                   |
| `is_closing_shift` | BOOLEAN | end_time follows department closing time                     |

### Time override model (agreed direction, needs detail)

Default + override pattern:

- Template shift has a **default** `start_time` + `end_time` (applies to all days)
- If `is_opening_shift`: default start_time is ignored, derived from operating hours
- If `is_closing_shift`: default end_time is ignored, derived from operating hours
- **Overrides**: optional list of `{ days: [5, 6], start_time?, end_time? }` for day-specific variations
- Override can target one day or multiple days, and only overrides what it specifies

### Open question: override storage

- Option A: JSONB column on `schedule_template_shift` (simple, no extra table)
- Option B: `schedule_template_shift_override` child table (normalized, queryable)
- Option C: Overrides are unnecessary if anchored shifts derive from operating hours (which already vary per weekday)

---

## 4. Department Classification

### The problem

Not all departments need opening/closing ceremonies:

| Type               | Example                                         | Opening hours? | Session hooks? | Opening shift? |
| ------------------ | ----------------------------------------------- | -------------- | -------------- | -------------- |
| **Operational**    | Restaurant floor, kitchen, bar, hotel reception | Yes            | Yes            | Yes            |
| **Administrative** | Back-office, call center, IT                    | No             | No             | No             |

A restaurant floor needs to be physically opened: lights, tables, cutlery, machines, fridges. A call center employee just logs in and starts working.

### Proposed solution

Add `is_operational` boolean (or `department_type` enum) to the `department` table. Only operational departments:

- Have operating hours
- Can have opening/closing template shifts
- Generate department sessions with full lifecycle (upcoming → active → closed)
- Have session hooks (pre_open, open, pre_close, close)

### Open question

Is boolean enough, or do we need an enum? Possible types:

- `operational` — physical open/close (restaurant, kitchen, shop)
- `administrative` — individual work sessions (office, call center)
- `hybrid` — has some structure but no physical ceremony (e.g., warehouse?)

---

## 5. Operating Hours — Where Should They Live?

### Option A: New `department_operating_hours` table

```sql
department_operating_hours (
  id UUID PK,
  department_id UUID FK,
  season_id UUID FK,
  day_of_week INT (0-6),
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false,
  workspace_id UUID FK,
  UNIQUE (department_id, season_id, day_of_week)
)
```

Plus a child table for date-specific overrides:

```sql
department_hours_override (
  id UUID PK,
  department_operating_hours_id UUID FK,  -- or just department_id + season_id
  override_date DATE,
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false,
  reason TEXT,
  UNIQUE (department_id, season_id, override_date)
)
```

**Pros:** Normalized, queryable, can have RLS, cascade-friendly via triggers.
**Cons:** Replaces two existing systems (operating_hours table + season.opening_hours JSONB). Migration needed.

### Option B: Keep `season.opening_hours` JSONB but make it structured

Enhance the existing JSONB field on `season` to include overrides:

```json
{
  "Kjøkken": {
    "default": { "mon": "09:00-21:30", "sat": "09:00-18:30", ... },
    "overrides": [
      { "date": "2026-12-23", "hours": "10:00-18:00", "reason": "Jul" }
    ]
  }
}
```

**Pros:** No schema change, already exists.
**Cons:** JSONB doesn't cascade, can't have FKs, harder to query, no RLS on individual entries.

### Option C: Hybrid — table for defaults, JSONB for overrides

Use the new table for per-weekday defaults, keep overrides in a JSONB column or simple override table.

### Open question: Location dimension

If a restaurant has two locations (Oslo, Bergen) with different hours, do operating hours need a `location_id`? Current `operating_hours` table supports this. The question is whether the new system should be `(department_id, season_id, day_of_week)` or `(department_id, location_id, season_id, day_of_week)`.

---

## 6. Session Hooks — Connection to Template Shifts

### Current hook system

| Hook type   | Anchor     | Timing                                  |
| ----------- | ---------- | --------------------------------------- |
| `pre_open`  | open       | Before opening (offset: -N min)         |
| `open`      | open       | At opening time                         |
| `scheduled` | open/close | Custom time during session (can repeat) |
| `pre_close` | close      | Before closing (offset: -N min)         |
| `close`     | close      | At closing time                         |

Hooks fire procedures/routines via `trigger_offset_min` relative to an anchor (open or close time). They're configured per department, not per season.

### The natural link

| Template shift type                | Responsible for hooks              |
| ---------------------------------- | ---------------------------------- |
| Opening shift (`is_opening_shift`) | pre_open + open tasks              |
| Closing shift (`is_closing_shift`) | pre_close + close tasks            |
| Middle shifts                      | scheduled tasks during their hours |

Currently, hooks assign tasks to `any_on_shift` or specific profiles. There's no concept of "the opening shift person gets the opening tasks." This connection could be formalized but may not be needed for v1.

### Open question

Should template shifts explicitly link to hook types? Or keep it implicit — whoever is assigned to the opening shift inherits opening responsibilities through task assignment rules?

---

## 7. The Cascade Mechanism — Open Design Questions

### When operating hours change, what triggers the cascade?

- **Option A: Database trigger** — UPDATE on `department_operating_hours` fires a PG function that updates all derived data
- **Option B: Edge Function** — API endpoint that performs the cascade as a transaction
- **Option C: Engine process** — Use the existing Event Engine (`engine_process`) to handle cascade as a multi-step workflow with audit trail

### What gets cascaded?

| Target                        | What changes                                  | Complexity                                |
| ----------------------------- | --------------------------------------------- | ----------------------------------------- |
| Template shift display        | Recalculate anchored times for vaktlista view | Low (computed at render time)             |
| Published schedule_shift rows | Update start_time/end_time on future shifts   | Medium (bulk UPDATE + conflict detection) |
| Session hooks                 | Recalculate firing times                      | Medium (offset math)                      |
| Employee notifications        | "Your shift changed" messages                 | Medium (notification system)              |
| Department sessions           | Adjust planned times                          | Low (metadata update)                     |

### Conflict scenarios

- What if an employee has a personal override on a shift that conflicts with new hours?
- What if a shift has been confirmed/acknowledged by the employee?
- What about shifts that have already started (past/in-progress)?
- Should the manager see a preview before confirming the cascade?

---

## 8. Summary: What Needs to Be Designed in Next Session

### Must decide (blocks implementation)

1. **Department classification** — `is_operational` boolean or `department_type` enum?
2. **Operating hours table design** — Option A/B/C from section 5, with or without location dimension
3. **Template shift override storage** — JSONB on shift, child table, or derive from operating hours?
4. **Cascade mechanism** — trigger, Edge Function, or engine process?

### Must design (core feature)

5. **Vaktlista view component** — grid layout, data flow, how it reads templates + operating hours + shifts
6. **Template shift editing** — UI for setting slot_order, name, is_opening/closing, overrides
7. **The cascade flow** — exact steps when hours change, with conflict handling

### Can defer (future iteration)

8. Hook-to-template-shift linking (explicit responsibility assignment)
9. Preview/confirm UX for cascade changes
10. Notification templates for shift changes
11. Historical tracking of operating hours changes

---

## 9. Files to Read Before Next Session

| File                                                                | Why                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/web/src/app/dashboard/schedule/page.tsx`                      | All 4 current view layouts, view switching mechanism                           |
| `apps/web/src/app/dashboard/schedule/_hooks/use-templates.ts`       | Template CRUD + load mutation                                                  |
| `apps/web/src/app/dashboard/schedule/_components/schedule-types.ts` | Frontend type definitions                                                      |
| `packages/supabase/src/database.types.ts`                           | Search for: schedule_template_shift, operating_hours, session_hook, department |
| `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts` | Current operating hours hook                                                   |
| `apps/web/src/app/dashboard/season/_hooks/use-seasons.ts`           | Season CRUD, opening_hours JSONB                                               |
| `apps/web/src/lib/season-calculations.ts`                           | How hours feed into budget calculations                                        |
| `docs/modules/SMARTOUT_MODULE_4_OPERATIONS.md`                      | Department session lifecycle                                                   |
| `docs/modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md`                | Season planning specification                                                  |
| `supabase/migrations/20260416200000_season_opening_hours.sql`       | The season.opening_hours JSONB migration                                       |
| `supabase/migrations/20260412100300_session_infrastructure.sql`     | session_hook, session_task tables                                              |

---

## 10. Visual Reference

Mockups from this brainstorming session are saved in:
`.superpowers/brainstorm/53321-1773922429/`

- `anchor-model.html` — Three approaches for shift time derivation
- `cascade-system.html` — The full cascade diagram + department classification + override example
