---
id: PLAN-SCHEDULE-LOCAL-STATE
title: "Schedule Page — Wire All UI With Local State"
status: draft
layer: plan
created: 2026-03-01
updated: 2026-03-01
module: 3-scheduling
scope: apps/web/src/app/dashboard/schedule/
depends_on:
  - MODULE_03
  - CORE_ARCH_V2
references:
  - RESEARCH_WORKFORCE
  - RESEARCH_PROD_ARCH
  - SCHEDULE_PAGE_UX_AUDIT_AND_WORKFLOWS
adr_required: ADR-0031 (schedule local state architecture)
---

# Schedule Page — Wire All UI With Local State

> Goal: Make every button, interaction, and feature on `/dashboard/schedule` functional using local React state. No database. No server actions. Dummy data as initial seed.
>
> Types must align with `@smartout/types` enums and MODULE_03 data model so the future database migration is a drop-in replacement, not a rewrite.

---

## Architectural Constraints

These rules come from the codebase deep-dive and MUST be followed:

| Constraint         | Source                             | Rule                                                                                                                                    |
| ------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Use existing enums | `packages/types/src/enums.ts`      | Import `DayCategory`, `AbsenceType`, `TaskStatus`, `RequestType`, `ProfileRole` — do NOT redefine                                       |
| Shift lifecycle    | MODULE_03 §11                      | 6 states: `created → assigned → published → active → completed → unpublished`                                                           |
| Absence types      | MODULE_03 §7 + `@smartout/types`   | Full enum: `sick_leave, parental_leave, vacation, unpaid_leave, military, training, welfare`                                            |
| Task status        | `@smartout/types`                  | Use `TaskStatus` enum, not boolean `done`                                                                                               |
| Day category       | MODULE_03 §15 + `@smartout/types`  | Every shift gets a `dayCategory`: morning, midday, afternoon, evening, night, weekend                                                   |
| Template save      | MODULE_03 §13.1                    | Toggle to include/exclude staff assignments when saving                                                                                 |
| 6-tab shift modal  | MODULE_03 §6                       | All 6 tabs present. Lønnsgrunnlag, Funksjoner, Innstillinger show placeholder content until database                                    |
| Fravær popover     | MODULE_03 §7                       | Register absence directly from grid cell, not only via shift modal                                                                      |
| Batch select       | MODULE_03 §5                       | "Velg dag" checkbox for multi-day operations                                                                                            |
| CSS variables      | CLAUDE.md                          | `bg-background`, `text-foreground` — NEVER hardcoded colors                                                                             |
| shadcn/ui          | CLAUDE.md                          | All UI components from shadcn (new-york). Already installed: Dialog, DropdownMenu, Popover, Sheet, Tabs, Select                         |
| Sonner             | CLAUDE.md                          | Toast feedback via `sonner`, not shadcn toast                                                                                           |
| TypeScript strict  | CLAUDE.md                          | `type` over `interface`, no `any`, Zod for validation                                                                                   |
| Named exports      | CLAUDE.md                          | No default exports except page.tsx                                                                                                      |
| No i18n hardcoding | Research (Production Architecture) | All user-facing strings should be extractable (use constants, not inline Norwegian). Full i18n is future work but don't create blockers |

---

## Phase 0: State Foundation

### 0.1 — Create `schedule-types.ts`

New file: `_components/schedule-types.ts`

Import and re-export from `@smartout/types` where enums exist. Define schedule-specific types that don't exist yet. These types are designed to map 1:1 to the future `schedule_shift` database table (MODULE_03 §15).

```typescript
import type { DayCategory, AbsenceType, TaskStatus, RequestType } from "@smartout/types";

// ── Shift (maps to future schedule_shift table) ──────────────
type ShiftStatus = "created" | "assigned" | "published" | "active" | "completed" | "unpublished";

type Shift = {
  id: string;
  employeeId: string | null; // null = unassigned (created state)
  dateId: string;
  role: string;
  positionId?: string; // future FK to position table
  teamId?: string; // future FK to team table
  time: string; // "08:00 - 16:00" display format
  startTime: string; // "08:00" (for calculations)
  endTime: string; // "16:00" (for calculations)
  workHours: number; // calculated: endTime - startTime - breaks
  status: ShiftStatus;
  dayCategory: DayCategory; // from @smartout/types
  zone?: string; // kitchen zone, floor section
  indicator: string; // color indicator (blue, emerald, purple, orange)
  isPublished: boolean; // derived from status, kept for quick filtering
  breaks: number; // minutes of break
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

// ── Absence (maps to future absence table) ───────────────────
type Absence = {
  id: string;
  employeeId: string;
  dateId: string;
  type: AbsenceType; // from @smartout/types (sick_leave, vacation, etc.)
  requestType?: RequestType; // from @smartout/types (available, not_available, etc.)
  reason?: string;
  startDate: string;
  endDate: string;
  isFullDay: boolean;
  status: "pending" | "approved" | "rejected";
};

// ── Template (maps to future shift_template table) ───────────
type ShiftTemplate = {
  id: string;
  name: string;
  department: string;
  shifts: Omit<Shift, "id" | "dateId" | "createdAt" | "updatedAt" | "isPublished">[];
  includeAssignments: boolean; // MODULE_03 §13.1: optionally include/exclude staff
  createdBy: string; // employee name (future: profile_id)
  createdAt: string;
};

// ── Day Message ──────────────────────────────────────────────
type DayMessage = {
  id: string;
  dateId: string;
  title: string;
  content: string;
  audience: "all" | "leaders" | string; // team name for scoped messages
  visibility: "all_day" | "until_16" | "permanent";
  author: string;
  isAlert: boolean;
  createdAt: string;
};

// ── Day Task ─────────────────────────────────────────────────
type DayTask = {
  id: string;
  dateId: string;
  label: string;
  status: TaskStatus; // from @smartout/types (pending, completed, etc.)
  category: "all" | "routine" | "delegated";
  assignedTo?: string; // employee name
  completedAt?: string;
  highlight: boolean;
};

// ── Day Booking ──────────────────────────────────────────────
type DayBooking = {
  id: string;
  dateId: string;
  title: string;
  guestCount: number;
  menu: string;
  time: string;
  location: string;
  status: "confirmed" | "pending" | "cancelled";
  isVip: boolean;
  notes?: string;
  contactPerson?: string;
};

// ── Open Shift ───────────────────────────────────────────────
type OpenShift = {
  id: string;
  title: string;
  time: string;
  startTime: string;
  endTime: string;
  department?: string;
  role?: string;
  dayCategory?: DayCategory;
};

// ── Clipboard ────────────────────────────────────────────────
type DayClipboard = {
  sourceDate: string;
  sourceDateLabel: string;
  shifts: Omit<Shift, "id" | "dateId" | "createdAt" | "updatedAt">[];
  absences: Omit<Absence, "id" | "dateId">[];
};

// ── Shift History (local audit trail) ────────────────────────
type ShiftHistoryEntry = {
  id: string;
  shiftId: string;
  eventType: "created" | "updated" | "status_changed" | "assigned" | "moved" | "deleted";
  field?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  actor: string; // "System" or employee name
};

// ── Day selection for batch operations ───────────────────────
type SelectedDays = Set<string>; // set of dateIds
```

### 0.2 — Create `schedule-context.tsx`

New file: `_components/schedule-context.tsx`

**State shape:**

```typescript
type ScheduleState = {
  shifts: Shift[];
  absences: Absence[]; // separate from shifts (MODULE_03 §7)
  openShifts: OpenShift[];
  templates: ShiftTemplate[];
  dayMessages: DayMessage[];
  dayTasks: DayTask[];
  dayBookings: DayBooking[];
  shiftHistory: ShiftHistoryEntry[]; // local audit trail
  selectedShiftId: string | null; // shift detail modal
  selectedDayId: string | null; // day inspector
  clipboard: DayClipboard | null; // copy/paste day
  selectedDays: SelectedDays; // batch operations (MODULE_03 §5)
  createShiftContext: {
    // pre-fill context for new shift modal
    dateId?: string;
    employeeId?: string;
  } | null;
  absencePopover: {
    // fravær popover state
    employeeId: string;
    dateId: string;
  } | null;
};
```

**Reducer actions:**

| Action                     | Payload                                            | Effect                                         |
| -------------------------- | -------------------------------------------------- | ---------------------------------------------- | -------------------------- | ---------------------------------------- |
| **Shift CRUD**             |                                                    |                                                |
| `ADD_SHIFT`                | `Omit<Shift, 'id'                                  | 'createdAt'                                    | 'updatedAt'>`              | Create with generated ID + history entry |
| `UPDATE_SHIFT`             | `{ id, changes }`                                  | Partial update + history entry                 |
| `DELETE_SHIFT`             | `{ id }`                                           | Remove + history entry                         |
| `MOVE_SHIFT`               | `{ shiftId, toEmployeeId, toDateId }`              | DnD result + history entry                     |
| `ASSIGN_SHIFT`             | `{ shiftId, employeeId }`                          | Set employee + status → assigned + history     |
| **Shift lifecycle**        |                                                    |                                                |
| `PUBLISH_SHIFT`            | `{ shiftId }`                                      | Single shift → published                       |
| `PUBLISH_DAY`              | `{ dateId }`                                       | All created/assigned shifts on day → published |
| `UNPUBLISH_DAY`            | `{ dateId }`                                       | All published → unpublished                    |
| `PUBLISH_SELECTED_DAYS`    | —                                                  | Batch publish all selected days                |
| **Day operations**         |                                                    |                                                |
| `COPY_DAY`                 | `{ dateId }`                                       | Store day shifts + absences in clipboard       |
| `PASTE_DAY`                | `{ targetDateId }`                                 | Clone clipboard to target                      |
| `SELECT_DAY`               | `{ dateId }`                                       | Toggle day in selectedDays set                 |
| `CLEAR_SELECTED_DAYS`      | —                                                  | Clear all selections                           |
| **Absence**                |                                                    |                                                |
| `ADD_ABSENCE`              | `Omit<Absence, 'id'>`                              | Register absence + remove conflicting shifts   |
| `DELETE_ABSENCE`           | `{ id }`                                           | Remove absence                                 |
| **Templates**              |                                                    |                                                |
| `SAVE_DAY_AS_TEMPLATE`     | `{ dateId, name, department, includeAssignments }` | Extract day → template                         |
| `LOAD_TEMPLATE`            | `{ templateId, targetDateId }`                     | Apply template to day                          |
| `ADD_TEMPLATE`             | `ShiftTemplate`                                    | Add standalone template                        |
| `DELETE_TEMPLATE`          | `{ id }`                                           | Remove template                                |
| **Open shifts**            |                                                    |                                                |
| `ADD_OPEN_SHIFT`           | `Omit<OpenShift, 'id'>`                            | Create open shift                              |
| `DELETE_OPEN_SHIFT`        | `{ id }`                                           | Remove open shift                              |
| `ASSIGN_OPEN_SHIFT`        | `{ openShiftId, employeeId, dateId }`              | Convert to real shift, remove from sidebar     |
| **Day content**            |                                                    |                                                |
| `ADD_MESSAGE`              | `Omit<DayMessage, 'id'                             | 'createdAt'>`                                  | Create message             |
| `DELETE_MESSAGE`           | `{ id }`                                           | Remove message                                 |
| `ADD_TASK`                 | `Omit<DayTask, 'id'>`                              | Create task                                    |
| `UPDATE_TASK_STATUS`       | `{ id, status: TaskStatus }`                       | Update task status (not just toggle)           |
| `DELETE_TASK`              | `{ id }`                                           | Remove task                                    |
| `ADD_BOOKING`              | `Omit<DayBooking, 'id'>`                           | Create booking                                 |
| **UI state**               |                                                    |                                                |
| `SET_SELECTED_SHIFT`       | `string                                            | null`                                          | Open/close shift modal     |
| `SET_SELECTED_DAY`         | `string                                            | null`                                          | Open/close day inspector   |
| `SET_CREATE_SHIFT_CONTEXT` | `{ dateId?, employeeId? }                          | null`                                          | Pre-fill for new shift     |
| `SET_ABSENCE_POPOVER`      | `{ employeeId, dateId }                            | null`                                          | Open/close absence popover |
| `SET_CLIPBOARD`            | `DayClipboard                                      | null`                                          | Copy/paste state           |

**Hook:** `useSchedule()` returns `{ state, dispatch, computed }` where `computed` has:

```typescript
type ScheduleComputed = {
  getShiftsForDay: (dateId: string) => Shift[];
  getShiftsForEmployee: (employeeId: string) => Shift[];
  getShiftsForCell: (employeeId: string, dateId: string) => Shift[];
  getAbsencesForCell: (employeeId: string, dateId: string) => Absence[];
  getDayStats: (dateId: string) => {
    staffCount: number;
    shiftCount: number;
    estimatedCost: number; // workHours × 250 NOK placeholder rate
    publishedCount: number;
    draftCount: number;
    absenceCount: number;
  };
  getEmployeeStats: (employeeId: string) => {
    totalHours: number;
    shiftCount: number;
    isOvertime: boolean; // > 37.5h
    overtimeHours: number;
    contractedHours: number; // 37.5 default
  };
  getTemplatesForDepartment: (dept: string) => ShiftTemplate[];
  getMessagesForDay: (dateId: string) => DayMessage[];
  getTasksForDay: (dateId: string) => DayTask[];
  getBookingsForDay: (dateId: string) => DayBooking[];
  getHistoryForShift: (shiftId: string) => ShiftHistoryEntry[];
  getCoverageForDay: (dateId: string) => {
    totalStaff: number;
    byTeam: Record<string, { target: number; current: number }>;
    hasGaps: boolean;
  };
  getStatusSummary: () => {
    coverageRisks: number;
    overtimeRisks: number;
    complianceRisks: number; // employees close to or over limits
    openShiftQueue: number;
    draftCount: number;
    publishedCount: number;
    activeCount: number;
    completedCount: number;
    absenceCount: number;
    publishedState: string; // "Draft endringer" | "Publisert"
  };
};
```

### 0.3 — Wrap page in provider

`page.tsx`: Wrap entire return in `<ScheduleProvider>`. Initialize from existing dummy data, mapped to new types.

### 0.4 — Migrate components to use context

Every component reading `dummyEmployees`, `dummyDays`, `dailyShifts`, `openShiftItems` → switch to `useSchedule()`. Employees and days remain static arrays (they come from the org module, not schedule). Only shifts, absences, and derived data come from context.

---

## Phase 1: Shift CRUD + 6-Tab Modal

### 1.1 — Shift Detail / Create Modal

New file: `_components/shift-modal.tsx`

Uses: `shadcn Dialog` + `shadcn Tabs` (both installed)

**Trigger:** Click on shift card OR click "+" in empty cell OR "Opprett vakt" from context menu.

**Mode:** Create (empty form, pre-filled from context) or Edit (pre-filled from shift data).

**6 tabs per MODULE_03 §6:**

| Tab                  | Content                                                                                                                                                           | State integration                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **1. Detaljer**      | Employee select, role, team, start/end time, zone, day category, status, publish toggle, notification channel buttons (Push/E-post/SMS)                           | `ADD_SHIFT` / `UPDATE_SHIFT`                       |
| **2. Funksjoner**    | Placeholder: "Tilleggsfunksjoner konfigureres per workspace"                                                                                                      | Read-only until database                           |
| **3. Historie**      | Render `getHistoryForShift(shiftId)` — shows created, updated, moved events with timestamps                                                                       | Read from `state.shiftHistory`                     |
| **4. Lønnsgrunnlag** | Placeholder showing: base pay (workHours × 250), evening supplement (if dayCategory evening/night: +40%), weekend supplement (if weekend: +100%). Static formula. | Computed from shift data                           |
| **5. Oppgaver**      | Checklist of tasks for this shift. Add/toggle/delete. Uses `TaskStatus` enum.                                                                                     | Own local state within modal (not day-level tasks) |
| **6. Innstillinger** | Placeholder: break duration input (updates `shift.breaks`), special conditions textarea                                                                           | `UPDATE_SHIFT` for breaks                          |

**Form fields (Detaljer tab):**

- Employee (select from employees, allow empty = "Åpen vakt")
- Role (text, auto-filled from employee position)
- Team (select from teams)
- Date (pre-filled, read-only)
- Start time / End time (time inputs)
- Day category (auto-calculated from time, overridable)
- Zone (optional text)
- Status display (read-only, shows current lifecycle state)
- Publish toggle + notification channel buttons

**Actions:**

- Save → `dispatch(ADD_SHIFT)` or `dispatch(UPDATE_SHIFT)`
- Delete → confirmation dialog → `dispatch(DELETE_SHIFT)`
- Assign → `dispatch(ASSIGN_SHIFT)` when employee selected on unassigned shift
- Publish → `dispatch(PUBLISH_SHIFT)` single shift publish
- Close → `dispatch(SET_SELECTED_SHIFT, null)`

### 1.2 — Wire shift card click

`grid-cards.tsx` → `ShiftCard`: Add `onClick` (stop propagation from drag) → `dispatch(SET_SELECTED_SHIFT, id)`.

### 1.3 — Wire empty cell "+"

`daily-grid.tsx` → `MatrixCell`: Add `onClick` on the "+" button → `dispatch(SET_CREATE_SHIFT_CONTEXT, { employeeId, dateId })` which opens the modal in create mode.

### 1.4 — Wire weekly empty cell "+"

`page.tsx` → `WeeklyEmptyCell`: Same pattern.

### 1.5 — Absence popover on grid cells

New file: `_components/absence-popover.tsx`

Uses: `shadcn Popover` (installed)

**Trigger:** Right-click on an employee cell, or explicit "Registrer fravær" option.

**Content:**

- Absence type select (from `AbsenceType` enum: Sykdom, Foreldreperm, Ferie, Ulønnet, Militær, Opplæring, Velferd)
- Full day toggle
- Start/end time (if not full day)
- Reason (optional text)
- Submit → `dispatch(ADD_ABSENCE)`

Absence auto-removes conflicting shifts on that cell and displays the absence card instead.

---

## Phase 2: Drag & Drop

### 2.1 — Add `onDragEnd` handler

`page.tsx` → `DndContext`: Add `onDragEnd` callback.

**Logic:**

- Extract drag source type from `active.data.current.type`
- Parse drop target from droppable ID (`cell::${employeeId}::${dateId}` or `day-header::${dateId}`)

| Source type      | Drop target   | Action                                                                         |
| ---------------- | ------------- | ------------------------------------------------------------------------------ |
| `shift`          | employee cell | `dispatch(MOVE_SHIFT, { shiftId, toEmployeeId, toDateId })`                    |
| `open-shift`     | employee cell | `dispatch(ASSIGN_OPEN_SHIFT, { openShiftId, employeeId, dateId })`             |
| `shift-template` | employee cell | `dispatch(ADD_SHIFT, { from template + cell context })`                        |
| `shift-template` | day header    | `dispatch(LOAD_TEMPLATE, { templateId, targetDateId })` — apply whole template |
| any              | outside grid  | no-op                                                                          |

### 2.2 — Encode cell identity in droppable ID

`daily-grid.tsx` → `MatrixCell`: Change to `useDroppable({ id: \`cell::${employeeId}::${dateId}\` })`.

`daily-grid.tsx` → `DayHeaders`: Add droppable on day headers with `id: \`day-header::${dateId}\``.

### 2.3 — Encode drag source in draggable data

`grid-cards.tsx` → `ShiftCard`: Add `shiftId` to `data` object.
`grid-cards.tsx` → `TemplateCard`: Add `templateId` to `data` object.

### 2.4 — Visual feedback improvements

- Drop target highlight (already exists via `isOver`)
- Invalid drop indicator (red border when dropping on absence cell)
- "Shift moved" toast on successful DnD

---

## Phase 3: Day Context Menu (⋮)

### 3.1 — Day context menu component

New file: `_components/day-context-menu.tsx`

Uses: `shadcn DropdownMenu` (installed)

**Replaces:** The bare `<button><MoreVertical /></button>` in `DayHeaders`.

**Menu items (matching MODULE_03 §5):**

| Item            | Icon              | Action                                           | Condition              |
| --------------- | ----------------- | ------------------------------------------------ | ---------------------- |
| Velg dag        | Square (checkbox) | `dispatch(SELECT_DAY, { dateId })`               | Toggle checkmark       |
| Opprett vakt    | Plus              | `dispatch(SET_CREATE_SHIFT_CONTEXT, { dateId })` | Always                 |
| — separator —   |                   |                                                  |                        |
| Publiser dag    | Send              | `dispatch(PUBLISH_DAY, { dateId })`              | Has unpublished shifts |
| Avpubliser dag  | Undo2             | `dispatch(UNPUBLISH_DAY, { dateId })`            | Has published shifts   |
| — separator —   |                   |                                                  |                        |
| Kopier dag      | Copy              | `dispatch(COPY_DAY, { dateId })`                 | Has shifts             |
| Lim inn dag     | ClipboardPaste    | `dispatch(PASTE_DAY, { dateId })`                | Clipboard not null     |
| — separator —   |                   |                                                  |                        |
| Lagre som mal   | BookmarkPlus      | Open save-template dialog                        | Has shifts             |
| Last inn mal    | BookOpen          | Open load-template sheet                         | Templates exist        |
| — separator —   |                   |                                                  |                        |
| Opprett daginfo | FileText          | Open day-message dialog                          | Always                 |
| Send melding    | Megaphone         | Open broadcast dialog                            | Always                 |
| — separator —   |                   |                                                  |                        |
| Se dagsliste    | List              | `dispatch(SET_SELECTED_DAY, dateId)`             | Always                 |

### 3.2 — Batch action bar

When `selectedDays.size > 0`, show a floating bar at the bottom:

"N dager valgt: [Publiser alle] [Avpubliser alle] [Fjern valg]"

Uses `PUBLISH_SELECTED_DAYS` and `CLEAR_SELECTED_DAYS` actions.

### 3.3 — Save-as-template dialog

New file: `_components/save-template-dialog.tsx`

Uses: `shadcn Dialog`

Fields:

- Name (required text input)
- Department (select)
- **Include staff assignments** toggle (MODULE_03 §13.1) — default off
- Preview: shows N shifts that will be saved

→ `dispatch(SAVE_DAY_AS_TEMPLATE, { dateId, name, department, includeAssignments })`

### 3.4 — Load-template sheet

New file: `_components/load-template-sheet.tsx`

Uses: `shadcn Sheet` (slide-in from right)

- List all templates grouped by department
- Click → preview shifts in the template
- "Bruk mal" button → `dispatch(LOAD_TEMPLATE, { templateId, targetDateId })`
- Conflict handling: if day already has shifts, show warning "Erstatt eksisterende vakter?"

### 3.5 — Day message dialog

New file: `_components/day-message-dialog.tsx`

Uses: `shadcn Dialog`

Fields: Title, content (textarea), audience (select: Alle/Ledere/team names), visibility (select: Hele dagen/Til 16:00/Permanent), is alert toggle.

→ `dispatch(ADD_MESSAGE)`

### 3.6 — Broadcast dialog

New file: `_components/broadcast-dialog.tsx`

Simple confirmation: "Send Push / SMS til N ansatte på vakt?"

→ Toast: "Push-varsler sendt til N ansatte" / "SMS sendt til N ansatte"

---

## Phase 4: Template System

### 4.1 — Template management in sidebar

Sidebar → "Vaktmaler" tab: Replace hardcoded templates with `state.templates` via `useSchedule()`.

Each template card:

- Drag to grid (existing DnD works)
- Click → open template detail sheet (preview shifts, delete option)
- Shows: name, department, shift count, time range, routine count

### 4.2 — "Opprett ny mal" button

Wire existing dashed button → open dialog:

- Name, department, manually add shifts (time + role)
- Or "Opprett fra eksisterende dag" → select a day → extract
- Save → `dispatch(ADD_TEMPLATE)`

### 4.3 — "Rull ut mal" (Apply template to day)

Two trigger paths:

1. Drag template card to **day header** → `LOAD_TEMPLATE` (full day apply)
2. Day context menu → "Last inn mal" → select template → `LOAD_TEMPLATE`

### 4.4 — Seed initial templates

Move hardcoded "Åpningsvakt", "Stengevakt", "Kjøkkensjef" into `initialState.templates` with proper `ShiftTemplate` shape.

---

## Phase 5: Sidebar — Open Shifts

### 5.1 — "Opprett ny åpen vakt" button

Wire the "+" button → dialog:

- Title, role, time range (start/end), department, day category
- Save → `dispatch(ADD_OPEN_SHIFT)`

### 5.2 — Open shift assignment

DnD: open shift dropped on employee cell → `dispatch(ASSIGN_OPEN_SHIFT)`.

- Removes from sidebar
- Creates real shift with status `assigned` in the cell
- Toast: "Åpen vakt tildelt {employee name}"

### 5.3 — Open shift list from state

Replace static `openShiftItems` → render from `state.openShifts`.

---

## Phase 6: DayInspector — All Tabs

### 6.1 — Oversikt tab

- **Vaktansvarlig card:** Click → `dispatch(SET_SELECTED_SHIFT, shiftId)` for that manager's shift
- **Key metrics:** Compute from `getDayStats()`:
  - Est. Kostnad: sum of workHours × 250 NOK
  - Totale Timer: sum of workHours formatted as "Xt Ym"
- **Coverage display:** From `getCoverageForDay()` — show per-team status

### 6.2 — Dagsinfo tab (Meldinger)

- "Nytt oppslag" form: Wire textarea + audience select + visibility select + "Publiser" button → `dispatch(ADD_MESSAGE)`
- "Aktive Oppslag": Render from `getMessagesForDay(dateId)`
- Each message card: Add "Slett" button → `dispatch(DELETE_MESSAGE)`

### 6.3 — Selskap/Booking tab

- "Legg til manuelt" → dialog → `dispatch(ADD_BOOKING)`
- "Se detaljer" → expand card inline (accordion pattern)
- Render from `getBookingsForDay(dateId)`

### 6.4 — Oppgaver tab

- Task input + "Legg til" → `dispatch(ADD_TASK, { dateId, label, status: "pending", category: "all" })`
- Status toggle → `dispatch(UPDATE_TASK_STATUS, { id, status })` — cycles: pending → in_progress → completed
- Filter chips: Wire to local filter state (alle / faste rutiner / delegert)
- Render from `getTasksForDay(dateId)` filtered by category

### 6.5 — Footer broadcast buttons

- "Push Vakt" → `dispatch` nothing (no backend) → toast: "Push-varsler sendt til {getDayStats().staffCount} ansatte"
- "SMS" → toast: "SMS sendt til {getDayStats().staffCount} ansatte"

---

## Phase 7: Monthly Heatmap

### 7.1 — Heatmap cell click

Each colored cell → `dispatch(SET_SELECTED_DAY, dayLabel)` → opens DayInspector.

### 7.2 — Team coverage from state

Replace hardcoded coverage numbers. Use `getCoverageForDay()`:

- Green: current >= target
- Orange: current = target - 1
- Red: current < target - 1

### 7.3 — Stats header from state

Calculate from `getStatusSummary()`:

- Est. Lønnskostnad: sum all shifts in month × 250 NOK
- Lønn % av Salg: placeholder ratio (hardcoded sales target)
- Underbemannede Vakter: count days with coverage gaps

---

## Phase 8: Status Strip (Live)

### 8.1 — Derive all counters from state

Replace `React.useMemo` in `page.tsx` that reads static arrays. Use `getStatusSummary()`:

| Counter                          | Computation                                                       |
| -------------------------------- | ----------------------------------------------------------------- |
| Coverage risks                   | Days where any team has current < target                          |
| Overtime risks                   | Employees where totalHours > 37.5                                 |
| Compliance risks                 | Employees where totalHours > 40 (AML limit)                       |
| Open shifts                      | `state.openShifts.length`                                         |
| Absence count                    | `state.absences.length` (current period)                          |
| Draft/Published/Active/Completed | Count shifts by status                                            |
| Published state                  | Any created/assigned shifts → "Draft endringer", else "Publisert" |

---

## Phase 9: Toast Feedback

### 9.1 — Sonner toasts for all mutations

Integrate into reducer or via `useEffect` watching state changes. Every dispatch that mutates data → show toast:

| Category    | Messages                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------- |
| Shift       | "Vakt opprettet" / "Vakt oppdatert" / "Vakt slettet" / "Vakt flyttet til {employee}"        |
| Lifecycle   | "Vakt publisert" / "Dag publisert ({N} vakter)" / "Dag avpublisert" / "{N} dager publisert" |
| Day ops     | "Dag kopiert til utklippstavle" / "Dag limt inn ({N} vakter)"                               |
| Templates   | "Mal lagret: {name}" / "Mal lastet inn ({N} vakter)" / "Mal slettet"                        |
| Open shifts | "Åpen vakt opprettet" / "Åpen vakt tildelt {name}"                                          |
| Absence     | "Fravær registrert: {type}" / "Fravær slettet"                                              |
| Messages    | "Daginfo publisert" / "Daginfo slettet"                                                     |
| Tasks       | "Oppgave lagt til" / "Oppgave fullført"                                                     |
| Broadcast   | "Push-varsler sendt til {N} ansatte" / "SMS sendt til {N} ansatte"                          |

---

## Phase 10: ADR + Documentation

### 10.1 — Write ADR-0031

Decision: Schedule page uses local React state (useReducer + Context) before database implementation.

**Context:** MODULE_03 is the most complex module. UI prototype exists with 832 lines and 9 component files, all using hardcoded dummy data. Building database-first risks creating a schema that doesn't match actual UI needs.

**Decision:** Wire all UI interactions with local state first. Types are aligned with `@smartout/types` enums and MODULE_03 data model so the migration to database is a type-compatible drop-in.

**Consequences:** No persistence between page reloads. No multi-user collaboration. No real notifications. All accepted for this phase.

### 10.2 — Register in decision log

Add ADR-0031 to `docs/decisions/0000-decision-log.md`.

---

## File Summary

| File                                   | Action                                                    | Est. lines   |
| -------------------------------------- | --------------------------------------------------------- | ------------ |
| `_components/schedule-types.ts`        | **NEW** — All types, imports from @smartout/types         | ~150         |
| `_components/schedule-context.tsx`     | **NEW** — Provider + reducer + computed hooks             | ~450         |
| `_components/shift-modal.tsx`          | **NEW** — 6-tab shift detail/create dialog                | ~400         |
| `_components/absence-popover.tsx`      | **NEW** — Register absence from grid cell                 | ~120         |
| `_components/day-context-menu.tsx`     | **NEW** — DropdownMenu for day ⋮ button                   | ~150         |
| `_components/batch-action-bar.tsx`     | **NEW** — Floating bar for multi-day operations           | ~60          |
| `_components/save-template-dialog.tsx` | **NEW** — Save day as template (with assignment toggle)   | ~100         |
| `_components/load-template-sheet.tsx`  | **NEW** — Browse + apply templates                        | ~140         |
| `_components/day-message-dialog.tsx`   | **NEW** — Create day message/broadcast                    | ~100         |
| `_components/broadcast-dialog.tsx`     | **NEW** — Confirm push/SMS broadcast                      | ~60          |
| `_components/open-shift-dialog.tsx`    | **NEW** — Create open shift                               | ~100         |
| `_components/booking-dialog.tsx`       | **NEW** — Add booking manually                            | ~120         |
| `_components/schedule-data.ts`         | **EDIT** — Map dummy data to new types                    | ~60 changed  |
| `page.tsx`                             | **EDIT** — Provider wrapper, onDragEnd, modal integration | ~120 changed |
| `_components/daily-grid.tsx`           | **EDIT** — Droppable IDs, cell clicks, absence popover    | ~60 changed  |
| `_components/grid-cards.tsx`           | **EDIT** — onClick, shiftId in drag data                  | ~20 changed  |
| `_components/daily-briefing.tsx`       | **EDIT** — Wire all handlers to dispatch                  | ~100 changed |
| `_components/status-strip.tsx`         | **EDIT** — Read from context computed                     | ~30 changed  |
| `_components/planner-command-bar.tsx`  | **EDIT** — Minor context integration                      | ~15 changed  |

**Total: 12 new files, 7 edited files, ~2,400 lines of new/changed code.**

---

## Build Order

```
Phase 0  (foundation)     → types + context + provider + migrate reads
Phase 1  (shift CRUD)     → 6-tab modal + card clicks + cell clicks + absence popover
Phase 2  (DnD)            → onDragEnd + droppable IDs + visual feedback
Phase 3  (day menu)       → context menu + batch bar + all sub-dialogs
Phase 4  (templates)      → sidebar + save/load + drag-apply
Phase 5  (open shifts)    → sidebar CRUD + DnD assignment
Phase 6  (day inspector)  → all 4 tabs wired to state
Phase 7  (monthly)        → heatmap clicks + computed coverage + live stats
Phase 8  (status strip)   → all counters from getStatusSummary()
Phase 9  (toasts)         → sonner feedback for every mutation
Phase 10 (docs)           → ADR-0031 + registration
```

**Dependencies:** Phase 0 must come first. Phase 1 depends on Phase 0. Phase 2 depends on Phase 0. Phases 3-9 depend on Phase 0 but are independent of each other. Phase 10 can be done anytime.

**Parallelization:** After Phase 0, work can split into two tracks:

- Track A: Phase 1 → Phase 2 (core grid interaction)
- Track B: Phase 3 → Phase 4 → Phase 5 (day operations + sidebar)
- Then: Phase 6 → 7 → 8 → 9 (polish)

---

## What This Plan Does NOT Include

- Database tables / migrations (separate plan: `schedule-database-schema`)
- Server actions / Supabase queries
- Real-time collaboration (Supabase Realtime)
- Mobile responsive fixes
- Keyboard navigation / accessibility
- Publishing → real notification delivery (Twilio/SendGrid)
- AI-assisted scheduling (demand forecast, auto-fill)
- Payroll calculation integration (real rates from employment_contract)
- Multi-location support
- Employee self-service (swap requests, availability, open shift bidding)
- Compliance engine (AML hviletid calculations, real overtime rules)
- Print optimization beyond existing list view

These are all future work. The local state types are designed to make the database migration straightforward — same shape, add `workspace_id` + RLS.
