---
title: "Mobile Shift Surface Map — Phase 0 Discovery"
status: in_progress
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [audit, mobile, shift, vaktliste, punch, discovery]
---

# Mobile Shift System Surface Map — Phase 0 Discovery

**Date:** 2026-05-04
**Sortie:** `feat/mobile-shift-system-polish`
**Worktree:** `/home/sxtnl/dev/smartout.ai-mobile-wt-2`
**Plan:** [PLAN-shift-system-polish.md](../plans/PLAN-shift-system-polish.md)

---

## 1. Mobile Shift Mutation Call-Sites Inventory

### 1.1 Shift Creation (`create_shift` action)

| File | Line | Verb | Payload | RLS Path | Status |
|------|------|------|---------|----------|--------|
| `apps/mobile/src/hooks/mutations/use-create-shift.ts` | 53–66 | `create_shift` enqueue | `{shift_date, start_time, end_time, day_category, role, workspace_id, employee_id, department_id, notes, breaks, status}` | Sync queue → `schedule_shift.insert()` | ACTIVE |
| `apps/mobile/app/(app)/(shifts)/create.tsx` | 47, 180+ | Form handler | Collects: `shift_date, start_time, end_time, role, department_id, breaks, notes` | Calls `useCreateShift.createShift()` | ACTIVE |

**Key Issues:**
- Client derives `day_category` (lines 81–91 in create.tsx) → **DRIFT RISK**: device tz vs workspace tz
- Missing `profileId` field (who created?)
- Missing `reason` field (reason for creation — min 8 chars per addShiftAction)
- Missing `source='manual_admin'` (marked as "created" status, not audit-traceable)
- Missing `is_published=true` (defaults to false in sync schema)
- **No `gateAction` call** — no C4 capability check before enqueue
- Telemetry emits `actor_id: profileId` (from `getProfileContext()`) but that's _current user_, not who the shift is assigned to

### 1.2 Punch In/Out (`punch_in` + `punch_out` actions)

| File | Line | Verb | Payload | RLS Path | Status |
|------|------|------|---------|----------|--------|
| `apps/mobile/src/hooks/mutations/use-punch.ts` | 51, 68–84 | `punch_in` enqueue | `{time_entry_id, shift_id, profile_id, workspace_id, punch_in, status}` | Sync queue → `timesheet.time_entry.insert()` | ACTIVE |
| `apps/mobile/src/hooks/mutations/use-punch.ts` | 116, 110–114 | `punch_out` enqueue | `{time_entry_id, punch_out, status}` | Sync queue → `timesheet.time_entry.update()` | ACTIVE |
| `apps/mobile/app/(app)/(home)/punch-clock.tsx` | [search] | UI button handler | Calls `usePunch.punchIn(shiftId)` + `usePunch.punchOut(timeEntryId)` | Via hook | ACTIVE |

**Key Issues:**
- Punch in resolves `{profileId, workspaceId}` via `getProfileContext()` (line 38) ✓ ADR-0134 compliant
- Punch out captures `shiftId` from cache before clearing it (line 103) ✓ Good for entity_id routing
- Telemetry includes `work_minutes` (calculated client-side, line 107–108) — **could be manipulated offline**
- No GPS/location capture despite comment about "punch_in_location" in TimeEntry type

### 1.3 Break Start/End (`break_start` + `break_end` actions)

| File | Line | Verb | Payload | RLS Path | Status |
|------|------|------|---------|----------|--------|
| `apps/mobile/src/hooks/shift-clock/useShiftClock.ts` | 147–151, 177–181 | `break_start` + `break_end` enqueue | `{time_entry_id, breaks: BreakEntry[], updated_at}` | Sync queue → `timesheet.time_entry.update(breaks)` | ACTIVE |

**Key Issues:**
- Break array is opaque JSONB in schema (line 46 in schemas.ts: `breaks: z.unknown()`)
- Client appends `{start, end, startLocation, endLocation}` (line 139–144)
- **No validation**: max breaks per shift, overlapping breaks, minimum break duration per Aml §10-9

### 1.4 Other Shift-Related Mutations

| File | Verb | Payload | RLS Path | Notes |
|------|------|---------|----------|-------|
| `use-confirm-hours.ts` | `confirm_shift` | `{schedule_shift_id, ...}` | Sync queue | Updates shift confirmation status |
| `use-submit-handoff.ts` | `submit_handoff` | `{workspace_id, ...}` | Sync queue | Inserts `session_note` |
| `use-confirm-hours.ts` | `confirm_hours` | `{approval_id, ...}` | Sync queue | Updates `shift_approval` record |
| `use-request-absence.ts` | `request_absence` | `{workspace_id, ...}` | Sync queue | Inserts `schedule_absence` |
| `use-cancel-absence.ts` | `cancel_absence` | `{schedule_absence_id, status}` | Sync queue | Updates absence status |

---

## 2. Mobile Shift Read Paths Inventory

### 2.1 Employee Shift Queries

| File | Query | Filters | Order | Cache Key |
|------|-------|---------|-------|-----------|
| `use-my-shifts.ts:77–85` | `schedule_shift.select("*")` | `employee_id=profileId, is_published=true, shift_date ∈ [today, today+7d]` | `shift_date ASC, start_time ASC` | `["my-shifts"]` |
| `use-shift-colleagues.ts` | `schedule_shift` + `profile` join | `shift_date=date, workspace_id=wsId` | `start_time ASC` | `["shift-colleagues"]` |
| `use-active-time-entry.ts` | `timesheet.time_entry` | `profile_id=, status='clocked_in'` | — | `["active-time-entry"]` |
| `use-my-tasks.ts` | `session_task` + join | `department_session_id, status` | `priority DESC` | `["my-tasks"]` |
| `use-operations-feed.ts:67+` | Composite of above | Filters by `selectedDate` | — | Multiple (shifts, tasks, colleagues) |

**Query Shapes:**
- `schedule_shift`: selects `schedule_shift_id, shift_date, start_time, end_time, role, status, employee_id, work_hours, breaks, day_category`
- `time_entry`: selects `shift_id, status, punch_in, punch_out, breaks`
- **Missing**: queries for `shift_approval`, `daily_reconciliation` (reconciliation screen does not exist on mobile)

### 2.2 Vaktliste (Shifts List) UI

| Component | File | Logic | Status Columns |
|-----------|------|-------|---|
| List container | `apps/mobile/app/(app)/(shifts)/index.tsx` | Groups by week, shows summary + swaps | See below |
| Week grouping | `index.tsx:52–71` | Calculates week#, date range, total hours | — |
| Shift card | `components/shift/ShiftCard.tsx` | Renders time, role, colleagues, status pill | `upcoming, active, completed, swapped` |
| Detail modal | `apps/mobile/app/(app)/(shifts)/[id].tsx` | Tab: Details, Tasks, Emma (AI) | — |

**Status Pills:**
- `upcoming` — shift in future
- `active` — currently clocked in
- `completed` — punch_out recorded
- `swapped` — from swap request acceptance

**Empty/Error States:**
- Empty: "Du har ingen vakter denne uka" + CTA to calendar
- **Missing**: error toast on sync failure, retry buttons

---

## 3. Web Canonical Write Paths

### 3.1 `addShiftAction` (Canonical Source of Truth)

**Location:** `apps/web/src/app/dashboard/_actions/add-shift-action.ts:133–275`

**Input Schema (Zod):**
```zod
{
  departmentSessionId?: uuid  // Optional: ties to live department_session
  departmentId?: uuid         // Optional: direct dept scope
  profileId: uuid             // REQUIRED: selected employee
  startAtISO: datetime        // REQUIRED: ISO 8601 (UTC)
  endAtISO: datetime          // REQUIRED: ISO 8601 (UTC)
  role: string (min 1)        // REQUIRED
  reason: string (min 8 chars)  // REQUIRED: audit trail reason
  overrideReason?: string     // Optional: if assigning unavailable/absent person
}
```

**Execution Flow:**
1. **Input validation** via Zod (line 134)
2. **Auth check** — resolve current admin profile (line 142)
3. **Cross-workspace guard** — employee must belong to same workspace (line 149–156)
4. **Workspace timezone fetch** — server-side (line 163–171) → used for `day_category` + time derivation
5. **Department resolution** — precedence: `departmentSessionId` → `departmentId` → trigger-derived (line 178–199)
6. **Gate action** — C4 capability `roster.add_shift_manual` via `gateAction()` (line 201–211)
   - Channel: `"chat"` (ADR-0078)
   - Action type: `"create"`
   - Entity: target `profileId`
7. **Time conversion** — UTC ISO → workspace-local HH:MM:SS + YYYY-MM-DD (line 213–214)
8. **Day category derivation** — weekend override + hour bucket (line 216) — **SERVER LOGIC** (lines 99–106)
9. **Insert** into `schedule_shift` with:
   - `source: 'manual_admin'` (line 234)
   - `is_published: true` (line 232)
   - `status: 'created'` (line 231)
   - `notes: reason` (line 235) — audit trail
10. **Telemetry emit** — `shift added_manual` event (line 248–272)
    - Includes `source, manual: true, reason, override_reason` (if applicable)
    - Lands in `activity_trail` via telemetry engine (ADR-0175)

**Payload Delivered to Database:**
```sql
INSERT INTO schedule_shift (
  workspace_id, employee_id, department_id,
  shift_date, start_time, end_time, role, work_hours, breaks,
  day_category, status, is_published, indicator, source, notes
) VALUES (
  workspaceId, profileId, departmentId,
  date, startTime, endTime, role, workHours, 0,
  dayCategory, 'created', true, 'blue', 'manual_admin', reason
)
```

### 3.2 Other Web Shift Write Paths (for context)

| Path | Mutation | Notes |
|------|----------|-------|
| RosterTab empty-state CTA | `addShiftAction` | Same as above; `departmentId` from context |
| Drag-drop schedule editor | [not found in snapshot] | Out of scope per ADR-0133 (web-only compose) |
| Voice "create shift" tool | Likely capability tool via stage-engine | Routes through BFF per ADR-0132 |
| Manual time-entry (reconciliation) | Separate action in reconciliation flow | Not shift-creation; post-punch override |

---

## 4. Delta-Table: Mobile vs Web Shift Creation

| Concern | Mobile `useCreateShift` | Web `addShiftAction` | Delta | Confidence |
|---------|---|---|---|---|
| **Location of `day_category` derivation** | Client-side (device tz) in create.tsx:81–91 | Server-side (workspace tz) in add-shift-action.ts:99–106 | Mobile uses device tz; tariff mismatches if device tz ≠ workspace tz | HIGH |
| **Timezone context** | None; relies on device | Fetches workspace.timezone server-side with Europe/Oslo fallback | Mobile has zero tz awareness | HIGH |
| **`reason` (audit) field** | Missing entirely | Required; min 8 chars; stored in `notes` | **CRITICAL GAP**: no audit reason captured | HIGH |
| **`source` field** | Absent; implicit "offline-queue" | Explicit `source='manual_admin'` | Mobile shifts are audit-blind; cannot distinguish from auto-fill | HIGH |
| **`is_published` flag** | Hardcoded to `false` (schema.ts:127) | Hardcoded to `true` | **CRITICAL**: mobile shifts invisible until manually published | HIGH |
| **`profileId` (creator)** | Not captured; only `employee_id` | Derived from session auth; stored in telemetry | Mobile loses WHO created (creator identity) | MEDIUM |
| **`gateAction` / C4 capability** | None; direct enqueue | `roster.add_shift_manual` gate before insert | Mobile shifts bypass authority checking entirely | HIGH |
| **Department scope** | From picker; passed as-is | Validated cross-workspace + trigger-derived fallback | Mobile trusts client input; no validation | MEDIUM |
| **Work hours calculation** | Manual input (optional `breaks` field) | Server-derived from `endAtISO - startAtISO` | Mobile inputs hours; web derives | MEDIUM |
| **Status field** | Hardcoded `"draft"` (use-create-shift.ts:65) | Hardcoded `"created"` | Different enum values; reconciliation logic differs | MEDIUM |
| **Telemetry attribution** | Resolves `profileId` via `getProfileContext()` ✓ | Resolves `profileId` from session auth ✓ | Both emit `workspace_id` + `actor_id` correctly (ADR-0134) | HIGH |
| **Override reason** | Missing | Optional; for unavailable/absent assignments | Mobile cannot override availability signals | LOW |
| **Break minutes field** | Optional; stored in DB | Hardcoded to `0` | Mobile allows partial shifts; web assumes full shift or manual break override later | LOW |

---

## 5. Sync Action-Map Impact Analysis

**File:** `apps/mobile/src/lib/sync/action-map.ts`

### 5.1 Actions Affected by Shift-System Polish

| Action | Handler | Affected by Polish | Disposition |
|--------|---------|---|---|
| `create_shift` | Line 143: `schedule_shift.insert()` | **YES** — will be deprecated per plan Phase 3b | **DEPRECATE** → move logic to BFF |
| `punch_in` | Line 64: `timesheet.time_entry.insert()` | NO — punch flow unchanged | **KEEP** → offline-first essential |
| `punch_out` | Line 66–71: `time_entry.update()` | NO — punch flow unchanged | **KEEP** → offline-first essential |
| `break_start` | Line 120–125: `time_entry.update(breaks JSONB)` | NO — break tracking offline-ready | **KEEP** → no server-side changes planned |
| `break_end` | Line 128–133: `time_entry.update(breaks JSONB)` | NO — break tracking offline-ready | **KEEP** → no server-side changes planned |
| `confirm_shift` | Line 87–93: `schedule_shift.update()` | NO — confirmation flow separate | **KEEP** |
| `confirm_hours` | Line 97–103: `shift_approval.update()` | NO — post-punch reconciliation | **KEEP** |

### 5.2 Schema Deprecation Path

**File:** `apps/mobile/src/lib/sync/schemas.ts:119–128`

```zod
const createShiftSchema = z.object({
  schedule_shift_id: uuid,
  shift_date: isoDate,
  start_time: isoTime,
  end_time: isoTime,
  workspace_id: uuid,
  role: z.string(),
}).catchall(z.unknown());
```

**Plan:**
1. **Phase 3b** — remove `create_shift` from action-map OR stub with deprecation warning
2. **Schemas.ts** — mark `createShiftSchema` with `@deprecated("Use BFF /api/mobile/shifts instead")`
3. **Migration period** — if any queued `create_shift` actions exist in production, process them before drop (unlikely; queue never populated due to offline requirement)

---

## 6. Punch Flow End-to-End Trace

### 6.1 Mobile Punch-In Flow

```
[Employee Tap "Stemple inn"]
  ↓
punch-clock.tsx button handler
  ↓
usePunch.punchIn(shiftId) [hooks/mutations/use-punch.ts:36–87]
  ↓
getProfileContext() → {profileId, workspaceId}
  ↓
Generate timeEntryId (UUID) + now timestamp
  ↓
enqueue("punch_in", {time_entry_id, shift_id, profile_id, workspace_id, punch_in, status})
  ↓
SQLite queue write (sync/queue.ts)
  ↓
[OFFLINE-READY BOUNDARY]
  ↓
SyncWorker picks up [offline/online]
  ↓
actionMap["punch_in"](payload)
  ↓
fromOtherSchema("timesheet", "time_entry").insert(payload)
  ↓
Supabase → timesheet.time_entry INSERT
  ↓
[Postgres trigger? — check for shift_lifecycle_v1 trigger]
  ↓
emit({event: "shift punched_in", ...})
  ↓
[Telemetry → engine_event, activity_trail]
```

### 6.2 Key Triggers & Handlers (Postgres-side)

**Expected triggers (from ADR-0095 reference):**
- `shift_lifecycle_v1` — on `time_entry` status change from `NULL/pending` to `clocked_in`
  - Should trigger: `shift_hour_interpretation` derivation
  - Should update: `department_session.active_profile_count`

**Known broken bits:**
- **L-0021 (Absence approval prerequisite)** — absence transitions never happen; workflows waiting for approval signal blocked indefinitely
- **L-0020 (Shift lock enforcement)** — mobile writes bypass DB-level shift-lock checks; can punch-in on locked dates
- **Break validation missing** — no Postgres check for Aml §10-9 (minimum break duration, max continuous hours)

### 6.3 Mobile Punch-Out Flow

```
[Employee Tap "Stemple ut"]
  ↓
usePunch.punchOut(timeEntryId) [hooks/mutations/use-punch.ts:96–145]
  ↓
getProfileContext() → {profileId, workspaceId}
  ↓
Fetch activeEntry from cache → shiftId
  ↓
Calculate workMinutes = (now - punch_in) / 60_000
  ↓
enqueue("punch_out", {time_entry_id, punch_out, status: "completed"})
  ↓
[SQLite → sync queue]
  ↓
[OFFLINE-READY]
  ↓
SyncWorker → actionMap["punch_out"]
  ↓
fromOtherSchema("timesheet", "time_entry").update({punch_out, status}).eq("time_entry_id", ...)
  ↓
emit({event: "shift punched_out", entity_id: shiftId, data: {work_minutes, ...}})
  ↓
[Expected: shift_lifecycle_v1 trigger fires → Interpretation layer derives hours]
```

**Critical Issue:** `work_minutes` is calculated client-side (line 107–108 in use-punch.ts) and passed to telemetry. If offline for 2 hours, mobile calculates `work_minutes=120`. Server should re-derive from `(punch_out - punch_in)` to prevent manipulation.

---

## 7. Vaktliste (Shifts List) Rendering & UX

### 7.1 Components

| Component | File | Rendering Logic |
|-----------|------|---|
| **List** | `apps/mobile/app/(app)/(shifts)/index.tsx:95+` | `useMyShifts()` → group by week → render WeekGroup sections |
| **Week header** | `index.tsx:160+` | Shows week# + date range ("1. jan — 7. jan") |
| **Shift card** | `components/shift/ShiftCard.tsx` | Role, time, employee name, status pill, colleague avatars |
| **Status pill** | ShiftCard | Maps shift.status → pill color + label |
| **Empty state** | `index.tsx:~200+` | "Du har ingen vakter denne uka" + tap calendar CTA |
| **Swap inbox** | `index.tsx:~150+` | Renders `SwapInboxCard` for pending swap requests |

### 7.2 Status Pills

**Current logic** (ShiftCard):
- Reads `shift.status` column directly
- No derivation from `time_entry` punch state

**Missing:**
- Derive active status from `time_entry.punch_in IS NOT NULL AND punch_out IS NULL`
- Show "pause" indicator if breaks array has open entry
- Show "late" warning if current time > shift.start_time + threshold
- Show "no-show" if shift started but no punch

### 7.3 Filtering & Sorting

**Existing filters:**
- **Time range:** next 7 days (hardcoded in use-my-shifts.ts:73–75)
- **Publication:** `is_published=true` only (line 81)

**Missing (per plan § 3.2):**
- Filter chips: "i dag" (today), "uke" (week), "måned" (month)
- Sort toggle: earliest first vs latest first
- Role filter
- Status filter (upcoming, active, completed)

### 7.4 Error States

**Current:**
- If `useMyShifts` fails, entire list shows loading spinner indefinitely
- No error toast or retry button

**Missing:**
- "Kunne ikke hente vakter. [Retry]" toast on failure
- Graceful fallback to cached data if available (MMKV in use-my-shifts.ts:24–35 implements this but UI never surfaces the failure)

---

## 8. Pre-Existing Learnings & ADRs (Constraint Summary)

### 8.1 Critical ADRs for Shift Authoring

| ADR | Title | Constraint | Impact on Polish |
|-----|-------|-----------|---|
| **ADR-0132** | Mobile thin client via web BFF | Mobile AI/capability traffic → web BFF, never direct | Shift-create must NOT bypass BFF; shift-create is a capability verb (D1 planning, C4 authority required) |
| **ADR-0133** | Web composes, mobile executes | Web: D1–D5 authoring; Mobile: D6 execution + C4 acceptance | **Shift-create is COMPOSE (D1)** → belongs on web only; mobile should NOT create, only execute (confirm/punch) |
| **ADR-0134** | Mobile telemetry contract enforcement | `workspace_id` + `actor_id` required; no empty-string fallbacks | Current: punch mutations resolve via `getProfileContext()` ✓; create-shift must do same |
| **ADR-0151** | Server-derive workspace_id + profile_id | Never trust client-asserted IDs; derive from JWT | BFF pattern: JWT → workspace scope, then resolve profileId server-side |
| **ADR-0078** | Channel guards — PII boundary | Shift-creation is "chat" channel, not voice (no voice PII) | `gateAction(..., channel: "chat")` required |
| **ADR-0204** | Gated mutation composition | Capability verbs route through `gatedMutation` | Shift-create needs `gateAction("roster.add_shift_manual")` before write |
| **ADR-0265** | Enforced deployment pipeline | Sorties merge to campaign branch via `/close-feature` | This sortie must merge via that gate |

### 8.2 Key Learnings

| Learning | Title | Implication |
|----------|-------|---|
| **L-0020** | Shift lock must be DB-canonical | Mobile writes bypass RLS; shift-lock must be Postgres trigger, not UI check |
| **L-0021** | Absence approval is prerequisite | Absence workflow incomplete; blocks any feature depending on approved-absence signal |
| **L-0056** | Optimistic cache proposed-branch silent staleness | Mobile optimistic cache updates may diverge from server; sync conflicts not handled |
| **L-0057** | `gatedUpdate` entity_id column zero-row trap | Confirm-shift / approval mutations must use correct PK; migration L-0057 warns of this |
| **L-0058** | Client-asserted profile_id is forgeable audit actor | Mobile must NEVER accept `profileId` from user input; resolve from auth only |

### 8.3 Shift Lifecycle Architecture (ADR-0095)

**Five-layer model:**
1. **Reality (D6):** `time_entry` + punch events
2. **Interpretation (D6 derived):** `shift_hour_interpretation` (in-flight; not yet deployed)
3. **Derivation (C3):** `shift_cost_snapshot` + tariff rules
4. **Decision (C1):** `shift_approval` + `daily_reconciliation`
5. **Execution (D6 commitment):** `schedule_shift` + `department_session`

**Consequence:** Mobile writes to layer 1 (time_entry) and layer 5 (schedule_shift) but never to layers 2–4. Interpretation happens server-side via trigger.

---

## 9. Known Gaps & Missing Pieces

### 9.1 Architecture Gaps

| Gap | Impact | Mitigation |
|-----|--------|-----------|
| **No BFF for `/api/mobile/shifts`** | Mobile shift-create has no server-side gate or validation | Phase 3a must build BFF route to wrap `addShiftAction` |
| **Mobile useShiftClock equivalent (web)** | Web has no punch-in/out capability; only shift-clock admin view | Not in scope per ADR-0133 (web composes, doesn't execute) |
| **No punch-flow on web** | Web managers cannot punch in/out for staff; only time-entry override exists | Intentional per ADR-0133; punch is floor-worker D6 verb |
| **Shift-detail divergence** | Mobile detail ≠ web shift-modal; fields and mutations differ | Phase 3c polish should sync schemas |
| **Absence approval missing** | Mobile requests absence but no flow to approve/reject (L-0021) | Blocks smart-cover feature; separate ticket required |

### 9.2 Schema/RLS Gaps

| Gap | Risk | Status |
|-----|------|--------|
| **`schedule_shift.day_category` derivation on mobile** | Device tz ≠ workspace tz → wrong tariff bucket for night/weekend premium | Pre-existing; will fix in Phase 3b |
| **Break validation (Aml §10-9)** | No min-duration check; no max-continuous-hours check | Not in scope; separate legal-compliance ticket |
| **Shift-lock enforcement** | Mobile can punch on locked dates (RLS bypassed) | Per L-0020, fix in DB trigger not UI |
| **Time-entry RLS** | Can mobile see colleagues' `time_entry` rows? If not, punch deduction calc breaks | Needs audit; not in plan scope |

### 9.3 UI/UX Gaps

| Gap | Severity | Phase |
|-----|----------|-------|
| **Error states on vaktliste** | HIGH | Phase 3c (polish) |
| **Filter chips (today/week/month)** | MEDIUM | Phase 3c |
| **Confirmation modals for destructive actions** | MEDIUM | Phase 3c |
| **Break duration picker** | LOW | Post-polish (nice-to-have) |
| **GPS location capture on punch** | LOW | Separate sortie per ADR-0136 |

### 9.4 Telemetry Gaps

| Gap | Issue | ADR |
|-----|-------|-----|
| **`work_minutes` client-calculated** | Can be forged offline → incorrect reconciliation | ADR-0134 runtime assertion catches missing IDs, not wrong values |
| **Break entries not individually logged** | Cannot audit which breaks were disputed/contested | Design gap; break should emit as separate events |
| **`override_reason` not emitted on mobile** | Manager cannot override availability signal on mobile (no field in create-shift form) | By design per ADR-0133 (mobile doesn't compose) |

---

## 10. Punch Flow Breakdown: Known-Broken Bits

### 10.1 Before Sync

| Component | Issue | Severity |
|-----------|-------|----------|
| **Punch-in UI feedback** | No toast/haptic on local enqueue (user not sure if submitted) | MEDIUM |
| **Punch-out validation** | No warning if shift hasn't started yet (punch-out before punch-in) | LOW |
| **Break overlap** | No client-side validation for overlapping break periods | MEDIUM |
| **SyncWorker hung** | If queue.ts worker crashes, punches never sync (no monitoring) | HIGH |

### 10.2 During Sync

| Component | Issue | Severity |
|-----------|-------|----------|
| **Duplicate punch handling** | If network retries, same punch_in might insert twice (no idempotency check) | MEDIUM |
| **Partial break array sync** | If breaks JSONB is corrupted mid-sync, array becomes invalid | LOW |
| **RLS on time_entry insert** | Anonymous/expired JWT → insert fails silently (queue poison) | MEDIUM |

### 10.3 After Sync

| Component | Issue | Severity |
|-----------|-------|----------|
| **Shift-lifecycle trigger missing/broken** | Postgres trigger doesn't exist or doesn't fire → no `shift_hour_interpretation` created | HIGH |
| **Active time-entry cache stale** | After punch_out syncs, mobile cache not invalidated → shows "still clocked in" | MEDIUM |
| **Telemetry duplication** | Mobile emits on local punch, then again on Postgres trigger → two events | MEDIUM |

### 10.4 Post-Sync Reconciliation

| Component | Issue | Severity |
|-----------|-------|----------|
| **No reconciliation UI on mobile** | Employee cannot dispute hours; must go to web | By design (D6 execution only) |
| **Tariff miscalc if tz drifts** | Mobile punch_in timestamp in device tz, but `shift_date` in workspace tz → overlap window | HIGH |
| **Manager approval missing** | No "Godkjenn timer" flow on mobile for overrides | By design |

---

## 11. Summary Table: 10 Critical Deltas

Below are the 10 most load-bearing differences between mobile local creation and web canonical paths:

| # | Delta | Mobile | Web | Confidence | Fix Phase |
|---|-------|--------|-----|------------|-----------|
| **1** | **Day-category derivation** | Client-side (device tz) | Server-side (workspace tz) | HIGH | 3b: remove client derivation, fetch tz from BFF |
| **2** | **Reason audit field** | Missing | Required; min 8 chars | HIGH | 3b: add textarea to create form |
| **3** | **Source attribution** | Absent | `source='manual_admin'` | HIGH | 3a/3b: BFF adds source field |
| **4** | **Published flag** | Always `false` | Always `true` | HIGH | 3a/3b: BFF sets is_published=true |
| **5** | **Authority gate** | None (direct enqueue) | C4 `roster.add_shift_manual` gate | HIGH | 3a: BFF calls gateAction before insert |
| **6** | **Telemetry emit** | Local (mobile app) | Server-side (add-shift-action) | MEDIUM | 3a: BFF must emit, not mobile |
| **7** | **ProfileId derivation** | Implicit from auth (punch) / input (create) | Explicit from session auth | MEDIUM | 3b: mobile form must select employee; web has picker |
| **8** | **Workspace tz handling** | None; device tz used | Fetched + fallback to Europe/Oslo | HIGH | 3a/3b: BFF provides tz for client |
| **9** | **Department validation** | Client input trusted | Server-side cross-workspace check | MEDIUM | 3a: BFF validates department scope |
| **10** | **Work-minutes calculation** | Client-side (punch-out) | Derived server-side from timestamps | MEDIUM | 3a: BFF re-derives from time_entry timestamps |

---

## 12. Recommendations for Phase 1 (Lovsen Review)

**Questions for legal counsel (ADR Phase 1):**

1. **Aml §14-6 (audit trail for manual shifts):** Is "notes=reason" sufficient, or must we capture WHO (profile_id of creator), WHEN, and WHY in a structured `activity_trail` row?

2. **Aml §10-2 (clock-in/out registration):** Is mobile punch-in sufficient, or must we also capture location + device + GPS?

3. **Aml §10-9 (pause registration):** The mobile break-array is opaque JSONB. Must we track min-pause-duration per shift? Daily total? Continuous-work-hour limits?

4. **Riksavtalen §3 (evening/night/weekend premium):** If mobile device tz ≠ workspace tz, which timezone controls the tariff bucket? (E.g., manager in OSL working on shifts for crew in NYC — should 23:30 NYC punch land in "night" per NYC tz or "evening" per OSL tz?)

5. **Override flow (manager assigns unavailable person):** What audit trail is required? Is the `override_reason` string in telemetry sufficient, or must we log the underlying availability-rule+signal that was overridden?

6. **C4 governance (roster.add_shift_manual capability):** Should mobile users have this capability at all, or is it web-admin-only by design?

---

## 13. Files Referenced

### Mobile Shift System
- `apps/mobile/src/hooks/mutations/use-create-shift.ts` — shift creation enqueue
- `apps/mobile/src/hooks/mutations/use-punch.ts` — punch in/out enqueue
- `apps/mobile/src/hooks/shift-clock/useShiftClock.ts` — state machine + break logic
- `apps/mobile/app/(app)/(shifts)/create.tsx` — shift form UI
- `apps/mobile/app/(app)/(shifts)/index.tsx` — vaktliste rendering
- `apps/mobile/app/(app)/(home)/punch-clock.tsx` — punch UI
- `apps/mobile/src/lib/sync/action-map.ts` — offline action handlers
- `apps/mobile/src/lib/sync/schemas.ts` — payload validation schemas

### Web Canonical Paths
- `apps/web/src/app/dashboard/_actions/add-shift-action.ts` — shift creation (canonical)
- `apps/web/src/app/dashboard/_hooks/use-roster.ts` — roster list query
- `apps/web/src/app/dashboard/schedule/_hooks/use-employee-roster.ts` — roster pattern CRUD

### Decision & Learning Artifacts
- `docs/decisions/0132-mobile-thin-client-via-web-bff.md` — BFF pattern
- `docs/decisions/0133-web-composes-mobile-executes.md` — verb boundary
- `docs/decisions/0134-mobile-telemetry-contract-enforcement.md` — telemetry enforcement
- `docs/decisions/0095-shift-lifecycle-five-layer-architecture.md` — shift layers
- `docs/learnings/0020-shift-lock-multi-channel-enforcement.md` — lock architecture
- `docs/learnings/0021-absence-approval-prerequisite.md` — blocking dependency
- `docs/plans/PLAN-shift-system-polish.md` — this sortie's plan

---

## 14. Confidence Tags

- **HIGH** — code traced directly from both mobile + web files; no inference
- **MEDIUM** — one side traced, other inferred from schema/type signatures
- **LOW** — pattern assumed from ADR text or design intent; code not yet written

---

**END OF AUDIT**

Last updated: 2026-05-04
Prepared for: Phase 1 (Lovsen Review) + Phase 2 (ADR Verification)
