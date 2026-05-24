---
title: "Agent 3 — Wed/Fri/Sat Employee Simulation Findings"
created: 2026-05-25
agent: A3
slice: Wed+Fri+Sat employee
status: complete
tags: [simulation, employee, mobile, shift-clock, deviation, tips, training]
---

# Agent 3 — Wed/Fri/Sat Employee Simulation Findings

**Persona:** Maria (trainee) + floor veterans at Bella Vista, 18-employee Oslo bistro.
**Slices:** Wednesday (Maria's first solo), Friday (busy service + deviation), Saturday (tips + training).
**Method:** Code trace via file:line — no fabrication. All findings are NEW (not in BUG-1..22).

---

## CRITICAL bugs

### NEW-BUG-A — GPS guard built but never called — `gps_verified: false` hardcoded in telemetry

**Classification:** Bug (implementation exists but is disconnected)
**Severity:** High — silent compliance gap

**Trace:**
- `useGPSGuard` hook exists at `apps/mobile/src/hooks/shift-clock/useGPSGuard.ts:75` — fully implemented with `expo-location`, permission request, 10s timeout, and geofence check via `calculateGPSDistance`.
- `usePunch.punchIn()` at `apps/mobile/src/hooks/mutations/use-punch.ts:44` does NOT call `useGPSGuard.getPosition()`. It enqueues directly at line 59. GPS coordinates are never collected.
- The optimistic cache write at line 71 sets `punch_in_location: null` unconditionally.
- Telemetry emit at line 87 hardcodes `gps_verified: false, gps_distance_meters: null` — so the audit trail always claims GPS was not checked, even when the workspace has GPS required.
- `ShiftClockView.tsx:111` calls `punchIn(shiftForPunch.schedule_shift_id)` — no GPS config passed, no pre-punch position fetch.
- `PunchAnimation.tsx:60` shows "GPS-posisjon" scan step to the user — purely cosmetic, no actual GPS call.

**Impact:** Maria sees "Sjekker GPS..." animation and believes her location was verified. It was not. Workers can punch in from anywhere. Shift-clock-guide domain docs confirm this at `docs/domains/shift-clock/GAPS-AND-DEBT.md:34-38` (G1 + G2).

**What's needed:** Call `useGPSGuard.getPosition()` before `enqueue("punch_in", ...)`, pass the snapshot to the payload, and set `gps_verified: true` in the emit when within geofence. Also requires `shift_clock_config.gps_reference_lat/lng` to be seeded from department location (G6 in shift-clock gap doc).

---

### NEW-BUG-B — Session hook forms on mobile are `PlaceholderForm` — C4 confirmation never fires

**Classification:** Gap (partial implementation — hooks visible but not completable)
**Severity:** High — Wednesday allergen review hook can never be signed off

**Trace:**
- Maria opens day-line, sees session hooks (open prep, line check, allergen review). These surface as `session_task` rows with `hook_id` set.
- `TaskModal.tsx:98-113` renders by `taskType`. Switch has 5 cases. Only `"haccp"` renders a real form (`HACCPForm`). Cases `"checklist"`, `"confirmation"`, `"procedure"`, and `"general"` all render `PlaceholderForm` at lines 102-112 — returns a "Kommer snart" label with no submission logic.
- Allergen review hooks are `linked_routine_id` (checklist type) or `linked_procedure_id` (procedure type) per `resolveTaskType` at `apps/mobile/src/lib/resolve-task-type.ts:28-32`. Both resolve to placeholder forms.
- The "Bekreftelse" case (`confirmation`, line 106) also hits the placeholder — this is the C4 confirmation path. When a hook fires C4, mobile cannot sign it.

**Impact:** On busy Friday with 14 staff clocked in — 14 employees cannot complete protocol confirmations on mobile. Session hooks accumulate as `pending` forever. Day-line on web shows uncompleted hooks as a blocker on session close. Manager cannot close the session if hooks require completion.

**What's needed:** Implement `ChecklistView`, `ConfirmationForm`, `ProcedureForm`, and `GenericTaskForm` components and wire them into the `renderForm` switch. This is Sortie scope, not a config change.

---

### NEW-BUG-C — Tips capability (`tips.set_pot`, `.adjust_share`, `.approve_distribution`) are Sortie 1 skeletons — all return `not_implemented`

**Classification:** Gap (skeleton shipped to registry, bodies not built)
**Severity:** High — Saturday tip distribution entirely non-functional

**Trace:**
- `packages/ai/src/capabilities/tips/tools.ts:46-53` — `tipsSetPotTool.execute` returns `{ ok: false, error: "not_implemented", note: "Skeleton — body lands in Sortie 2 tips-leader-flows" }`.
- Same pattern for `tipsAdjustShareTool` (line 69) and `tipsApproveDistributionTool` (line 90).
- `tipsQueryOwnShareTool` (line 118) — employee read tool — also `not_implemented`.
- DB schema is fully built (`tip_pool`, `tip_distribution` migrations at `20260428220003` + `20260428220004`), RLS policies set, authority seeds at `20260428100007` applied.
- Intent classifier at `packages/ai/src/capabilities/registry.ts:82` routes to `tipsCapability` — meaning Botsson will accept tip-related queries, run the gate, and return `not_implemented` with no user-visible error explanation.

**Impact:** Erik (manager) asks Botsson on Saturday evening: "Sett tipspotten til 1200 kr for i dag." Botsson accepts the intent, passes the gate, and returns `not_implemented` in JSON. If the BFF/stage-engine converts this to a 200 response, Erik sees no error — the tip pool was never created. Maria and her colleagues cannot see their share. Payroll period closes without tip data.

**What's needed:** Sortie 2 (tips-leader-flows) bodies must be built before Saturday tipping is usable. Until then, add a user-facing error string: "Tipspott-funksjonen er ikke tilgjengelig ennå."

---

## HIGH gaps

### NEW-GAP-D — `AfterShiftView` shows estimated earnings using hardcoded 220 kr/hour, not contract rate

**Classification:** Bug / misleading UX
**Severity:** Medium

**Trace:**
- `apps/mobile/src/components/home/AfterShiftView.tsx:51`: `const HOURLY_RATE_FALLBACK = 220;`
- `apps/mobile/src/components/home/AfterShiftView.tsx:128`: `const estimatedNok = useMemo(() => formatNok(workedH * HOURLY_RATE_FALLBACK), [workedH]);`
- `apps/mobile/src/components/home/DuringShiftView.v2.tsx:62`: same `HOURLY_RATE_FALLBACK = 220` constant, same pattern at line 160.
- No query to `employee_payroll_profile.hourly_rate` or `tariff_rate_table` in either component.

**Impact:** Maria works Friday night (18:00–02:00), 8 hours. App shows her "Du har tjent ~1 760 kr." Her actual Riksavtalen evening/night rate at trainee level may be 220–260 kr/h base + 30–45 kr/h evening tillegg. If she's on 225 + 38 = 263 kr/h, actual estimate should be ~2 104 kr. The 344 kr gap is significant on a busy Friday and misleads her expectations before oppgjør.

**What's needed:** Fetch `employee_payroll_profile.hourly_rate` (or tariff floor via D3 resolution) and use it instead of the static fallback. At minimum, add "Dette er kun et estimat" disclaimer to the UI.

---

### NEW-GAP-E — Cash count discrepancy on Friday does NOT auto-create deviation — manual step required

**Classification:** Gap (spec intent vs implementation)
**Severity:** Medium

**Trace:**
- `Step03Kontanttelling.tsx:58-63` computes `cash_count_variance` and passes it upstream via `onNext({ cash_count_denominations, cash_count_total, cash_count_variance })`.
- `Step04Avvik.tsx` receives `deviations: Step04DeviationSummary[]` from the parent — a pre-fetched list. It does NOT auto-create a deviation row based on the `cash_count_variance` from Step03.
- `AdminOverrideSheet.tsx:25` lists `"no_cash_count"` and `"open_deviation"` as blocker codes — implying the system distinguishes between "no cash count done" and "deviation exists" but does NOT infer one from the other.
- No migration or trigger creates a `deviation` row when `cash_count_variance` exceeds `financial_close_config.tolerance_value` (the config table at `20260328120100` has `tolerance_value` but no trigger reading it).

**Impact:** Friday cash count shows 340 kr discrepancy. Erik proceeds through the wizard. No deviation is auto-created. Manager sign-off expected by the spec ("cash count discrepancy → deviation + manager sign-off") never happens because the deviation row does not exist. The `Step04Avvik` screen shows "Ingen registrerte avvik i dag."

**What's needed:** When `cash_count_variance` exceeds `financial_close_config.tolerance_value`, auto-create a `deviation` row (domain=`material`, severity based on variance magnitude) during reconciliation wizard Step 03→04 transition. Wire through the `report_deviation` sync action or BFF call.

---

### NEW-GAP-F — Mobile deviation resolution not available — manager cannot sign off deviations on mobile

**Classification:** Gap (web-only capability)
**Severity:** Medium — Friday scenario blocks end-of-night close

**Trace:**
- `update-deviation-action.ts:134` — `hms.resolve_deviation` capability exists as web Server Action, gated at authority level `confirm`.
- `update-deviation-action.ts:216` — `hms.acknowledge_deviation` also web-only Server Action.
- Mobile `apps/mobile/src/lib/sync/types.ts:14` — `"report_deviation"` is in write actions. No `"resolve_deviation"` or `"acknowledge_deviation"` write action exists.
- Mobile `apps/mobile/src/lib/sync/action-map.ts` — `report_deviation` entry at line 78 (create only). No resolve/acknowledge entry.
- Searching mobile components confirms: no `ResolveDeviationButton`, no `AcknowledgeDeviationSheet`.

**Impact:** Friday — POS terminal failure logged as deviation (severity: high). End of shift, manager Erik is on the floor, phone in hand. He cannot resolve the deviation on mobile. The reconciliation wizard Step04 shows the open deviation but has no "Lukk avvik" action — only a text note field. The blocker `open_deviation` prevents session close until web is opened.

**What's needed:** Add `resolve_deviation` to mobile write actions + BFF route `/api/mobile/deviations/:id/resolve`. This unblocks in-service floor management.

---

### NEW-GAP-G — `settle_shift` is system-only — no employee or manager can trigger end-of-shift settlement via mobile or chat

**Classification:** Design gap / missing surface
**Severity:** Medium

**Trace:**
- `packages/ai/src/capabilities/shift-lifecycle/tools.ts:541`: `if (channel !== "system") return "settle_shift kan kun kalles fra system-kanal."` — channel guard blocks chat + voice.
- `settle_shift` is exclusively triggered by automated pipelines. No web UI hook, no mobile trigger, no Botsson chat path for a manager to manually request settlement for a specific shift.
- The `daily_close` engine process seeds a `lock_checkout` step at `20260304300000_seed_daily_close_process.sql:52` — this is the only settlement trigger.

**Impact:** Friday — 14 staff clock out by 02:00. One shift (Andrei, partial cover) has an unusual end time. Erik wants to manually trigger settlement for that shift before payroll cut. No path exists: `settle_shift` is system-only, the engine process runs on its scheduled cron, and there is no "settle this shift now" button on web or mobile.

**What's needed:** Add a `settlement.trigger_manual` capability at `confirm` authority level, chat-allowed, that calls the same `derive_shift_hours` RPC as `settle_shift` but on a specific shift. Surface as "Kjør oppgjør nå" button in payroll or shift detail panel.

---

## MEDIUM gaps

### NEW-GAP-H — `DuringShiftViewV2` (v2 flag off by default) — Maria sees no task timeline during service

**Classification:** Gap (feature-flagged, not shipped to production)
**Severity:** Medium

**Trace:**
- `apps/mobile/app/(app)/(home)/index.tsx:34`: `const DURING_SHIFT_V2_ENABLED = process.env.EXPO_PUBLIC_DURING_SHIFT_V2 === "true"` — defaults to V1.
- V1 (`DuringShiftView.v1`) shows minimal clocked-in state. V2 (`DuringShiftView.v2.tsx`) shows DAGENS OPPGAVER task timeline sourced from `day_line` chain via `shiftSessionId`.
- Without the flag, Maria clocks in on Wednesday and sees a generic "Du er stemplet inn" view. She has no visibility into her session hooks or tasks from the home screen — she must navigate to a separate tab.

**Impact:** On a busy floor, a trainee cannot glance at the phone and see "next task: allergen review." She must navigate, breaking flow.

---

### NEW-GAP-I — Readiness gate blocks `publish_shift` for Maria even after basic training — no partial-readiness bypass for scheduled shifts

**Classification:** Design tension (not a code bug — works as designed, but floor-hostile)
**Severity:** Medium / UX

**Trace:**
- `shift-lifecycle/tools.ts:157`: `evaluateReadinessGate` calls `checkReadiness` for every non-unassigned shift. Returns `{ allowed: false, reason: "readiness_gap" }` if any policy or protocol is missing.
- Maria is `trainee` status. She has completed only the first 3 protocols on Wednesday. If Erik tries to publish her Thursday shift after Wednesday's service, but policy 4 (e.g. wine knowledge test) is still `in_progress`, `publishShift` is blocked — not just warned.
- The gate has no carve-out for "partially ready but manager has overridden" — ADR-0101 four-eyes may allow override, but `evaluateReadinessGate` fires BEFORE `mutateWithGate`, meaning the four-eyes path is never reached for readiness gaps.

**Impact:** Erik cannot publish Maria's Saturday shift until she completes wine knowledge test. On a busy week with a short training window, this creates a hard operational block. The spec (Wednesday: "Maria completes hooks, sees session") assumes she CAN be assigned to shifts while still in training — which is the entire point of trainee status.

**What's needed:** Either (a) allow `trainee` status shifts to publish with a readiness warning (not block), or (b) add a `require_full_readiness` flag to `engine_authority_config` so workspaces can choose warn vs block. The floor reality is that bistros routinely put trainees on shift while they complete training.

---

## LOW findings

### NEW-FIND-J — `session_note` rich model aspirational — Maria cannot log structured allergen handoff

**Classification:** Known gap (documented in day-session GAPS-AND-DEBT.md G12)
**Severity:** Low (existing known gap, not new)
**Note:** Not re-reported — already captured in day-session domain doc. Listed here for completeness as it affects the Wednesday end-of-shift handoff flow Maria needs (structured allergen note with action flag and next-shift visibility). Current `session_note` has 7 columns, no `is_actionable`, no `visibility`, no `priority`.

---

### NEW-FIND-K — `channel.is_active` migration staged but not applied — announcement fan-out risk

**Classification:** Ops / deployment risk
**Severity:** Low

**Trace:**
- `supabase/migrations/20260625130000_channel_is_active_column.sql` is staged (visible in `git status` A-file listing) but not yet applied locally or to production.
- If the `publish_announcement` capability's SQL queries filter on `is_active`, announcements may fail silently once the migration is applied and rows default to `NULL` rather than `true`.
- No trace of channel `is_active` usage in capability code — risk is forward-only (future code reading the column before migration is applied).

---

## Summary table

| # | ID | Type | Severity | Slice | File:line |
|---|----|----|------|-------|-----------|
| 1 | NEW-BUG-A | Bug | HIGH | Wed clock-in | `use-punch.ts:59`, `useGPSGuard.ts:75` |
| 2 | NEW-BUG-B | Gap | HIGH | Wed hooks | `TaskModal.tsx:102-112` |
| 3 | NEW-BUG-C | Gap | HIGH | Sat tips | `tips/tools.ts:46-53,69,90,118` |
| 4 | NEW-GAP-D | Bug (UX) | MEDIUM | Fri/Sat earnings | `AfterShiftView.tsx:51,128` |
| 5 | NEW-GAP-E | Gap | MEDIUM | Fri cash count | `Step03Kontanttelling.tsx:58-63`, `Step04Avvik.tsx` |
| 6 | NEW-GAP-F | Gap | MEDIUM | Fri deviation | `action-map.ts` (no resolve entry) |
| 7 | NEW-GAP-G | Gap | MEDIUM | Fri settlement | `shift-lifecycle/tools.ts:541` |
| 8 | NEW-GAP-H | Gap | MEDIUM | Wed/Fri task view | `index.tsx:34` |
| 9 | NEW-GAP-I | Design tension | MEDIUM | Wed/Fri publish | `shift-lifecycle/tools.ts:157` |
| 10 | NEW-FIND-K | Ops risk | LOW | Wed announce | staged migration |

---

## Fast-wins (cost-ordered)

| # | Finding | Cost | Unblocks |
|---|---------|------|---------|
| 1 | NEW-GAP-D (hardcoded 220 rate) | 1h — fetch payroll profile rate | Accurate post-shift earnings across all employees |
| 2 | NEW-BUG-A (GPS animation vs real check) | 2h — wire getPosition() before enqueue | Real GPS enforcement + honest telemetry |
| 3 | NEW-GAP-F (resolve deviation mobile) | 3h — BFF route + sync action | Manager can close deviations on floor without web |
| 4 | NEW-BUG-B (session hook forms) | 4h per form type | All hook completions on mobile; session close unblocked |
| 5 | NEW-GAP-E (cash variance → auto-deviation) | 2h — wizard transition logic | Cash discrepancy audit trail + manager sign-off |
| 6 | NEW-BUG-C (tips not_implemented UX) | 30min — add user-facing error | Prevents silent failure on tip queries |
| 7 | NEW-GAP-H (DuringShiftV2 flag) | 30min — enable flag + test | Task visibility on home screen during shift |
