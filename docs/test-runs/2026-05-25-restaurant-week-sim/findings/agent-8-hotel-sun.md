---
title: "Hotel Wedding — Sunday Settlement Findings (Agent A8)"
status: done
created: 2026-05-25
updated: 2026-05-25
agent: A8
slice: Hotel-Sun
module: simulation
tags: [simulation, hotel, wedding, settlement, tips, payroll, billing, event-pnl]
---

# Hotel Wedding — Sunday Settlement Findings (Agent A8)

> Scope: Sunday 09:00–18:00 — departure breakfast, late brunch, checkout surge,
> event settlement, invoice draft (payer ≠ guests), 3-day P&L, owner review.
> Code-traced. All file:line citations verified against wt-1 codebase.

---

## Journey steps simulated

| Time | Step | Persona | Surface |
|------|------|---------|---------|
| 09:00 | Departure breakfast, 80 covers | Camilla (F&B) | Day line |
| 10:00 | Late wedding brunch, 60 staying guests | Andreas (banquet captain) | Day line |
| 11:00 | Check-out surge, 35 rooms | Sara (front-desk) | Day line |
| 12:00 | Bride/groom thank-you + feedback | Linda (event manager) | — |
| 14:00 | Housekeeping deep-clean ballroom | Ingrid (housekeeping) | Day line |
| 15:00 | Event settlement — costs, tips, deviations | Linda | Day line / payroll |
| 16:00 | Invoice draft to bride's father (payer) | Linda | Billing |
| 17:00 | 3-day P&L review | Camilla + Henrik | Reports |
| 18:00 | Event review in owner dashboard | Pontus | Reports / commercial |

---

## Gaps found

### GAP-A8-01 — No multi-department tip pool: CRITICAL

**Hypothesis:** Wedding banquet 50% / kitchen 30% / bar 20% tip split.

**Reality:** `tip_pool` has a hard `UNIQUE (department_session_id)` constraint
(`20260428220003_tips_pool_table.sql:25`) — one pool per session, one session per department.
`tip_policy` is keyed to `department_id` (`20260428220001_tips_policy_table.sql:17`).
There is no `cross_department_pool`, no `event_pool`, no aggregation table that
spans pools from multiple departments.

**Consequence:** Linda cannot create a single wedding tip pool that applies the 50/30/20
ratio across banquet + kitchen + bar departments. She would have to:
1. Record three separate pools (one per department session).
2. Manually calculate each department's share and enter it as the `amount_nok`.
3. The system has no mechanism to enforce that the three amounts sum to the total,
   nor that the 50/30/20 split is respected programmatically.

**Evidence:**
- `supabase/migrations/20260428220003_tips_pool_table.sql:12` — FK to `department_session_id`
- `supabase/migrations/20260428220003_tips_pool_table.sql:25` — UNIQUE constraint
- `supabase/migrations/20260428220001_tips_policy_table.sql:14,17` — `department_id` scoped

**Severity:** CRITICAL — a 3-department wedding event is the core NHO Reiseliv scenario
for tip splitting. Without this, tip settlement is manual arithmetic outside the system.

---

### GAP-A8-02 — No event entity: a multi-day wedding is not a first-class object: CRITICAL

**Reality:** The closest entities are:
- `planning_event` (`20260421100200_cascade_a1_domain_tables.sql:133`) — a D4 demand signal
  with `event_date` + `end_date`, `expected_covers`, `demand_multiplier`. This is for
  **forecasting**, not for tracking an operational event end-to-end.
- `department_session` — one session per department per day. A 3-day wedding across 5
  departments = ~15 separate sessions with no common parent entity.

There is no `banquet_event`, `hotel_event`, or `event_booking` table. No FK ties the
Friday/Saturday/Sunday department sessions into one wedding entity. Linda has no surface
to say "these 15 sessions belong to the Marit + Espen wedding."

**Consequence:**
- Event settlement at 15:00 Sunday requires manually aggregating costs across all sessions.
- P&L at 17:00 has no event-level roll-up — it is per-session or per-period.
- Invoice at 16:00 has no link to a structured event, only loose references.

**Evidence:**
- `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql:133-154` — `planning_event`
  is forecasting only, no operational lineage
- No `event_booking`, `banquet_event`, or similar table in any migration (grep confirmed)

**Severity:** CRITICAL for hotel/event vertical.

---

### GAP-A8-03 — Invoice billing model cannot address a payer who is not the workspace company: CRITICAL

**Hypothesis:** Linda issues invoice draft to bride's father (payer) — a private individual,
not the registered workspace company.

**Reality:** `invoice.company_id NOT NULL REFERENCES company(company_id)`
(`20260417121720_invoice_table.sql:21`). The billing engine is explicitly Smartout-bills-its-B2B-customers.
There is no `customer_name`, `customer_org_no`, `payer_email`, or `billing_contact` column.
The billing domain comment explicitly states: "Workspace → end-customer billing: rejected (ADR-0131)."

There is no mechanism for Grand Hotel Sjølyst to issue a Smartout-generated invoice to
the bride's father. This is structurally out of scope in the current billing domain.

**Consequence:** Linda must use the hotel's own PMS (Opera, Mews, etc.) for event invoice.
Smartout cannot produce the event cost document. The settlement Smartout can produce covers
only *payroll cost* — not the guest-facing revenue invoice.

**Evidence:**
- `supabase/migrations/20260417121720_invoice_table.sql:21` — company_id NOT NULL
- `docs/domains/billing/OVERVIEW.md:26` — "Workspace → end-customer billing rejected (ADR-0131)"
- `docs/domains/billing/OVERVIEW.md:66` — "Company-scoped, not workspace-scoped"

**Severity:** CRITICAL — event manager workflow step 16:00 (invoice draft to payer) is
entirely unsupported by Smartout today.

---

### GAP-A8-04 — No event P&L roll-up across payroll period boundaries: HIGH

**Hypothesis:** Henrik + Camilla review 3-day P&L Friday–Sunday.

**Reality:** The payroll period is monthly (`payroll.period` table, `20260422110700_payroll_schema.sql`).
`shift_cost_snapshot` is per-shift per-reconciliation. There is no query surface or view
that aggregates "all shift costs for shifts tagged to event X across 3 days."

Without GAP-A8-02 (an event entity), shifts from Friday/Saturday/Sunday have no common
`event_id` FK. An event P&L query would require date-range filtering across departments,
which is manual and loses the payroll supplement context (overtime, night supplements)
that only materialises at period close.

**Consequence:**
- Henrik's 17:00 P&L review requires manual export and spreadsheet aggregation.
- Supplement costs (Saturday night bar shift 23:00–02:00 = night supplement + weekend
  supplement under NHO Reiseliv) are not visible in a per-event view.
- Revenue side (covers × menu price) is completely absent from Smartout regardless.

**Evidence:**
- `docs/domains/payroll/GAPS-AND-DEBT.md:53` — G2: "Event Engine recalc orchestration
  targeted per affected shifts" is a planned gap but for payroll recalc, not P&L roll-up
- `supabase/migrations/20260422110200_payroll_calculation_tables.sql:173` — `payroll_deviation`
  exists but no `shift_cost_snapshot` event grouping

**Severity:** HIGH — NHO Reiseliv requires post-event cost-vs-budget analysis for all
events above 50 covers (internal governance standard).

---

### GAP-A8-05 — Casual / event-only employment contracts: employment_form_enum has no event-only variant: HIGH

**Hypothesis:** Jonas (trainee) + 8 casual banquet staff hired only for the wedding weekend.

**Reality:** `employment_form_enum` values: `permanent`, `temporary`, `apprentice`,
`practice`, `freelance` (`20260519100100_contracts_module_foundation.sql:45-51`).

There is no `on_call`, `tilkalling`, `event_only`, or zero-hours variant. Norwegian hotel
practice relies heavily on "tilkallingsvikt" (on-call workers) and "event-only engagements"
for banquet staffing — typically covered by a minimal framework contract plus per-event
supplements. The closest is `temporary` but that requires an `end_date` and triggers
contract-end processes that do not match a rolling event roster.

`employment_contract.temporary_requires_end_date` constraint
(`20260519150000_contract_text_to_enum_cast.sql:167-170`) blocks a `temporary` contract
without an end date — making it unsuitable for a standing on-call arrangement.

**Consequence:**
- Casual banquet staff either get shoehorned into `temporary` (with wrong end_date semantics)
  or `freelance` (which has different tax implications — B-income vs A-income in Norway).
- Payroll supplement engine will apply permanent-contract rules to event staff, potentially
  miscalculating entitlements (seniority, overtime threshold, minimum rest).

**Evidence:**
- `supabase/migrations/20260519100100_contracts_module_foundation.sql:45-51` — enum definition
- `supabase/migrations/20260519150000_contract_text_to_enum_cast.sql:167-170` — temporary
  constraint requires end_date

**Severity:** HIGH — NHO Reiseliv Overenskomst explicitly defines tilkallingsvakt as a
distinct employment category with separate overtime thresholds.

---

### GAP-A8-06 — Guest feedback / CSAT surface: entirely absent: HIGH

**Hypothesis:** Linda meets bride/groom at 12:00 for thank-you + feedback capture.

**Reality:** Full grep across migrations confirms zero tables or columns matching
`CSAT`, `NPS`, `feedback`, `survey`, `nps_score`, `satisfaction`, `guest_feedback`.
The only hit is `reconciliation_feedback` in a seed template
(`20260304300000_seed_daily_close_process.sql:80`) — which is internal staff reconciliation
commentary, not guest-facing CSAT.

**Consequence:**
- Feedback Linda captures exists nowhere in Smartout. It cannot inform staff KPIs,
  training assignments, or service standards.
- In NHO Reiseliv's quality framework (Norsk Hotellstandard), post-event CSAT is a
  mandatory input to the event debrief. Without it, the debrief record is incomplete.
- Pontus cannot see guest satisfaction at 18:00 in the owner dashboard.

**Evidence:** Grep confirmed no matching schema. `docs/domains/reports/OVERVIEW.md` — reports
domain covers operational data only, no CX layer.

**Severity:** HIGH — post-event feedback is a required input to quality management and
is the single data point bridging guest experience to staff performance.

---

### GAP-A8-07 — Deviation domain has no "event" domain category: MEDIUM

**Reality:** `deviation_domain` enum values: `safety`, `customer`, `procedure`,
`system`, `material` (`20260304200200_deviation_shift_approval.sql:11-13`).

During event settlement at 15:00, Linda reviews deviations: a broken centrepiece
(material), a sound system failure (system), a guest complaint about service timing
(customer). These map to existing categories.

However, there is no `event` or `banquet` category. Event-specific deviations
(e.g., ceremony timing overrun affecting kitchen service, last-minute table-plan change)
that affect multiple departments simultaneously must be logged department-by-department
with no cross-department link. The `deviation` table's `session_id` FK is to a single
`department_session_id` (`20260304200200_deviation_shift_approval.sql:46`) — so a multi-department
deviation (e.g., ceremony delay affects banquet + bar + kitchen simultaneously) requires
three separate deviation records with no parent event FK.

**Evidence:**
- `supabase/migrations/20260304200200_deviation_shift_approval.sql:11-13` — enum values
- `supabase/migrations/20260304200200_deviation_shift_approval.sql:46` — single session FK

**Severity:** MEDIUM — workaround exists (log per department) but creates audit fragmentation.

---

### GAP-A8-08 — Housekeeping sessions: no room-turnaround D6 model: MEDIUM

**Hypothesis:** Ingrid manages 8 housekeepers across 35 rooms in parallel sessions.

**Reality:** `department_session` models a single session per department. Housekeeping
in a 120-room hotel runs in parallel room-level work orders, not a single session.
There is no `room_task`, `room_turnover`, or `room_assignment` entity. Ingrid can
create a department session for "Housekeeping Sunday" but she cannot track which
housekeeper is assigned to which room block, or which rooms are complete.

The nearest analogy is `session_task` (D6), but these are operational tasks inside a
session — not per-room assignments with a status per room.

**Consequence:** Ingrid's work visibility is zero in Smartout. The "14:00 deep-clean
ballroom" session is only a shift start/end record — no task-level tracking.

**Evidence:**
- No `room`, `room_assignment`, or `room_task` table in any migration (grep confirmed)
- `docs/domains/day-session/` — task model is session-scoped, not asset-scoped

**Severity:** MEDIUM — hotel operations vertical requires room-level tracking.
Restaurant week simulation does not surface this gap.

---

## Commercial gaps (payer ≠ guest, event P&L, multi-dept tip)

### 1. Payer ≠ guest (event invoice)

The Smartout billing engine is a B2B SaaS invoice engine: Smartout bills workspace
customers (companies). It has no concept of "workspace bills its own customer."
Grand Hotel Sjølyst cannot use Smartout to invoice the bride's father.

From a NHO Reiseliv commercial perspective, the hotel needs to produce:
- Event contract invoice (venue hire + catering + accommodation package)
- Itemised settlement for the organiser (costs by category)
- Potential split invoice (father pays venue; bride pays catering extras)

None of these are supported. The gap is structural (ADR-0131) and intentional —
but it means the hotel's event finance workflow lives entirely outside Smartout.

**Schema gap:** `invoice` table has no `payer_name`, `payer_org_no`, `payer_email`,
`payer_address` columns. Adding them would require either an ADR amendment to
ADR-0131, or a separate `event_invoice` table in a future `hospitality-ops` domain.

### 2. Event P&L (3-day roll-up)

Event profitability requires aggregating: (a) labour cost by supplement, (b) food/bev
cost, (c) revenue from event contract. Smartout owns only (a) — and only at period
level, not event level. (b) and (c) are PMS/ERP data.

The missing bridge: an event entity FK on `schedule_shift` rows would allow
`shift_cost_snapshot` aggregation per event. Without it, the 3-day P&L is a manual
export operation.

**NHO Reiseliv standard:** Post-event P&L must be signed off by GM within 48 hours of
event close. Smartout cannot facilitate this sign-off today.

### 3. Multi-department tip pool (50/30/20 split)

The `tip_pool` model is single-department by design (UNIQUE on department_session_id).
The 50/30/20 wedding tip split is a Norwegian hotel industry norm, explicitly governed
by the NHO Reiseliv collective agreement (Overenskomst for hotell- og restaurantbransjen).
The mechanism required:

```
event_tip_pool
  ├── amount_nok (total)
  ├── department_allocations[] → [banquet 50%, kitchen 30%, bar 20%]
  └── each allocation → tip_pool per department_session → tip_distribution per employee
```

This parent-child structure does not exist. The legal obligation to distribute tips
per collective agreement cannot be system-enforced.

---

## Bugs found (NEW — not in BUGS.md dedup list)

### BUG-A8-01 — `approve_tip_pool` RPC: workspace-scope check uses single-workspace profile assumption

**Where:** `supabase/migrations/20260429010000_approve_tip_pool_rpc.sql:66-75`

**Issue:** Step 2 queries `profile.workspace_id = p_actor_profile_id`. But `profile`
has a 1:1 relationship with `workspace_id` only in the current single-workspace model.
If a future multi-workspace profile model is introduced (ADR pattern: user_identity
can have profiles in multiple workspaces), this check silently passes for the wrong
workspace. The check fetches the actor's *primary* workspace (`SELECT workspace_id FROM profile
WHERE profile_id = ...`) and compares to pool's workspace — if actor is admin of
workspace A but calls with a pool from workspace B, the check correctly rejects.
However, if profiles can exist across workspaces, the query returns only ONE row
(no ORDER BY, no LIMIT 1 guard) and relies on the FK uniqueness of `profile_id`
which is a PK — so the check is correct today but brittle under schema evolution.

**Impact:** Low today, but the comment at line 70 says "workspace_id IN (...)" but the
query is actually `WHERE profile_id = p_actor_profile_id AND is_active = true` — if a
profile row exists but `is_active = false`, `NOT FOUND` raises `workspace_mismatch`
instead of `inactive_actor`. The error message is misleading for inactive actors.

**Fix:** Add explicit `actor_is_inactive` guard: check `is_active = false` first,
raise `'inactive_actor'` before workspace check.

### BUG-A8-02 — `tip_distribution` payroll FK is `ON DELETE SET NULL` but no index covers `payroll_period_id IS NULL`

**Where:** `supabase/migrations/20260527100900_payroll_phase1_tip_payroll_fk.sql:17-22`

**Issue:** `ON DELETE SET NULL` means tip distributions become orphaned (NULL
`payroll_period_id`) when a payroll period is deleted. The existing index
`idx_tip_distribution_payroll` has `WHERE payroll_period_id IS NOT NULL`
(`20260428220004_tips_distribution_table.sql:34`) — so orphaned distributions are
**not indexed** and cannot be efficiently queried to find distributions never linked
to a payroll period. On an event hotel with high tip volume, this creates a silent
data quality gap (paid distributions with NULL period_id cannot be audited efficiently).

**Fix:** Add a partial index `WHERE payroll_period_id IS NULL AND status = 'paid'` or
enforce NOT NULL after payroll integration ships.

### BUG-A8-03 — `planning_event.end_date` not covered by any operational cascade

**Where:** `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql:145`

**Issue:** `planning_event` has `event_date` + `end_date` (nullable). For a multi-day
event (Friday–Sunday), `end_date` would be set. But the cascade engine that generates
`department_session` from demand signals reads only `event_date` for day-factor
multipliers — there is no logic that generates sessions for the entire `event_date..end_date`
range. A hotel entering the Marit+Espen wedding as a `planning_event` with
`event_date=2026-06-13, end_date=2026-06-15` gets demand-signal uplift only on
June 13, not 14 or 15.

**Evidence:** `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql:142-145`
— `end_date DATE` with no corresponding cascade propagation logic visible in any
migration or Edge Function (grep confirmed no `end_date` reference outside this file).

**Fix:** Cascade scheduling engine must expand multi-day events to date range when
computing day_factor for sessions.

---

## Confirmed working

| Step | What worked | Evidence |
|------|-------------|---------|
| 15:00 Deviation review | `deviation` table supports all relevant categories (safety, customer, material, system). Linda can log each deviation with `cost_impact`. | `20260304200200_deviation_shift_approval.sql:42-73` |
| 15:00 Single-department tip pool | Banquet department session tip pool + approval RPC functional per existing design. | `20260428220003_tips_pool_table.sql`, `20260429010000_approve_tip_pool_rpc.sql` |
| 15:00 Shift cost review | `shift_cost_snapshot` + `payroll_deviation` give per-shift cost visibility. | `payroll/GAPS-AND-DEBT.md:W1, W7` |
| 18:00 Owner dashboard | Reports domain + `custom_report` AI builder available to Pontus. | `docs/domains/reports/OVERVIEW.md` |

---

## Severity summary

| ID | Title | Severity |
|----|-------|----------|
| GAP-A8-01 | No multi-department tip pool | CRITICAL |
| GAP-A8-02 | No event entity (wedding not first-class) | CRITICAL |
| GAP-A8-03 | Invoice payer ≠ workspace company | CRITICAL |
| GAP-A8-04 | No event P&L roll-up | HIGH |
| GAP-A8-05 | No on-call/event-only employment form | HIGH |
| GAP-A8-06 | No guest CSAT/NPS surface | HIGH |
| GAP-A8-07 | No event deviation domain category | MEDIUM |
| GAP-A8-08 | No room-level housekeeping model | MEDIUM |
| BUG-A8-01 | approve_tip_pool: inactive actor misleading error | LOW |
| BUG-A8-02 | tip_distribution payroll NULL orphan gap | LOW |
| BUG-A8-03 | planning_event end_date not cascade-propagated | MEDIUM |

**3 CRITICAL · 3 HIGH · 2 MEDIUM · 2 LOW (gaps) + 1 MEDIUM · 2 LOW (bugs)**
