---
title: User Journeys — Absence Approval
status: done
updated: 2026-03-28
created: 2026-03-28
module: scheduling
tags: [absence, approval, journeys]
---

# User Journeys — Absence Approval

## Journey: Admin Approves Absence Request

**Precondition:** Employee has submitted an absence request (status: pending). Admin is logged in and viewing the schedule.

1. Admin opens schedule → navigates to day detail (OversiktTab)
2. System shows "Fraværsforespørsler (N)" section at top of panel with pending requests
3. Each request shows: employee name, absence type, date range, day count
4. Admin clicks green checkmark (✓) on a request
5. System optimistically updates UI → sends Supabase UPDATE (status: "approved", guarded by .eq("status", "pending"))
6. System emits "absence approved" telemetry → routes to activity_trail + engine_event
7. Admin sees toast: "Fravær godkjent"
8. Pending list count decreases by 1. Weekly absence view refreshes.

**Postcondition:** Absence status = approved. Event Engine can consume the event for downstream workflows (smart-cover).

**Error paths:**
- DB update fails (network, RLS) → optimistic update rolls back, toast: "Kunne ikke godkjenne fravær"
- Another admin already approved → .eq("status", "pending") returns no rows → error toast
- Employee not in admin's workspace → RLS blocks the UPDATE

---

## Journey: Admin Rejects Absence Request

**Precondition:** Same as above — pending absence request visible.

1. Admin clicks red X on a request
2. System shows AlertDialog: "Avslå — Er du sikker på at du vil avslå denne forespørselen?"
3. Admin clicks "Avslå" to confirm (or "Avbryt" to cancel)
4. System optimistically updates UI → sends Supabase UPDATE (status: "rejected", guarded by .eq("status", "pending"))
5. System emits "absence rejected" telemetry → routes to activity_trail + engine_event
6. Admin sees toast: "Fravær avslått"
7. Request disappears from pending list.

**Postcondition:** Absence status = rejected.

**Error paths:**
- Same as approval: network fail → rollback, concurrent approval → error toast
- Admin cancels dialog → no action taken

---

## Journey: Employee View (No Changes)

**Precondition:** Employee has submitted an absence request.

1. Employee does NOT see the pending approval list (admin-only, gated by isAdminMode)
2. Employee sees their own absences in the weekly schedule view via existing useAbsences hook
3. Status changes (pending → approved/rejected) reflect in the employee's view after query invalidation

**Postcondition:** Employee sees updated status.

---

## Journey: Event Engine Consumes Approval

**Precondition:** An engine_process exists with a trigger on "absence.approved" (future: smart-cover).

1. Admin approves absence (Journey 1 above)
2. emit() sends "absence approved" to engine_event destination
3. Engine event provider writes to engine_event table via engine-dispatch relay
4. engine-dispatch Edge Function matches the event against active triggers
5. If a waiting engine_state matches (wait_for_event on "absence.approved"), it resumes

**Postcondition:** Downstream workflow (smart-cover) is triggered.

**Error paths:**
- emit() fires client-side — if tab closes immediately, event may not reach engine (MVP-acceptable)
- No matching engine_process → event logged but no workflow triggered (correct behavior until smart-cover is built)
