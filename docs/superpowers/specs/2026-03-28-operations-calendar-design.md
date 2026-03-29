---
title: Operations Calendar — Universal Calendar for Mobile
status: draft
created: 2026-03-28
updated: 2026-03-28
module: mobile
tags: [calendar, shifts, tasks, bookings, operations]
---

# Operations Calendar — Design Spec

## Purpose

Replace the static placeholder calendar with a fully functional Operations Calendar that aggregates all daily operational data — shifts, tasks, bookings, notes, and open shifts — into a single, filterable, scope-aware view. Supports both week and month views.

## Data Sources

| Type        | Table                  | Key Fields                                         | Hook                       |
| ----------- | ---------------------- | -------------------------------------------------- | -------------------------- |
| My shifts   | `schedule_shift`       | shift_date, start_time, end_time, role, status     | `useMyShifts` (extended)   |
| Team shifts | `schedule_shift`       | Same + employee_id != me, same dept                | New: `useDepartmentShifts` |
| Open shifts | `schedule_shift`       | employee_id IS NULL, is_published = true           | New: `useOpenShifts`       |
| Tasks       | `session_task`         | title, status, is_compliance_required, assigned_to | `useMyTasks` (extended)    |
| Bookings    | `schedule_day_booking` | booking_time, title, guest_count, status, is_vip   | `useDayInfo` (extended)    |
| Notes       | `schedule_day_message` | title, content, is_alert, visibility               | `useDayInfo` (extended)    |
| Shift notes | `shift_note`           | content, profile_id                                | `useShiftNotes`            |

## UI Structure

### Header Bar

```
+--------------------------------------------------+
| Operations              [Meg|Team|Alle] [Uke|Mnd] |
| UNIVERSAL CALENDAR                          [cog] |
+--------------------------------------------------+
```

- **Title:** "Operations" (serif 30, light weight) + "Universal Calendar" (micro, brandOrange, uppercase tracking)
- **Scope selector:** Segmented control — `Meg | Team | Alle`. Controls whose data is shown.
- **View toggle:** Segmented control — `Uke | Mnd`. Controls calendar layout.
- **Settings:** Gear icon → opens SettingsSheet.

### Week View (default)

#### Week Strip

- 7-column horizontal row (Mon–Sun)
- Selected day: brandOrange background, white text, shadow
- Today (if not selected): brandOrange text
- Swipe left/right to navigate weeks (stretch goal — tapping arrows or dates first)

#### Filter Tags

Horizontal scrollable chip row:

| Key        | Label       | Filters                                  |
| ---------- | ----------- | ---------------------------------------- |
| `all`      | Alt         | No filter                                |
| `shifts`   | Mine vakter | schedule_shift where employee_id = me    |
| `tasks`    | Oppgaver    | session_task                             |
| `bookings` | Bookinger   | schedule_day_booking                     |
| `notes`    | Notater     | schedule_day_message + shift_note        |
| `open`     | Apne vakter | schedule_shift where employee_id IS NULL |

Active chip: foreground bg, background text, bold. Inactive: secondary bg, muted text.

#### Feed Cards

Cards rendered in a ScrollView, filtered by: selected date + active filter + active scope.

**1. Overdue Task Card (red alert)**

- Condition: `session_task` with `is_compliance_required = true` AND status = 'pending' AND overdue
- Left red bar (4px) + destructive background tint
- Icon: AlertTriangle in red circle
- Shows: task title, "OVERFORFALLT", last completed time

**2. My Shift Card (white/elevated)**

- Source: `schedule_shift` where employee_id = current profile
- Badge: "Min Vakt" (brandOrange tint pill)
- Shows: role + shift type, time range, date label
- Tap → navigate to shift detail `/(app)/(shifts)/[id]`

**3. Team Shift Card (muted)**

- Source: `schedule_shift` where employee_id != me, same department
- Only shown when scope = Team or Alle
- Badge: "Team" (gray pill)
- Shows: colleague name + department, time range
- Avatar from profile join

**4. Open Shift Card (outlined/dashed)**

- Source: `schedule_shift` where employee_id IS NULL, is_published = true
- Badge: "Ledig vakt" (green-tint pill)
- Shows: role, time range, department
- Dashed border style to visually distinguish from assigned shifts
- Tap → future: claim shift flow

**5. Booking Card (warm tint)**

- Source: `schedule_day_booking`
- Icon: UtensilsCrossed in white square
- Shows: title, guest_count + table info, booking_time
- VIP indicator if is_vip = true

**6. Task Card (standard)**

- Source: `session_task` (non-overdue)
- Shows: title, status badge, compliance flag if applicable
- Tap → future: task detail/completion

**7. Note Card (italic/subtle)**

- Source: `schedule_day_message` + `shift_note`
- Shows: "Dagens Notat" label, content in italic
- Alert messages get a subtle highlight

**Card layout rules:**

- My Shift + Team Shift render side-by-side (2 columns) when both present
- Overdue cards always on top
- Everything else in chronological order by time field
- Empty state: centered message "Ingen hendelser denne dagen"

### Month View

Full 7-column calendar grid (same as old CalendarGrid component, refined).

#### Grid

- Month/year header with prev/next arrows
- Day-of-week headers: Man Tir Ons Tor Fre Lor Son
- Day cells: number + up to 3 colored dot indicators
- Selected day: brandOrange circle
- Today: brandOrange text (if not selected)

#### Dot Indicators

Each day shows colored dots based on what events exist:

| Color              | Meaning            |
| ------------------ | ------------------ |
| brandOrange        | My shift           |
| `#3b82f6` (blue)   | Task               |
| `#22c55e` (green)  | Booking            |
| `#eab308` (yellow) | Note/message       |
| `#ef4444` (red)    | Overdue/compliance |
| `#8b5cf6` (purple) | Open shift         |

Max 3 dots shown per day. Priority: red > orange > blue > green > purple > yellow.

#### Day Expansion

Tapping a day in month view:

1. Selects the day (brandOrange circle)
2. Shows the same feed cards below the calendar grid (scrollable)
3. Filter tags still apply

### Settings Sheet (Bottom Sheet)

Opened via gear icon in header. Persisted in MMKV.

#### Visibility Toggles

| Setting     | Default | Controls                             |
| ----------- | ------- | ------------------------------------ |
| Mine vakter | ON      | Show my shifts                       |
| Team-vakter | ON      | Show team shifts (when scope allows) |
| Apne vakter | ON      | Show unassigned shifts               |
| Oppgaver    | ON      | Show tasks                           |
| Bookinger   | ON      | Show bookings                        |
| Notater     | ON      | Show notes/messages                  |

#### Default Scope

Radio group: Meg / Team / Alle. Sets initial scope on screen load.

#### Default View

Radio group: Uke / Maned. Sets initial view on screen load.

## Data Hook: `useCalendarFeed`

Central aggregation hook that fetches and merges all data for a given date.

```typescript
type CalendarFeedParams = {
  date: string; // ISO date (YYYY-MM-DD)
  scope: "me" | "team" | "all";
  profileId: string;
  departmentId: string;
};

type CalendarFeedItem = {
  id: string;
  type: "shift" | "team_shift" | "open_shift" | "task" | "booking" | "note";
  time?: string; // HH:MM for sorting
  title: string;
  subtitle?: string;
  isOverdue?: boolean;
  isCompliance?: boolean;
  isVip?: boolean;
  raw: ScheduleShift | SessionTask | DayBooking | DayMessage;
};

function useCalendarFeed(params: CalendarFeedParams): {
  data: CalendarFeedItem[];
  isLoading: boolean;
  error: Error | null;
};
```

**Implementation:** Runs parallel queries via `Promise.all`:

1. `schedule_shift` filtered by date + scope
2. `session_task` filtered by date
3. `schedule_day_booking` filtered by date
4. `schedule_day_message` filtered by date

Merges results into `CalendarFeedItem[]`, sorted by time (overdue items first).

**Stale time:** 2 minutes. Offline cache via MMKV.

## Data Hook: `useCalendarDots`

For month view — fetches summary data for an entire month.

```typescript
type DayDots = Record<number, Array<{ color: string; type: string }>>;

function useCalendarDots(params: {
  year: number;
  month: number;
  scope: "me" | "team" | "all";
  profileId: string;
  departmentId: string;
}): {
  data: DayDots;
  isLoading: boolean;
};
```

**Implementation:** Single query per table with date range filter (first day of month to last day). Groups results by day number and maps to dot colors.

**Stale time:** 5 minutes (month-level summary changes slowly).

## Settings Store

MMKV-backed Zustand store:

```typescript
type CalendarSettings = {
  defaultScope: "me" | "team" | "all";
  defaultView: "week" | "month";
  visibility: {
    myShifts: boolean;
    teamShifts: boolean;
    openShifts: boolean;
    tasks: boolean;
    bookings: boolean;
    notes: boolean;
  };
};
```

Default: all ON, scope = "me", view = "week".

## File Structure

```
apps/mobile/
  app/(app)/(shifts)/
    index.tsx              — Main OperationsCalendarScreen (rewritten)
    [id].tsx               — Shift detail (unchanged)
    _layout.tsx            — Stack layout (unchanged)
    roster.tsx             — Roster view (unchanged)
  src/
    components/calendar/
      WeekStrip.tsx        — 7-day horizontal selector
      MonthGrid.tsx        — Full month calendar with dots
      FilterTags.tsx       — Horizontal filter chip row
      ScopeToggle.tsx      — Meg/Team/Alle segmented control
      ViewToggle.tsx       — Uke/Maned segmented control
      FeedCard.tsx         — Generic feed card (delegates to type-specific cards)
      ShiftCard.tsx        — My shift bento card
      TeamShiftCard.tsx    — Team shift card
      OpenShiftCard.tsx    — Open/unassigned shift card
      BookingCard.tsx      — Booking card
      TaskCard.tsx         — Task card (+ overdue variant)
      NoteCard.tsx         — Note/message card
      SettingsSheet.tsx    — Bottom sheet with visibility + defaults
      EmptyState.tsx       — "Ingen hendelser" placeholder
    hooks/
      queries/
        use-calendar-feed.ts    — Aggregated day feed
        use-calendar-dots.ts    — Month dot indicators
        use-department-shifts.ts — Team/all shifts for a date
        use-open-shifts.ts      — Unassigned published shifts
      stores/
        use-calendar-settings.ts — MMKV settings store
```

## Scope Rules

| Scope | My shifts | Team shifts | Open shifts | Tasks     | Bookings | Notes |
| ----- | --------- | ----------- | ----------- | --------- | -------- | ----- |
| Meg   | Yes       | No          | Yes         | Mine only | Yes      | Yes   |
| Team  | Yes       | Same dept   | Yes         | Team's    | Yes      | Yes   |
| Alle  | Yes       | All depts   | Yes         | All       | Yes      | Yes   |

Open shifts and bookings are always visible regardless of scope (they're operational, not personal). Notes follow scope for shift_note but schedule_day_message is always visible (it's department communication).

## Edge Cases

- **No data for selected day:** Show EmptyState component
- **Offline:** All queries have MMKV cache; show cached data with SyncIndicator
- **Role permissions:** Employees see Meg only. Managers/admins see all three scope options.
- **Multi-department:** Profile has `departments[]` array. Team scope = all departments user belongs to.
- **Month navigation:** Prev/next month arrows update the month grid and refetch dots.
- **Week navigation:** Tapping days outside current week shifts the week strip.

## Not In Scope (Future)

- Claiming open shifts (tap → claim flow)
- Drag-and-drop shift swapping
- Creating new bookings/tasks from calendar
- Push notifications for overdue tasks
- Week swipe gestures (use day taps for now)
