---
title: "Restaurant Week Sim — Gaps"
status: complete
created: 2026-05-25
updated: 2026-05-25
module: meta
tags: [gaps, sim, restaurant-week, hotel, festival, wfm-strategy]
---

# Restaurant Week Sim — Gap List (feature / UX / journey holes)

> **Scope:** Bistro week + Hotel wedding + Festival = 11 specialists, ~93 unique findings.
> **What counts as a gap:** the intended journey step has NO implementation OR implementation is partial / disconnected / aspirational. Code bugs go to `BUGS.md`.
>
> **NEW gaps found:** **47 feature/journey holes**, organized by sector + cross-cutting.
> **Framing:** these are what's missing for Smartout to be the **world-best WFM for shift-based businesses** — not just functional, but operationally indispensable.

---

## SECTOR — BISTRO (Phase 1: 5-day restaurant week)

Bistro week exercised the core 6D + 4C cascade. Cascade fundamentals work. Gaps cluster around **decision-support during scheduling, in-shift execution, and period close**.

### GAP-SIM-B01 — No replacement-suggestion surface on absence creation 🔴 CRITICAL

- **What's missing:** Erik registers Sofia's Thursday sick-call → grid shows a hole → zero guidance on who to call. SIMULATION-PLAN expects "Botsson cascade computes available employees by readiness." No such surface exists. `absence-popover.tsx` creates the absence row and closes.
- **Why a real op needs it:** The 14:00 Friday sick-call from the cook is the highest-friction 30 seconds in a hospitality manager's week. World-class WFM ranks replacements by (1) readiness, (2) overtime risk, (3) availability preference, (4) travel distance. Smartout has all four data sources (`protocol_assignment`, `employment_contract.agreed_weekly_hours`, `employee_availability`, profile location) but they are not assembled.
- **Sector:** Bistro (also Hotel)
- **Severity:** CRITICAL
- **Fix scope:** Sortie. Post-absence-creation hook calls `query_others_availability` + `check_readiness` for non-scheduled employees on the affected day → ranks → surfaces as Botsson chat message OR drawer "Finn erstatter" in schedule grid.

### GAP-SIM-B02 — Period "approved" status has no BFF route → owner sign-off is a ghost step 🔴 CRITICAL

- **What's missing:** `payroll.period_status` enum has `approved` value (`20260422110000_payroll_enums.sql:70`). All BFF routes guard against it. NO `POST /api/payroll/approve-period` exists. `PeriodHeader.tsx:80-103` renders only "Beregn på nytt" + "Lås periode" — no Godkjenn CTA.
- **Why a real op needs it:** Pontus cannot advance `locked → approved`. `approved_by` column never populated. Bokf. §13 audit needs recorded approver on locked lønnsgrunnlag.
- **Sector:** Bistro (compliance)
- **Severity:** CRITICAL
- **Fix scope:** Sortie. New BFF route + Server Action + Godkjenn button + audit trail emit.

### GAP-SIM-B03 — No feriepenger (10.2% / 12% / 12.5%) deviation check 🔴 CRITICAL

- **What's missing:** Deviation engine has W01-W14 covering rest, OT, tax card, TOIL, deductions, punch gaps, breaks, split shifts, wellness, minstelønn, 90%-regel. NO check on `vacation_pay_pct`.
- **Why a real op needs it:** Ferieloven §10 nr.3 mandates ≥ 10.2%; nr.4 mandates ≥ 12.5% for workers > 60; Riksavtalen typically 12%. Workspace with `vacation_pay_pct=5` locks a period containing 18 employees' silent underpayment. Compliance breach.
- **Sector:** Bistro (compliance, applies all sectors)
- **Severity:** CRITICAL
- **Fix scope:** Sortie. Add W-feriepenger to `deviation-checks.ts` reading `workspace_settings.vacation_pay_pct` + employee age for the 12.5% lane.

### GAP-SIM-B04 — No OTP (obligatorisk tjenestepensjon) check at period lock 🟠 HIGH

- **What's missing:** No check that qualifying employees have `pension_scheme` set. OTP §2 requires ≥2% above 1G for employees working ≥20% FTE. 18-staff bistro will have multiple qualifying employees.
- **Why a real op needs it:** Employer's mandatory OTP obligation invisible at period close. Tripletex push-sync (G1) would catch it later — but until that ships (Phase 7), there is NO compliance gate.
- **Sector:** Bistro (compliance, applies all sectors)
- **Severity:** HIGH
- **Fix scope:** Sortie. W-OTP check on period lock.

### GAP-SIM-B05 — Tariff floor not displayed per-shift during creation 🟠 HIGH

- **What's missing:** Erik builds 18 shifts without inline cost/tariff preview. `usePublishValidation` runs at publish time only. `week-grid-header.tsx:20` comments "this is display-only" — no per-shift tariff supplement breakdown (kveldstillegg / helgetillegg / nattillegg).
- **Why a real op needs it:** Real Bella Vista managers check tariff cost WHILE building the schedule. Riksavtalen §6 (26% > 21:00, 50% > 00:00) and helgetillegg (45% Sat/Sun) mean a Saturday 16-23 shift costs 35-40% more than Tuesday. Currently the gut-feel schedule discovers the cost at publish — exactly what the system should prevent.
- **Sector:** Bistro (also Hotel + Festival)
- **Severity:** HIGH
- **Fix scope:** Sortie. Wire `useEmployeeRuleContext` + `supplement_rule` into shift modal as read-only cost panel.

### GAP-SIM-B06 — No bootstrap-coordinator UI for tariff-binding decision 🟠 HIGH

- **What's missing:** `tariff_binding_decided` gate stays open forever — no `/dashboard/bootstrap` page, no dashboard widget, no Botsson coordinator. RPCs exist but no surface.
- **Why a real op needs it:** Riksavtalen tariff binding is a LEGAL decision (NHO Reiseliv collective agreement). An owner who doesn't know they need to make it won't. Every employee under unbound workspace gets wrong supplement calcs from day 1.
- **Sector:** Bistro (compliance, all sectors)
- **Severity:** HIGH
- **Fix scope:** Minor (dashboard widget calling `fn_list_open_bootstrap_gates`). Larger: full coordinator with Botsson explanation.

### GAP-SIM-B07 — First-shift assignment absent from employee onboarding wizard 🟠 HIGH

- **What's missing:** 8-step wizard creates profile + contract + payroll profile + GDPR consent. Zero of 8 steps creates a `schedule_shift` row.
- **Why a real op needs it:** Every new hire's first scheduled shift drives `employment_contract.start_date` alignment (Aml. §14-6). It's the first record Botsson uses to generate the pre-shift checklist. Erik should add Maria to Friday dinner DURING her onboarding, not as a separate step later.
- **Sector:** Bistro (also Hotel + Festival new-hire flow)
- **Severity:** HIGH
- **Fix scope:** Minor. Add "Første vakt" optional step OR post-completion CTA calling `POST /api/schedules/shifts` with `status=draft`.

### GAP-SIM-B08 — Trainee bootcamp auto-assignment never fires (missing position_slug capture) 🟠 HIGH

- **What's missing:** `auto_assign_protocols_to_new_employee` trigger fires on `profile INSERT` and matches on `profession.slug` → `protocol.name`. The invite form captures `role` (employee/manager/admin) NOT `position_slug` (Servitør, Kokk, Bartender). Without it, the join fails — zero protocols assigned.
- **Why a real op needs it:** A new server expects to start Allergenhandtering + Handhygiene on Day 1 without manager manually assigning them. That's the value prop.
- **Sector:** Bistro
- **Severity:** HIGH
- **Fix scope:** Minor. Add `position_slug` to invite form / wizard; OR call `fn_auto_assign_protocols_by_role(profile_id, position_slug)` from `completeWelcome` Server Action.

### GAP-SIM-B09 — Cover-request flow (assign + accept/decline) does not exist 🟠 HIGH

- **What's missing:** SIMULATION-PLAN Thursday step 6 expects "Kim accepts on mobile." Current paths: (a) drag-drop in schedule grid silently moves the shift, OR (b) marketplace open-shift claim. Neither is "Erik assigns Kim → push notification → accept/decline → grid updates."
- **Why a real op needs it:** Aml §14-6 requires reasonable notice for schedule changes. Silent drag-drop is non-compliant. Marketplace is for open shifts, not absence-replacement targeting.
- **Sector:** Bistro + Hotel (any absence-replacement scenario)
- **Severity:** HIGH
- **Fix scope:** Sortie. New `request_coverage(shift_id, target_profile_id, expiry_minutes)` capability tool creating time-boxed marketplace offer targeting specific employee + push notification.

### GAP-SIM-B10 — C2 intelligence pipeline absent — session channel never auto-briefs staff 🟠 HIGH

- **What's missing:** `compile-day-brief.ts` + `briefing.ts` tools exist in `packages/ai/src/capabilities/communication/`. No Event Engine process invokes them. `channel_event` table has 0 rows. Session channel created by trigger but auto-members only duty leader, not scheduled staff.
- **Why a real op needs it:** Wednesday dinner session at 16:00 should auto-receive a shift briefing (covers, special events, allergen flags) plus the new menu announcement. This is Smartout's promised differentiator over Slack/WhatsApp.
- **Sector:** Bistro + Hotel + Festival
- **Severity:** HIGH (defines the product's promise)
- **Fix scope:** Campaign. C2 projection trigger + briefing process + auto-member to session channel.

### GAP-SIM-B11 — Mobile cannot resolve / acknowledge deviation (`hms.resolve_deviation` web-only) 🟡 MEDIUM

- **What's missing:** `update-deviation-action.ts:134` is web Server Action only. Mobile `apps/mobile/src/lib/sync/types.ts:14` has `report_deviation` but no resolve/acknowledge action.
- **Why a real op needs it:** Friday POS-down deviation logged; end-of-shift Erik is on the floor with phone in hand; cannot close from mobile → must open laptop → friction wins.
- **Sector:** Bistro + Hotel + Festival (all mobile-floor ops)
- **Severity:** MEDIUM
- **Fix scope:** Minor. Add `resolve_deviation` to mobile write actions + BFF route `/api/mobile/deviations/:id/resolve`.

### GAP-SIM-B12 — Session-hook forms on mobile are PlaceholderForm (C4 confirmation never fires) 🟠 HIGH

- **What's missing:** `TaskModal.tsx:98-113` only renders `HACCPForm` for `taskType=haccp`. `checklist`, `confirmation`, `procedure`, `general` all render `PlaceholderForm` → "Kommer snart."
- **Why a real op needs it:** Allergen review hooks resolve to `checklist` or `procedure` types. Confirmation step is C4 path. On busy Friday 14 staff cannot sign off hooks → session cannot close.
- **Sector:** Bistro + Hotel + Festival
- **Severity:** HIGH
- **Fix scope:** Sortie. Build `ChecklistView`, `ConfirmationForm`, `ProcedureForm`, `GenericTaskForm` + wire into renderForm switch.

### GAP-SIM-B13 — Tips capability bodies are `not_implemented` skeletons 🟠 HIGH

- **What's missing:** `tipsSetPotTool` + `tipsAdjustShareTool` + `tipsApproveDistributionTool` + `tipsQueryOwnShareTool` all return `{ ok: false, error: "not_implemented" }` (lines 46-118). DB schema fully built. Intent classifier routes to capability → user-facing silent fail.
- **Why a real op needs it:** "Sett tipspotten til 1200 kr" silently fails. Saturday tip distribution non-functional.
- **Sector:** Bistro + Hotel + Festival
- **Severity:** HIGH
- **Fix scope:** Sortie 2 (already planned as "tips-leader-flows"). Stop-gap (30 min): add user-facing error string.

### GAP-SIM-B14 — `kind='new_menu'` schema present, picker not mounted (AnnouncementKindPicker dormant) 🟡 MEDIUM

- **What's missing:** `apps/web/src/app/dashboard/komm/_components/AnnouncementKindPicker.tsx` exists but is NOT mounted in `NyheterClient.tsx`. Web compose has no `kind` field. Defaults to DB default.
- **Why a real op needs it:** Erik publishes "Sommermeny live" — lands as `kind=general` — Maria's mobile shows it as system bubble alongside birthdays. Visual hierarchy lost on busy floor.
- **Sector:** Bistro + Hotel
- **Severity:** MEDIUM
- **Fix scope:** Minor. Mount the picker + add `kind` to compose payload.

### GAP-SIM-B15 — Home widget "latest news" + mobile bulletin layout both absent 🟡 MEDIUM

- **What's missing:** `NoShiftView.tsx` hardcodes placeholder "Ny sesongmeny er her!". `ChannelMessageBubble.tsx:55` renders announcements as system chat bubbles — no card, no pinned strip.
- **Why a real op needs it:** WhatsApp surfaces messages via push directly. Smartout's mobile-bulletin UX is currently weaker than WhatsApp for the same flow.
- **Sector:** Bistro + Hotel
- **Severity:** MEDIUM
- **Fix scope:** Sortie. Bulletin card component + home widget reading latest N announcements.

### GAP-SIM-B16 — Manager-overdue SLA badge is not realtime (15-s polling) 🟡 MEDIUM

- **What's missing:** `useMinKo` has `staleTime: 15_000` polling; no Supabase Realtime subscription on `engine_state`. SLA breach surfaces with up to 15-s delay.
- **Why a real op needs it:** Slack badges update via WebSocket instantly. Smartout has the infra (`use-channel-realtime.ts` pattern) — just not applied here.
- **Sector:** Bistro + Hotel
- **Severity:** MEDIUM
- **Fix scope:** Minor. Realtime subscription on `engine_state WHERE process_id='helpdesk_query_lifecycle'`.

### GAP-SIM-B17 — DuringShiftV2 + AfterShiftView task timeline gated behind flag (off by default) 🟡 MEDIUM

- **What's missing:** `EXPO_PUBLIC_DURING_SHIFT_V2` defaults to `false`. Maria clocked in → sees generic "Du er stemplet inn" — no task timeline visible on home screen.
- **Why a real op needs it:** Trainee should glance at phone and see "next task: allergen review." Otherwise must navigate. Flow-breaker.
- **Sector:** Bistro
- **Severity:** MEDIUM
- **Fix scope:** Minor. Flip flag default + verify.

### GAP-SIM-B18 — Bootstrap-cascade does not seed `payroll.workspace_settings` 🟠 HIGH

- **What's missing:** 12-step bootstrap-cascade has no `INSERT INTO payroll.workspace_settings`. `is_tariff_bound` reads NULL → coerces to `false` → Maria's ConsentStep silently omits the Riksavtalen tariff clause. Gate `tariff_binding_decided` stays permanently open.
- **Why a real op needs it:** Legally material. Every new Norwegian hospitality workspace starts unbound even if owner is NHO Reiseliv member.
- **Sector:** Bistro (all sectors)
- **Severity:** HIGH
- **Fix scope:** Minor. Add Step 9.5 to bootstrap-cascade OR trigger on `workspace INSERT`. Auto-close gate only after explicit decision.

### GAP-SIM-B19 — New workspace form has no niche selector (Bistro vs Fast-Food vs Catering) 🟡 MEDIUM

- **What's missing:** `platform-admin/workspaces/new/page.tsx` has `company_industry` (restaurant/hotel/cafe/bar/catering) but no `niche` field. Bootstrap can't differentiate Maaemo from Narvesen.
- **Why a real op needs it:** Niche drives shift templates + governance protocols. Default 07:00-15:00 "Morgenvakt" is school-canteen shape, not bistro reality (16:00 prep, 18:00 service). Trust-building failure at first login.
- **Sector:** Bistro (also Hotel via HOTEL-9)
- **Severity:** MEDIUM
- **Fix scope:** Minor. Add `niche` dropdown + store on `workspace.intelligence_data.niche`; cascade reads it for template selection.

### GAP-SIM-B20 — Manual supplement form labels free-text "Lønnskode" with `hint="A-melding"` — false promise 🟡 MEDIUM

- **What's missing:** `ManualSupplementForm.tsx:295` shows `<FieldLabel label="Lønnskode" hint="A-melding" />`. A-melding is explicitly OUT-OF-SCOPE per ADR-0250. Free-text input not bound to `payroll.salary_code` catalog.
- **Why a real op needs it:** Erik types "5210" believing it feeds Altinn A-melding. It doesn't. False compliance signal.
- **Sector:** Bistro + Hotel + Festival
- **Severity:** MEDIUM
- **Fix scope:** Minor. Rename hint OR bind to catalog + document CSV-export pipeline.

### GAP-SIM-B21 — Invitation link mobile-first UX: no App Store / Play Store CTA 🟡 MEDIUM

- **What's missing:** `/invite/[token]` web page + `/m/invite/[token]` mobile path both work but neither offers "Download the Smartout app" deep-link.
- **Why a real op needs it:** Hospitality onboarding happens on the floor, on a phone, 5 minutes before service. Friction here = abandonment.
- **Sector:** Bistro + Hotel + Festival
- **Severity:** MEDIUM
- **Fix scope:** Minor (30 min). `<AppBadge>` component on invite page UA-conditioned.

### GAP-SIM-B22 — `settle_shift` channel-locked to system; no manager / chat trigger 🟡 MEDIUM

- **What's missing:** `shift-lifecycle/tools.ts:541` rejects all channels except `"system"`. Only `daily_close` engine seeds `lock_checkout`.
- **Why a real op needs it:** Friday with one off-pattern shift, manager wants to run settlement immediately before payroll cut. No path.
- **Sector:** Bistro + Hotel
- **Severity:** MEDIUM
- **Fix scope:** Sortie. New `settlement.trigger_manual` capability at `confirm` authority.

### GAP-SIM-B23 — Readiness gate blocks `publish_shift` for trainees with partial readiness (no warn-vs-block flag) 🟡 MEDIUM

- **What's missing:** `evaluateReadinessGate` returns `{ allowed: false, reason: "readiness_gap" }` if ANY policy missing. Fires BEFORE four-eyes — override path never reached. No `require_full_readiness` config flag.
- **Why a real op needs it:** Bistros routinely put trainees on shift while completing training — that's the entire point of `trainee` status. Current behavior makes the status meaningless.
- **Sector:** Bistro + Hotel
- **Severity:** MEDIUM
- **Fix scope:** Sortie. Either (a) trainee status → warning not block, OR (b) `require_full_readiness` config.

---

## SECTOR — HOTEL (Phase 2: 3-day 80-guest wedding at Grand Hotel Sjølyst)

Hotel wedding surfaced **the structural absence of event-as-entity, room ops, and multi-department orchestration**. Cascade architecture CAN bend, but no hotel-vertical sub-package exists.

### GAP-SIM-H01 — No `event` first-class entity 🔴 CRITICAL

- **What's missing:** Linda cannot see "Marit + Espen wedding" as a named, multi-day, multi-department entity. No `event` / `banquet_event` / `event_booking` table. Closest is `planning_event` (D4 demand signal). `schedule_day_booking` is a 1D calendar annotation (no department_id FK, no end_time, no phase enum, no event_id).
- **Why a real op needs it:** Mews + Cloudbeds + Stayntouch + Opera all have first-class event objects (group block / BEO). The wedding is a single financial + operational event spanning 3 days × 5 departments. Without an event entity, it's 15 anonymous sessions with no parent.
- **Sector:** Hotel (also large-event restaurant + festival)
- **Severity:** CRITICAL
- **Fix scope:** ADR-grade. Introduce `event` (D4/D6 boundary) + `event_phase` (ceremony / reception / dinner / dancing) + `event_session` (sibling to `department_session`, cross-dept, multi-day) + `event_settlement` (C3 commercial).

### GAP-SIM-H02 — Room ops not modeled as D6 sessions 🔴 CRITICAL

- **What's missing:** Ingrid manages 35 rooms turning in parallel. `department_session` is 1-per-dept-per-date. No `room` table, no `room_status` enum, no `room_assignment`, no `room_turnover`.
- **Why a real op needs it:** Every PMS has a room board / housekeeping module with 5-8 status states. This is the daily operational heartbeat of housekeeping. Without it, Ingrid's work visibility in Smartout is zero.
- **Sector:** Hotel
- **Severity:** CRITICAL
- **Fix scope:** ADR-grade. New `room` sub-entity in D1 envelope + `room_assignment` + `room_status` machine. Likely under a `hospitality.no.hotel.v1` industry sub-package.

### GAP-SIM-H03 — Invoice billing model cannot address payer ≠ workspace company 🔴 CRITICAL

- **What's missing:** `invoice.company_id NOT NULL REFERENCES company`. Billing domain explicitly Smartout-bills-its-customers (ADR-0131). Bride's father (private individual) cannot be invoiced from Smartout.
- **Why a real op needs it:** Hotel event finance workflow LIVES on this — venue hire + catering + accommodation invoiced to organizer. Smartout produces only the labor cost, not the guest-facing revenue document.
- **Sector:** Hotel (also Festival per A11)
- **Severity:** CRITICAL (ADR-0131 boundary)
- **Fix scope:** ADR-grade. Either amend ADR-0131 OR introduce a separate `hospitality-ops` domain with `event_invoice` table (payer_name, payer_org_no, payer_email, payer_address). NOT in the SaaS billing schema.

### GAP-SIM-H04 — No event P&L roll-up across payroll period boundaries 🟠 HIGH

- **What's missing:** `shift_cost_snapshot` is per-shift; `daily_reconciliation` is per-dept-per-day; no `event_id` FK on shifts; no aggregation surface that maps "all shifts tagged to event X."
- **Why a real op needs it:** NHO Reiseliv internal governance: GM must sign off post-event P&L within 48 h. Currently a manual export operation.
- **Sector:** Hotel (also Festival)
- **Severity:** HIGH
- **Fix scope:** Sortie + (depends on H01). Add `event_id` FK to `schedule_shift`; build `v_event_pnl` view; UI dashboard tab.

### GAP-SIM-H05 — No on-call / tilkalling / event-only / volunteer employment_form variant 🟠 HIGH

- **What's missing:** `employment_form_enum`: `permanent | temporary | apprentice | practice | freelance`. No `tilkalling` (on-call), `event_only`, `volunteer`, or zero-hours. `temporary_requires_end_date` constraint blocks rolling on-call.
- **Why a real op needs it:** NHO Reiseliv tilkallingsvakt is a distinct employment category with separate OT thresholds. Hotel banquet teams + festival casuals + volunteers all need real categories.
- **Sector:** Hotel + Festival (also general flexibility)
- **Severity:** HIGH
- **Fix scope:** ADR-grade. Extend enum + amend Tripletex/DocuSeal templates + payroll engine rules per category.

### GAP-SIM-H06 — No guest CSAT / NPS / feedback surface anywhere 🟠 HIGH

- **What's missing:** Grep confirms zero tables/columns for `csat`, `nps`, `feedback`, `survey`, `nps_score`, `satisfaction`, `guest_feedback`.
- **Why a real op needs it:** Norsk Hotellstandard (NHO Reiseliv quality framework) requires post-event CSAT as a mandatory input to event debrief. Without it, the debrief record is incomplete and the data bridge from guest experience to staff KPI / training assignment doesn't exist.
- **Sector:** Hotel (extensible to bistro guest feedback)
- **Severity:** HIGH
- **Fix scope:** Campaign. New `guest_feedback` schema + collection surface (post-checkout link / QR) + analytics tab + KPI feedback into readiness scoring.

### GAP-SIM-H07 — Cross-department orchestration view does not exist 🟠 HIGH

- **What's missing:** Linda at 12:00 needs to see ALL 5 department sessions on one rail. `WebDayControl.tsx` renders ONE session. `day_line` is `UNIQUE (department_session_id, location_id)` — area-anchored within ONE session. No cross-dept event timeline.
- **Why a real op needs it:** Mews has group-blocks timeline; Opera has BEO multi-dept Gantt. Linda's core job at 12:00 has no surface in Smartout.
- **Sector:** Hotel (also Festival multi-zone)
- **Severity:** HIGH
- **Fix scope:** Sortie + (depends on H01). New "event-day-line" surface aggregating multiple `department_session_id`s.

### GAP-SIM-H08 — No seating-plan / table-assignment / structured event-change capture 🟠 HIGH

- **What's missing:** 16:30 Saturday bride change ("move table 4, +2 seats table 7, Uncle Erik not near band") has zero structured home. `schedule_day_booking.notes` + `session_task.description` = free text. No `seating_plan` / `table_assignment` table. No realtime propagation to kitchen + DJ + floor.
- **Why a real op needs it:** Last-minute coordination is the highest-value 10 minutes of a wedding day. Currently the system provides no leverage over the event coordinator's actual job.
- **Sector:** Hotel
- **Severity:** HIGH
- **Fix scope:** ADR-grade. New `seating_plan` + `table_assignment` schema; realtime broadcast; printable floor plan.

### GAP-SIM-H09 — No service-pause / hold state on `department_session_status` 🟡 MEDIUM

- **What's missing:** Enum: `upcoming | active | pending_signoff | closed | missed`. No `paused` / `hold` variant. At 20:00 speeches, Andreas cannot signal kitchen + bar to hold service.
- **Why a real op needs it:** Routine in banquet events. Currently requires manual task + channel message.
- **Sector:** Hotel
- **Severity:** MEDIUM
- **Fix scope:** Minor. Extend enum + UI button "Hold service" + propagate to dependent sessions.

### GAP-SIM-H10 — No banquet-captain role distinction (mid-service authority) 🟡 MEDIUM

- **What's missing:** `department_session.duty_leader_profile_id` = one. `team.leader_profile_id` = one. Neither models banquet captain — a service-execution authority distinct from administrative duty leader. `POSITION_REGISTRY` has `Hovmester` (FOH) but no `Bankettsjef`.
- **Why a real op needs it:** Andreas's authority during 17:00-22:00 service ≠ Linda's administrative authority. "Delay third course" is a real-time D6 decision with no Smartout surface.
- **Sector:** Hotel
- **Severity:** MEDIUM
- **Fix scope:** Sortie. New role + authority slot + UI surface for in-service decisions.

### GAP-SIM-H11 — No hotel-specific `roleCapabilityProfiles` (resepsjonist / bankett_captain / nattevakt / husholderske) 🟡 MEDIUM

- **What's missing:** `hospitalityPackage.roleCapabilityProfiles` defines 5 restaurant roles (`skiftleder | servitor | kokk | bartender | renhold`). No hotel roles. `industryPackage.label` is explicitly "Restaurant og servering."
- **Why a real op needs it:** Front-desk needs check-in protocol + GDPR + fire-evacuation + night-handover. Housekeeper needs biohazard + master-key. Banquet captain needs BEO-reading + event service sequence. None modeled.
- **Sector:** Hotel
- **Severity:** MEDIUM
- **Fix scope:** Campaign. `hospitality.no.hotel.v1` sub-package extending base. Procedures already partially exist in `defaults.ts:133-139` (NACE 55.101) but unlinked to readiness.

### GAP-SIM-H12 — Hotel NACE bootstraps with `overnight: false` + `defaultTariffKey: "riksavtalen"` 🟡 MEDIUM

- **What's missing:** `hospitality.ts:545,723` — overnight false, default tariff is restaurant. Hotel NACE 55.101 inherits these.
- **Why a real op needs it:** `hotell-natt` supplement (55 kr/t 00:00-06:00) requires overnight + hotelloverenskomsten. Hotel workspace gets wrong defaults out of the box.
- **Sector:** Hotel
- **Severity:** MEDIUM
- **Fix scope:** Minor (2-line) per hotel sub-package, OR niche-parametrized via D5.

### GAP-SIM-H13 — No event-domain deviation category (event deviations span depts but FK is single-session) 🟡 MEDIUM

- **What's missing:** `deviation_domain`: `safety | customer | procedure | system | material`. No `event` or `banquet`. `deviation.session_id` is single `department_session_id`. Multi-dept incidents (ceremony delay → banquet + bar + kitchen) require 3 separate rows.
- **Why a real op needs it:** Audit fragmentation. Post-event review can't reconstruct cross-dept incidents.
- **Sector:** Hotel + Festival
- **Severity:** MEDIUM
- **Fix scope:** Sortie. Add `event_id` FK to `deviation`; extend domain enum.

### GAP-SIM-H14 — Cross-dept note fanout blocked for managers (admin-only per ADR-0333) 🟡 MEDIUM

- **What's missing:** `comm.note_fanout_cross_dept` gated at `min_role=admin`. Andreas (manager) cannot push "Reception starting" to all depts.
- **Why a real op needs it:** Banquet captain runs the live event. Routing through admin = latency at the most time-critical handoff.
- **Sector:** Hotel
- **Severity:** MEDIUM
- **Fix scope:** Sortie. ADR-0333 Phase 2 allowlist (already planned).

---

## SECTOR — FESTIVAL (Phase 3: 1-day 1200-guest Sjølyst Sommerfest)

Festival surfaced **scope-boundary gaps**: pop-up lifecycle, casual labor, multi-vendor revenue, real-time ops. The cascade barely bends; commercial layer is entirely missing.

### GAP-SIM-F01 — No multi-vendor sub-workspace / vendor-scoped RLS 🔴 CRITICAL

- **What's missing:** Identity model is `user_identity → company → company_member → workspace → profile`. No parent-child workspace. Multi-workspace = user-is-member-of-multiple, not workspace-contains-sub. No vendor-scoped RLS partition below workspace.
- **Why a real op needs it:** Yara's 4 food vendors each have own staff + POS + payroll. Option A (4 workspaces) = no festival rollup; Option B (4 depts in one workspace) = vendor A's manager can see Vendor B's wage data → GDPR violation if vendors are independent businesses.
- **Sector:** Festival (also any multi-tenant event)
- **Severity:** CRITICAL
- **Fix scope:** ADR-grade. New `vendor_workspace` or `sub_workspace` concept + RLS partitioning. Major architectural decision.

### GAP-SIM-F02 — No casual / dagarbeid / one-day employment_form 🟠 HIGH

- **What's missing:** Casual festival workers must be `temporary` with `start_date=end_date=event_day` — but DocuSeal templates aren't built for 1-day temp; `tilkalling` implies recurring relationship; A-melding rules differ.
- **Why a real op needs it:** Øya hires 400, Hovefestivalen had 1500+. 1-day employment is a core Norwegian festival pattern (Aml. §14-9 with specific objective basis clause). Currently shoehorned into wrong category.
- **Sector:** Festival (overlaps H05)
- **Severity:** HIGH
- **Fix scope:** ADR-grade. New enum value + DocuSeal template + payroll-engine rule + A-melding integration timeline.

### GAP-SIM-F03 — No vendor revenue split schema (X% vendor, Y% festival) 🟠 HIGH

- **What's missing:** No table in `billing.*` / `public.*` / `payroll.*` captures revenue split. `billing.settlement_*` is Smartout's own customer invoicing reconciliation (not workspace-internal).
- **Why a real op needs it:** Festival model: vendor brings own staff + pays % rent OR takes % of revenue. Without schema → spreadsheet.
- **Sector:** Festival (also any commission/concession model)
- **Severity:** HIGH
- **Fix scope:** ADR-grade. New `revenue_split_rule` + `vendor_settlement` entities. Likely under a hospitality-ops domain.

### GAP-SIM-F04 — No event-scoped revenue envelope (P&L per event) 🟠 HIGH

- **What's missing:** Smartout bills workspaces on subscription. No `event_revenue_envelope` or `planning_event → billing` bridge. Custom reports partially fill via AI but ingredients/production/security costs have no schema home.
- **Why a real op needs it:** "What did we make at THIS festival vs last year's?" — no first-class representation.
- **Sector:** Festival + Hotel
- **Severity:** HIGH (commercial differentiator)
- **Fix scope:** Campaign. Event P&L envelope (depends on H01 event-entity).

### GAP-SIM-F05 — No pop-up department lifecycle (`valid_from` / `valid_until` / dissolve) 🟡 MEDIUM

- **What's missing:** `department` has only `is_active BOOLEAN`. No `valid_from` / `valid_until` / `dissolve_at`. Cascade engine has no "decommission" event. Post-festival = 7 zombie departments per event.
- **Why a real op needs it:** Pontus running 100 events/year = 100 zombie workspaces or 700 zombie departments.
- **Sector:** Festival
- **Severity:** MEDIUM
- **Fix scope:** Sortie. Add temporal columns + cascade dissolve event.

### GAP-SIM-F06 — No workspace lifecycle / archive state 🟡 MEDIUM

- **What's missing:** No `workspace.status` (active / archived / dissolved). Pop-up event workspaces persist forever.
- **Why a real op needs it:** Scale problem. Production landmine at 100 festivals/year.
- **Sector:** Festival (cross-cutting)
- **Severity:** MEDIUM
- **Fix scope:** Sortie. Workspace status machine.

### GAP-SIM-F07 — No real-time capacity counter / `entry_event` / crowd-density tracking 🟠 HIGH

- **What's missing:** Grep confirms no `ticket_scan`, `entry_log`, `crowd_count`, `gate_event` table. Supabase realtime not subscribed for attendance. `deviation_domain` has no `crowd_safety`.
- **Why a real op needs it:** Politiet krav til arrangement requires real-time occupancy vs fire-regulation cap. External ticketing (TicketCo / Billetto) owns this — Smartout has no integration hook.
- **Sector:** Festival
- **Severity:** HIGH (safety + regulatory)
- **Fix scope:** Campaign + integration. `external_event_source` integration + `entry_event` ingestion + capacity-gate UI.

### GAP-SIM-F08 — Multi-zone POS reconciliation (3 bars + 4 food vendors = 7 streams) 🟠 HIGH

- **What's missing:** `pos_account` is `UNIQUE (workspace_id, vendor)` and `vendor IN ('lightspeed_kseries')` only. Multiple vendor types (Square, Zettle, custom) in one workspace = impossible. Multi-account within one vendor = impossible.
- **Why a real op needs it:** Festival has 7 POS streams. Currently can connect 1 Lightspeed account; aggregation impossible.
- **Sector:** Festival
- **Severity:** HIGH
- **Fix scope:** Sortie. Drop UNIQUE; add `zone_id` discriminator; extend vendor enum.

### GAP-SIM-F09 — No cash float (open / close / variance) tracking 🟡 MEDIUM

- **What's missing:** `daily_reconciliation.revenue_cash` = gross. No `float_open` / `float_close` / `variance` columns. Bar opening float (deployed 14:00) → closing count (00:00) → variance (theft / error / donation) has no home.
- **Why a real op needs it:** Daily problem in every bar — acute at 3-zone festival.
- **Sector:** Festival + Bistro + Hotel
- **Severity:** MEDIUM
- **Fix scope:** Minor. Add `float_open` + `float_close` columns + variance computed column.

### GAP-SIM-F10 — `deviation_domain` lacks `security` / `crowd_safety` / structured incident types 🟠 HIGH

- **What's missing:** Domain enum: `safety | customer | procedure | system | material`. No `security`. No incident_type / escalation_agency / external_ref / responding_profile_id[] / location_label / guest_ref. `system_deviations JSONB` is untyped.
- **Why a real op needs it:** Sigrid's security log needs structured fields for Politiet post-event report. Medical handoff at 20:45 (guest collapse) has nowhere to record paramedic arrival or hospital transfer.
- **Sector:** Festival + Hotel (security/incident)
- **Severity:** HIGH (regulatory + audit)
- **Fix scope:** Sortie. Extend `deviation_domain`; new `deviation_incident_meta` table or JSONB schema; typed system_deviations.

### GAP-SIM-F11 — No production-schedule / multi-block sub-session model 🟠 HIGH

- **What's missing:** `department_session` has one `planned_open` + one `planned_close`. Stage has 3 locked blocks (opener / middle / headliner) within one day. `session_hook` is reactive trigger, not hard wall.
- **Why a real op needs it:** Liv (stage manager) coordinates artist soundcheck windows + stage cues + AV transitions + rider compliance. None of these exist.
- **Sector:** Festival (also any time-locked event)
- **Severity:** HIGH (entirely-missing role)
- **Fix scope:** Campaign. New `production_block` entity within session OR `event_phase` from H01 extended for stage cues.

### GAP-SIM-F12 — HITL pattern on `publish_announcement` adds 5-15s latency to crowd-surge alerts 🟠 HIGH

- **What's missing:** ADR-0398 enforces draft-confirm pattern. Under crowd-surge at 20:15 mid-headliner, Magnus needs <30 s push to 60 staff. The mandatory tap → commit → fan-out is 5-15 s minimum. No emergency-broadcast fast path.
- **Why a real op needs it:** Safety. ADR-0398 trade-off is wrong for emergency comms.
- **Sector:** Festival (safety)
- **Severity:** HIGH
- **Fix scope:** ADR-grade. Amend ADR-0398 — emergency broadcast capability with elevated authority and no HITL.

### GAP-SIM-F13 — No `on_shift_only` channel-message visibility scope; `on_duty` resolver caps at 500 + volunteer blind spot 🟡 MEDIUM

- **What's missing:** `channel_message_visibility`: `all_members | admins | targeted_members`. No `on_shift_only`. `on_duty` resolver has `LIMIT 500` (silent truncate at scale); volunteers never appear (no `time_entry` row → no employment).
- **Why a real op needs it:** Pre-doors briefing must reach on-site staff only. Volunteers must be reachable.
- **Sector:** Festival + Hotel
- **Severity:** MEDIUM
- **Fix scope:** Sortie. New visibility scope + audience-resolver volunteer path (depends on H05 volunteer enum).

### GAP-SIM-F14 — No POS-throughput / zone-level monitoring events 🟡 MEDIUM

- **What's missing:** `query_monitor_alerts` queries `engine_event` for `ops.monitor.%`. No producer for physical-zone alerts (crowd density, POS queue depth, bar throughput).
- **Why a real op needs it:** Mid-headliner Magnus wants "how many transactions last 5min at Bar B" — no surface.
- **Sector:** Festival
- **Severity:** MEDIUM
- **Fix scope:** Sortie. POS event ingestion → `ops.monitor.*` event production.

### GAP-SIM-F15 — Subcontractor / agency-labor model absent (security via Vaktvirksomhetsloven license) 🟡 MEDIUM

- **What's missing:** Sigrid + 10 security likely from licensed security company (Vaktvirksomhetsloven). They are subcontractors, not Pontus's employees. No subcontractor / agency-labor schema.
- **Why a real op needs it:** Festival reality. Currently they'd be entered as workspace employees → wrong.
- **Sector:** Festival
- **Severity:** MEDIUM
- **Fix scope:** ADR-grade. New `external_contractor` schema with separate payroll boundary.

### GAP-SIM-F16 — Runner / zone-routing task dispatch absent 🟡 MEDIUM

- **What's missing:** `task` capability has `create_session` + `create_day_ad_hoc`. No zone-routing / batch-runner-dispatch concept.
- **Why a real op needs it:** Vegard (trainee runner) needs batched task feed from physical zones. Currently chat one-by-one.
- **Sector:** Festival
- **Severity:** MEDIUM
- **Fix scope:** Sortie. Zone-aware task routing.

---

## CROSS-CUTTING (touches multiple sectors)

### GAP-SIM-X01 — `tip_pool` is single-session UNIQUE → blocks any event tip distribution

Already documented as BUG-SIM-23 (mechanical) AND structural here: the lack of an `event_tip_pool` parent is the schema sibling of GAP-SIM-H01. 5 agents flagged. **Promotion: this and H01 are the same architectural decision.**

### GAP-SIM-X02 — `employment_form_enum` lacks 3 categories that real Norwegian ops use

Volunteer (NULL pattern conflicts) + tilkalling/on-call + casual-day. Documented as BUG-SIM-01 + GAP-SIM-H05 + GAP-SIM-F02. **Same ADR.**

### GAP-SIM-X03 — No event-entity / event-FK / event-aggregation across the schema

H01 (event entity) + H04 (event P&L) + H07 (orchestration view) + F04 (event revenue envelope) + the tip-pool + reconciliation gaps. **All resolve under one ADR introducing `event` as a first-class D4/D6 entity.**

### GAP-SIM-X04 — Compliance silence: 3 critical Norwegian-law gates at period close

W-feriepenger (Ferieloven §10), W-OTP (OTP-loven §2), period-approved sign-off (Bokf. §13). All flagged by A5. Period lock currently masks compliance gaps the operator believes the system catches.

### GAP-SIM-X05 — A-melding scope boundary creates false-promise UX

ADR-0250 marks A-melding out of scope. UI ("Lønnskode hint=A-melding") and the operator's mental model both contradict this. **Either ship the integration OR remove A-melding signals from UI.**

### GAP-SIM-X06 — C2 intelligence pipeline (briefing + auto-member + session channel auto-population) is the missing Smartout differentiator

A4 flagged. The single feature that would make Smartout obviously better than WhatsApp/Slack for hospitality is the auto-shift-briefing in session channel. Designed, partially built, not wired.

### GAP-SIM-X07 — Mobile cannot complete the in-shift loop (deviation resolve + session-hook forms + tips + settlement trigger)

GAP-SIM-B11 + GAP-SIM-B12 + GAP-SIM-B13 + GAP-SIM-B22 — all force the floor manager to switch to web. Per ADR-0133 "mobile executes" — but the execute verbs are partly stubbed.

---

## Does cascade bend, or do we need new industry packages?

**Bistro:** Cascade fits today. Gaps are decision-support + execution polish + compliance gates. **No new architecture moves needed.**

**Hotel:** Cascade architecture CAN bend. What's missing is the `hospitality.no.hotel.v1` industry sub-package per A6's verdict:
- `event` entity at D4/D6 boundary
- `room` sub-entity in D1 envelope + `room_status` machine
- `event_session` sibling to `department_session` (multi-day, cross-dept)
- `event_settlement` (C3 commercial)
- `cross_department_tip_pool` with split config
- Midnight-shift boundary fix (BUG-SIM-27)
- Hotel `roleCapabilityProfiles` (resepsjonist / bankett_captain / nattevakt / husholderske)

**Per cascade spec §2.2:** "D5 changes weights, thresholds, and defaults throughout." This can be a niche-parameterization of `hospitality.ts` rather than a new IndustryPackage.

**Festival:** Cascade barely bends. Beyond the hotel-style event entity, festival needs:
- Pop-up department + workspace lifecycle (F05 + F06)
- Multi-vendor sub-workspace (F01) — **truly new architecture**
- Vendor revenue split schema (F03) — **new domain**
- Real-time capacity / `entry_event` (F07) — **integration spine missing**
- Production-block / stage-cue model (F11) — **new entity**
- Subcontractor / agency-labor (F15) — **new identity model**
- Emergency-broadcast fast path (F12) — **ADR-0398 amendment**

**Verdict:** Hotel is a niche sub-package on existing cascade. Festival requires architectural moves beyond hospitality — likely a separate `event-operations` domain with its own ADR family.

---

## Strategic priority matrix (impact × effort)

```
                    EFFORT
              Low                       High
        ┌────────────────────────┬──────────────────────────────┐
        │  HIGH IMPACT × LOW     │  HIGH IMPACT × HIGH          │
        │  EFFORT (DO NOW)       │  EFFORT (CAMPAIGN)           │
        │                        │                              │
        │  • B05 tariff floor    │  • H01 event entity          │
   HIGH │  • B01 replacement     │  • H02 room ops              │
        │    suggestion          │  • H03 event invoice         │
        │  • B02 approve-period  │  • F01 multi-vendor          │
        │  • B07 first-shift     │  • X06 C2 pipeline           │
        │  • B12 hook forms      │  • F11 production-block      │
        │  • X04 compliance gates│                              │
        ├────────────────────────┼──────────────────────────────┤
        │  LOW IMPACT × LOW      │  LOW IMPACT × HIGH           │
        │  EFFORT (POLISH)       │  (DEPRIORITIZE)              │
        │                        │                              │
        │  • B14 kind picker     │  • F07 real-time capacity    │
   LOW  │  • B15 home widget     │    (depends on external      │
        │  • B16 realtime SLA    │    integration anyway)       │
        │  • B19 niche selector  │  • F15 subcontractor model   │
        │  • B21 invite app CTA  │                              │
        └────────────────────────┴──────────────────────────────┘
```

---

## World-best WFM gap list — what's missing for Smartout to beat Planday, Quinyx, Tamigo

Smartout's positioning is **"AI operating system for shift-based businesses"** — not just scheduling, but cascade-aware operations + compliance + AI co-pilot. The competitive gaps:

| Competitor strength | Smartout status | Gap | Sortie/Campaign |
|---|---|---|---|
| **Replacement suggestion on absence (Quinyx, Tamigo)** | UI not built | B01 — backend data exists, no surface | Sortie |
| **Tariff cost preview during scheduling (Tamigo, Planday)** | Display-only comment | B05 — wire `supplement_rule` into modal | Sortie |
| **Period approval workflow (all major)** | Status enum present, no route | B02 — BFF + button + audit | Sortie |
| **Feriepenger / OTP compliance gates (all Nordic WFM)** | No checks | X04 — 3 W-checks missing | Sortie |
| **Mobile-floor deviation resolve (best-in-class)** | Web-only | B11 — sync action gap | Minor |
| **Auto-shift-briefing in channel (truly differentiating)** | Built, not wired | X06 — C2 projection trigger + auto-member | Campaign |
| **Event ops (none of Planday/Quinyx/Tamigo has this well)** | Absent | X03 — event entity is white-space opportunity | ADR + Campaign |
| **GPS clock-in + geofence enforcement (Planday has)** | UI animation only | BUG-SIM-10 — wire `getPosition` | Minor |
| **Guest CSAT bridge to staff KPI (no competitor has this)** | Absent | H06 — guest_feedback schema + KPI feedback | Campaign |
| **Trainee → ready workflow with auto-protocol assignment (Smartout USP)** | Trigger fires, position_slug missing | B08 — invite captures position | Minor |
| **Multi-zone POS reconciliation (none has this for hospitality)** | 1 vendor per workspace | F08 — drop UNIQUE + zone_id | Sortie |
| **Real-time crowd / capacity (event-specific, no general WFM has)** | Absent | F07 — out-of-scope, integration play | Long-term |

**Where Smartout can win (no competitor has):**

1. **Cascade-aware schedule that respects readiness gates + tariff rules + Aml. compliance at publish time** — close BUG-SIM-06 + GAP-SIM-B05 + GAP-SIM-B23.
2. **Auto-shift-briefing in session channel** — close GAP-SIM-X06 (C2 pipeline).
3. **Replacement suggestion ranking by readiness + OT-risk + availability** — close GAP-SIM-B01.
4. **Event-as-entity bridge from D4 demand to D6 production to C3 commercial** — close GAP-SIM-X03 family (hotel + festival).
5. **Guest experience → staff KPI loop** — close GAP-SIM-H06.

**Where Smartout MUST close to avoid losing on baseline:**

1. Period approval + compliance gates (X04 + B02) — basic WFM hygiene.
2. Replacement suggestion (B01) — table-stakes for absence management.
3. Tariff floor in shift modal (B05) — Tamigo + Planday have it.
4. Mobile execute parity (X07) — Quinyx mobile is best-in-class; Smartout mobile is stubbed.

---

## Gap summary by sector + severity

| Sector | CRITICAL | HIGH | MEDIUM | LOW | Total |
|---|---|---|---|---|---|
| Bistro | 3 (B01, B02, B03) | 9 (B04, B05, B06, B07, B08, B09, B10, B12, B13, B18) | 9 (B11, B14, B15, B16, B17, B19, B20, B21, B22, B23) | — | 22 |
| Hotel | 3 (H01, H02, H03) | 5 (H04, H05, H06, H07, H08) | 6 (H09, H10, H11, H12, H13, H14) | — | 14 |
| Festival | 1 (F01) | 6 (F02, F03, F04, F07, F08, F10, F11, F12) | 5 (F05, F06, F09, F13, F14, F15, F16) | — | 16 |
| Cross-cutting | — | 7 (X01-X07) | — | — | 7 |
| **Total** | **7** | **27** | **20** | **0** | **47** |

---

## Evidence

All finding files: `findings/agent-{1..11}-*.md`
Code-traced; every claim has file:line.
Dedup verified against `docs/test-runs/2026-05-23-journey-sweep/BUGS.md`.
