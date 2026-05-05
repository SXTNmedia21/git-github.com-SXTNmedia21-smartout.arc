---
title: "AddSheet BFF-Wrap Coverage Audit"
status: in_progress
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [audit, addsheet, bff, server-actions, adr-0114, adr-0204, calendar]
---

# AddSheet BFF-Wrap Coverage Audit

**Sortie:** `feat/mobile-calendar-redesign` (Worktree: `/home/sxtnl/dev/smartout.ai-mobile-wt-3`)
**Date:** 2026-05-04
**Scope:** 5 type-branches (shift, task, booking, deviation, day_info)

---

## Summary table

| Type | Web Action | gateAction vs gatedMutation | Telemetry Event | Mobile Direct Insert | BFF Route | Status |
|------|-----------|----------------------------|-----------------|----------------------|-----------|--------|
| **1. Shift create** | add-shift-action.ts | gateAction (legacy) | "shift added_manual" | deprecated Phase 3b | none needed | COVERED |
| **2. Task create** | add-task-action.ts | gateAction (legacy) | "task.added_manual" | actionMap.create_task | MISSING | MISSING BFF |
| **3. Booking create** | MISSING | — | NO EVENT | actionMap ready | MISSING | CRITICAL |
| **4. Deviation report** | MISSING (client-side hook) | — | "deviation reported" | actionMap.report_deviation | MISSING | CRITICAL |
| **5. Day info create** | MISSING (client-side hook) | — | "day_info created" | actionMap.create_day_info | MISSING | CRITICAL |

---

## Detailed audit findings

### 1. Shift create

**Confidence:** High (already audited Phase 3a)

- **Web Action:** `apps/web/src/app/dashboard/_actions/add-shift-action.ts:133-275`
  - Uses `gateAction()` with capability `"roster.add_shift_manual"` (line 201-211)
  - Does NOT use `gatedMutation()` (ADR-0204) — uses legacy `gateAction()` + direct insert (line 218-238)
  - Pattern: `gate_action()` → authority check → direct admin insert
  - Per ADR-0277 §B1, this is permitted for manual roster ops (non-mutation-composition path)

- **Telemetry:** Registered
  - Event: `"shift added_manual"` (line 249)
  - Registry: `packages/telemetry/src/registry.ts`
  - Destinations: `[posthog, logger, activity_trail, engine_event]`

- **Mobile:** Deprecated Phase 3b
  - `actionMap.create_shift` (action-map.ts:143) → throws stub per sortie context

- **BFF:** None required (web action directly accessible via Server Action)

**Status:** COVERED (legacy gateAction path acceptable for manual roster via ADR-0277; telemetry registered; deprecated mobile path)

---

### 2. Task create

**Confidence:** High

- **Web Action:** `apps/web/src/app/dashboard/_actions/add-task-action.ts:38-162`
  - Capability: `"task.add_task_manual"` (line 102)
  - Uses `gateAction()` (line 100) — NOT `gatedMutation()` — legacy pattern
  - Authority gate at line 100-110
  - Direct admin insert at line 114-127
  - Server-side workspace re-derivation: ADR-0151 (line 55-63 session validation)

- **Telemetry:** Registered
  - Event: `"task.added_manual"` (line 140)
  - Emitted at line 139-159
  - Destinations: `[posthog, logger, activity_trail, engine_event]`

- **Mobile Direct Insert:** Present
  - `actionMap.create_task` (action-map.ts:146)
  - Schema: `createTaskSchema` (schemas.ts:104-109) — requires `workspace_id + department_session_id`
  - **BFF-wrap issue:** Mobile action bypasses authority gate + telemetry

- **BFF Route:** **MISSING**
  - No `/api/*/task/*` route exists to wrap the mobile `create_task` action
  - Mobile direct insert path: `supabase.from("session_task").insert(p)` (action-map.ts:146)
  - **Result:** Mobile can create tasks WITHOUT authority gate or telemetry emission

**Status:** PARTIAL
- Web action: fully gated + telemetry
- Mobile: direct insert; no BFF wrap; missing authority gate + telemetry
- **Fix required:** Add BFF route `/api/mobile/tasks/create` that applies `gateAction('task.add_task_manual')` + `emit()` before Supabase insert (or delegate to `addTaskAction` with `actor` parameter pattern from ADR-0277)

---

### 3. Booking create

**Confidence:** High (table exists, mobile queue ready, web action missing)

- **Table:** Exists
  - `schedule_day_booking` (database.types.ts from migration 20260301600003)
  - Columns: `schedule_day_booking_id, workspace_id, shift_date, booking_time, title, guest_count, status, ...`

- **Web Action:** **MISSING**
  - No `add-booking-action.ts` or equivalent in `apps/web/src/app/dashboard/_actions/`
  - No Server Action to create bookings from web dashboard
  - Confirmed: `grep -r "booking" apps/web/src/app/dashboard/_actions --include="*.ts"` returns zero matches

- **Telemetry Event:** **NOT REGISTERED**
  - No `"booking created"` event in `packages/telemetry/src/registry.ts`
  - Confirmed: `grep -i "booking\|booked" packages/telemetry/src/registry.ts` returns zero matches

- **Mobile Direct Insert:** Queue NOT ready
  - `actionMap` does NOT yet have `create_booking` entry
  - `createBookingSchema` does NOT exist in `schemas.ts`
  - **Current state:** Mobile sync can read bookings but cannot enqueue creates

- **BFF Route:** **MISSING**
  - No `/api/*/bookings/*` route exists

**Status:** CRITICAL MISSING
- **ADR violations:**
  - ADR-0114 (Server Action required for web mutations)
  - ADR-0204 (gatedMutation orchestrator composition)
  - ADR-0134 (telemetry contract)
- **Phase 3e blockers:**
  1. Create `apps/web/src/app/dashboard/_actions/add-booking-action.ts` (Server Action)
  2. Gate via `gateAction('schedule.add_booking_manual')`
  3. Register `"booking created"` event in telemetry registry
  4. Add mobile sync support: `actionMap.create_booking` + `createBookingSchema`
  5. Add BFF wrap route `/api/mobile/bookings/create`
  6. **Lovsen F-01/F-02/F-03 ADR-0267:** booking-PII access-control gate per `profile.role`

---

### 4. Deviation report

**Confidence:** High (telemetry exists, web path is client-side hook, mobile direct insert present)

- **Web Action:** **MISSING (Server Action)**
  - Current web path: **client-side hook** `useCreateDeviation()` (`apps/web/src/app/dashboard/hms/_hooks/use-create-deviation.ts:12-71`)
  - This is a **client-side `useMutation()`**, NOT a Server Action per ADR-0114
  - Direct Supabase insert at client: line 28-49 (createClient → .insert())
  - **Violates ADR-0114:** All web mutations must flow through Server Actions
  - No authority gate on web path (line 18-52 is pure client logic)
  - Telemetry emitted client-side (line 55-63) — **async void emit, no error handling**

- **Telemetry Event:** Registered
  - Event: `"deviation reported"` (line 56)
  - Registry confirmed: `packages/telemetry/src/registry.ts`
  - Destinations: `[posthog, logger, activity_trail, engine_event]`
  - **Problem:** Emitted client-side without await — may not reach backend if network fails

- **Mobile Direct Insert:** Present
  - `actionMap.report_deviation` (action-map.ts:75)
  - Schema: `reportDeviationSchema` (schemas.ts:61-65)
  - Mobile has authority gate (can sync when offline), web client-side path does not

- **BFF Route:** **MISSING**
  - No `/api/*/deviations/*` route

**Status:** CRITICAL — ADR VIOLATION
- **Main issue:** Web path violates ADR-0114 — uses client-side mutation, not Server Action
- **Secondary:** No BFF wrap for mobile path
- **Phase 3e blockers:**
  1. Create `apps/web/src/app/dashboard/_actions/report-deviation-action.ts` (Server Action)
  2. Gate via `gateAction('hms.report_deviation_manual')`
  3. Server-side `emit()` with proper async/await
  4. Add BFF wrap route `/api/mobile/deviations/report`
  5. Update web component to call Server Action instead of client-side hook

---

### 5. Day info create

**Confidence:** High (telemetry exists, web path is client-side hook, mobile direct insert present)

- **Web Action:** **MISSING (Server Action)**
  - Current web path: **client-side hook** `useCreateDayInfo()` (`apps/web/src/app/dashboard/schedule/_hooks/use-day-info.ts:113-155`)
  - This is a **client-side `useMutation()`**, NOT a Server Action per ADR-0114
  - Direct Supabase insert at client: line 124 (createClient → .insert())
  - No authority gate (line 113-136 is pure client logic)
  - Telemetry emitted client-side (line 139-146) — **async void emit, no error handling**

- **Telemetry Event:** Registered
  - Event: `"day_info created"` (line 140)
  - Registry confirmed: `packages/telemetry/src/registry.ts`
  - Destinations: `[posthog, logger, activity_trail, engine_event]`
  - **Problem:** Emitted client-side without await — may not reach backend if network fails

- **Mobile Direct Insert:** Present
  - `actionMap.create_day_info` (action-map.ts:149)
  - Schema: `createDayInfoSchema` (schemas.ts:189-194)
  - Mobile can sync day-info creation when offline

- **BFF Route:** **MISSING**
  - No `/api/*/day-info/*` route

**Status:** CRITICAL — ADR VIOLATION
- **Main issue:** Web path violates ADR-0114 — uses client-side mutation, not Server Action
- **Secondary:** No BFF wrap for mobile path
- **Tertiary:** No authority gate on web side (mobile can create freely)
- **Phase 3e blockers:**
  1. Create `apps/web/src/app/dashboard/_actions/create-day-info-action.ts` (Server Action)
  2. Gate via `gateAction('schedule.add_day_info_manual')`
  3. Server-side `emit()` with proper async/await
  4. Add BFF wrap route `/api/mobile/day-info/create`
  5. Update web component to call Server Action instead of client-side hook

---

## Classification summary

| Type | Classification | Reason |
|------|---|---|
| Shift | **COVERED** | Server Action + gateAction + telemetry + mobile deprecated |
| Task | **PARTIAL** | Web OK; mobile direct-insert lacks BFF wrap + authority gate |
| Booking | **MISSING** | No web action; no telemetry event; no BFF; table only |
| Deviation | **MISSING** | Web is client-side (ADR-0114 violation); no BFF; no authority gate on web |
| Day Info | **MISSING** | Web is client-side (ADR-0114 violation); no BFF; no authority gate on web |

---

## Blocking issues for Phase 3e

### S1-class (ADR violations)

1. **Task Create (S1-PARTIAL)** — Mobile direct insert without BFF authority gate
   - **Issue:** `actionMap.create_task` bypasses `gateAction('task.add_task_manual')` + telemetry
   - **Impact:** Mobile manager can create ad-hoc tasks without audit trail
   - **ADR violations:** ADR-0114 (no Server Action wrap), ADR-0099 (no authority gate on mobile path), ADR-0134 (no telemetry)
   - **Fix:** Add BFF route `/api/mobile/tasks/create` that gates + emits

2. **Booking Create (S1-CRITICAL)** — No web Server Action
   - **Issue:** Table exists, but zero web mutation path
   - **Impact:** Bookings cannot be created from web dashboard; AddSheet (+) button will fail for booking branch
   - **ADR violations:** ADR-0114, ADR-0204, ADR-0134, ADR-0151
   - **Dependencies:** Authority seed (engine_authority_config row); telemetry event registration; ADR-0267 booking-PII gate
   - **Fix:** Create full stack: Server Action + authority gate seed + telemetry + BFF + PII-gate

3. **Deviation Report (S1-CRITICAL)** — Web path is client-side, not Server Action
   - **Issue:** `useCreateDeviation()` at line 12-71 is async useMutation hook, not Server Action
   - **Impact:** Deviations can be reported without authority gate or reliable telemetry
   - **ADR violations:** ADR-0114 (no Server Action), ADR-0099 (no authority gate), ADR-0134 (telemetry unreliable)
   - **Fix:** Migrate web path to Server Action `report-deviation-action.ts`

4. **Day Info Create (S1-CRITICAL)** — Web path is client-side, not Server Action
   - **Issue:** `useCreateDayInfo()` at line 113-155 is async useMutation hook, not Server Action
   - **Impact:** Day-info can be created without authority gate or reliable telemetry
   - **ADR violations:** ADR-0114 (no Server Action), ADR-0099 (no authority gate), ADR-0134 (telemetry unreliable)
   - **Fix:** Migrate web path to Server Action `create-day-info-action.ts`

---

## ADR reference map

| Finding | ADR | Section | Breach |
|---------|-----|---------|--------|
| All web mutations must be Server Actions | ADR-0114 | "Server Action Normative" | Deviation, Day Info use client-side hooks |
| Authority gate + cascade gate composition | ADR-0204 | Dual-gate orchestrator | No gatedMutation() used anywhere (legacy gateAction only) |
| Telemetry contract (registry + emit) | ADR-0134 | Trust Freeze gate 2 | Day Info, Deviation emit client-side (unreliable); Booking has no event |
| Server-derived workspace_id | ADR-0151 | "Trust Freeze gate 1" | All Server Actions validate session/booking workspace match; client hooks skip this |
| Authority gate placement | ADR-0099 | Unified authority gate | Mobile direct-insert paths bypass gate (Task, Deviation, Day Info) |
| Channel guard + four-eyes | ADR-0078 | Channel guards | No channel enforcement in any manual-add flow |

---

## Concrete fix roadmap

**Priority 1 (AddSheet Phase 3e blocking):**
1. Shift — already covered (keep current gateAction pattern)
2. **Booking** — Create full stack (est. 2-3 days)
   - `add-booking-action.ts` Server Action (gate + emit)
   - Authority seed: `engine_authority_config` row
   - Telemetry: register `"booking created"` event
   - BFF: `/api/mobile/bookings/create` route
   - Mobile: `actionMap.create_booking` + schema
   - PII-gate per ADR-0267 (booking.contact field)
3. **Deviation** — Migrate web path (est. 1 day)
   - New Server Action `report-deviation-action.ts`
   - Remove client-side `useCreateDeviation` hook (or retire to RQ)
   - Add BFF wrap: `/api/mobile/deviations/report`
4. **Day Info** — Migrate web path (est. 1 day)
   - New Server Action `create-day-info-action.ts`
   - Remove/retire client-side `useCreateDayInfo` hook
   - Add BFF wrap: `/api/mobile/day-info/create`
5. **Task** — Add BFF wrap (est. 0.5 days)
   - BFF route `/api/mobile/tasks/create` (wraps existing addTaskAction)

**Priority 2 (post-Phase 3e):**
- Evaluate gateAction → gatedMutation migration for all 5 types (ADR-0204 adoption)
- Add channel guard enforcement (ADR-0078)
- Add four-eyes rules for sensitive deviations (ADR-0101)

---

## File references

**Web Actions:**
- `apps/web/src/app/dashboard/_actions/add-shift-action.ts` (existing, Phase 3a wt-2)
- `apps/web/src/app/dashboard/_actions/add-task-action.ts` (existing, working)
- No booking action (create needed)
- No deviation Server Action (client hook at `apps/web/src/app/dashboard/hms/_hooks/use-create-deviation.ts:12-71` must be replaced)
- No day-info Server Action (client hook at `apps/web/src/app/dashboard/schedule/_hooks/use-day-info.ts:113-155` must be replaced)

**Mobile Sync:**
- `apps/mobile/src/lib/sync/action-map.ts:143, 146, 149, 75` (create_shift deprecated, create_task/booking/day_info/report_deviation ready)
- `apps/mobile/src/lib/sync/schemas.ts:104-109, 189-194, 61-65` (schemas defined for task, day_info, deviation; booking schema missing)
- No BFF routes for mobile wrap

**Telemetry:**
- `packages/telemetry/src/registry.ts` (shift, task, deviation, day_info events registered)
- No "booking created" event registered

**Authority Seeds:**
- `20260517*_closure_authority_seed_task.sql` (task.add_task_manual)
- `20260517100000_seed_roster_add_shift_authority.sql` (roster.add_shift_manual)
- No booking authority seed (create needed)
- No deviation authority seed (create needed)
- No day_info authority seed (create needed)

---

**Audit completed:** 2026-05-04 | **Confidence:** High | **Recommendation:** Do NOT ship AddSheet Phase 3e until all CRITICAL items are resolved.
