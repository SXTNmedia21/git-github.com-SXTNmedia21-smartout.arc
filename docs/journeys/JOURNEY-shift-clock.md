---
title: "Journey — ShiftClock (Punchklokke)"
status: done
updated: 2026-03-24
created: 2026-03-24
module: operations
tags: [journey, shift-clock, punch, employee, manager]
---

# Journey — ShiftClock (Punchklokke)

## Journey: Employee Punch In (Planlagt vakt)

**Precondition:** Employee is authenticated, has active profile, has a scheduled shift within punch window (default ±30 min).

1. Employee opens ShiftClock view → System shows shift info (time, department, zone), countdown to shift start, colleague count, and the glowing fingerprint punch button
2. Employee presses the punch button → System shows press animation (scale 0.88), then scanning sequence:
   - GPS-posisjon ✓
   - Identitet bekreftet ✓
   - Vakt aktivert ✓
   - Sesjon startet ✓
3. System calls `shift-clock-compliance` Edge Function → Server validates GPS position, 11h rest period, weekly hours
4. If **allowed**: System creates `timesheet.time_entry` (punch_in=now), updates `schedule_shift.status='active'`, emits telemetry → User sees success explosion (green check, confetti, points badge), then crossfade to active shift view
5. If **blocked** (GPS too far): System shows block message with distance info → User must move closer or contact leader

**Postcondition:** time_entry created, shift active, employee sees live timer + tasks + chat.

**Error paths:**

- GPS unavailable → Punch continues without GPS (logged), no blocking
- GPS blocked by admin setting → "Du er for langt fra arbeidsplassen" → Must contact leader
- 11h rest warning → Warning shown but punch allowed (advisory only)
- Weekly hours exceeded → Warning shown but punch allowed
- Already punched in → Redirected to active shift view
- No shift found → Shown ad-hoc options (if enabled)

---

## Journey: Employee Punch In (Ad-hoc vakt)

**Precondition:** Employee has no scheduled shift, `shift_clock_config.adhoc_shifts_enabled = true` for their team/department.

1. Employee opens ShiftClock view → System shows "Ingen planlagt vakt — Vil du starte en vakt?"
2. Employee sees two options:
   - **Open shifts:** List of unassigned published shifts with "Ta vakt" button
   - **New ad-hoc shift:** "Start ny ad-hoc vakt" button (dashed border)
3. If **taking open shift**: Employee taps "Ta vakt" → System claims shift (optimistic lock on employee_id IS NULL), then proceeds to normal punch-in flow
4. If **starting ad-hoc**: Employee taps "Start ny ad-hoc vakt" → System creates `schedule_shift` with `is_adhoc=true`, then punches in. If `adhoc_requires_approval`: leader notified, shift marked pending approval

**Postcondition:** Shift assigned/created, time_entry created, employee on active view.

**Error paths:**

- Open shift already taken by another employee → "Vakten er allerede tatt" → Refresh list
- Ad-hoc requires approval → Leader receives push notification → Approve/reject

---

## Journey: Employee Takes Break

**Precondition:** Employee is clocked in (phase: `clocked_in`).

1. Employee taps "Pause" (Coffee icon) in action grid → System takes GPS snapshot
2. System updates `time_entry.breaks` JSONB array (adds `{start: now, end: null}`)
3. Timer switches to break timer (orange), status badge changes to "PAUSE"
4. Employee sees "Tilbake fra pause" button (green, play icon)
5. Employee taps "Tilbake fra pause" → GPS snapshot → break entry updated with `end: now`
6. Timer switches back to work timer, status returns to "PÅ VAKT"

**Postcondition:** Break recorded in time_entry. Break classification (paid/unpaid) determined by `payroll_break_rule` — employee never sees this distinction.

**Error paths:**

- GPS fails during break → Snapshot skipped, break still recorded
- Employee punches out while on break → Not allowed (must end break first, enforced by state machine)

---

## Journey: Employee Registers Supplement

**Precondition:** Employee is clocked in, admin has configured available manual supplements.

1. Employee taps "Tillegg" (Coins icon) → Bottom sheet opens with available supplements (e.g., "Smusstillegg +kr 30/t", "Ubekvemstillegg +kr 25/t")
2. Employee selects a supplement → Confirmation form appears with:
   - Supplement name and rate
   - Required comment field (describe what happened)
   - Timestamp (default: now)
3. Employee fills comment + taps "Registrer tillegg" → System creates `payroll.manual_supplement` with `status='pending'`
4. Badge on Tillegg button updates (count), banner shows below actions
5. Leader receives notification for approval

**Postcondition:** Supplement claim created with pending status. Leader must approve for payroll inclusion.

**Error paths:**

- Empty comment → Validation blocks submission ("Comment is required")
- No supplements configured → Tillegg button hidden or disabled

---

## Journey: Employee Communicates During Shift

**Precondition:** Employee is clocked in.

### Chat

1. Employee taps "Chat" tab → Two channels visible:
   - **Avdelings-chat** (group, all on duty): session-wide messages
   - **Vakt-tråd** (DM, employee ↔ leader): private shift-specific thread
2. Employee writes message → Sent via Supabase, realtime to all participants
3. Unread badge shows on Chat tab when new messages arrive

### Notes

1. Employee taps "Notater" tab → List of shift notes
2. Employee writes note in textarea, hits send → `shift_note` created
3. Notes visible to employee + all leaders in workspace

### Voice (V1: Fallback)

1. Employee taps "Ring leder" → Opens shift thread chat (LiveKit not ready yet)
2. Future: Will start voice call to all leaders on duty via WalkieTalkie/LiveKit

---

## Journey: Employee Punches Out

**Precondition:** Employee is clocked in (not on break).

1. Employee taps "Stemple ut" (red button at bottom) → GPS snapshot taken
2. System updates `time_entry` with `punch_out=now`, `status='completed'`
3. System updates `schedule_shift.status='completed'`
4. Summary screen shows:
   - "Bra jobbet!" header with checkmark
   - Stats: work time, break time, points (if available), streak (if available)
   - Task completion progress
   - Registered supplements list
   - Optional comment field
5. Employee optionally writes a comment, taps "Ferdig" → Returns to idle state

**Postcondition:** time_entry completed, shift completed, shift_approval pending for leader review.

**Error paths:**

- On break → Must end break before punching out (state machine enforces)

---

## Journey: Manager Views Active Shifts (Web)

**Precondition:** User has manager/admin role, is on web dashboard.

1. Manager navigates to `/dashboard/shift-clock` → System detects admin role, shows LeaderOverview
2. Manager sees:
   - Status badges: X on shift (green), X on break (orange), X waiting (gray)
   - Employee card grid (responsive: 3 col desktop, 2 tablet, 1 mobile)
3. Cards update in real-time via Supabase subscription on `timesheet.time_entry`
4. For waiting employees: "Stemple inn manuelt" button available
5. Manager taps "Stemple inn manuelt" → System creates time_entry for that employee

**Postcondition:** Manager has live operational oversight. Can manually punch employees.

**Error paths:**

- No shifts scheduled today → Empty state shown
- Realtime connection lost → Fallback to 30s polling via refetchInterval
