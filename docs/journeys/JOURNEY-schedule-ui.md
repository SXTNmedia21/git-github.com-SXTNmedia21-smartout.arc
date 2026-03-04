---
title: "User Journeys — Schedule UI (DB Persistence)"
status: done
updated: 2026-03-01
created: 2026-03-01
module: schedule
tags: [schedule, journeys, persistence, realtime]
---

# User Journeys — Schedule UI (DB Persistence)

---

## Journey: Admin/Manager — Create a shift

**Precondition:** Logged in, workspace selected, schedule page open, viewing current week.

1. User clicks a cell in the grid (employee row + day column) → System opens Create Shift dialog with employee and date pre-filled → User sees the shift form
2. User fills in role, start time, end time, break duration, zone (optional), notes (optional) → System auto-calculates work hours
3. User clicks "Opprett" → System optimistically adds shift to grid (instant UI update) → System sends INSERT to `schedule_shift` via supabase-js → DB trigger logs entry in `schedule_audit_log`
4. User sees the shift card appear immediately in the grid cell

**Postcondition:** Shift exists in `schedule_shift` table with status `created`. Audit log entry recorded.

**Error paths:**

- Supabase INSERT fails (RLS, network) → Optimistic shift removed from grid → Toast: "Kunne ikke opprette vakt"
- User is not admin/manager → RLS blocks INSERT → Same error toast

---

## Journey: Admin/Manager — Edit a shift

**Precondition:** Shift exists in the grid.

1. User clicks a shift card → System opens ShiftModal with all shift data populated → User sees 6-tab editor (Detaljer, Tid, Team, Notater, Historikk, Handlinger)
2. User changes any field (role, time, employee, zone, etc.) → User clicks "Lagre"
3. System optimistically updates shift in grid → System sends UPDATE to `schedule_shift` → DB trigger logs old/new values in `schedule_audit_log`
4. User sees updated shift card immediately

**Postcondition:** Shift updated in DB. Audit log captures changed fields.

**Error paths:**

- UPDATE fails → Optimistic change rolled back → Toast: "Kunne ikke oppdatere vakt"

---

## Journey: Admin/Manager — Delete a shift

**Precondition:** Shift exists, ShiftModal open on "Handlinger" tab.

1. User clicks "Slett vakt" → System shows confirmation
2. User confirms → System optimistically removes shift from grid → System sends DELETE to `schedule_shift` → DB trigger logs deletion in `schedule_audit_log`

**Postcondition:** Shift removed from DB. Audit log contains full old_data for potential rollback.

**Error paths:**

- DELETE fails → Shift reappears in grid → Toast: "Kunne ikke slette vakt"

---

## Journey: Admin/Manager — Move a shift (drag & drop)

**Precondition:** Shift exists in grid. DnD is enabled.

1. User drags a shift card → System shows drag overlay with shift info
2. User drops on a different cell (employee + day) → System optimistically moves shift → System sends UPDATE (employee_id, shift_date) to `schedule_shift`
3. User sees shift appear in new cell immediately

**Postcondition:** Shift moved to new employee/date. Audit log records the move.

**Error paths:**

- Drop on invalid target (outside grid) → Nothing happens
- UPDATE fails → Shift snaps back to original position → Toast: "Kunne ikke flytte vakt"

---

## Journey: Admin/Manager — Publish shifts for a day

**Precondition:** Day has shifts with status `created` or `assigned`.

1. User right-clicks a day column header → Context menu appears → User clicks "Publiser dag"
2. System optimistically sets all draft shifts on that day to `published` + `is_published: true` → System sends batch UPDATE to `schedule_shift`
3. User sees shift cards change visual state (published indicator)

**Postcondition:** All draft shifts for that day are now `published`. Audit log records each status change.

**Error paths:**

- Batch UPDATE fails → All shifts revert to draft state → Toast: "Kunne ikke publisere vakter"

---

## Journey: Admin/Manager — Unpublish a day

**Precondition:** Day has published shifts.

1. User right-clicks day header → "Avpubliser dag" → System optimistically reverts to `unpublished` → Batch UPDATE sent

**Postcondition:** Published shifts become `unpublished`. Audit log records changes.

**Error paths:**

- Same as publish, reverse direction

---

## Journey: Admin/Manager — Publish all drafts

**Precondition:** Week has any shifts with status `created` or `assigned`.

1. User clicks "Publiser alle" in the command bar → System collects all draft shift IDs → Optimistic batch update → Batch UPDATE sent

**Postcondition:** All draft shifts across the week are now `published`.

---

## Journey: Admin/Manager — Copy and paste a day

**Precondition:** At least one day has shifts.

1. User right-clicks day header → "Kopier dag" → System stores all shifts from that day in clipboard (stripped of IDs and dates) → Toast confirms copy
2. User right-clicks a different day → "Lim inn dag" (enabled because clipboard has data) → System optimistically creates new shifts on target day → Batch INSERT to `schedule_shift`
3. User sees copied shifts appear on the target day

**Postcondition:** New shifts created on target day matching the copied day's shifts. Original shifts unchanged.

**Error paths:**

- No clipboard data → "Lim inn dag" is disabled
- Batch INSERT fails → Optimistic shifts removed → Toast: "Kunne ikke lime inn vakter"

---

## Journey: Admin/Manager — Batch select and publish days

**Precondition:** Multiple days have draft shifts.

1. User clicks day headers to toggle selection (multi-select) → Selected days get visual highlight
2. User clicks "Publiser valgte" in BatchActionBar → System publishes all draft shifts on selected days → Clears selection

**Postcondition:** All draft shifts on selected days are published.

---

## Journey: Admin/Manager — Register an absence

**Precondition:** Schedule grid visible.

1. User clicks an empty cell (or a cell with existing shifts) for an employee → Absence popover appears
2. User selects absence type (Sykdom, Ferie, etc.), optionally adds reason → Clicks "Registrer"
3. System creates absence in `schedule_absence` → Optimistically shows absence badge on cell

**Postcondition:** Absence recorded in DB. Audit log entry created.

**Error paths:**

- INSERT fails → Toast: "Kunne ikke opprette fravær"

---

## Journey: Admin/Manager — Create an open shift

**Precondition:** Schedule page open.

1. User opens sidebar → Clicks "Ny åpen vakt" → OpenShiftDialog appears
2. User fills in title, time, department, role → Clicks "Opprett"
3. System creates open shift in `schedule_open_shift` → Appears in sidebar list

**Postcondition:** Open shift exists in DB, visible in sidebar.

---

## Journey: Admin/Manager — Assign an open shift (drag & drop)

**Precondition:** Open shift exists in sidebar.

1. User drags open shift from sidebar → Drops on employee cell
2. System deletes the open shift AND creates a new real shift assigned to that employee → Both queries invalidated

**Postcondition:** Open shift removed. New assigned shift created for employee on that date.

---

## Journey: Admin/Manager — Save a day as template

**Precondition:** Day has at least one shift.

1. User right-clicks day → "Lagre som mal" → SaveTemplateDialog appears
2. User enters template name, department, chooses whether to include staff assignments → Clicks "Lagre"
3. System creates `schedule_template` + `schedule_template_shift` rows

**Postcondition:** Template saved, appears in template list in sidebar.

---

## Journey: Admin/Manager — Load a template onto a day

**Precondition:** At least one template exists.

1. User opens sidebar → Templates tab → Clicks a template → LoadTemplateSheet appears
2. User selects target day → Clicks "Last inn"
3. System reads template shifts and creates real shifts on the target day via batch INSERT

**Postcondition:** New shifts created on target day matching template. Template unchanged.

---

## Journey: Admin/Manager — View audit history and rollback

**Precondition:** A shift has been modified at least once.

1. User clicks shift card → ShiftModal opens → "Historikk" tab
2. System fetches audit log entries for this shift from `schedule_audit_log` → User sees chronological list of changes (who, when, what changed)
3. User clicks "Angre" on a specific change → System calls `rollback_audit_entry()` RPC → Change is reversed → All schedule queries invalidated
4. User sees shift reverted to previous state

**Postcondition:** Shift restored to pre-change state. New audit log entry records the rollback.

**Error paths:**

- Rollback fails (row already deleted, conflict) → Toast: "Kunne ikke rulle tilbake endringen"

---

## Journey: Admin/Manager — Add day content (message, task, booking)

**Precondition:** Day inspector panel open for a specific day.

1. User clicks "Ny beskjed" / "Ny oppgave" / "Ny booking" → Respective dialog opens
2. User fills in details → Submits
3. System creates row in `schedule_day_message` / `schedule_day_task` / `schedule_day_booking` → Optimistically shown in day inspector

**Postcondition:** Content saved in DB, visible in day view.

---

## Journey: Manager (concurrent) — See another manager's changes in real-time

**Precondition:** Two managers have the schedule page open for the same workspace and week.

1. Manager A creates a shift → Supabase Realtime fires `postgres_changes` event
2. Manager B's browser receives the event → TanStack Query invalidates the shifts query → Automatic refetch → New shift appears in Manager B's grid

**Postcondition:** Both managers see the same schedule state within seconds.

**Error paths:**

- Realtime connection drops → Data stays stale until next manual page load or reconnect
- Both managers edit the same shift simultaneously → Last write wins → The other manager sees the latest version after realtime sync

---

## Journey: Employee — View published schedule (read-only)

**Precondition:** Logged in as employee role. Schedule page open.

1. User sees the weekly grid with their shifts → RLS policy allows SELECT for any workspace member
2. User cannot create, edit, or delete shifts → RLS INSERT/UPDATE/DELETE policies require admin role → Mutation hooks would fail with permission error

**Postcondition:** Employee sees their published shifts. No modifications possible.

**Error paths:**

- Employee tries to modify → Toast error from mutation failure
