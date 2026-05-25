---
title: "Agent 6 — Hotel Wedding Friday: Industry Sim Findings"
created: 2026-05-25
updated: 2026-05-25
agent: A6
slice: Hotel-Fri
status: complete
tags: [simulation, hotel, event, wedding, gaps, industry-vertical]
---

# Agent 6 — Hotel Wedding Friday: Industry Sim Findings

> Grand Hotel Sjølyst, Friday arrival day. 22 staff, 80 wedding guests, 35 rooms turning.
> All findings are NEW vs the 22-bug baseline in `docs/test-runs/2026-05-23-journey-sweep/BUGS.md`.
> Dedup cross-check: A1–A5 work is parallel (restaurant week), none overlap these hotel-specific findings.

---

## Summary of persona steps vs what Smartout actually provides

| Step | Persona need | Smartout provides | Verdict |
|---|---|---|---|
| 12:00 Linda opens event day-line | Cross-department event view | One `department_session` per dept, no event aggregate | GAP CRITICAL |
| 13:00 Ingrid manages 8 housekeepers across 35 rooms | Parallel housekeeping sessions with room granularity | `department_session` is 1-per-dept, not per-room | GAP CRITICAL |
| 14:00 Front-desk pre-stages keys | Key/PMS ops are outside Smartout scope | Nothing — no PMS bridge | GAP CRITICAL |
| 15:00 Sara checks in 15 guests | Guest check-in surge tracking | Nothing — no guest/reservation model | GAP CRITICAL |
| 17:00 Linda captures last-minute changes | Change capture on event document | `schedule_day_booking` has `notes` but no structured event-change log | GAP MEDIUM |
| 18:30 Andreas leads 6-server setup | Multi-server setup session in banquet area | Works via `department_session` + `day_line` (location anchor) | PARTIAL |
| 19:00 Welcome dinner service, 40 covers | Covers/pax on session | `schedule_day_booking.guest_count` is a flat integer, no event-FK | GAP MEDIUM |
| 22:00 Bar to 02:00 | Night-bar session spanning midnight | Session does NOT span midnight by design (`session_date` = DATE, `planned_close` = TIME). 02:00 is day+1. | GAP HIGH |
| 23:00 Camilla closes kitchen + F&B reconciliation | Cross-department F&B roll-up | One reconciliation per `department_session`, no cross-dept aggregate for event | GAP HIGH |
| 02:30 Late shift settlement + temporal lock | Overnight settlement after midnight | `department_session` of day N closes; late staff belong to day N+1 sessions | GAP HIGH |

---

## Findings

### HOTEL-1 — No event-as-first-class-citizen model [CRITICAL]

**What is needed:** Linda manages "Marit + Espen wedding" as a named, multi-day, multi-department entity. She needs one event record that spans 3 days, links to: 5 departments (banquet + kitchen + bar + housekeeping + front-desk), guest list (80 pax), run-of-show timeline, budget envelope, and final invoice.

**What exists:** Zero. The cascade model has `planning_event` (D4) for demand signals (`planning_event_category` enum `external_scraped | cultural_commercial | internal | weather | recurring` — `supabase/migrations/20260421100100_cascade_a1_enums.sql:37-45`), but this is a DEMAND INPUT for staffing solvers, NOT an event container for F&B + rooms + timeline. There is no `event` table, no `event_booking` table, no event-to-department-session link, no event budget envelope.

**PMS comparison:** Mews, Cloudbeds, and Stayntouch all have first-class `event` objects (often called "group block" or "event reservation") that link to: room block, F&B estimates, BEO (Banquet Event Order), and staff assignment.

**Code trace:** `packages/ai/src/industry/packages/hospitality.ts:538-540` — `filterDefaults.overnight: false` — the package flag acknowledges hotel as a vertical but the default disables it. No `event` dimension in cascade model anywhere. `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md:section 2.2` — D4 is "Demand Signal" and `planning_event` is the demand signal row, not an event container.

**Classification:** GAP CRITICAL — hotel event operations are entirely unsupported. Wedding = 80 anonymous covers spread across multiple sessions.

---

### HOTEL-2 — Room ops are not D6 sessions [CRITICAL]

**What is needed:** Ingrid manages 35 rooms turning in parallel (13:00–15:00). Each room has: arrival state, dirty/clean/inspected status, assigned housekeeper, estimated completion time. A real housekeeping lead in a hotel has a room board — 35 rows with live status per room, reassignment drag-drop, and time estimates. This is the daily operational heartbeat of housekeeping.

**What exists:** `department_session` is 1-per-department-per-date (`UNIQUE (workspace_id, department_id, session_date)` — `supabase/migrations/20260304200000_department_session.sql:47`). Ingrid has ONE housekeeping session, not 35. She can create tasks inside it via `session_task`, but there is no room-level entity. `location` (`00002_structure_tables.sql:60`) maps to operational areas, not individual rooms. No `room` table, no `room_status` enum, no `room_assignment` entity.

**PMS comparison:** Every hotel PMS has a room board / housekeeping module with 5–8 status states per room (dirty, in-progress, clean, inspected, out-of-order, touch-up). This is not "nice to have" — it is the operational core for housekeeping.

**Closest workaround (inadequate):** Admin could create 35 locations (one per room) and 35 `day_line` rows (one per location per session). But `day_line` is an area-program layer anchored to department_session (`supabase/migrations/20260620120200_day_line_table.sql:19` — `UNIQUE (department_session_id, location_id)`), not a room-cleaning task. This would create schema pollution and break the cascade intent.

**Code trace:** `packages/ai/src/industry/defaults.ts:86-88` — "Housekeeping" department with "Renholder" + "Renholdsansvarlig" positions exists in the bootstrap defaults. The department is modeled but room-level operations are not. `roleCapabilityProfiles` at `hospitality.ts:849-855` defines protocols for "renhold" but they are generic cleaning procedures, not room-status-machine operations.

**Classification:** GAP CRITICAL — housekeeping is a named department but has no room-ops primitives.

---

### HOTEL-3 — Midnight-spanning sessions have no native model [HIGH]

**What is needed:** Bar service from 22:00 Friday to 02:00 Saturday. The shift physically starts Friday and ends Saturday. `session_date` in `department_session` is a DATE (`supabase/migrations/20260304200000_department_session.sql:col session_date DATE NOT NULL`). `planned_open`/`planned_close` are TIME columns. A bar session that closes at 02:00 the next calendar day has no native representation.

**What exists:** The `HOSPITALITY_DEFAULT_HOURS` in `packages/ai/src/industry/packages/hospitality.ts:380-385` defines closing hours as max 23:00 (Mon-Sat). `HOSPITALITY_TARIFF_RATES:84` — kveldstillegg applies "21:00-06:00" crossing midnight, so tariff logic acknowledges midnight-crossing. But session lifecycle (`session-lifecycle` EF) uses `now > session_date + planned_close + 2h` for `missed` transition — this assumes planned_close is on the same calendar date as session_date.

**Real-world impact:** Andreas's bar team clocking out at 02:30 Saturday appears on a Sunday session that doesn't exist yet, or on Saturday's session at 02:30. The payroll supplement engine also hits this: `hotelloverenskomsten` has `hotell-natt` (00:00-06:00, rate=55 kr/t) — this supplement should apply to the hours 00:00-02:30. But if the `department_session` is Friday (date), the `shift_session.clocked_out_at` is Saturday 02:30, and the C1 reconciliation applies to Friday. The supplement rate calculation must span the day boundary.

**Code trace:** `supabase/migrations/20260428220000_tips_enums.sql` — tip_pool has `UNIQUE (department_session_id)`, so tips from a midnight-crossing session all accrue to the Friday pool. If the shift is split by midnight, tip attribution becomes ambiguous.

**Classification:** GAP HIGH — not a blocker for restaurants (23:00 close) but critical for hotels/bars with late-night operations. The Hotelloverenskomsten tariff rates exist (`hospitality.ts:630-720`) but the session boundary model doesn't support the hours they cover.

---

### HOTEL-4 — `tip_pool` is single-department, no cross-department event pool [HIGH]

**What is needed:** Wedding tip pool: 50% banquet / 30% kitchen / 20% bar. This is a cross-department tip distribution on a single event. The allocation formula is event-specific (not a fixed `tip_policy.method`).

**What exists:** `tip_pool` has `UNIQUE (department_session_id)` (`supabase/migrations/20260428220003_tips_pool_table.sql:25`) — one pool per session per department. `tip_policy` is per-department (`department_id NOT NULL REFERENCES department`). There is no cross-department tip pool entity. No `event_id` on `tip_pool`. No `pool_split_config` with percentage weights per department.

**`tip_algorithm` enum** (`supabase/migrations/20260428220000_tips_enums.sql:18`): `'equal' | 'by_hours' | 'by_role'` — no `by_department_split` option.

**Real-world impact:** Camilla at 23:00 trying to record the event's total tip amount (say 8,400 kr) and split it 50/30/20 across departments cannot do this. She would need to manually calculate and enter three separate pools: one in banquet (4,200 kr), one in kitchen (2,520 kr), one in bar (1,680 kr). Each would then distribute via the per-department algorithm. Manual split, no event-level container.

**Code trace:** `supabase/migrations/20260428220002_tips_role_weight_table.sql` — role weights exist for `by_role` algorithm but are department-scoped. No cross-department weight mechanism.

**Classification:** GAP HIGH — affects every multi-department event (weddings, conferences, large banquets). The tip schema handles restaurant (single-dept) well but fails at event operations.

---

### HOTEL-5 — `schedule_day_booking` has no event FK, no department scope, no multi-day span [MEDIUM]

**What is needed:** When Linda pre-stages the wedding booking on the day-line, the booking entity should carry: event name ("Marit + Espen"), total covers (80), affected departments, run-of-show timeline, BEO reference. When she opens the day-line at 12:00, she should see the wedding as a rich context object, not just a `guest_count: 80` integer.

**What exists:** `schedule_day_booking` (`supabase/migrations/20260301600003_schedule_persistence_tables.sql:353-369`):
- `title TEXT NOT NULL` — event name
- `guest_count INTEGER NOT NULL DEFAULT 0` — flat integer
- `menu TEXT` — free text
- `booking_time TIME NOT NULL` — single time point
- `location TEXT` — free text (not FK to `location` table; D8 debt item `day-session GAPS §D8`)
- `is_vip BOOLEAN`
- `notes TEXT`
- No `end_time` column — cannot represent a multi-hour event window
- No `department_id(s)` — booking is workspace-scoped, not dept-scoped
- No `event_id` FK — no link to any event aggregate
- No BEO or structured run-of-show JSONB

**Workaround:** Linda can add a `notes` field with free text, but Botsson cannot parse structured last-minute changes from free text at 17:00. The "bridal party run-through capture" step has zero machine-readable support.

**Code trace:** `supabase/migrations/20260301600003_schedule_persistence_tables.sql:370` — `COMMENT ON TABLE public.schedule_day_booking IS 'Reservations and bookings shown in schedule day view.'` — design intent is a simple reservation marker, not an event container.

**Classification:** GAP MEDIUM — the table exists but is bistro-shaped (single booking, single time, flat guest count). An 80-person wedding needs a richer model.

---

### HOTEL-6 — No cross-department session orchestration view [HIGH]

**What is needed:** At 12:00, Linda opens "the event day-line" and sees ALL department sessions for Friday in one unified view: housekeeping (35 rooms turning 13:00-15:00), front-desk (check-in surge 15:00-17:00), banquet (setup 18:30, service 19:00), kitchen (prep 17:00, service 19:00-23:00), bar (22:00-02:00). This is analogous to a "multi-rail timeline" with one rail per department.

**What exists:** `WebDayControl.tsx` renders one `department_session` (one rail). `DayControlPanel.tsx` in schedule view can show sessions per department but the manager must navigate to each department individually. `TimelineTab.tsx` multi-strip composition (G1 in `day-session GAPS`) is in-flight (HIGH gap). Even when G1 ships, it shows areas within one department, not cross-department orchestration.

**Cascade position:** The `day_line` is `UNIQUE (department_session_id, location_id)` — area-anchored within ONE session. There is no "event_orchestration_view" or "cross_department_day_line" concept.

**PMS comparison:** Mews has a "group blocks timeline" showing all reservations, all departments, all spaces on a single day. Opera has the Banquet Event Order module with a visual multi-department Gantt. Smartout has none of this.

**Code trace:** `supabase/migrations/20260620120200_day_line_table.sql:19` — FK is `department_session_id`, not `event_id`. `packages/ai/src/capabilities/schedule/tools.ts` — all schedule read tools are dept-scoped.

**Classification:** GAP HIGH — Linda's core job at 12:00 (orchestrate all departments for the event day) has no surface in Smartout.

---

### HOTEL-7 — `Hotelloverenskomsten` tariff defined but no hotel-specific roleCapabilityProfiles [MEDIUM]

**What is needed:** Hotel roles have different compliance requirements than restaurant roles. A front-desk receptionist needs: check-in protocol, GDPR guest data handling procedure, fire-evacuation protocol for a residential building, night-desk handover protocol. A housekeeper needs: room-cleaning standards (Renholdsprotokoll), biohazard protocol, master-key handling protocol. A banquet captain (Bankettsjef/Hovmester) needs: BEO-reading procedure, service sequence for banquets (different from a la carte), allergen for large groups, alcohol-service for events.

**What exists:** `hospitalityPackage.roleCapabilityProfiles` (`hospitality.ts:789-856`) defines 5 roles: `skiftleder`, `servitor`, `kokk`, `bartender`, `renhold`. These are restaurant-oriented. The protocols referenced (`governance.sql:323-331`) are Mattilsynet/restaurant-compliance focused. No `resepsjonist`, no `bankett_captain`, no `nattevakt` (night desk), no `event_manager` role profile.

**`industryPackage.label`** at `hospitality.ts:540`: `"Restaurant og servering"` — explicitly restaurant-labeled, not hotel.

**Bootstrap gates** (`hospitality.ts:407-528`) — no hotel-specific gates. `mattilsynet_routines_seeded` and `alcohol_labor_routines_seeded` are restaurant-centric. No `check_in_protocol_active`, no `room_inspection_standards`, no `night_audit_procedure`.

**Code trace:** `packages/ai/src/industry/defaults.ts:133-139` — NACE `55.101` (hotell) procedures seeded: `Innsjekk-rutine`, `Utsjekk-rutine`, `Renholdsprotokoll`, `Brannrutine`. This is the closest thing to hotel-specific governance. But these are `PROCEDURE_CONFIGS` for onboarding UI suggestion only — they are not linked to `roleCapabilityProfiles` and do not gate employee readiness.

**Classification:** GAP MEDIUM — `Hotelloverenskomsten` tariff rates are present but hotel employee readiness is not modeled. Jonas (trainee, first event week) has no specific hotel-event protocol path.

---

### HOTEL-8 — Multi-day F&B reconciliation has no container [HIGH]

**What is needed:** At 17:00 Sunday, Linda runs the 3-day event settlement: total F&B revenue (3 days), total labor cost (3 days across 5 departments), tip totals, deviations, final invoice draft to bride's father. This is a single financial event spanning 3 calendar days, 5 departments, and results in one invoice.

**What exists:** `daily_reconciliation` has `UNIQUE (workspace_id, department_id, reconciliation_date)` — it is per-department per-day. The total event P&L requires: (5 departments) × (3 days) = 15 reconciliation rows. No aggregation entity. No `event_settlement` table. The `billing.invoice` table (`supabase/migrations/20260417121720_invoice_table.sql`) is for Smartout's SaaS billing to companies, not for hotel event invoicing to guests.

**What Linda sees on Sunday:** She navigates to `/dashboard/reconciliation` and sees a week grid, not an event-filtered view. She would need to manually sum 15 rows across 5 departments. No event P&L surface exists.

**Code trace:** `supabase/migrations/20260304200100_daily_reconciliation.sql:UNIQUE (workspace_id, department_id, reconciliation_date)` — constraint enforces no multi-day or cross-dept reconciliation entity. `daily_reconciliation.revenue_total` is per-session-per-day.

**Classification:** GAP HIGH — the event settlement step (the most commercially important operation of the entire 3-day event) has no container in Smartout.

---

### HOTEL-9 — `hospitality.ts filterDefaults.overnight: false` creates wrong default for hotel workspace [MEDIUM]

**What is needed:** A hotel workspace should default `overnight: true` in the industry package. This flag (type `IndustryFilterKey` in `packages/types/src/industry.ts:11`) gates overnight-related features. The Hotelloverenskomsten tariff (`hotell-natt` supplement for 00:00-06:00) only makes sense with overnight enabled.

**What exists:** `hospitalityPackage.filterDefaults.overnight: false` (`hospitality.ts:545`). There is a separate `hotelloverenskomsten` tariff key, but `overnight: false` is the package default. A hotel admin onboarding via NACE `55.101` inherits `filterDefaults.overnight: false`.

**Impact:** If `overnight` flag gates night-supplement calculations, hotel workspaces may not apply `hotell-natt` (55 kr/t, 00:00-06:00) by default. The tariff rates exist in the package but the filter default disables them.

**Code trace:** `hospitality.ts:538-547` — `filterDefaults` object. `packages/types/src/industry.ts:11` — `IndustryFilterKey = "food" | "alcohol" | "overnight" | "delivery"`. `defaultTariffKey: "riksavtalen"` at `hospitality.ts:723` — hotel NACE defaults to restaurant tariff, not `hotelloverenskomsten`.

**Classification:** GAP MEDIUM — hotel bootstrapped with wrong tariff default + wrong overnight flag. Two-line fix, but current behavior creates wrong tariff binding for every hotel workspace.

---

### HOTEL-10 — Banquet captain is not a modeled role distinction [MEDIUM]

**What is needed:** Andreas as "banquet captain" has different authority than a regular shift leader. Specifically: he runs the service pass, coordinates between kitchen and service team during service, has authority to re-time courses during service (e.g. "delay third course by 20 minutes — the speeches are running long"), and captures deviations that affect event billing (a course was not served to 3 guests = deduction). He is NOT the duty leader of the department (that's Linda) but he has operational authority during the service window.

**What exists:** `department_session.duty_leader_profile_id` (`supabase/migrations/20260329100000`) allows one duty leader. `team.leader_profile_id` allows a team leader per team. Neither models "banquet captain" as a service-execution authority role distinct from administrative duty leader.

**Position registry** (`defaults.ts:67`) has `"Hovmester"` (head waiter) as a `tier: "basis"` leader role in the "Sal" department. But `Hovmester` is a front-of-house position, not a banquet execution role. The `POSITION_REGISTRY` has no `Bankettsjef`, `Bankettkaptein`, or `Events Captain` type.

**Authority gap:** Andreas at 19:00 calling "delay third course" is a verbal D6 production decision. Smartout has no surface to capture this in real time. The deviation module (`deviation` table) is designed for compliance/safety deviations, not for service-timing decisions.

**Code trace:** `packages/ai/src/industry/packages/hospitality.ts:799-813` — `servitor` roleCapabilityProfile covers `"Servitør", "Runner", "Vertinne"` positions. No banquet-specific readiness signal.

**Classification:** GAP MEDIUM — the role exists in real operations but Smartout has no model for it. Affects both role-capability readiness and operational authority during service.

---

## Cross-vertical applicability

### Does cascade bend to hotel — or does Smartout need a hotel-vertical industry package?

**Short answer: The cascade architecture CAN bend, but Smartout currently does not have the hotel-specific industry package to make it work.**

**What bends naturally:**

The cascade model's dimensional structure is actually well-suited for hotels IF the right entities are added:

- **D1 Envelope:** `location` with `location_type: 'event'` and room-level locations (or a `room` sub-entity) would carry the hotel's physical structure. The type enum already has `'event'` (`00002_structure_tables.sql:2`).
- **D2 Resource:** Housekeeping staff + front-desk staff already fit the `profile` + `employment_contract` model. The `Hotelloverenskomsten` tariff already exists in the package.
- **D3 Rules:** Night supplements, weekend rates, and Hotelloverenskomsten constraints already have entries in `hospitality.ts:630-720`. They just need to be activated.
- **D6 Production:** `department_session` (one per department per day) works for restaurant-style departments. Adding an `event_session` as a D6 sibling (event-scoped, multi-department, multi-day) would extend the model without breaking it.

**What requires new building blocks:**

| Missing | Cascade dimension | Scope |
|---|---|---|
| `event` entity (named, multi-day, multi-dept) | D4/D6 boundary — event as demand container + production envelope | Hotel-vertical industry package |
| `room` entity with status machine | D1 envelope (sub-location) | Hotel-vertical |
| `event_session` (multi-day, cross-dept aggregate) | D6 Production — sibling of `department_session` | Hotel-vertical |
| `event_settlement` (multi-dept, multi-day F&B roll-up) | C3 Commercial + C1 Calibration | Hotel-vertical |
| `cross_department_tip_pool` with split config | C3 Commercial | Both hotel and large-event restaurant |
| `midnight_shift_boundary` handling | D6 + C1 — session date vs clock-out time | Hotel + late-night bar |
| Hotel `roleCapabilityProfiles` (receptionist, banquet captain, night-desk) | K1a Industry | Hotel-vertical industry package |

**Verdict:** The cascade model is a good fit for hotels architecturally. The `hospitality.ts` package already acknowledges hotel (`hotelloverenskomsten` tariff, NACE 55.101 department presets, `overnight` filter flag) but stops short of building the hotel operational layer. This is a **hotel-vertical industry sub-package gap**, not a cascade architecture flaw.

The equivalent of creating `hospitality.ts` for restaurants exists. What does NOT exist is a `hotel.ts` (or `hospitality-hotel.ts`) that extends the base hospitality package with the hotel-specific primitives listed above.

**Recommendation:** Before onboarding a hotel, Smartout needs a `hotel` niche sub-package (call it `hospitality.no.hotel.v1`) that:
1. Sets `filterDefaults.overnight: true`
2. Sets `defaultTariffKey: "hotelloverenskomsten"`
3. Defines hotel-specific `roleCapabilityProfiles` (resepsjonist, bankett_captain, nattevakt, husholderske)
4. Adds hotel-specific bootstrap gates (`check_in_protocol_active`, `room_inspection_standards`, `night_audit_procedure`)
5. Seeds hotel-specific procedure templates (check-in, check-out, room inspection, night audit, BEO-reading)

**This does NOT require a separate `IndustryPackage` — it can be a niche-parameterization of the existing hospitality package via D5 Concept layer (consistent with the cascade spec §2.2: "D5 changes weights, thresholds, and defaults throughout").**

---

## Gap register (new findings only)

| ID | Title | Severity | Cascade layer | Code anchor |
|---|---|---|---|---|
| HOTEL-1 | No event-as-first-class-citizen | CRITICAL | D4/D6 | `hospitality.ts:538` — `overnight:false`, no `event` table anywhere |
| HOTEL-2 | Room ops not D6 sessions | CRITICAL | D1/D6 | `department_session.sql:47` — UNIQUE per dept, not per room |
| HOTEL-3 | Midnight-spanning sessions unsupported | HIGH | D6/C1 | `department_session` cols `session_date DATE`, `planned_close TIME`; EF logic assumes same-day |
| HOTEL-4 | No cross-department event tip pool | HIGH | C3 | `tips_pool_table.sql:25` — `UNIQUE (department_session_id)`, no event FK |
| HOTEL-5 | `schedule_day_booking` bistro-shaped | MEDIUM | D6 | `schedule_persistence_tables.sql:353-369` — no end_time, no event FK, location as free text |
| HOTEL-6 | No cross-dept orchestration view | HIGH | D6 UI | `day_line` UNIQUE `(department_session_id, location_id)` — no event rail |
| HOTEL-7 | No hotel roleCapabilityProfiles | MEDIUM | K1a/I1 | `hospitality.ts:789-856` — 5 restaurant roles only |
| HOTEL-8 | No multi-day event settlement container | HIGH | C1/C3 | `daily_reconciliation.sql:UNIQUE (workspace_id, department_id, date)` |
| HOTEL-9 | `overnight:false` + wrong default tariff for hotel NACE | MEDIUM | I1 | `hospitality.ts:545, 723` — `overnight:false`, `defaultTariffKey:"riksavtalen"` |
| HOTEL-10 | Banquet captain not a modeled role | MEDIUM | D2/D6 | `defaults.ts:67` — no banquet captain position, no mid-service authority model |

---

## What does work (confirms, not gaps)

- **Multi-department setup via locations:** Andreas leading 6 servers in the main restaurant area works via `day_line` (location-anchored, `day_line_table.sql:19`). The ADR-0367 area-anchored model actually fits banquet-floor-vs-kitchen-vs-bar splits within one department.
- **Tariff supplements for evening/weekend:** `hotelloverenskomsten` supplement entries exist (`hospitality.ts:630-720`). Once activated (HOTEL-9 fix), kveldstillegg + lørdagstillegg + nattillegg apply correctly.
- **Deviation reporting during service:** `deviation` table (D6) supports capturing service incidents. Andreas can log a deviation at 20:30 ("3 guests received wrong main course").
- **Trainee readiness gate:** Jonas as trainee (`profile.status = 'trainee'`) works within the existing readiness model. He can be assigned to low-stakes runner tasks via `session_task`.
- **Tips within a single department session:** Camilla can close the bar pool at 02:30 via the tip capability (single-department scenario works per `tip_pool`, `tip_distribution` schema).
- **Temporal lock:** `daily_reconciliation.status = 'locked'` works at 02:30 for the sessions that belong to Friday date.

---

*All findings are NEW versus the 22-bug baseline. No overlap with A1–A5 bistro week findings.*
*Code-traced evidence provided for each finding. File:line anchors verified.*
