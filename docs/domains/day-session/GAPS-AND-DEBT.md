---
title: "Day Session — Gaps & Debt"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-22
council_refs: [council-2026-05-23-tidslinje-surface-boundary]
domain: day-session
tags: [domain, day-session, gaps, debt, verified]
---

# Day Session — Gaps & Debt

> Built-vs-planned delta. Every gap cites code (file:line anchor) or roadmap. **Code wins.**

## 1. Verification method

For each item below:
- **CODE** = grepped + anchor cited.
- **JOURNEY** = roadmap/design spec describes the target.
- **GAP** = delta between CODE and JOURNEY.

---

## 2. Spec/Plan Reconciliation

### §1 Day-handoff design spec (docs/design/day-handoff/)

| Spec claim | Code status | Classification |
|---|---|---|
| 6 phases including `locked` | 5 in `department_session_status` enum; `locked` lives on `reconciliation_status`. See §4b. | **Deviation** |
| 10 canonical widgets all ported | 10 widgets exist in codebase or `@smartout/ui`. `PhaseTimeline` is `DayTimelineStrip.tsx` (dept-anchored). Full multi-strip version (area-anchored) is Phase C. | **Partial** |
| Web day-control 7 tabs | All 7 tabs exist and are shipped. | **Confirmed** |
| Mobile Home Before/During/After | `(home)/index.tsx` — 4 views (no_shift + before + during + after). Matches design intent. | **Confirmed** |
| Admin "Avstemming" (ReconView) | `/dashboard/reconciliation` is built. Called "Avstemming" in sidebar (naming-collision GAP §6). ReconSummary widget in `@smartout/ui`. | **Confirmed** (name collision flagged) |
| Slot picker 3 lanes | `SlotPicker.tsx` D6_ITEMS/D2_ITEMS/FREE_ITEMS — shipped 2026-05-17. | **Confirmed** |
| Popover anchors at click coordinate | `DayTimelineStrip.tsx` emits `onSlotClick(time, rect)`, `SlotPicker` uses `PopoverAnchor`. | **Confirmed** |
| Session-level broadcasts | `BroadcastTab.tsx` — shipped. | **Confirmed** |
| Omsetning capture (settlement_image OCR) | `process-settlement-image` EF + `validate-settlement` EF. | **Confirmed** |
| Cross-tab real-time sync | Supabase Broadcast (ADR-0334) for ephemeral presence. TanStack Query invalidation on mutations for structural state. | **Confirmed** |
| Phase auto-transitions | `session-lifecycle` EF (15 min cron): upcoming→active, active→pending_signoff, upcoming→missed. | **Confirmed** |
| Grace period for missed | `department_session.planned_open` + grace (currently hardcoded in EF logic — `now > planned_close + 2h` for missed). Design says configurable 15m per workspace. | **Deviation** — see G8 |

### §2 ADR-0367 Phase A+B (specs/2026-05-18-dagslinje-area-anchored-design.md)

| Spec claim | Code status | Classification |
|---|---|---|
| `day_line` table | `supabase/migrations/20260620120200_day_line_table.sql` | **Confirmed** |
| `shift_session` table | `supabase/migrations/20260620120300_shift_session_table.sql` | **Confirmed** |
| `shift_session_day_line` junction | `supabase/migrations/20260620120400_shift_session_day_line_junction.sql` | **Confirmed** |
| `department_location` junction | `supabase/migrations/20260620120500_department_location_table.sql` (assumed, not directly verified — see G9) | **Aspirational** |
| `day_line_status` NOT stored | `derive-day-line-status.ts` derives from `(cancelled_at, sessionStatus, reconciliationLocked)` | **Confirmed** |
| Capability seeds (`day_line.create/add_item/instantiate_template`) | `20260620120800_day_line_capability_authority_seed.sql` + `20260620120900_day_line_update_hours_authority_seed.sql` | **Confirmed** |
| `session_hook` UNIQUE constraint | `20260620120100_day_line_session_enums.sql` (constraint added per ADR-0367 Rule 1b) | **Confirmed** |
| Shift_session auto-trigger | `20260620130000_ensure_shift_session_trigger.sql` | **Confirmed** |
| ADR-0367 Phase C (UI) | `DayLineStrip.tsx`, `AggregatedDayLineList.tsx`, `OpenCloseEditPopover.tsx` exist. TimelineTab multi-strip wiring: **in flight**. | **Mixed / In flight** |
| ADR-0367 Phase D (mobile multi-area) | `useShiftSession` hook exists (`apps/mobile/src/hooks/queries/use-shift-session.ts` — referenced in home/index.tsx). Multi-area section list: **in flight**. | **Mixed / In flight** |
| ADR-0367 Phase E (push pipeline) | `push_topic` column on `shift_session`. Engine-dispatch cron fan-out: **not confirmed**. | **Aspirational** |

---

## 3. Known Gaps

### G1 — ADR-0367 Phase C: TimelineTab multi-strip wiring incomplete
**Code:** `DayLineStrip.tsx` + `DayLineStripHeader.tsx` exist. `AggregatedDayLineList.tsx` exists. `use-day-lines.ts` hook exists. However `TimelineTab.tsx` multi-strip composition and dialog wiring for area-anchored paths are in flight.
**Gap:** UI Phase C not complete. Blocking F10–F12 full UX flow (capabilities shipped, UI incomplete).
**Severity:** HIGH.

### G2 — ADR-0367 Phase D: Mobile multi-area section list not built
**Code:** `apps/mobile/app/(app)/(calendar)/day/[date].tsx` — single vertical timeline, no area grouping. `useShiftSession` exists for shift_session data.
**Gap:** Multi-area stacked sections, defensive client-side RLS filter, `shift_session_item_leak_detected` telemetry not built.
**Severity:** HIGH (blocks J13 / F13).

### G3 — ADR-0367 Phase E: Push pipeline (engine-dispatch cron fan-out) not confirmed built
**Code:** `push_topic` column on `shift_session`. `shift_session_day_line` junction exists. No confirmed engine-dispatch cron extension verified in `supabase/functions/`.
**Gap:** Push fan-out to clocked-in employees per `shift_session_day_line` not confirmed shipped.
**Severity:** MEDIUM (sessions work without push; employee pull-model works today).

### G4 — `routine.attach_to_line` capability missing
**Code:** `apps/web/src/components/day/AttachRoutineDialog.tsx` exists. `packages/ai/src/capabilities/` — no `routine/` folder with `attach_to_line` tool. Grep: `grep -r "attach_to_line" packages/ai/src/capabilities/` returns empty.
**Gap:** Cross-namespace delegation via Pattern B (ADR-0356) not implemented. SlotPicker has "Rutine" option but capability not wired.
**Severity:** MEDIUM.

### G5 — ADR-0367 Phase F: 5 journey files missing for shipped code
**Code:** Close flow + admin approval + week lock + mobile home phases + settlement OCR all shipped in code. No journey files.
**Gap:** `JOURNEY-day-session-close-flow.md`, `JOURNEY-day-session-admin-approval.md`, `JOURNEY-day-session-week-lock.md`, `JOURNEY-mobile-home-phases.md`, `JOURNEY-day-session-settlement-ocr.md` not in `docs/journeys/`.
**Severity:** MEDIUM (required for `/close-feature` gate on any PR touching these flows).

### G6 — Naming collision: "Avstemming" used for two different objects
**Code:**
- `packages/i18n/locales/nb/dashboard.json:719` — `"item_avstemming": "Avstemming"` → sidebar label for `/dashboard/reconciliation` (operational day-approval).
- Billing domain owns `billing.settlement_run` / `billing.settlement_period` — accountant-facing period reconciliation, also called "avstemming" in some billing flows.
- `docs/design/day-handoff/README.md` labels the admin view "Avstemming" (ReconView §7).
**Gap:** The same Norwegian word refers to two different objects. The operational day-approval (this domain) should be renamed to **"Dagsgodkjenning"** in all UI labels and i18n keys. The code object (`reconciliation` in routes + table names) does not need renaming — only the human-facing label. Do NOT silently rename code; surface to Pontus for sign-off first.
**Recommendation:** Open a rename sortie. Rename `sidebar.item_avstemming` → `sidebar.item_dagsgodkjenning`, update all NB/EN locale strings in the reconciliation route. Keep billing's "Avstemming" references where they exist.
**Severity:** MEDIUM (UX confusion risk; no functional breakage today).

### G7 — `financial_close_config` UI not confirmed built
**Code:** `supabase/migrations/20260328120100_financial_close_config.sql` — schema + RLS exist. No confirmed admin UI at `/dashboard/settings/` or similar to configure `tolerance_type`, `tolerance_value`, `require_cash_count`, `approval_deadline_hours`.
**Gap:** Admin cannot change close tolerances from the web app. Seeded default (tolerance 50 kr fixed, cash 20 kr, approval required, 24h deadline) applies to all workspaces.
**Severity:** LOW (defaults are reasonable; operator friction only).

### G8 — Grace period for `missed` is hardcoded in EF, not from `graceMinutes` config
**Code:** `supabase/functions/session-lifecycle/index.ts` — `missed` transition when `now > session_date + planned_close + 2h`. Design spec says `graceMinutes = 15` per session (configurable per workspace, see `source/day/data.js`). No `grace_minutes` column on `department_session` or config table.
**Gap:** Grace period is not workspace-configurable. Fixed at 2h post planned_close in EF code (more generous than the design's 15m post planned_open). Likely intentional to avoid false-missed on late-opening departments.
**Severity:** LOW (functional; operator expectation drift risk).

### G9 — `department_location` migration — CLOSED (2026-05-23)
**Resolution:** Verified `supabase/migrations/20260620120500_department_location_junction.sql` (note: actual filename is `_junction` not `_table`). Schema: `(department_id, location_id, workspace_id)` PK on `(department_id, location_id)`. RLS: jwt_read (workspace member), jwt_insert (admin+), jwt_delete (admin+), service_role. Trigger `trg_set_department_location_workspace_id` auto-populates `workspace_id` on INSERT. No remaining gap — spine claims now verified.
**Severity:** CLOSED.

### G10 — Slot picker "Rutine" lane vs `routine.attach_to_line` not wired
**Code:** `apps/web/src/components/day/SlotPicker.tsx` — contains `D6_ITEMS` array. Check if "Rutine" option is present and where it dispatches. `AttachRoutineDialog.tsx` exists but capability not shipped.
**Severity:** MEDIUM — partially overlaps G4.

### G12 — `session_note` shipped schema is minimal (full rich model aspirational)
**Code:** `supabase/migrations/20260412100300_session_infrastructure.sql:120` — shipped `session_note` has 7 columns: `id`, `workspace_id`, `department_session_id`, `note_type` (handoff/closing/general), `content`, `created_by`, `created_at`. No `target_date`, `visibility`, `category`, `is_actionable`, `priority`, `attachments`, `action_status`.
**Legacy design:** MODULE_4_OPERATIONS §17.1 describes a rich `session_note` with actionable flag, multi-category, visibility scope, priority, AI-to-task pipeline. None of that is built.
**Gap:** Rich information layer (Day Brief compilation, actionable notes, AI triage) is aspirational. Only minimal session notes exist.
**Severity:** MEDIUM (functional for handoff notes; no AI-driven information layer yet).

### G13 — `waste_log` shipped schema is simplified (production integration aspirational)
**Code:** `supabase/migrations/20260407200001_waste_log_table.sql` — `waste_log` table exists with `session_id` FK but no `production_session_id`, no `dish_id`, no `ingredient_id`. `waste_category` enum exists.
**Legacy design:** MODULE_14_PRODUCTION §7.2 + MODULE_4_OPERATIONS integration expects `waste_log` to link to `production_session` (not built) and `ingredient`/`dish` tables (not built). No production calculation engine, no recipes/dishes/bookings data model exists in migrations.
**Gap:** Food production module (ingredients, recipes, dishes, menus, bookings, production_session, calculation engine) is not built. `waste_log` is a standalone operational log, not connected to production tracking.
**Severity:** LOW (waste_log usable without production module; production module is a separate major initiative — see ROADMAP P9).

### G11 — Workforce snapshot slice must include `day_line` rows post-ADR-0367
**Code:** ADR-0297 workforce snapshot bootstraps `D2+D6` facts at session start to voice + chat. Snapshot slice defined in stage-engine system-prompt builder. Does not yet include `day_line` rows (pre-dates ADR-0367).
**Gap:** Botsson voice loses area-aware day context until snapshot is extended.
**Severity:** MEDIUM.

### G14 — MODULE_4.5 aspirational `daily_financial_close` table not built
**Legacy design:** SMARTOUT_MODULE_4.5_DAILY_SATTLED §5.1 describes a dedicated `daily_financial_close` table with 8-state machine (`not_started → closing_in_progress → awaiting_ocr → awaiting_validation → validation_failed → awaiting_approval → rejected → closed`), plus `close_image`, `close_task`, `close_deviation`, `pos_template` tables.
**Code:** None of these tables exist in migrations. The current implementation uses `daily_reconciliation.status` (6-state `reconciliation_status` enum) + `settlement_image` (extended with `image_type`, `captured_by`, `parse_status` in `20260328120000`) as the financial close layer. The design intent was partially realized via a simpler schema.
**Gap:** Richer financial close state machine, separate close_task checklist, per-image deviation tracking (`close_deviation`), POS template system, and checkout-gate function `check_financial_close_gate` are not built. The `financial_close_config` table captures some config intent.
**Severity:** LOW (current `daily_reconciliation` + `settlement_image` + OCR EFs handle core flow; detailed gatekeeper and multi-image-type deviation tracking are v2 features).

### G16 — `DayControlPanel` missing `pinDayControlPanelContextAction` (Botsson context-blind)
**Code:** `apps/web/src/components/day/WebDayControl.tsx:137` calls `pinDayControlContextAction` writing `engine_memory` with date+dept+session context, TTL 24h. `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx` calls no equivalent action. Grep `grep -rn "pinDayControl" apps/web/src` returns only the WebDayControl call-site.
**Gap:** When manager opens DayControlPanel from `schedule/page.tsx:1207`, `calendar/CalendarPageShell.tsx:419`, or `AdminDashboard.tsx:62`, Botsson Orb has no context anchor — voice/chat queries about "i dag" answer with workspace-default context, not the panel's focused date+dept. This is a pre-existing gap independent of Tidslinje work, but is a Sortie 1 pre-condition for P10.
**Severity:** MEDIUM (P10 Sortie 1 blocker; pre-existing).

### G17 — `DayControlPanel` inline `TabButton` missing tab ARIA (WCAG 4.1.2)
**Code:** `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx:221-273` renders 7 inline `TabButton` instances (oversikt/meldinger/bookings/oppgaver/budsjett/bemanning/okonomi). Pattern is custom inline `<button>` with onClick, missing `role="tab"`, `aria-selected={active}`, `aria-controls="panel-{id}"`. Tab content area at `:278` lacks `role="tabpanel"` + `aria-labelledby`.
**Reference comparison:** `apps/web/src/components/day/WebDayControl.tsx:299-309` uses `PageTabNav` shared component with proper ARIA contract.
**Gap:** Screen readers announce DayControlPanel tabs as generic buttons, not tab controls. Keyboard navigation (`ArrowLeft`/`ArrowRight` within tablist) not supported. Adding any new tab (e.g. Tidslinje per P10) inherits broken contract.
**Severity:** HIGH (WCAG 4.1.2 fail; P10 Sortie 1 blocker; pre-existing).

### G18 — `DaySessionProvider` carries dead Ultravox voice-tools path post-ADR-0282
**Code:** `apps/web/src/app/dashboard/schedule/_components/day-control/DaySessionProvider.tsx:97` calls `useVoiceTools()`; `:335-336` calls `setClientTools(mergeVoiceTools(...))`. The `temporaryTool: { modelToolName: ... }` shape used in `day-session-voice-tools.ts` (referenced via `createDaySessionVoiceTools`) is the pre-ADR-0282 Ultravox browser-tool definition pattern. Ultravox was removed in ADR-0282; this code feeds `VoiceAssistant` (dynamic mount in `DashboardShell.tsx:42`) which is the dead Ultravox client.
**Gap:** Live dead-code orphan. A future developer mistakes the path as active and adds new voice tools to a sink that never fires. Hazard class is "phantom contract" — sibling of L-176 (docstring drift) + L-NEW telemetry-without-emit.
**Resolution path:** Replace with `useRegisterTools("day-control", ...)` per harness canonical post-ADR-0282 pattern. Grep entire `apps/web/src` for `useVoiceTools|temporaryTool` before claiming complete — may not be the only orphan.
**Severity:** MEDIUM (P10 Sortie 1 pre-condition; not currently shipping broken behavior but blocks correct tool registration for new surface).

### G19 — Three capability tools missing for DnD re-time
Council 2026-05-23 deferred DnD re-time on Tidslinje surface until capability tools exist. Per Agent-coord code-trace:

**G19a — `schedule.reschedule_shift` missing:**
**Code:** `packages/ai/src/capabilities/schedule/tools.ts` is 100% read-only — only `get_*` tools (lines 34/122/167/228/269/386). `packages/ai/src/capabilities/shift-lifecycle/tools.ts` only updates `status` (publish line 194-202, approve line 358-369). `packages/ai/src/capabilities/scheduler/tools.ts:478` does bulk INSERT only (`build_schedule.materialise`). No `schedule.update_time` / `schedule.reschedule_shift` export anywhere.
**Gap:** Cannot re-time `schedule_shift.start_time / end_time` through any capability. DnD UI on shift rows would have no tool to call.
**Severity:** MEDIUM (P10 Sortie 1-3 not blocked; DnD-deferral gap).

**G19b — `task.update_scheduled_at` missing:**
**Code:** `packages/ai/src/capabilities/task/tools.ts` — `task.create_session` accepts + writes `scheduled_at` on CREATE only (line 415 + 523 + 560). No `task.update_scheduled_at` or generic `task.update` export. Re-time post-creation not possible via capability.
**Gap:** Cannot re-time `session_task.scheduled_at` after creation. DnD UI on task rows would have no tool to call.
**Severity:** MEDIUM.

**G19c — `session_hook` re-time pattern unresolved:**
**Code:** `packages/ai/src/capabilities/routine/tools.ts:499` upserts session_hook (creating/replacing per dept). Hook timing is template-derived (enum `pre_open|open|scheduled|pre_close|close` at line 30), not free-time. No update-timing tool.
**Gap:** Re-timing a hook = re-creating the template association (architectural decision, not just a missing tool). DnD on hook rows is conceptually different from shift/task re-time. Per Agent-coord recommendation: likely defer entirely (hooks are template-derived; re-time = `routine` capability concern, not TimelineTab DnD primitive).
**Severity:** LOW (defer-and-document rather than build).

**Resolution path:** Separate capability sortie + new ADR before any DnD UI is wired. ADR must spec G19a + G19b contracts (gate_action, gatedMutation wrapper, emit shape, authority level — likely `four_eyes` for published shifts, `suggest` for unpublished). G19c may stay deferred with documented rationale.

### G15 — MODULE_14 Production module entirely unbuilt
**Legacy design:** SMARTOUT_MODULE_14_PRODUCTION describes ingredient/recipe/dish/menu/booking/production_plan_step/production_session/waste_log data model + calculation engine.
**Code:** None of `ingredient`, `recipe`, `recipe_ingredient`, `dish`, `dish_recipe`, `production_plan_step`, `menu`, `menu_dish`, `booking`, `booking_dish`, `production_session`, `season_menu` tables exist in migrations. Only `waste_log` (simplified) exists.
**Gap:** Food production module is a future major initiative. Note: the MODULE_14 doc had `planned_domain: day-session` but this content may belong to a dedicated `production` or `menu` domain. The tag was aspirational — production session "runs inside" department_session but owns its own set of domain entities.
**Recommendation:** When production module is prioritized, run `domain-steward pre production` (or `menu`) rather than absorbing into day-session. The `production_session → department_session` FK is a seam, not co-ownership.
**Severity:** LOW (not needed for current product; note for future domain planning).

---

## 4. Deviations (spec vs code differs — code wins)

### §4a — 5-phase `department_session_status` vs 6-phase design
**Spec:** Day-handoff design README §3 lists 6 phases: `upcoming`, `active`, `pending_signoff`, `closed`, `missed`, `locked`.
**Code:** `department_session_status` enum has 5 values — `locked` is absent. `locked` state is implemented via `daily_reconciliation.status = 'locked'` (C1 layer).
**Why:** Per ADR-0156 precedent — stored status on the live-production table drifts under concurrent writes; the lock is a C1 calibration concern, not a D6 production concern. The `derive-day-line-status.ts` helper returns `"locked"` as a derived type but never stores it on `department_session`.
**Impact:** Any code that reads `department_session.status === 'locked'` will never be true. Lock-state must be read from `daily_reconciliation.status`. Document in agent guardrails.

### §4b — `DuringShiftViewV2` behind feature flag
**Spec:** Design spec's mobile "During" screen (MobileHomeDuring) with gradient-hero live-timer card.
**Code:** Two implementations — `DuringShiftView` (v1, always-on) and `DuringShiftViewV2` (v2, behind `EXPO_PUBLIC_DURING_SHIFT_V2`). V2 is the design-aligned version.
**Why:** A/B testing before graduating v2 to default.

### §4c — Mobile home uses `no_shift` phase (not in design spec)
**Spec:** Design describes Before/During/After as the three mobile states.
**Code:** `apps/mobile/app/(app)/(home)/index.tsx` uses `useShiftPhase()` with 4 values: `no_shift`, `before_shift`, `during_shift`, `after_shift`. `NoShiftView` is an additional state.
**Why:** Covers employees with no shift today — design spec only showed Café Skuta with a shift every day.

---

## 5. Overlap Edges

### §5a day-session ↔ billing
**Shared surface:** The word "Avstemming" + the conceptual idea of "reconciliation".
**Classification:** **keep** — different objects. Billing owns `billing.settlement_run` / `billing.settlement_period` (accountant-facing B2B billing close). Day-session owns `daily_reconciliation` (operational day-approval). See G6 for rename recommendation.
**Seam:** The word "avstemming" (Norwegian). Reserve billing's use for B2B period close; rename day-session's use to "dagsgodkjenning".

### §5b day-session ↔ payroll
**Shared surface:** Overtime/supplement hours confirmed at close; shift cost snapshots.
**Classification:** **keep** — clear seam. Day-session confirms hours at `pending_signoff` → `closed`. Payroll domain reads `daily_reconciliation.total_actual_hours` + `shift_cost_snapshot` after `status = 'approved'`. No dual ownership.
**Seam:** `daily_reconciliation.approved_at` is the event payroll waits for.

### §5c day-session ↔ procedure-engine
**Shared surface:** `session_hook.linked_procedure_id`, `session_hook.linked_routine_id` — hooks reference procedures/routines authored in the procedure-engine domain.
**Classification:** **keep** — author/consumer split. Procedure-engine authors hooks/routines. Day-session consumes them at runtime via `session-hook-executor`.
**Seam:** `session_hook` table's FK columns. Procedure-engine writes `procedure` + `routine` tables; day-session reads them.

### §5d day-session ↔ communication (Komm)
**Shared surface:** Komm session channel auto-created per `department_session`. `BroadcastComposer` sends through that channel.
**Classification:** **keep** — day-session creates the container (`department_session` → Komm channel creation trigger), communication owns the routing/delivery.
**Seam:** Channel creation trigger on `department_session` INSERT.

### §5f day-session ↔ gamification (not yet a domain)
**Shared surface (aspirational):** MODULE_4_OPERATIONS §19.2 defines point-earning actions on `session_task` completion, `session_hook` clean signoff, deviation patterns. A `gamification_config` policy + `points_event` table is described but NOT built.
**Classification:** **keep** — when gamification is prioritized, it reads session_task/session data; day-session owns the task tables. Seam: task completion events (telemetry) feed into a future gamification engine.
**Note from retro-absorb:** MODULE_4 gamification content belongs to a future `gamification` domain, NOT to day-session spine. Content logged here for routing; do NOT move into day-session data model.

### §5g day-session ↔ AI operations layer / Day Brief (not yet built)
**Shared surface (aspirational):** MODULE_4_OPERATIONS §17.2 describes a `day_brief` table (AI-compiled daily summary + sections JSONB + delivery tracking) + `session_handoff` (structured end-of-shift knowledge transfer with voice recording). Neither table exists in migrations.
**Classification:** **keep** — Day Brief + AI monitoring belongs to the Botsson / stage-engine domain. Day-session provides the input data; Botsson compiles and delivers. The `ops-day-brief` Edge Function is the current minimal implementation (ADR-0297 workforce snapshot direction).
**Note from retro-absorb:** `day_brief`, `session_handoff`, `ai_session_event`, `ai_operations_config` tables are aspirational Botsson/agent-harness domain content. Not absorbed into day-session DATA-MODEL.

### §5h day-session ↔ shift-template / recurring_task_config (not yet a domain)
**Shared surface (aspirational):** MODULE_4_OPERATIONS §9–§13 describes `shift_template`, `shift_template_procedure`, `recurring_task_config` tables. Shift templates are authoring constructs for scheduling/procedure-engine; `recurring_task_config` is a procedure-engine concept.
**Classification:** **keep** — `shift_template` belongs to scheduling domain; `recurring_task_config` belongs to procedure-engine. None of these tables are in day-session ownership scope.
**Note from retro-absorb:** This content from MODULE_4 has NOT been absorbed into day-session spine; it belongs to scheduling + procedure-engine `pre`/`update` sorties.

### §5e daytimeline ↔ day-session (FOLDED)
**Former docs/modules/daytimeline/**: absorbed into this domain. Not an overlap — daytimeline was the `active`-phase surface of `department_session`. No separate domain exists.
**Status:** Migration complete (see §6 below).

---

## 6. Adjacent Debt

| # | Item | Where | Severity |
|---|---|---|---|
| D1 | `useDayTimelineEvents` broad invalidation — single queryKey for all mutations | `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts` | LOW |
| D2 | `SlotQuickAddPopover.tsx` legacy component retained for E2E green — should be removed | `apps/web/src/components/day/SlotQuickAddPopover.tsx` header comment | LOW |
| D3 | `schedule_day_info` is dept-anchored, not location-anchored — multi-location dept has one handover note for all sites | `supabase/migrations/20260302152749_add_dashboard_evolution_tables.sql:157` | LOW |
| D4 | Mobile telemetry event separator mismatch — `"calendar view_changed"` (space) vs dot-separator pattern | `packages/telemetry/src/registry.ts` | LOW |
| D5 | No virtualization on web `DayEventList` — fine ≤200 events; will degrade with multi-line stack | `apps/web/src/components/day/DayEventList.tsx` | LOW |
| D6 | Voice tool surface hand-maintained — no codegen from capability registry; drift risk | `services/voice-agent/src/tools-task.ts` | LOW |
| D7 | `oversikt-tools-bridge` tools hardcoded — no `day_line` awareness post-ADR-0367 | `apps/web/src/components/day/_tools/` | LOW |
| D8 | Booking `schedule_day_booking.location` is free-text TEXT (not FK); `day_line_id` added but legacy `.location` retained | `supabase/migrations/20260301600003_schedule_persistence_tables.sql:353` | LOW |
| D9 | `hms` capability namespace: deviation tools still live under `operations` namespace, not dedicated `hms/` folder | `packages/ai/src/capabilities/operations/` | LOW |

---

## 7. Cross-ref update backlog (migration from daytimeline folder)

The following files in the repo still reference `docs/modules/daytimeline/`:
- `CLAUDE.md` (project-level) — references this path. Per scope: **DO NOT edit CLAUDE.md**. Log here as migration backlog.
- Various ADR cross-references in `docs/decisions/` — these reference `MODULE_DAYTIMELINE.md`. Update paths to `docs/domains/day-session/` when next touching those ADRs.

**Action item:** In a future cleanup sortie, search and replace `docs/modules/daytimeline/` → `docs/domains/day-session/` across `docs/decisions/` and `docs/INDEX.md`.
