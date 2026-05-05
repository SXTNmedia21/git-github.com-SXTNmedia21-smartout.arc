---
title: "Cascade Spreadsheet Overview"
status: reference
updated: 2026-03-21
created: 2026-03-21
module: cascade
tags: [cascade, architecture, spreadsheet, waterfall, overview]
---

# Cascade Spreadsheet Overview

> How data flows through the system like a spreadsheet. Each layer is a row.
> When you change a cell, everything below it recalculates.

---

## The Waterfall (Read top to bottom)

```
LAYER 1: PLANNING CYCLE          "When is our year?"
    │
    ▼
LAYER 2: SEASONS                  "What are our periods?"
    │
    ▼
LAYER 3: OPERATING HOURS          "When are we open?"
    │
    ▼
LAYER 4: TEMPLATE SHIFTS          "What shifts do we need?"
    │
    ▼
LAYER 5: SCHEDULE SHIFTS          "Who works when?"
    │
    ▼
LAYER 6: SESSIONS                 "What happens today?"
    │
    ▼
LAYER 7: HOOKS                    "What triggers when?"
    │
    ▼
LAYER 8: TASKS                    "Who does what?"
    │
    ▼
LAYER 9: NOTIFICATIONS            "Who needs to know?"
```

---

## The Spreadsheet

### Example: "Sjøhuset Restaurant, Stavanger"

Each row is a layer. Each column shows the data, where it comes from (the formula), and what happens when it changes.

---

### Layer 1: Planning Cycle (Årshjul)

| Field              | Value         | Source          |
| ------------------ | ------------- | --------------- |
| **Name**           | "2026"        | Admin creates   |
| **Start**          | 2026-01-01    | Admin sets      |
| **End**            | 2026-12-31    | Admin sets      |
| **Revenue Target** | 12 000 000 kr | Admin sets      |
| **Status**         | active        | Admin activates |

**Table:** `planning_cycle`
**Who sets it:** Owner/admin, once per year
**What depends on it:** All seasons must fit inside these dates

---

### Layer 2: Seasons (Sesonger)

| Field              | Vår            | Sommer             | Høst           | Jul/Vinter     |
| ------------------ | -------------- | ------------------ | -------------- | -------------- |
| **Dates**          | Jan 1 – Apr 30 | May 1 – Aug 31     | Sep 1 – Nov 30 | Dec 1 – Dec 31 |
| **Revenue Target** | 2 400 000 kr   | 4 800 000 kr       | 3 000 000 kr   | 1 800 000 kr   |
| **Revenue Weight** | 0.8            | 1.6                | 1.0            | 0.6            |
| **Status**         | archived       | **ready (active)** | draft          | draft          |
| **Color**          | green          | yellow             | orange         | red            |

**Table:** `season` (with `planning_cycle_id` FK)
**Who sets it:** Admin during planning
**Formula:** Revenue Target = Planning Cycle Target × (Weight × Days) / Sum(Weight × Days)
**Constraint:** Seasons tile the year — no gaps, no overlaps (`EXCLUDE USING gist`)

> **When you change a season's dates:** Operating hours, shifts, sessions, hooks, tasks — everything below recalculates for the affected date range.

---

### Layer 3: Operating Hours (Åpningstider)

| Field                | Mon   | Tue   | Wed   | Thu   | Fri   | Sat   | Sun     |
| -------------------- | ----- | ----- | ----- | ----- | ----- | ----- | ------- |
| **Kitchen open**     | 09:00 | 09:00 | 09:00 | 09:00 | 09:00 | 10:00 | 11:00   |
| **Kitchen close**    | 22:00 | 22:00 | 22:00 | 22:00 | 23:00 | 23:00 | 21:00   |
| **Restaurant open**  | 11:00 | 11:00 | 11:00 | 11:00 | 11:00 | 11:00 | 12:00   |
| **Restaurant close** | 22:00 | 22:00 | 22:00 | 22:00 | 23:00 | 23:00 | 20:00   |
| **Bar open**         | 15:00 | 15:00 | 15:00 | 15:00 | 14:00 | 12:00 | —       |
| **Bar close**        | 00:00 | 00:00 | 00:00 | 01:00 | 02:00 | 02:00 | —       |
| **Bar closed?**      | no    | no    | no    | no    | no    | no    | **yes** |

**Table:** `department_operating_hours` (per department × season × weekday)
**Who sets it:** Admin per department, per season
**Formula:** Each cell = lookup(department, season, day_of_week)

**Overrides** (holidays, events — higher priority than weekly):

| Date   | Department | Override    | Reason                 |
| ------ | ---------- | ----------- | ---------------------- |
| May 17 | All        | CLOSED      | 17. mai (nasjonaldag)  |
| Dec 24 | All        | 11:00–15:00 | Julaften               |
| Jun 21 | Restaurant | 11:00–01:00 | Sankthansaften (event) |
| Jul 12 | All        | 10:00–02:00 | Gladmat festival       |

**Table:** `department_hours_override`
**Resolution:** Override > Weekly > Closed (CSS specificity)

> **When you change operating hours:** Every shift anchored to "open" or "close" recalculates. Sessions get new planned times. Hooks get new fire times.

---

### Layer 4: Template Shifts (Vaktmaler)

These are the **patterns** — not actual shifts yet. They define what shifts a department needs.

#### Kitchen Template Shifts:

| Slot | Label                 | Function       | Start Anchor | Start              | End Anchor    | End                |
| ---- | --------------------- | -------------- | ------------ | ------------------ | ------------- | ------------------ |
| 1    | Åpningsvakt Kjøkken   | **opening**    | open − 60min | _09:00−1h = 08:00_ | fixed         | 15:00              |
| 2    | Lunsj rush            | **rush_hour**  | fixed        | 10:30              | fixed         | 14:30              |
| 3    | Ettermiddagsvakt      | **supporting** | fixed        | 14:00              | fixed         | 21:00              |
| 4    | Stengingsvakt Kjøkken | **closing**    | fixed        | 17:00              | close + 60min | _22:00+1h = 23:00_ |

#### Restaurant Template Shifts:

| Slot | Label             | Function       | Start Anchor | Start               | End Anchor    | End                 |
| ---- | ----------------- | -------------- | ------------ | ------------------- | ------------- | ------------------- |
| 1    | Åpningsvakt Sal   | **opening**    | open − 30min | _11:00−30m = 10:30_ | fixed         | 16:00               |
| 2    | Lunsj servering   | **rush_hour**  | fixed        | 11:00               | fixed         | 15:00               |
| 3    | Middagsvakt       | **supporting** | fixed        | 15:00               | fixed         | 22:00               |
| 4    | Stengingsvakt Sal | **closing**    | fixed        | 18:00               | close + 30min | _22:00+30m = 22:30_ |

**Table:** `schedule_template_shift` (with anchor system)
**Who sets it:** Admin/manager when designing shift patterns
**Formula for anchored shifts:**

- `start = open − 60min` means: whatever the opening hour is, subtract 60 minutes
- `end = close + 60min` means: whatever the closing hour is, add 60 minutes

**The key insight:**

```
Monday Kitchen opens at 09:00  →  Åpningsvakt starts at 08:00 (09:00 − 60min)
Saturday Kitchen opens at 10:00 →  Åpningsvakt starts at 09:00 (10:00 − 60min)
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                    SAME template, DIFFERENT computed time.
                                    This is the cascade in action.
```

> **When you change a template shift:** All future schedule shifts generated from this template recalculate.

---

### Layer 5: Schedule Shifts (Faktiske vakter)

These are **real shifts** assigned to **real people**. Generated from templates + operating hours.

#### Monday Jun 15 — Kitchen:

| Slot | Shift            | Employee | Start | End   | Source              |
| ---- | ---------------- | -------- | ----- | ----- | ------------------- |
| 1    | Åpningsvakt      | Anna K.  | 08:00 | 15:00 | Template (anchored) |
| 2    | Lunsj rush       | Erik S.  | 10:30 | 14:30 | Template (fixed)    |
| 3    | Ettermiddagsvakt | Maria L. | 14:00 | 21:00 | Template (fixed)    |
| 4    | Stengingsvakt    | Johan B. | 17:00 | 23:00 | Template (anchored) |

#### Saturday Jun 20 — Kitchen (different hours!):

| Slot | Shift            | Employee | Start     | End       | Source                             |
| ---- | ---------------- | -------- | --------- | --------- | ---------------------------------- |
| 1    | Åpningsvakt      | Anna K.  | **09:00** | 15:00     | Template (anchored: 10:00 − 60min) |
| 2    | Lunsj rush       | Erik S.  | 10:30     | 14:30     | Template (fixed — same)            |
| 3    | Ettermiddagsvakt | Maria L. | 14:00     | 21:00     | Template (fixed — same)            |
| 4    | Stengingsvakt    | Johan B. | 17:00     | **00:00** | Template (anchored: 23:00 + 60min) |

**Table:** `schedule_shift`
**Formula:** Time = computeAnchoredTime(template_anchor, operating_hours)
**Manual edits:** If a manager manually changes a shift time, it's flagged as "manually edited" and WON'T be auto-adjusted by the cascade. It becomes a **conflict** that requires human review.

> **When operating hours change:** All anchored shifts recalculate. Fixed shifts stay the same. Manual edits become conflicts.

---

### Layer 6: Sessions (Daglige økter)

One session per department per day. Contains planned open/close from operating hours.

#### Monday Jun 15:

| Department | Session Date | Planned Open | Planned Close | Status   |
| ---------- | ------------ | ------------ | ------------- | -------- |
| Kitchen    | Jun 15       | 09:00        | 22:00         | upcoming |
| Restaurant | Jun 15       | 11:00        | 22:00         | upcoming |
| Bar        | Jun 15       | 15:00        | 00:00         | upcoming |

**Table:** `department_session`
**Formula:** planned_open = operating_hours.open_time, planned_close = operating_hours.close_time
**Lifecycle:** upcoming → active → pending_signoff → closed

> **When operating hours change:** planned_open and planned_close update on all upcoming sessions.

---

### Layer 7: Hooks (Automatiske utløsere)

Hooks fire at specific times relative to the session. They trigger procedures, routines, and tasks.

#### Kitchen Session — Jun 15:

| Hook          | Type      | Offset  | Fire Time | Triggers                     |
| ------------- | --------- | ------- | --------- | ---------------------------- |
| Pre-open prep | pre_open  | −30 min | 08:30     | Station setup checklist      |
| Opening check | open      | 0 min   | 09:00     | HACCP temperature check      |
| Mid-service   | scheduled | +3h     | 12:00     | Quality control round        |
| Pre-close     | pre_close | −30 min | 21:30     | Last order procedures        |
| Closing       | close     | 0 min   | 22:00     | Kitchen close-down checklist |

**Table:** `session_hook`
**Formula:** fire_time = session.planned_open + trigger_offset_min (for open-anchored hooks)
**Formula:** fire_time = session.planned_close + trigger_offset_min (for close-anchored hooks)

> **When session times change:** All hook fire times recalculate. Pre-open at 08:30 might become 09:30 if kitchen opens an hour later.

---

### Layer 8: Tasks (Oppgaver)

Tasks are created from hooks. Each task is assigned to a person and tracked.

#### Kitchen — Jun 15, Opening Hook fires at 09:00:

| Task                       | Assigned To           | Due   | Status  |
| -------------------------- | --------------------- | ----- | ------- |
| Sjekk kjøleskap temperatur | Anna K. (åpningsvakt) | 09:15 | pending |
| Sett opp stasjon 1         | Anna K.               | 09:15 | pending |
| Sett opp stasjon 2         | Erik S. (lunsj rush)  | 10:30 | pending |
| Oppdater dagens meny       | Anna K.               | 09:30 | pending |

**Table:** `session_task`
**Formula:** Tasks created when hook fires. Assigned based on who has the matching shift.

> **When hook fire times change:** Tasks get new due times. If a hook hasn't fired yet, it fires at the new time.

---

### Layer 9: Notifications (Varsler)

When the cascade changes something that affects an employee, they get notified.

| Employee | Change            | Old Time | New Time | Delta   | Notified?          |
| -------- | ----------------- | -------- | -------- | ------- | ------------------ |
| Anna K.  | Åpningsvakt start | 08:00    | 09:00    | +60 min | **Yes** (> 15 min) |
| Erik S.  | Lunsj rush start  | 10:30    | 10:30    | 0 min   | No (unchanged)     |
| Johan B. | Stengingsvakt end | 23:00    | 00:00    | +60 min | **Yes** (> 15 min) |

**Mechanism:** `dispatch_push_notification()` → Expo Push → mobile app
**Threshold:** Only notify if shift time changes by > 15 minutes

---

## The Cascade in Action: One Change, Full Waterfall

**Scenario:** Admin changes Summer Kitchen hours from "open 09:00" to "open 10:00" on weekdays.

```
CHANGE:  Kitchen weekday open_time: 09:00 → 10:00
         ┌──────────────────────────────────────────────────────┐
Step 1   │ RESOLVE HOURS                                        │
         │ For each affected weekday in summer season:          │
         │ Mon-Fri Kitchen open = 10:00 (was 09:00)             │
         └──────────────────┬───────────────────────────────────┘
                            ▼
         ┌──────────────────────────────────────────────────────┐
Step 2   │ RECOMPUTE ANCHORED SHIFTS                            │
         │ Åpningsvakt: start = open − 60min                   │
         │   Was: 09:00 − 60min = 08:00                        │
         │   Now: 10:00 − 60min = 09:00                        │
         │                                                      │
         │ Lunsj rush: start = fixed 10:30 → UNCHANGED          │
         │ Stengingsvakt: end = close + 60min → UNCHANGED        │
         └──────────────────┬───────────────────────────────────┘
                            ▼
         ┌──────────────────────────────────────────────────────┐
Step 3   │ DETECT CONFLICTS                                     │
         │ Check: any manually edited shifts on affected dates? │
         │ Anna's Monday shift was manually changed to 07:30    │
         │ → CONFLICT: won't auto-adjust, flag for review       │
         └──────────────────┬───────────────────────────────────┘
                            ▼
         ┌──────────────────────────────────────────────────────┐
Step 4   │ RECALCULATE SESSIONS                                 │
         │ Kitchen Mon-Fri sessions:                            │
         │   planned_open: 09:00 → 10:00                        │
         │   planned_close: 22:00 → 22:00 (unchanged)           │
         └──────────────────┬───────────────────────────────────┘
                            ▼
         ┌──────────────────────────────────────────────────────┐
Step 5   │ RECALCULATE HOOKS                                    │
         │ Pre-open: planned_open − 30min                       │
         │   Was: 09:00 − 30min = 08:30                         │
         │   Now: 10:00 − 30min = 09:30                         │
         │                                                      │
         │ Opening check: planned_open + 0min                   │
         │   Was: 09:00                                          │
         │   Now: 10:00                                          │
         └──────────────────┬───────────────────────────────────┘
                            ▼
         ┌──────────────────────────────────────────────────────┐
Step 6   │ NOTIFY                                               │
         │ Anna K: shift start 08:00 → 09:00 (+60 min) → PUSH  │
         │ Erik S: shift start 10:30 → 10:30 (0 min) → skip    │
         │ Johan B: shift end 23:00 → 23:00 (0 min) → skip     │
         │                                                      │
         │ Conflict: Anna's Monday (manually edited) → ALERT    │
         └──────────────────────────────────────────────────────┘
```

---

## Planning Events: How External Factors Enter the Spreadsheet

Events are like **conditional formatting** on the spreadsheet — they don't change the formulas, but they modify the inputs.

| Date      | Event            | Category         | Demand Multiplier | Effect                          |
| --------- | ---------------- | ---------------- | ----------------- | ------------------------------- |
| May 17    | 17. mai          | cultural         | 0.0               | CLOSED (override created)       |
| Jun 21    | Sankthansaften   | cultural         | 1.5               | +50% staffing needed            |
| Jul 12-14 | Gladmat Festival | external_scraped | 2.0               | Double staffing, extended hours |
| Dec 24    | Julaften         | cultural         | 0.3               | Reduced hours (11:00-15:00)     |
| Every Fri | Fredagspils      | recurring        | 1.3               | +30% bar staffing               |

**How events affect the cascade:**

1. Event with `demand_multiplier > 1.0` → suggestion to add extra shifts or extend hours
2. Event with `demand_multiplier = 0.0` → auto-create hours override (CLOSED)
3. Event with override link → `department_hours_override` automatically created

---

## The Learning Loop: How the Spreadsheet Gets Smarter

After each period, the system compares planned vs actual and adjusts.

| Week   | Planned Covers (Fri) | Actual Covers | Ratio | Smoothed Adjustment               |
| ------ | -------------------- | ------------- | ----- | --------------------------------- |
| Week 1 | 80                   | 92            | 1.15  | **1.045** (first data, alpha=0.5) |
| Week 2 | 80 × 1.045 = 84      | 88            | 1.05  | **1.047**                         |
| Week 3 | 80 × 1.047 = 84      | 86            | 1.02  | **1.041**                         |
| Week 4 | 80 × 1.041 = 83      | 85            | 1.02  | **1.037**                         |
| ...    | converging → 85      | ~85           | ~1.0  | **stable**                        |

**Formula:** `adjustment = old_adjustment + alpha × (actual_ratio − old_adjustment)`
**Tables:** `planning_factors` (raw data) + `adjustment_factors` (smoothed state)

The system learns that Friday covers are ~6% higher than originally planned and auto-adjusts future planning.

---

## Summary: The Complete Data Chain

| Layer | Table                        | Depends On                       | Human-Readable Name                  |
| ----- | ---------------------------- | -------------------------------- | ------------------------------------ |
| 1     | `planning_cycle`             | —                                | Årshjul (Year Wheel)                 |
| 2     | `season`                     | planning_cycle                   | Sesong (Season)                      |
| 3a    | `department_operating_hours` | season + department              | Åpningstider (Operating Hours)       |
| 3b    | `department_hours_override`  | operating_hours + planning_event | Unntak (Overrides)                   |
| 4     | `schedule_template_shift`    | department + anchor system       | Vaktmaler (Shift Templates)          |
| 5     | `schedule_shift`             | template + operating_hours       | Vakter (Actual Shifts)               |
| 6     | `department_session`         | operating_hours                  | Daglig økt (Daily Session)           |
| 7     | `session_hook`               | session + hook offsets           | Utløsere (Triggers)                  |
| 8     | `session_task`               | hook + shift assignment          | Oppgaver (Tasks)                     |
| 9     | push notification            | shift time delta                 | Varsler (Notifications)              |
| —     | `planning_event`             | planning_cycle                   | Hendelser (Events)                   |
| —     | `change_proposal`            | any layer change                 | Endringsforslag (Change Preview)     |
| —     | `planning_factors`           | actuals vs planned               | Planleggingsfaktorer (Learning Data) |
| —     | `adjustment_factors`         | planning_factors                 | Justeringsfaktorer (Learning State)  |
