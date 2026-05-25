---
title: "Sim Findings — A2: Tuesday + Thursday Schedule (Bella Vista)"
created: 2026-05-25
agent: A2
slice: Tue+Thu schedule
status: complete
tags: [simulation, schedule, absence, sick-call, publish, tariff, mobile]
---

# Agent 2 Findings — Tuesday + Thursday Schedule

## Summary

Traced the full Tuesday schedule-creation flow (Erik creates Week 22 shifts, assigns roles, publishes) and the Thursday sick-call cascade (Sofia absent, replacement suggested, Kim accepts). The batch-publish path in `BatchActionBar` bypasses the `PublishOverviewDialog` cascade-rule gate entirely, meaning Erik can publish all 18 shifts without any Riksavtalen framework validation. The absence-popover writes ISO timestamps into DATE columns, producing an off-by-one-day bug for Oslo shifts created after 22:00 UTC. Two Botsson read tools (`getShiftColleagues`, `getShiftDetail`) use the wrong PK column (`id` instead of `schedule_shift_id`) and will silently return "shift_not_found" on every query. Most critically, the Thursday cascade flow has no UI implementation for replacement suggestions: there is no Botsson-driven "who can cover?" surface wired from absence creation, and no `schedule.shift.cancelled` event registered in the telemetry registry.

---

## NEW Bugs

### BUG-A2-1 — `BatchActionBar` bypasses cascade rule validation on batch publish 🔴 HIGH

**Where:** `apps/web/src/app/dashboard/schedule/_components/batch-action-bar.tsx:39-50`

**What:** `handlePublishAll()` calls `publishShifts.mutate(draftIds)` directly — it does NOT open `PublishOverviewDialog` (which calls `usePublishValidation` → `evaluateFrameworkRules`). The dialog path in `page.tsx` uses `setOnPublishAll` / `setScheduleDraftCount` to trigger the gated dialog, but `BatchActionBar` short-circuits that entirely.

**Impact:** Manager selects multiple days → "Publiser alle" → all 18 shifts publish immediately with no Riksavtalen (kveldstillegg, helgetillegg) framework validation. Violations silently slip through. Compliance gap for Aml §14-6 and tariff rules.

**Fix:** Route `handlePublishAll` through the `PublishOverviewDialog` gate (same path as `DashboardShell`'s `onPublishAll` callback in `page.tsx:750-774`) instead of calling `publishShifts.mutate` directly.

**Evidence:** `batch-action-bar.tsx:47` vs `publish-overview-dialog.tsx` which explicitly calls `usePublishValidation`.

---

### BUG-A2-2 — `absence-popover` writes ISO timestamp into `DATE` columns — off-by-one after 22:00 UTC

**Where:** `apps/web/src/app/dashboard/schedule/_components/absence-popover.tsx:62-70`

**What:** `nowStr = new Date().toISOString()` produces a TIMESTAMPTZ string (e.g. `2026-05-25T22:30:00.000Z`). This is passed as `startDate` and `endDate` to `createAbsence.mutate()`. The mapper `toDbAbsenceInsert` writes them to `schedule_absence.start_date` / `schedule_absence.end_date` which are `DATE NOT NULL` columns (`20260301600003_schedule_persistence_tables.sql:48-49`). PostgreSQL coerces to DATE in UTC — so a sick-call registered at 00:30 Oslo (22:30 UTC previous day) records yesterday's date, not today.

**Secondary issue:** `startDate` and `endDate` should derive from `absencePopover.dateId` (the cell's calendar date), not "now". An absence for Thursday should record Thursday's date regardless of when Erik clicks the popover.

**Impact:** Absence date recorded as wrong day for Oslo shifts near midnight. Payroll, SLA calculation, and absence approval UI all read `start_date`/`end_date` — a wrong date means the absence disappears from the week grid.

**Fix:** Replace `nowStr` with `absencePopover.dateId` for both `startDate` and `endDate`.

---

### BUG-A2-3 — `getShiftColleagues` uses wrong PK column — always returns `shift_not_found`

**Where:** `packages/ai/src/capabilities/schedule/tools.ts:136`

**What:** First query uses `.eq("id", params.shift_id)` but the PK is `schedule_shift_id`. Compare with `getWorkspaceSchedule` (line 312) which correctly uses `schedule_shift_id`.

**Impact:** Botsson `get_shift_colleagues` tool silently returns `{"error":"shift_not_found"}` for every call. Maria asking "hvem jobber med meg?" gets an error response. Second query (line 146) also uses `.select("id, ...")` not `schedule_shift_id`.

**Fix:** `.eq("schedule_shift_id", params.shift_id)` (line 136) + `select("schedule_shift_id, ...")` (line 146).

---

### BUG-A2-4 — `getShiftDetail` uses wrong PK column — always returns `shift_not_found`

**Where:** `packages/ai/src/capabilities/schedule/tools.ts:243`

**What:** Same class as BUG-A2-3. `.eq("id", params.shift_id)` should be `.eq("schedule_shift_id", params.shift_id)`. `select` also uses `"id, ..."` instead of `"schedule_shift_id, ..."` (line 241).

**Impact:** `get_shift_detail` tool returns `shift_not_found` for every shift UUID. Manager asking Botsson for detail on a specific shift always gets an error.

**Fix:** `.eq("schedule_shift_id", params.shift_id)` + update `select` to use `schedule_shift_id`.

---

## NEW Gaps

### GAP-A2-1 — No `schedule.shift.cancelled` event in telemetry registry

**Where:** `packages/telemetry/src/registry.ts` (entire file)

**What:** The simulation plan (SIMULATION-PLAN.md §Thursday step 2) expects `schedule.shift.cancelled` event when Erik marks Sofia absent. Grep confirms: `shift_swap.cancelled` and `shift_offer.cancelled` exist but `schedule.shift.cancelled` (or `shift.cancelled`) is absent from the registry. `use-absences.ts` emits `absence created` on `useCreateAbsence` but never emits a shift cancellation event.

**Impact:** Thursday sick-call creates an absence row but does not fire the event that would trigger downstream cascade: no push notification to Sofia, no engine_process step, no audit trail for the shift's removal from service.

**Fix:** Register `schedule.shift.cancelled` in `packages/telemetry/src/registry.ts`; wire emit in `useCreateAbsence.onSuccess` after the absence row is confirmed (if the absence auto-cancels the shift), OR in a new `useCancelShift` mutation.

---

### GAP-A2-2 — No replacement suggestion UI after absence creation

**Where:** No file — feature does not exist

**What:** SIMULATION-PLAN.md §Thursday step 3: "System suggests replacements — Botsson cascade computes available employees by readiness." No such surface exists. `absence-popover.tsx` creates the absence and closes. No drawer, no suggestion list, no `query_others_availability` invocation, no readiness-ranked replacement list appears.

**Impact:** Erik registers Sofia's absence and is left with a gap in the grid and zero guidance on who to call in. In a real 18-employee bistro on a Friday evening this is the highest-friction moment of the week. Manager must manually scroll through `employee_availability` + readiness data mentally.

**Fix path:** Post-absence-creation hook that calls `query_others_availability` + `check_readiness` for employees not already scheduled on the shift's day → ranks by readiness → surfaces as Botsson chat message or a "Finn erstatter" panel in the schedule grid.

---

### GAP-A2-3 — Tariff floor not displayed per shift during creation

**Where:** `apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx` and `week-grid-header.tsx:20`

**What:** Comment in `week-grid-header.tsx:20` reads "Real rates come from tariff_rate_table — this is display-only." No tariff supplement breakdown (kveldstillegg after 18:00, helgetillegg, nattillegg) is shown to Erik when he creates a 16:00–23:00 shift for Sofia. `usePublishValidation` evaluates framework rules at publish time but there is no inline cost/tariff preview in the shift creation modal.

**Impact:** Erik creates 18 shifts without knowing cost implications. He publishes and only then sees "blocked" warnings. Real Bella Vista managers check tariff cost while building the schedule (it directly affects labor budget).

**Fix path:** Wire `useEmployeeRuleContext` + `supplement_rule` rates into the shift modal as a read-only cost estimate panel.

---

### GAP-A2-4 — Kim accept/decline flow is marketplace, not absence-replacement

**Where:** `packages/ai/src/capabilities/shift_marketplace/` vs absence flow

**What:** The simulation Thursday step 6 expects "Erik assigns Kim to cover → accept/decline flow on mobile." The existing `shift_marketplace` capability supports open-shift claim flows, and `shift-swap` supports bilateral swaps. Neither is specifically wired as an absence-replacement "cover request" flow where Erik assigns Kim and Kim gets a mobile push to accept/decline. Assigning Kim via drag-drop in the schedule grid (`useMoveShift`) is silent — no notification, no acceptance required.

**Impact:** Kim gets her shift moved without notification or consent. In Norway this is legally problematic (Aml §14-6 requires reasonable notice for schedule changes). A "cover request with accept/decline" flow does not exist.

**Fix path:** New capability tool `request_coverage` that creates a marketplace offer targeting a specific employee, with push notification (OneSignal) and accept/decline surface in mobile shift view.

---

### GAP-A2-5 — Mobile day-line uses `shift_session` data but shift notification landing page missing

**Where:** `apps/mobile/app/(app)/(calendar)/day/[date].tsx`

**What:** Maria's "sees shifts on mobile app, day-line view" (Tuesday step 6) works via `useShiftSession` + `useDayLineItems` per ADR-0367. However when Maria receives a push notification for her newly published shift, there is no deep-link target that opens the specific shift card on the day-line. The day `[date].tsx` page shows session data but there is no route that accepts a `shift_id` parameter and scrolls to that shift.

**Impact:** Push notification → Maria taps → opens mobile app home screen, not the shift. She must navigate manually. Defeats notification UX.

**Fix path:** Add `shift_id` query param support to `day/[date].tsx` + scroll-to on mount.

---

## References to existing BUGS.md

- **BUG-19 (Cascade UI 8/18 fail):** The `usePublishValidation` cascade validation that BUG-A2-1 shows is bypassable is itself partially broken per BUG-19. Both issues compound.
- **BUG-4 (Slot quickadd popover broken):** Related to absence-popover triggering mechanism — both use programmatically controlled popovers from grid cells.
- **BUG-18 (Day-line: 8 skip, 2 fail):** GAP-A2-5 (no shift deep-link) is related to the broader day-line data gap BUG-18 identified.
- **BUG-20 (Helpdesk SLA: 0/4 PASS):** Thursday step 4 (Erik opens helpdesk query to Sofia) will fail if BUG-1 (`engine_authority_config` missing for `communication`) is still open — helpdesk_query capability seed depends on the same authority config family.
- **BUG-22 (Journey-shift: 6/16 fail):** GAP-A2-3 (tariff not displayed) compounds with BUG-22's `schedule_shift.status` enum drift — if status is wrong, publish-validation receives wrong shift set.

---

## Industry-intel commentary

A Norwegian bistro manager building an 18-person Week 22 schedule is doing one thing above everything else: playing offense against tariff cost before the week starts. Kveldstillegg (Riksavtalen §6 — 26% after 21:00, escalating to 50% after 00:00) and helgetillegg (45% Sat/Sun) mean a 16:00–23:00 Saturday shift costs 35-40% more than the same shift on Tuesday. Smartout currently shows no per-shift tariff estimate during creation (GAP-A2-3), and worse, allows batch-publishing all 18 shifts without any validation run (BUG-A2-1). The result is Erik building a schedule on gut feel and discovering Riksavtalen violations at publish time — exactly what the system is supposed to prevent.

The Thursday sick-call scenario is where the real differentiation lives. Every hospitality manager has experienced the 14:00 Friday call from the cook who's sick for the 16:00 service: you have two hours to fill a hole. The current system records the absence but drops the manager at a blank grid. What a world-class WFM product does here is rank available replacements by (1) readiness %, (2) hours already worked this week (overtime risk), (3) availability preference, (4) travel distance. Smartout has all four data sources — `protocol_assignment`, `employment_contract.agreed_weekly_hours`, `employee_availability`, and profile location — but they are not assembled into a replacement surface (GAP-A2-2). This is not a nice-to-have; it is the highest-value 30 seconds in the manager's week.

Kim's accept/decline flow (GAP-A2-4) is also legally load-bearing. Under Aml §14-6 employees must be given reasonable notice of schedule changes. Silently moving Kim's shift via drag-drop without consent is non-compliant. The marketplace capability exists and is well-built — the gap is wiring it to the absence-replacement use case. A `request_coverage(shift_id, target_profile_id, expiry_minutes)` tool that creates a time-boxed offer, fires a push to Kim's mobile, and waits for accept/decline before updating the grid would close this compliance gap and create a workflow that managers in pilot will immediately recognise as "the thing we needed."