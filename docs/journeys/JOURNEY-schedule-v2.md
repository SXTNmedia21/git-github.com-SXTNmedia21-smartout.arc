---
title: "User Journeys — Schedule Module v2"
status: done
updated: 2026-03-02
created: 2026-03-02
module: schedule
tags: [schedule, vaktplan, journeys, v2]
---

# User Journeys — Schedule Module v2

## Journey: Admin views weekly schedule

**Precondition:** Admin is logged in, has workspace with employees and shifts.

1. Admin navigates to `/dashboard/schedule`
2. System shows week grid with sticky employee sidebar on left
3. Employee names stay visible when scrolling horizontally
4. Admin clicks [1 uke | 2 uker] toggle → grid expands to show 14 days
5. Admin clicks `< >` arrows → jumps one week forward/back
6. Admin scrolls horizontally → continuous day navigation
7. System shows shift blocks in grid cells with status coloring

**Postcondition:** Admin has full overview of weekly schedule.

**Error paths:**

- No employees → shows empty state with "Legg til ansatte" prompt
- No shifts → shows empty grid cells

---

## Journey: Admin opens Day Control Center

**Precondition:** Admin is on week/month view with shifts.

1. Admin clicks on a day header (e.g. "Fre 6/3")
2. System opens bottom sheet sliding up from bottom
3. Bottom sheet shows tabs: Oversikt | Dagsinfo | Reservasjoner | Oppgaver
4. Admin clicks [⛶] → control center expands to fullscreen
5. Fullscreen shows:
   - KPI cards (est. kostnad, budsjett, timer, ansatte) with [✏ Rediger] for budget
   - Opening hours + Duty manager fields
   - Last year comparison data
   - Gantt-style timeline (06:00-23:00) with shift blocks per employee
   - Employee list with status (arrived/not), contact info, [SMS] action
6. Admin clicks [🔔 Push m/melding] → dialog opens with message field + "Pakk med daginfo" checkbox
7. Admin writes message, checks "Pakk med daginfo", clicks Send
8. System sends push notification to all employees on shift

**Postcondition:** Day overview reviewed, notifications sent.

**Error paths:**

- No shifts for day → timeline empty, employee list shows "Ingen på vakt"
- Push fails → toast error "Kunne ikke sende varsel"

---

## Journey: Admin creates employee turnus (roster)

**Precondition:** Admin is on schedule view, employees exist in workspace.

1. Admin clicks on employee name in left sidebar (e.g. "Anna Olsen")
2. System opens drawer from right side (400-500px)
3. Drawer shows:
   - Employee info (name, role, department)
   - Turnus editor: 7-day grid with time inputs per weekday
   - Period selector (start date → end date)
   - Availability calendar
   - Statistics (hours/week, shifts/month, overtime)
4. Admin fills in turnus: Mån-Fre 08:00-16:00, Lør-Søn off
5. Admin sets period: 01.03 → 31.05
6. Admin clicks [Auto-fyll vakter for periode]
7. System generates draft shifts for every matching weekday in the period
8. System skips days where employee has registered absence
9. Admin sees new draft shifts appear in the grid (status: "created")
10. Admin closes drawer

**Postcondition:** Employee has turnus configured, draft shifts generated for 3-month period.

**Error paths:**

- No period selected → "Velg en periode først" validation
- Employee has existing shifts in period → "X eksisterende vakter funnet. Overskrive?" confirmation
- Auto-fill fails → toast error, no shifts created

---

## Journey: Admin uses month view

**Precondition:** Admin is on schedule page.

1. Admin clicks [Måned] tab
2. System shows month grid
3. Default grouping: by department (Sal & Service, Bar, Drift)
4. Admin clicks department/employee toggle → switches to employee grouping
5. Admin clicks on a cell → shift detail dialog opens (if shift exists) or create-shift dialog (if empty)
6. Admin can see coverage indicators (e.g. "2/3 dekket ⚠")
7. Cost header shows: Est. Lønnskostnad, Lønn % av salg, Underbemannede

**Postcondition:** Admin has monthly overview with ability to create/edit shifts.

**Error paths:**

- No data → empty grid with department names

---

## Journey: Admin uses shift list

**Precondition:** Admin is on schedule page with shifts.

1. Admin clicks [Vaktliste] tab
2. System shows shifts grouped by day, each as a clickable card
3. Cards show: Employee name, time, role, status badge (Draft/Published/Active)
4. Admin clicks a shift card → shift detail modal opens
5. Admin can edit shift, change status, set availability/time-off
6. Admin clicks [🖨 Skriv ut] → browser print dialog for clean list

**Postcondition:** Admin has reviewed/edited shifts in list format.

**Error paths:**

- No shifts → "Ingen vakter å vise"

---

## Journey: Admin uses filter popovers

**Precondition:** Admin is on any schedule view.

1. Admin clicks [👤] (Ansatt filter) in top bar
2. Popover opens with employee checklist
3. Admin selects specific employees → grid filters to show only those
4. Admin clicks [💼] (Jobb filter) → selects "Kokk"
5. Grid now shows only employees with "Kokk" role
6. Filters apply across all views (uke, måned, vaktliste)
7. Active filters shown as badges in top bar

**Postcondition:** Schedule filtered to specific employees/roles/teams/locations.

**Error paths:**

- No matches → "Ingen ansatte matcher filteret"
