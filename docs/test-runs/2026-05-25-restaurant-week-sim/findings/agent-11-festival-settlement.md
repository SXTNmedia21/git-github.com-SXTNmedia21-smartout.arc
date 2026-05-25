---
title: "Festival Settlement — A11 Findings (22:00 → next morning)"
created: 2026-05-25
agent: A11
slice: Festival-settlement
status: draft
tags: [simulation, festival, settlement, casual-labor, vendor, tip-pool, p-and-l]
---

# A11 — Festival Settlement Findings
## "Sjølyst Sommerfest" — 22:00 → 08:00 next morning

> Scope: last call → food vendor close → security dispersal → stage crew strike →
> cash count → cashless POS reconciliation → vendor settlement → tip pool → trainee
> debrief → next-morning P&L review.
>
> Method: code-traced against migrations, domain GAPS-AND-DEBT files, and ADRs.
> All gaps are NEW (not in BUGS.md).

---

## 1. Simulation walkthrough — what Smartout can and cannot do

### 22:00 — Last call at bars (Jens manages 3 bar zones)

**What works:** Each bar zone is a `department`. Jens can close each zone's
`department_session` via the `session.close` capability (authority config seeded in
`supabase/migrations/20260525100000_seed_deviation_authority.sql`). The daily
reconciliation table (`supabase/migrations/20260304200100_daily_reconciliation.sql`)
accepts `revenue_card` + `revenue_cash` + `revenue_total` per department per date.

**GAP-A11-01 — No multi-zone aggregated cash close.**
`daily_reconciliation` has `UNIQUE (workspace_id, department_id, reconciliation_date)`
(`20260304200100_daily_reconciliation.sql:53`). Three bar zones = three separate
reconciliation records. Pontus has no single "bars total" rollup in the current
schema or in the reconciliation UI — he must manually sum three rows. No aggregate
view exists in code or migrations.

### 23:00 — Food vendors close (Yara coordinates 4 external vendors)

**What works:** If each food vendor is modelled as a Smartout `department`, they can
close sessions. If they have their own Lightspeed K-Series POS, `pos_account` +
`pos_sale_event` (ADR-0305, `supabase/migrations/20260611120000_wfm_foundation.sql:90`)
can ingest sale events per vendor once synced.

**GAP-A11-02 — POS vendor constraint is single-vendor-per-workspace.**
`pos_account` has `CONSTRAINT pos_account_vendor_check CHECK (vendor IN ('lightspeed_kseries'))`
and `CONSTRAINT pos_account_workspace_vendor_unique UNIQUE (workspace_id, vendor)`
(`20260611120000_wfm_foundation.sql:48,55`). Four food vendors using DIFFERENT POS
systems (some may use Square, Zettle, custom) have no integration path. Even if all
used Lightspeed: V1 = one Lightspeed account per workspace. Festival needs 4–5 POS
accounts per workspace. Hard schema blocker.

**GAP-A11-03 — Revenue split formula has no home in the data model.**
Festival model: food vendor brings own staff + pays rent % OR takes % of revenue.
No table in `billing.*`, `public.*`, or `payroll.*` captures "vendor keeps X% of
session revenue, festival keeps Y%". `billing.settlement_*` tables
(`supabase/migrations/20260522000000_billing_settlement_schema.sql`) are
Smartout-bills-its-customer-companies reconciliation tools (MEMORY.md confirmed:
accountant Erik confirms Smartout's invoices to its customers). They are not a
workspace-internal vendor revenue split ledger. This is a genuine new domain concept.

### 00:00 — Cash count per bar zone + cashless POS reconciliation (Magnus + Jens)

**What works:** `daily_reconciliation.revenue_cash` + `revenue_card` fields exist per
department session. Magnus can enter cash drawer count manually. POS card total can
flow from `pos_sale_event` aggregate via `v_pos_sales_hour` view
(`20260611120000_wfm_foundation.sql` — view definition present).

**GAP-A11-04 — Cash float tracking missing.**
There is no `float_open` / `float_close` / `variance` concept in `daily_reconciliation`
or any related table. Petty-cash float for bar zones (opening float deployed at 14:00,
closing count at 00:00, variance = theft/error/donation) has no schema home.
`revenue_cash` = gross takings, but NET = gross minus opening float. This gap affects
every bar every day, not just festival; it is acute at a 3-zone festival.

### 00:00 — Vendor settlement (revenue split)

**What works:** Nothing. See GAP-A11-03 above. This entire flow is outside current scope.

### 00:00 — Tip pool (bars + VIP restaurant + security?)

**What works:** `tip_pool` table (one pool per `department_session`,
`20260428220003_tips_pool_table.sql:9`), `tip_distribution` per employee
(`20260428220004_tips_distribution_table.sql`), three algorithms: `equal`,
`by_hours`, `by_role` (`20260428220000_tips_enums.sql`). `tip_policy` is
per-department with date-versioning (`20260428220001_tips_policy_table.sql`).
`approve_tip_pool` RPC exists (`20260429010000_approve_tip_pool_rpc.sql`).
This is genuinely well-built for a single department.

**GAP-A11-05 — No cross-department (festival-wide) tip pool.**
`tip_pool.department_session_id` is UNIQUE — one pool per session
(`20260428220003_tips_pool_table.sql:24`). A festival-wide tip pool across bar +
restaurant + security (if included) would need a parent "event pool" that aggregates
contributions from N department sessions. No such concept exists. Workaround: three
separate pools with manual cross-department pro-rata calculation. For festival tip
culture (e.g. stage crew + security share), the algorithm cannot span departments.

**GAP-A11-06 — Security tip eligibility has no policy mechanism.**
Norwegian tip culture is ambiguous about security staff. The `tip_policy` table has
no field for "eligible roles" beyond the `tip_algorithm` enum
(`equal | by_hours | by_role`, `20260428220001_tips_policy_table.sql:11`). The
`by_role` algorithm exists but `tip_role_weight` presumably handles weighting — not
exclusion. No "exclude role=security" rule without a new column.

### 00:00 — Trainee Vegard debrief

**What works:** Botsson can handle a debrief conversation. Vegard's training status
(`protocol_assignment`) and knowledge test scores are accessible. `personal_task` /
`emma_task` can record action items from the debrief session.

No new gap identified here — existing capability is sufficient for a 1:1 debrief
conversation.

### 08:00 — Pontus reviews total revenue per channel

**What works:** `daily_reconciliation` has per-department revenue totals. The reports
domain has 4 static tabs (overview/people/staffing/training,
`docs/domains/reports/GAPS-AND-DEBT.md:W1-W4`). AI wizard can query across departments.

**GAP-A11-07 — No event-scoped P&L view aggregating bar + food court + VIP + merch.**
`daily_reconciliation` is `UNIQUE (workspace_id, department_id, reconciliation_date)`.
An event P&L would need: revenue per channel (5 sources), minus labor cost per
department (from `shift_cost_snapshot`), minus ingredients (no table — external), minus
security cost, minus production cost. Only labor cost is in the model. The other cost
categories have no schema home. `reports` domain `DEV-1` explicitly notes that scope
was narrowed — all reconciliation work lives in day-session/billing/other domains
(`docs/domains/reports/GAPS-AND-DEBT.md:DEV-1`). A festival-morning P&L is not
achievable from current data without spreadsheet export.

### 08:00 — Deviation log (medical incidents, crowd alerts, breakages)

**What works:** `deviation_domain` enum includes `'safety'` and `'material'`
(`supabase/migrations/20260304200200_deviation_shift_approval.sql` line ~5).
`deviation_severity` covers `'high'` and `'critical'`. HMS `report_deviation_manual`
capability seeded. Security incidents (ejections, crowd surges) map to `safety` domain.
Medical liaison handoff maps to `safety/critical`.

**GAP-A11-08 — No `security_incident` deviation domain or crowd-specific category.**
`deviation_domain` values: `'safety', 'customer', 'procedure', 'system', 'material'`
(`20260304200200_deviation_shift_approval.sql`). A security ejection or crowd-surge
event is `safety` but there is no sub-category (e.g. `crowd_surge`, `medical`,
`ejection`). For festival post-mortem the deviation log cannot distinguish a broken
glass (material) from a medical incident (safety/medical) from an ejection
(safety/security) without reading free-text notes. No structured query possible.

**GAP-A11-09 — `system_deviations` JSONB column has no typed schema.**
`daily_reconciliation.system_deviations JSONB` (`20260304200100_daily_reconciliation.sql`)
is used for machine-generated deviations. No schema or enum governs the JSONB shape.
Festival automated alerts (capacity threshold breach, bar cash-out-of-balance) have
nowhere to land with a typed structure that can be queried post-event.

### 08:00 — Staff sign-off + payroll for casual labor

**What works partially:** `employment_form_enum` has `'temporary'` and `'freelance'`
values (`supabase/migrations/20260519100100_contracts_module_foundation.sql`). Tripletex
columns on `employment_contract` have `NULL`-tolerant CHECK constraints
(`20260515100100_employment_contract_tripletex_columns.sql`) — NULL = volunteer/exclude
from Tripletex sync. The payroll calc engine exists.

**GAP-A11-10 — No one-day / casual employment contract form.**
`employment_form_enum` values: `permanent, temporary, apprentice, practice, freelance`
(`20260519100100_contracts_module_foundation.sql`). Norwegian casual labor
("dagarbeid / engangsjobb") is distinct from `temporary` (which typically means
fixed-term contract > 1 day). For a festival employing 15–20 casual laborers for one
Saturday, each needs a one-day contract scoped to that date. No `casual` or `one_day`
enum value exists. Workaround is `temporary` with start_date = end_date = event day —
but DocuSeal contract templates are not built for this pattern.

---

## 2. Multi-vendor + casual-labor gaps

### GAP-A11-11 — A-melding delegation is explicitly out of scope (ADR-0250)
`docs/domains/payroll/GAPS-AND-DEBT.md:D7` and `docs/domains/payroll/ROADMAP.md:6`
confirm: Smartout does NOT submit A-melding. The accountant uses Tripletex/Visma with
Phase 3 CSV + Phase 4 PDF lønnsgrunnlag. For one-day casual labor, the employer
(festival operator = Pontus's company) MUST submit A-melding for each casual worker
within 5 days of payment (Ligningsloven + A-opplysningsloven § 3). Smartout has no
mechanism to produce an A-melding payload. Risk: Pontus relies entirely on Tripletex.
If Tripletex integration is not live (Tripletex push-sync = GAP G1, not built per
`docs/domains/payroll/GAPS-AND-DEBT.md:G1`), the lønnsgrunnlag CSV is the only handoff.
Manual A-melding submission for 20 casual workers.

### GAP-A11-12 — OTP-loven threshold not modelled (pensjon for temporary workers)
OTP-loven (Lov om obligatorisk tjenestepensjon) exempts workers who are employed for
< 12 months, or work < 20% of a full-time position. Festival casual labor typically
falls below threshold. Smartout has no `otp_exempt` flag or threshold calculator on
`employee_payroll_profile` or `employment_contract`. The payroll engine calculates
gross supplements and overtime but does not evaluate OTP obligation. If Pontus employs
the same casual workers at multiple festivals in the same year, cumulative duration
might cross the threshold — no tracking mechanism exists.

### GAP-A11-13 — Multi-vendor sub-workspace concept: no schema support
The CONCERT-FESTIVAL-PLAN.md asks: "4 food vendors — sub-workspaces or just vendors?"
(`CONCERT-FESTIVAL-PLAN.md:21`). Smartout's identity model is
`user_identity → company → company_member → workspace → profile`. There is no
`sub_workspace` or `vendor_workspace` concept. Food vendor staff would need to be
profiled as employees of the festival workspace, violating their real employer
relationship (the vendor company is their employer, not the festival promoter).
No multi-tenancy-within-workspace exists. Workaround: separate Smartout workspace per
vendor — but cross-workspace revenue split (GAP-A11-03) has no mechanism.

### GAP-A11-14 — Volunteer staff: timebank exists, but "volunteer" employment form is missing
`supabase/migrations/20260515100100_employment_contract_tripletex_columns.sql` comment
says: "NULL (volunteer — excluded from Tripletex sync)." This is a NULL pattern on
`employment_form` and `remuneration_type`, not a dedicated `volunteer` enum value.
`employment_form_enum` does not include `volunteer`. The festival has some unpaid
volunteer staff (perks instead of pay). A `NULL`-employment-form contract is
syntactically allowed but semantically unclear — is `NULL` "not set yet" or
"volunteer"? No distinguishable flag, no dedicated timebank account type for
volunteer-hours-as-currency (e.g. free ticket credit).

---

## 3. Event vs subscription commercial gap

**Core architectural fact (from MEMORY.md):** Smartout's commercial layer =
*Smartout bills its customer companies on usage* (merchant-of-record,
`billing/GAPS-AND-DEBT.md` §5 note). Settlement tables (`billing.settlement_*`) are
Erik the accountant confirming Smartout's own invoices to its customers — NOT a
workspace's internal revenue reconciliation.

### GAP-A11-15 — No event-scoped revenue envelope in the billing domain
Smartout bills workspaces on a subscription / usage model (invoices, `invoice` table,
`billing` schema). The festival model is: workspace Sjølyst Sommerfest runs one event,
generates ~NOK 1.2M gross revenue in one day. There is no `event_revenue_envelope`
or `planning_event` → billing bridge. `planning_event` exists in D4 Demand
(`supabase/migrations/20260421100200_cascade_a1_domain_tables.sql:idx_planning_event_workspace`)
but it drives staffing demand forecasts, not revenue attribution. Event-specific P&L
(what did we make at THIS festival vs last year's?) has no first-class representation.
Custom reports (`custom_report` table, `docs/domains/reports/GAPS-AND-DEBT.md:W5`) can
partially fill this via AI query, but the data they query (labor cost per shift,
reconciliation revenue per department) does not include ingredients, production, or
external vendor costs.

### GAP-A11-16 — Billing engine is month-scoped; festival = same-day open+close
`billing.settlement_period` enforces `UNIQUE (workspace_id, period_start, period_end)`
(`supabase/migrations/20260522000000_billing_settlement_schema.sql`). The settlement
model assumes a calendar-month period. A festival workspace may run for 1 day within
a monthly billing period, then be dormant. No mechanism to close a workspace-internal
event period independently of the billing settlement period. If Pontus runs 3 festivals
in June under one workspace, he cannot separate the P&L per event within the June
settlement period without department-level filtering in a spreadsheet.

### GAP-A11-17 — Pop-up department has no lifecycle (create + dissolve)
`department` in D1 has no `is_active` flag or end-date concept (verified: no
`department_active_until` or `department_status` column in migrations). The festival
needs 6 temporary departments (bar-zone-a, bar-zone-b, bar-zone-c, food-court,
vip-restaurant, stage-crew). After the event, these departments are noise in the
workspace and in future schedule planning. No `dissolve_department` capability or
soft-delete mechanism exists. This is distinct from `channel.is_active` (which is in
the staged migration `20260625130000_channel_is_active_column.sql` per git status, but
channels ≠ departments).

---

## 4. Summary of new gaps (deduplicated against BUGS.md)

| # | Gap | Severity | Domain affected |
|---|---|---|---|
| A11-01 | No multi-zone revenue rollup (3 bar zones) | medium | day-session / reports |
| A11-02 | `pos_account` single-vendor-per-workspace constraint | high | WFM / POS |
| A11-03 | No vendor revenue split schema (X% to vendor, Y% to festival) | high | billing (new concept) |
| A11-04 | No cash float tracking (open/close/variance) | medium | day-session |
| A11-05 | No cross-department festival-wide tip pool | medium | tips |
| A11-06 | No role-exclusion in tip policy (security eligibility) | low | tips |
| A11-07 | No event-scoped P&L aggregating all cost categories | high | reports |
| A11-08 | No sub-category on `deviation_domain` for crowd/medical/ejection | low | HMS |
| A11-09 | `system_deviations` JSONB untyped — no structured festival alert schema | low | day-session |
| A11-10 | No one-day casual employment contract form (dagarbeid) | high | contracts / payroll |
| A11-11 | A-melding out of scope; casual labor A-melding = manual only | high | payroll (scope) |
| A11-12 | OTP-loven threshold not calculated for casual workers | medium | payroll |
| A11-13 | No multi-vendor sub-workspace model | high | core-structure |
| A11-14 | `volunteer` is NULL pattern, not a typed employment form | medium | contracts |
| A11-15 | No event-scoped revenue envelope in billing | high | billing |
| A11-16 | `billing.settlement_period` is month-scoped; event = same-day | medium | billing |
| A11-17 | No pop-up department lifecycle (create + dissolve) | medium | core-structure |

---

## 5. Norwegian compliance notes for Pontus

1. **Casual labor (dagarbeid) + A-melding:** Each casual worker employed for a single
   day requires A-melding submission within 5 days of first pay. Tripletex sync
   (payroll GAP-G1, not built) is the only automated path. Until G1 ships, Pontus must
   manually register all 20 casual workers in Tripletex and submit A-melding there.

2. **OTP threshold (OTP-loven § 2):** Workers employed < 12 months AND < 20%
   stillingsandel are OTP-exempt. Festival casual labor = exempt. But if any worker
   crosses 12-month cumulative service across events, obligation triggers retroactively.
   No Smartout tracking for this.

3. **Arbeidsmiljøloven § 14-9 (midlertidig ansettelse):** Each one-day casual hire is
   a temporary employment. The employment form is `temporary` in Smartout. The contract
   must specify the objective basis for temporariness (Aml. § 14-9(2)(a–f)).
   DocuSeal templates for one-day temp contracts need a specific clause — not currently
   built in the clause library.

4. **Security staff:** Security at a festival must be licensed (Vaktvirksomhetsloven).
   Sigrid and her 10-person team are likely from a security company (not Pontus's
   employees). They are subcontractors — NOT modelled in Smartout at all
   (sub-contractor / agency labor has no schema).

---

## 6. Verdict: festival scope readiness

| Area | Status |
|---|---|
| Department operations (sessions, deviations, shifts) | Partial — works for permanent departments; pop-up lifecycle missing |
| POS reconciliation (cashless) | Partial — Lightspeed only, single vendor per workspace |
| Cash count | Partial — revenue fields exist; float variance missing |
| Tip pool | Partial — per-department works; cross-department / security exclusion missing |
| Vendor settlement | Not built |
| Casual labor payroll | Partial — lønnsgrunnlag calc works; A-melding = manual; OTP not evaluated |
| One-day contracts | Partial — `temporary` workaround only; no `casual` form |
| Multi-vendor workspace model | Not built |
| Event P&L | Not built |
| Pop-up department lifecycle | Not built |
| Volunteer staff | Not built (NULL pattern only) |

**Bottom line:** Smartout can handle a festival with significant manual workarounds for
settlement, vendor management, casual-labor compliance, and event P&L. The cascade model
(I1 + 6D + 4C) bends to a pop-up event at the department level, but the commercial and
multi-vendor layer is entirely missing. A purpose-built event workspace type would require
at minimum: (1) pop-up department lifecycle, (2) vendor revenue split schema,
(3) cross-department tip pool, (4) cash float tracking, (5) event P&L envelope.
