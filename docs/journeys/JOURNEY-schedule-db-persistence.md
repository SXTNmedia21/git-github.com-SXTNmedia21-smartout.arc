---
title: "User Journeys — Schedule DB Persistence"
status: done
updated: 2026-03-03
created: 2026-03-03
module: schedule
tags: [journey, schedule, database, realtime, tanstack-query, optimization]
---

# User Journeys — Schedule DB Persistence

## Overview

This document captures real user flows for the Schedule DB Persistence feature, which replaces local React state management with TanStack Query (v5) hooks backed by Supabase for real-time schedule management.

**Key technical implementation:**

- 8 TanStack Query hooks for schedule data (shifts, employees, absences, messages, tasks, bookings, open shifts, audit log)
- Supabase Realtime subscriptions for live sync across tabs, browsers, and users
- Optimistic updates for instant UI feedback with automatic rollback on error
- `schedule_audit_log` table with DB triggers logging all changes for full change history
- `rollback_audit_entry` RPC function to undo specific changes
- Query key factory pattern (`scheduleKeys`) for granular cache invalidation
- UI-only context (`ScheduleUIProvider`) for ephemeral local state (selections, filters, clipboard)
- Workspace-scoped data access with role-based permissions (Admin → full CRUD, Manager → department CRUD, Employee → read-only)

---

## Journey 1: Admin Edits a Shift (Optimistic Update Flow)

**Role:** Admin (full workspace CRUD access)
**Context:** Admin is scheduling shifts for an upcoming week, wants instant feedback

### Precondition

- Admin is logged in to Smartout workspace
- Schedule page is open showing week view
- TanStack Query hooks initialized: `useShifts()`, `useUpdateShift()`, `useScheduleRealtime()` subscribed
- Shift exists in the UI (loaded from `schedule_shift` table via Supabase)
- Admin has RLS permission to UPDATE shifts in workspace

### Steps

1. **User clicks shift card** → Admin clicks "Edit" or directly modifies shift time
   **System:** UI opens shift editing modal with current shift data (start time, end time, employee assignment, status)
   **User sees:** Modal populated with "08:00", "16:00", employee "Lars", status "unpublished"

2. **User changes shift time to 09:00–17:00** → Admin types new start time in form field
   **System:** Form updates local input state (not yet persisted)
   **User sees:** Input field shows "09:00" being typed

3. **User clicks "Oppdater vakt" (Update Shift) button** → Admin submits form
   **System:**
   - `useUpdateShift.mutate()` is called with `{ id: "shift-123", patch: { startTime: "09:00", endTime: "17:00" } }`
   - **Immediately (before server round-trip):** `onMutate` hook:
     - Cancels in-flight queries for shifts key
     - Reads current cached shifts array from React Query
     - Updates local cache: finds shift by ID, updates time fields, sets `updatedAt` to now
     - Returns `{ previous: [old cached shifts] }` for rollback if error occurs
   - Modal closes optimistically
   - Shift card in grid shows NEW time "09:00 - 17:00" immediately (zero latency UI)
     **User sees:** Shift card updates to show "09:00 - 17:00" while editing dialog closes

4. **Network request to Supabase completes** → UPDATE query succeeds on DB server
   **System:**
   - Supabase returns updated shift with `schedule_shift_id`, new times, `updated_at` timestamp
   - `onSettled` fires: invalidates shifts query key
   - TanStack Query re-fetches shifts from DB (reconciliation)
   - DB trigger writes entry to `schedule_audit_log`: actor (admin user), change (start_time: "08:00" → "09:00"), timestamp
   - Supabase Realtime publishes "postgres_changes" event on `schedule_shift` table
     **User sees:** Shift card briefly flickers as cache reconciles (typically <100ms)

5. **Other browser tabs or concurrent users receive Realtime event** → Any other admin viewing this schedule
   **System:**
   - Realtime subscription in `useScheduleRealtime()` fires `postgres_changes` callback
   - Callback: `queryClient.invalidateQueries({ queryKey: scheduleKeys.shifts(...) })`
   - TanStack Query refetches shifts for that week
   - All shift data re-syncs without user intervention
     **User sees:** Other tabs auto-update with new shift time (live collaboration)

### Postcondition

- Shift in database shows start_time = "09:00", end_time = "17:00"
- `updated_at` = current timestamp
- `schedule_audit_log` contains entry: `{ table_name: "schedule_shift", row_id: "shift-123", action: "UPDATE", old_values: "{\"start_time\":\"08:00\",\"end_time\":\"16:00\"}", new_values: "{\"start_time\":\"09:00\",\"end_time\":\"17:00\"}", actor_id: "<admin-user>", created_at: "2026-03-03T10:45:00Z" }`
- All connected users see updated shift (within Realtime latency ~50–500ms)
- Shift is marked dirty/unsaved if user has "unpublished" → "published" workflow

### Error Paths

**Error Path 1: Network timeout during UPDATE**

- Admin clicks "Oppdater vakt", shift card updates optimistically
- After 3 seconds, no response from Supabase
- `onError` callback fires:
  - Toast: "Kunne ikke oppdatere vakt"
  - `queryClient.setQueryData()` reverts cache to `context.previous` (old shift time)
  - Shift card reverts to "08:00 - 16:00" visibly
- User sees: toast notification + shift card reverts to original state
- **User action:** Manually retry edit or dismiss modal

**Error Path 2: Permission denied (RLS policy blocks UPDATE)**

- Admin (somehow with revoked permissions?) clicks "Oppdater vakt"
- Shift updates optimistically in UI
- Supabase returns RLS error: "new row violates row-level security policy"
- `onError` fires, cache reverts
- User sees: toast "Kunne ikke oppdatere vakt" + shift card reverts
- **System behavior:** RLS is enforced at DB layer; requires admin to re-login or permissions restored

**Error Path 3: Concurrent edit — another user updates same shift**

- Admin A changes shift time to 09:00
- At same moment, Admin B changes shift time to 10:00
- Both send UPDATE mutations simultaneously
- Both see optimistic updates
- Whichever UPDATE completes first wins at DB layer
- Second UPDATE query returns success (no conflict) but overwrites first change
- Realtime event fires once per change
- Both admins' caches invalidate and refetch
- Final state: whichever COMMIT was processed last wins (last-write-wins)
- **User experience:** Both see final state (10:00) after refetch; no error shown; potential data loss if unaware
- **Note:** No optimistic locking/versioning in current impl; concurrent edits are "last write wins"

---

## Journey 2: Manager Views Real-Time Changes from Another User

**Role:** Manager (can CRUD shifts within own department only)
**Context:** Manager is viewing schedule for "Kitchen" department while another manager updates a shift in the same week

### Precondition

- Manager A logged in to Smartout, viewing Schedule page
- Week view showing Kitchen department shifts
- `useShifts(weekStart, weekEnd)` query has cached shifts for this week
- `useScheduleRealtime(weekStart)` subscription is active, listening for DB changes
- Manager B (peer manager in same workspace) also has schedule page open

### Steps

1. **Manager B updates a shift** in the same week (e.g., changes status from "unpublished" to "published")
   **System:**
   - Manager B's `useUpdateShift.mutate()` sends UPDATE to Supabase
   - DB trigger writes to `schedule_audit_log`
   - Supabase Realtime publishes event: `{ schema: "public", table: "schedule_shift", event: "UPDATE", new: { ... }, old: { ... } }`
     **User sees (Manager B):** Shift card updates immediately (optimistic), then reconciles

2. **Realtime subscription fires on Manager A's client** → Supabase Realtime channel receives "postgres_changes" event
   **System:**
   - `useScheduleRealtime()` hook's `postgres_changes` listener for `schedule_shift` table executes
   - Callback: `queryClient.invalidateQueries({ queryKey: scheduleKeys.shifts(workspace_id, weekStart) })`
   - TanStack Query marks shifts cache as stale, then refetches
   - Query function: `supabase.from("schedule_shift").select(...).eq("workspace_id", ...).gte("shift_date", ...).order(...)`
   - Fresh data returned from Supabase
     **User sees (Manager A):** No visible change yet (silent refetch)

3. **UI re-renders with new data** → Manager A's React components consume updated shifts from cache
   **System:**
   - Grid surface re-renders all shift cards with new data
   - Shift card that was updated by Manager B now shows Manager B's changes (e.g., "published" status badge)
     **User sees (Manager A):** Shift card color/badges update (e.g., green "published" badge appears) within ~100–500ms of Manager B's action

4. **Shift is in different department** → Shift is outside Manager A's RLS-scoped permissions
   **System:**
   - Manager A's RLS policy on `schedule_shift`: `workspace_id IN (...) AND department_id = <my_department_id>`
   - If shift belongs to different department, RLS silently filters it during refetch
   - Shift does NOT appear in Manager A's schedule view
     **User sees (Manager A):** Nothing; shift is not visible (RLS isolation)

### Postcondition

- Manager A's cache reflects the latest state from DB (within Realtime latency)
- Manager A sees ONLY shifts from their own department (RLS enforced)
- Both managers' local `updatedAt` values match the DB source of truth
- No toast notifications or user interruption (silent sync)
- If Manager A was editing a form, editing continues uninterrupted while background data syncs

### Error Paths

**Error Path 1: Realtime connection drops temporarily**

- Realtime subscription disconnects (network glitch)
- Manager B updates shift while connection is down
- Manager A's subscription does NOT receive event
- Shift in Manager A's cache becomes stale
- When Manager A takes any action that re-fetches data (e.g., navigates to different week), stale data becomes visible
- **User experience:** Temporary inconsistency; user may see outdated info until action triggers refetch
- **System:** TanStack Query background refetch (staleTime) may eventually reconcile without user action

**Error Path 2: Insufficient permissions for soft-realtime data**

- Manager A's RLS is revoked for department shifts
- Manager B updates a shift in that department
- Realtime event fires (system-wide)
- Manager A's refetch query returns empty/filtered results (RLS blocks)
- Shift disappears from Manager A's view
- **User experience:** Shift vanishes with no explanation; user may be confused
- **Note:** No permission-change notification sent; user discovers via disappearance

---

## Journey 3: Admin Rolls Back a Change Using Audit Log

**Role:** Admin (full workspace access + audit capabilities)
**Context:** Admin realizes a shift was modified incorrectly and wants to undo it

### Precondition

- Admin is on Schedule page or in an Audit Log viewer (future feature)
- Shift was previously modified (visible in `schedule_audit_log`)
- Admin has RLS permission to execute `rollback_audit_entry` RPC
- Change to be rolled back is recent (within last N hours)

### Steps

1. **Admin opens shift details or audit log** → Admin clicks "View History" or "Audit Trail" for a specific shift
   **System:**
   - `useAuditLog(tableName, rowId)` query executes
   - Query: `supabase.from("schedule_audit_log").select(...).eq("table_name", "schedule_shift").eq("row_id", "shift-123").order("created_at", DESC)`
   - Returns array of all changes to this shift: `[{ id: "audit-1", action: "UPDATE", old_values: {...}, new_values: {...}, created_at: "2026-03-03T10:45:00Z" }, ...]`
     **User sees:** Modal/panel showing chronological list of changes, e.g.:
   - "2026-03-03 10:45 — Updated by Admin Lars: start_time 08:00 → 09:00"
   - "2026-03-03 10:20 — Updated by Admin Pontus: status unpublished → published"
   - "2026-03-02 14:30 — Created by Admin Pontus"

2. **Admin selects a change to undo** → Admin clicks "Undo" button next to "start_time 08:00 → 09:00" change
   **System:**
   - `useRollback().mutate("audit-1")` called with audit log entry ID
   - Mutation optimistically updates local UI (optional: show "reverting..." state)
   - RPC call: `supabase.rpc("rollback_audit_entry", { p_audit_log_id: "audit-1" })`
     **User sees:** "Reverting..." toast or loading state

3. **RPC executes rollback on server** → Supabase function `rollback_audit_entry` processes the change
   **System (Supabase RPC logic):**
   - Fetch audit log entry: `SELECT * FROM schedule_audit_log WHERE schedule_audit_log_id = 'audit-1'`
   - Extract old values: `{ "start_time": "08:00", "end_time": "16:00" }`
   - UPDATE target table with old values: `UPDATE schedule_shift SET start_time = '08:00', end_time = '16:00' WHERE schedule_shift_id = <row_id>`
   - Create new audit log entry for the rollback: `INSERT INTO schedule_audit_log (table_name, row_id, action, old_values, new_values, actor_id, ...) VALUES ('schedule_shift', <row_id>, 'ROLLBACK', <new_values>, <old_values>, <admin_user>, ...)`
   - Trigger fires: logs the rollback action
   - Return success
     **User sees:** "Reverting..." state completes

4. **Client receives success + invalidates all schedule caches** → Rollback succeeded
   **System:**
   - `onSuccess` callback fires
   - Toast: "Endring rullet tilbake"
   - `queryClient.invalidateQueries({ queryKey: scheduleKeys.all })` — clears ALL schedule-related caches
   - TanStack Query background refetch begins for shifts, absences, etc.
   - Supabase Realtime publishes "postgres_changes" event (UPDATE on `schedule_shift`)
     **User sees:** Toast "Endring rullet tilbake" + shift card updates to old time "08:00 - 16:00"

5. **Audit log updates** → New entry appears showing rollback
   **System:**
   - `useAuditLog` query for this shift is invalidated + refetched
   - New entry at top of list: "2026-03-03 10:48 — Rolled back by Admin Pontus: start_time was restored from 09:00 to 08:00"
     **User sees:** Audit log modal/panel appends new "Rolled back" entry at the top

### Postcondition

- Shift in database returns to previous state (start_time = "08:00")
- New audit log entry documents the rollback (action = "ROLLBACK")
- All connected users see rolled-back shift (via Realtime + refetch)
- Rollback is immutable (appears in audit trail; cannot be undone without manual re-edit)
- Shift may revert from "published" to "unpublished" depending on which field was rolled back

### Error Paths

**Error Path 1: Audit entry is too old or already rolled back**

- Admin clicks "Undo" on an audit log entry from 3 days ago
- RPC attempts `UPDATE schedule_shift SET ...` but:
  - Shift no longer exists (deleted), OR
  - Old values are invalid for current schema, OR
  - Concurrent changes make rollback ambiguous
- RPC returns error: "Cannot rollback: shift not found" or "Data mismatch"
- `onError` callback fires:
  - Toast: "Kunne ikke rulle tilbake endringen"
  - No cache invalidation
- **User experience:** Toast appears, user informed rollback failed; audit log remains unchanged

**Error Path 2: Permission denied (RLS blocks rollback RPC)**

- Manager (not admin) clicks "Undo" on a shift in a different department
- RPC `rollback_audit_entry` has RLS policy: requires admin role or workspace ownership
- RPC call blocked at DB layer
- `onError` fires
- Toast: "Kunne ikke rulle tilbake endringen"
- **User experience:** User forbidden; no audit log created for failed attempt

**Error Path 3: Concurrent rollback requests**

- Admin A clicks "Undo" on same audit entry as Admin B (simultaneous)
- First RPC completes: shifts back to old state
- Second RPC processes: tries to UPDATE with same old values (idempotent)
- Second succeeds but creates another redundant audit log entry OR fails (depending on RPC impl)
- Both admins see toast success
- Both caches invalidate + refetch
- Final state: shift reverted once; audit shows two rollback entries OR one (depending on deduplication)
- **User experience:** Two rollback toasts; final state correct; audit trail shows both attempts (immutable record)

---

## Journey 4: Employee Views Their Own Shifts (Read-Only Access)

**Role:** Employee (can see only own shifts; no write access)
**Context:** Employee is checking their assigned shifts for next week

### Precondition

- Employee is logged in (auth.uid = employee profile's user ID)
- Profile role = "employee" (or "trainee")
- Schedule page is accessible to employee role
- `useShifts(weekStart, weekEnd)` has RLS filtering enabled
- No create/edit/delete mutations available in employee UI

### Steps

1. **Employee navigates to Schedule page** → Employee clicks "Schedule" or "Min Time" in dashboard
   **System:**
   - Page loads, `ScheduleUIProvider` wraps content
   - `useShifts()` hook executes query: `supabase.from("schedule_shift").select(...).eq("workspace_id", ...).gte("shift_date", ...).lte("shift_date", ...)`
   - RLS policy on `schedule_shift` table for employee: `(auth.uid = <my_user_id> AND employee_id = <my_profile_id>) OR (workspace_id IN (get_workspace_ids_for_user(auth.uid())) AND <manager/admin check>)`
   - Query returns only shifts where `employee_id = <this-employee-profile-id>`
     **User sees:** Loading skeleton or empty state briefly

2. **Query completes with employee's shifts** → Shifts for this week load from cache or DB
   **System:**
   - Data: `[{ id: "shift-456", employeeId: "<employee-id>", dateId: "2026-03-05", startTime: "08:00", endTime: "16:00", status: "published", ... }, ...]`
   - TanStack Query caches result
   - `useScheduleRealtime()` subscription activates for Realtime events
     **User sees:** Calendar grid showing Monday–Friday with 2 shifts assigned:
   - Wed 05-Mar: "08:00 - 16:00" (Kitchen, published)
   - Fri 07-Mar: "10:00 - 18:00" (Floor, published)

3. **Employee clicks on a shift card** → Employee taps "08:00 - 16:00" to view details
   **System:**
   - `ScheduleUIProvider.setSelectedShift()` sets local UI state (not persisted)
   - Modal opens showing shift details: time, zone, team, status
   - No "Edit" button visible (employee role has no mutation)
   - Optional: "Report Absence" or "Request Swap" buttons (future features)
     **User sees:** Read-only modal showing shift details, no edit controls

4. **Manager updates this shift** → Manager changes shift status to "unpublished"
   **System (background):**
   - Manager's `useUpdateShift.mutate()` updates shift status
   - Supabase triggers audit log entry
   - Realtime publishes event on `schedule_shift` table
   - Employee's `useScheduleRealtime()` subscription receives event
   - Callback invalidates shifts cache
   - Cache refetches (RLS returns updated shift)
     **User sees:** Shift card color updates (e.g., unpublished = grayed out), or badge changes if modal open; user not interrupted

5. **Employee's shift is deleted** → Manager removes this shift entirely
   **System:**
   - Manager's `useDeleteShift.mutate()` executes DELETE
   - Audit log records deletion
   - Realtime event fires
   - Employee's cache invalidates + refetches
   - Query returns fewer shifts (delete applied)
     **User sees:** Shift card disappears from calendar; if modal was open, it closes or shows "not found"

6. **Employee closes modal** → Employee clicks outside or "Close" button
   **System:**
   - `ScheduleUIProvider.setSelectedShift(null)` clears selection
   - Modal closes; employee is back at week view
     **User sees:** Week view with their 1 remaining shift (after deletion)

### Postcondition

- Employee sees only their own shifts (RLS enforced)
- All data is read-only in UI (no mutate buttons)
- Live updates appear when manager edits their shifts
- Employee cannot see shifts assigned to other employees
- Employee cannot see unpublished shifts assigned to others (unless in future admin UI)

### Error Paths

**Error Path 1: RLS policy denies access**

- Employee somehow accesses schedule page for different workspace (bug)
- Query: `supabase.from("schedule_shift").select(...).eq("workspace_id", "wrong-workspace-id")`
- RLS policy: `workspace_id IN (get_workspace_ids_for_user(auth.uid()))` returns empty for this user
- Query returns empty array (no shifts)
- No error toast (silent failure)
- **User experience:** Calendar shows as empty; user assumes they have no shifts assigned

**Error Path 2: Session expires while viewing shifts**

- Employee is reading shifts, session token expires
- User clicks "Refresh" or navigates away
- Next query attempt fails with 401 Unauthorized
- TanStack Query catches error, shows toast or prompts re-login
- **User experience:** Toast "Sesjon utløpt, logg inn på nytt" or redirect to login

**Error Path 3: Shift is deleted by manager while employee reads details**

- Employee opens modal showing shift "08:00 - 16:00"
- Manager deletes shift
- Realtime event fires, cache invalidates
- `useAuditLog()` query for this shift still succeeds (audit log has entry)
- But modal attempts to show details from stale cache
- UI detects shift no longer exists, closes modal
- **User experience:** Modal closes unexpectedly with no explanation; user may see subtle "not found" message

---

## Journey 5: Multi-Tab Sync via Realtime Subscriptions

**Role:** Admin (full access)
**Context:** Admin has Schedule page open in 2 browser tabs (same workspace), makes edits in one tab

### Precondition

- Admin has browser open with 2 tabs:
  - Tab A: `localhost:3050/dashboard/schedule?week=2026-03-02` (Mon–Sun)
  - Tab B: `localhost:3050/dashboard/schedule?week=2026-03-09` (next week)
- Both tabs are active (not backgrounded)
- Both have TanStack Query state + Realtime subscriptions initialized
- Shift "shift-789" exists in week of Tab A (2026-03-02)

### Steps

1. **Admin is in Tab B, updates a shift in Tab A's week** → Admin leaves Tab B visible but makes API call from Tab A using DevTools
   **System (conceptual test case):**
   - Direct mutation: `supabase.from("schedule_shift").update({ startTime: "10:00" }).eq('schedule_shift_id', 'shift-789').select()`
   - This fires Realtime event
   - Does NOT affect Tab B's local query key (different week)
     **User sees:** Tab B remains unchanged (shift is not in this week)

2. **Admin is in Tab A, updates shift in same week** → Admin clicks "Edit" on shift-789, changes time to 10:00
   **System (Tab A):**
   - `useUpdateShift().mutate()` fires optimistic update
   - Shift updates immediately in Tab A's cached shifts array
   - Network request sent to Supabase
   - Success response triggers `onSettled` → invalidate shifts query key
   - Background refetch begins
   - Supabase Realtime publishes event
     **User sees (Tab A):** Shift card updates to "10:00 - 18:00" instantly

3. **Realtime event reaches both tabs** → Supabase publishes "postgres_changes" to all connected clients
   **System:**
   - Tab A's Realtime listener:
     - Channel filter matches: `workspace_id=eq.${workspace_id}` ✓
     - Table matches: `table: "schedule_shift"` ✓
     - Callback executes: invalidate `scheduleKeys.shifts(workspace_id, weekStart-of-Tab-A)`
   - Tab B's Realtime listener:
     - Channel filter matches: `workspace_id=eq.${workspace_id}` ✓
     - Table matches: `table: "schedule_shift"` ✓
     - Callback executes: invalidate `scheduleKeys.shifts(workspace_id, weekStart-of-Tab-B)` — DIFFERENT WEEK
     - But shift-789 is in Tab A's week, not Tab B's, so refetch returns nothing for Tab B (no changes)
       **User sees (Tab B):** Nothing changes (shift not in view)

4. **Switch focus to Tab B** → Admin clicks on Tab B window
   **System:**
   - Tab B is still subscribed and has already received Realtime event
   - If refetch already completed, data is fresh
   - If refetch still pending, it continues in background
     **User sees (Tab B):** Same as before (no shifts in this tab's week were affected)

5. **Admin switches back to Tab A** → Admin clicks Tab A
   **System:**
   - Tab A has already refetched and has latest data
   - Shift-789 is cached as updated
   - No additional requests needed
     **User sees (Tab A):** Shift shows "10:00 - 18:00" (persisted from Tab B switch)

6. **Admin opens same shift in both tabs** → Admin opens shift-789 details modal in Tab A, then does same in Tab B
   **System:**
   - Both `useScheduleUI()` hooks maintain separate `selectedShiftId` state
   - Both modals open independently
   - Both show same data from shared TanStack Query cache
   - If data updates via Realtime, both modals show updated data (cache is global)
     **User sees:** Two modals open showing same shift, both with latest data; if admin edits in Tab A and saves, Tab B modal updates too

7. **Admin edits in Tab A while Tab B modal is open** → Admin in Tab A changes shift time, saves
   **System:**
   - Tab A: optimistic update → network request → success → cache invalidated → refetch
   - Supabase Realtime event fires
   - Tab B: Realtime listener fires → invalidate → refetch
   - Both tabs now have updated shift in cache
     **User sees (Tab A):** Shift updates, modal closes (or stays open with updated data)
     **User sees (Tab B):** Modal still open, but shift data inside modal auto-updates (because cache is shared)

### Postcondition

- Both browser tabs stay in sync via Supabase Realtime
- Edits in one tab are visible in other tab(s) within ~100–500ms
- Query cache is shared across tabs (same React Query client instance per tab)
- No manual refresh needed; sync is automatic via Realtime subscriptions
- Closing one tab does not affect other tab's subscriptions

### Error Paths

**Error Path 1: Realtime disconnects in one tab**

- Tab A's Realtime connection drops (network glitch)
- Tab B's connection remains stable
- Admin edits shift in Tab B
- Tab A does NOT receive Realtime event
- Tab A's cache becomes stale
- When admin clicks back to Tab A, shift still shows old time
- **User experience:** Tab A is temporarily inconsistent with server
- **Recovery:** Admin navigates away/back, or next refetch cycle kicks in (TanStack Query staleTime)

**Error Path 2: Different workspace data appears in Tab B**

- Tab A: workspace A
- Tab B: accidentally switched to workspace B (admin navigated)
- Admin edits shift in Tab A (workspace A)
- Realtime publishes to all clients in workspace A
- Tab B is now listening to workspace B channel (different)
- Tab B does NOT receive workspace A events
- **User experience:** No sync between tabs; expected (different workspaces)

**Error Path 3: Browser storage sync conflict**

- Admin uses browser's "Restore closed tabs" feature
- Multiple tabs open with same schedule page
- TanStack Query client is initialized per-tab (separate instances)
- Edit in Tab 1 fires Realtime
- Tab 2 has separate QueryClient (not shared)
- Tab 2's cache is not invalidated (different instance)
- **User experience:** Tab 2 shows stale data until manual refresh
- **Note:** Current architecture shares QueryClient across same browser session; this path is unlikely

---

## Technical Architecture Notes

### Query Key Factory Pattern

Query keys are structured for granular invalidation:

```typescript
scheduleKeys = {
  all: ["schedule"] as const,
  shifts: (workspaceId, weekStart) => ["schedule", "shifts", workspaceId, weekStart],
  auditLog: (tableAndRowId) => ["schedule", "audit", tableAndRowId],
  // ... etc
};
```

**Invalidation hierarchy:**

- `scheduleKeys.all` — clears everything (used after rollback)
- `scheduleKeys.shifts(workspace_id, weekStart)` — clears one week's shifts
- `scheduleKeys.shift(id)` — clears single shift (if detail view exists)

### Optimistic Update Pattern

All mutations follow this pattern:

```typescript
useMutation({
  mutationFn: async (input) => {
    // 1. Send to Supabase
  },
  onMutate: async (input) => {
    // 2. Update cache immediately (optimistic)
    // 3. Return old value for rollback
  },
  onError: (_err, _vars, context) => {
    // 4. Revert cache on error
  },
  onSettled: () => {
    // 5. Invalidate & refetch to reconcile
  },
});
```

This provides instant UI feedback while maintaining eventual consistency.

### Realtime Subscription Pattern

```typescript
useEffect(() => {
  const channel = supabase
    .channel(`schedule:${workspaceId}:${weekStart}`)
    .on("postgres_changes", { table: "schedule_shift", ... }, () => {
      queryClient.invalidateQueries({ queryKey: ... })
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}, [workspaceId, weekStart, queryClient])
```

Subscriptions fire for ANY change (INSERT, UPDATE, DELETE) on watched tables, then refetch to get fresh data.

### UI-Only State (ScheduleUIProvider)

Ephemeral state that is NOT persisted:

- `selectedShiftId` — which shift modal is open
- `selectedDayId` — day filter
- `selectedEmployeeId` — employee filter
- `clipboard` — day copy/paste buffer (lost on page refresh)
- `selectedDays` — batch operation selection
- `createShiftContext` — form prefill for new shift dialog
- `dayControlFullscreen` — UI layout toggle

This state is local to the component tree; Realtime changes do not affect it.

### RLS Enforcement

All queries respect RLS policies:

- **Employee:** sees only own shifts (`employee_id = auth.user.profile_id`)
- **Manager:** sees own department + direct reports (department filter in RLS)
- **Admin:** sees all workspace shifts
- **Workspace isolation:** all queries filtered by `workspace_id IN (get_workspace_ids_for_user(auth.uid()))`

RLS is evaluated at query time; no data escapes to unauthorized users.

### Audit Log

- Populated by DB triggers on `schedule_shift`, `schedule_absence`, etc.
- Stores old + new values as JSON
- Immutable (append-only)
- Used for:
  - Change history UI
  - Compliance/audit trails
  - Rollback source of truth
  - Debugging concurrent edits

---

## Summary Table

| Journey           | Role     | Primary Action      | Real-Time? | Optimistic? | Audit Logged? |
| ----------------- | -------- | ------------------- | ---------- | ----------- | ------------- |
| #1 Shift Edit     | Admin    | UPDATE shift        | Yes        | Yes         | Yes           |
| #2 Real-Time Sync | Manager  | View peer edits     | Yes        | No          | Yes           |
| #3 Rollback       | Admin    | RPC rollback        | Yes        | Optional    | Yes           |
| #4 Employee Read  | Employee | SELECT own shifts   | Yes        | N/A         | N/A           |
| #5 Multi-Tab Sync | Admin    | Same edit, two tabs | Yes        | Yes         | Yes           |

All journeys assume:

- User is authenticated (RLS applies)
- Network connectivity (timeouts possible)
- Workspace membership (admin checks)
- No concurrent schema changes (migrations)

---

_Document reflects production implementation as of 2026-03-03. See `schedule.md` module docs and ADR-0036 for full schedule system specification._
