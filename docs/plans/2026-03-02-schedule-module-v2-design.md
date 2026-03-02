---
title: "Design — Schedule Module v2 UI Redesign"
status: approved
updated: 2026-03-02
created: 2026-03-02
module: schedule
tags: [schedule, vaktplan, redesign, ui]
---

# Schedule Module v2 — UI Redesign

## Context

Rebuild of the schedule module from Bubble reference screenshots. The current Next.js implementation has basic grid + CRUD but lacks the full feature set from Bubble and the new improvements specified by Pontus.

## Design Decisions

| Question                                  | Decision                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| Employee card                             | Drawer from right                                                            |
| Month view grouping                       | Toggle department/employee                                                   |
| Filter panel (Employee/Job/Team/Location) | Popover per filter button in top bar                                         |
| Shift list layouts                        | Single view, clickable cards                                                 |
| Roster/turnus                             | Simple: fixed weekdays + times, auto-fill for period                         |
| Navigation                                | Arrows to jump week + horizontal scroll, sticky sidebar                      |
| Day control center fullscreen             | Timeline, employee list, budget, opening hours, duty manager, last year data |

## Architecture

### Top Bar (simplified)

```
Operations > Schedule    📍 Lokasjon ▼   [👤][💼][👥][📍]   [Uke][Rullerende][Måned][Vaktliste]   < Uke 52 >  [Publiser (0)]
```

- Location: dropdown left of view tabs
- Filters (Ansatt/Jobb/Team/Lokasjon): popover buttons — click opens dropdown, no panel
- "Brukermetode" removed entirely
- View tabs: "Dag-til-dag" renamed to "Uke"

### Sub-header (risk badges + status counts)

```
🔽 [Alle][Selskap][Krise][Normal]   [Dekningsrisiko: 1][Overtidsrisiko: 0][Compliance: 0][Ledige: 0]   Draft 0  Published 2  Active 0
```

Kept as-is from current implementation.

### Week View (primary)

```
┌─────────────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│ 🔒 STICKY       │ Mån  │ Tir  │ Ons  │ Tor  │ Fre  │ Lør  │ Søn  │ Mån  │ Tir  │
│                 │ 2/3  │ 3/3  │ 4/3  │ 5/3  │ 6/3  │ 7/3  │ 8/3  │ 9/3  │10/3  │
├─────────────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ AO Anna Olsen   │      │ ████ │      │ ████ │      │      │      │      │      │
│ Kokk · 2v 16/37│      │      │      │      │      │      │      │      │      │
├─────────────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ EP Erik P.      │ ████ │      │ ████ │      │ ████ │      │      │      │      │
│ Sous · 3v 24/37│      │      │      │      │      │      │      │      │      │
└─────────────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
                           ←← scroll →→
                  < Uke 52 >  [1 uke | 2 uker]
```

**Key behaviors:**

- CSS `position: sticky; left: 0` on employee column
- `overflow-x: auto` on grid container
- 1-week or 2-week toggle
- Arrow buttons jump one week forward/back
- Horizontal scroll for continuous day navigation
- Employee rows slightly smaller height than current

### Employee Card (drawer)

Opens from right when clicking employee in sidebar.

```
┌───────────────────────────────────┐
│ ← Anna Olsen                 [✕] │
│ Kokk · Sal & Service              │
├───────────────────────────────────┤
│ TURNUS                    [Rediger]│
│ ┌─────┬─────┬─────┬─────┬─────┐  │
│ │ Mån │ Tir │ Ons │ Tor │ Fre │  │
│ │08-16│08-16│08-16│08-16│08-16│  │
│ └─────┴─────┴─────┴─────┴─────┘  │
│ Lør: —  Søn: —                    │
│ Periode: 01.03 → 31.05           │
│                                    │
│ TILGJENGELIGHET                    │
│ ██ Tilgjengelig  ░░ Ikke tilgj.   │
│ [Kalender-widget med dager]       │
│                                    │
│ [Auto-fyll vakter for periode]    │
│                                    │
│ STATISTIKK                         │
│ Timer denne uken: 24/37.5         │
│ Vakter denne mnd: 12              │
│ Overtid: 0t                       │
└───────────────────────────────────┘
```

### Month View

Toggle between department and employee grouping via filter popover.

**Department mode** (default):

```
┌──────────────────┬───┬───┬───┬───┬───┬───┬───┬───┬─── ... ──┐
│                  │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │    31   │
│ Sal & Service    │ ██│ ██│ ██│ ██│ ██│ ██│ ██│   │         │
│ 2/3 dekket ⚠    │   │   │   │   │   │   │   │   │         │
│ Bar              │ ██│ ██│ ██│   │ ██│ ██│   │   │         │
│ 1/2 dekket ⚠    │   │   │   │   │   │   │   │   │         │
└──────────────────┴───┴───┴───┴───┴───┴───┴───┴───┴─────────┘
```

**Employee mode:**

```
┌──────────────────┬───┬───┬───┬───┬───┬───┬───┬───┬─── ... ──┐
│ Anna Olsen       │ ██│   │ ██│   │ ██│   │   │ ██│         │
│ Erik Pedersen    │   │ ██│   │ ██│   │ ██│   │   │         │
│ Jonas Bakken     │ ██│ ██│   │   │ ██│   │   │ ██│         │
└──────────────────┴───┴───┴───┴───┴───┴───┴───┴───┴─────────┘
```

All cells clickable → opens shift detail or create-shift dialog.

### Day Control Center

Opens from bottom (bottom sheet animation). Can expand to fullscreen.

**Tabs:** Oversikt | Dagsinfo | Reservasjoner | Oppgaver

**Oversikt tab (fullscreen):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ FREDAG 6. MARS                                          [✕] [⛶]   │
│ [Oversikt] [Dagsinfo] [Reservasjoner] [Oppgaver]                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ NØKKELTALL                                              [✏ Rediger]│
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│ │EST. KOSTNAD│ │BUDSJETT    │ │TOTALE TIMER│ │ANSATTE     │       │
│ │ 12 400 kr  │ │ 15 000 kr  │ │ 24t        │ │ 4          │       │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘       │
│                                                                     │
│ ÅPNINGSTIDER: 11:00 – 23:00    DUTY: Erik Pedersen, Anna Olsen    │
│ FORRIGE ÅR: 8 ansatte, 18 400 kr, 52t                             │
│                                                                     │
│ TIDSLINJE                                                           │
│ 06  07  08  09  10  11  12  13  14  15  16  17  18  19  20  21  22 │
│ ──────────────────────────────────────────────────────────────────── │
│ Anna  ░░░░░░░░████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│ Erik  ░░░░░░░░░░░░░░░░████████████████████████░░░░░░░░░░░░░░░░░░  │
│ Jonas ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████████████████░░░░░░  │
│                                                                     │
│ ANSATTE PÅ VAKT                                                     │
│ ✅ Anna Olsen    08:00-16:00  Kokk       📱 +47 xxx      [SMS]    │
│ ✅ Erik Pedersen 12:00-20:00  Sous Chef  📱 +47 xxx      [SMS]    │
│ ⬜ Jonas Bakken  16:00-00:00  Bartender  📱 +47 xxx      [SMS]    │
│                                                                     │
│ 📢 KRINGKAST   [🔔 Push m/melding]  [✉ SMS m/melding]             │
│                 ☐ Pakk med daginfo                                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Dagsinfo tab additions:**

- Read receipt: "3 av 4 har sett daginfoen" → click to see who

**Reservasjoner tab (renamed from Selskap/Booking):**

- Same booking form but with "Reservasjoner" as label

**Oppgaver tab additions:**

- Search field with autocomplete dropdown from task library
- Click task → opens full detail editor

### Shift List View

Single layout. Grouped by day. Clickable cards open shift detail modal.

```
Uke 52, 2026                                              [🖨 Skriv ut]

┌─────────────────────────────────────────────────────────────────────┐
│ Tir 3/3                                      👤 3 ANSATTE  ⏰ 4 VAKTER │
├─────────────────────────────────────────────────────────────────────┤
│ [Anna Olsen · 08-16 · Kokk · Draft]    [Erik P. · 12-20 · Sous · Published] │
│ [Jonas B. · 16-00 · Bar · Draft]        [LEDIG · 08-16 · Sal · Open]        │
└─────────────────────────────────────────────────────────────────────┘
```

### Shift Detail Modal

Existing modal + new field:

- Avspasering / Tilgjengelighet toggle

### Turnus System (v1 — simple)

Stored per employee. Fixed weekday + time pattern with date range.

**Schema addition:**

```sql
CREATE TABLE employee_roster (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID NOT NULL REFERENCES profile(profile_id),
  workspace_id  UUID NOT NULL REFERENCES workspace(workspace_id),
  pattern       JSONB NOT NULL,  -- { "mon": "08:00-16:00", "tue": "08:00-16:00", ... }
  period_start  DATE NOT NULL,
  period_end    DATE,            -- NULL = ongoing
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

**Auto-fill logic:**

1. Read pattern for employee
2. For each day in selected period where weekday has a shift
3. Create `schedule_shift` with status "created" (draft)
4. Skip days where employee has absence/unavailability

## Implementation Phases

### Phase 1: Grid Foundation (3-4 tasks)

- Refactor top bar: rename "Dag-til-dag" → "Uke", remove Brukermetode, move filters to popover
- Implement CSS sticky sidebar on employee column
- Add horizontal scroll with 1/2-week toggle
- Keep arrow navigation alongside scroll

### Phase 2: Day Control Center (3-4 tasks)

- Change animation to bottom-sheet (from left drawer)
- Add fullscreen expand
- Add timeline view (Gantt-style 06:00-23:00)
- Add employee list with status + contact
- Add budget edit on KPI cards
- Add opening hours + duty manager fields
- Add last year comparison data
- Compact header

### Phase 3: Employee Card + Turnus (3 tasks)

- Create employee_roster table migration
- Build employee drawer (right side) with turnus editor
- Implement auto-fill logic (generate draft shifts from pattern)
- Add availability calendar widget

### Phase 4: Month + Shift List + Detail (3 tasks)

- Month view: add employee grouping toggle
- Month view: clickable cells → create/edit shift
- Shift list: clickable cards → shift detail modal
- Shift detail: add availability/time-off field

### Phase 5: Day Control Center Tabs (3 tasks)

- Reservasjoner tab (rename + keep)
- Oppgaver tab: search autocomplete + task detail editor
- Dagsinfo tab: read receipts
- Push/SMS: dialog with message field + "pakk med daginfo"

### Phase 6: Polish + Integration (2 tasks)

- Responsive design pass
- Print view for shift list
- Filter integration across all views
- Status filter (Draft/Published/Active)
