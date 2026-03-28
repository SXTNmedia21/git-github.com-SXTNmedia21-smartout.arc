---
title: "Module 10: Reports, Dashboards & Reconciliation"
id: MODULE_10
version: "1.1"
status: design-spec
layer: module
created: 2026-02-24
updated: 2026-03-22
author: pontus
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
  - MODULE_04
tags:
  - reports
  - dashboards
  - reconciliation
  - deviations
  - kpis
  - settlement
  - qr-routines
  - cascade
tables_implemented:
  - custom_report
tables_planned:
  - deviation
  - daily_reconciliation
  - shift_approval
  - settlement_image
  - settlement_validation
  - location_routine_session
  - role_reconciliation
  - season_reconciliation
implementation_notes: |
  Only the AI-powered custom report builder is implemented (custom_report table,
  reports-agent API, 6 data sources, 4 visualizations). The full reconciliation
  system (daily reconciliation, settlement/OCR, deviation motor, KPI dashboard,
  alert engine, QR routines, role/season reconciliation) remains unbuilt.
changelog:
  - date: 2026-03-01
    change: "Updated status to design-spec. Split tables into implemented vs planned."
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

## Cascade Mapping

> This module's relationship to the Cascade Core Foundation
> (spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)

| Dimension                      | Role                                                   |
| ------------------------------ | ------------------------------------------------------ |
| C1 Observability & Calibration | Primary — dashboards, KPIs, and reconciliation reports |
| C3 Commercial & Outcome        | Produces — revenue, cost, and settlement analysis      |
| All Dimensions                 | Consumes — aggregates data from every dimension        |

# Module 10: Reports, Dashboards & Reconciliation

> **Smartout.ai** — Functional documentation for migration
> Version 1.1 | February 2026
>
> **Scope expansion:** This module was originally reserved as "Reports & Dashboards" in the index. It has been elevated to **Reports, Dashboards & Reconciliation** because it introduces the **Daily Reconciliation** — the admin-facing approval layer that sits on top of Module 4's Department Session sign-off — the **Role Reconciliation** for periodic per-role aggregation — and the **Season Reconciliation** that closes the Season lifecycle.
>
> **Kildeutviklere:** Pontus Lindroth & Martin Lundqvist

---

## 1. The Core Insight

Module 4 (Operations) owns the _operational_ day: tasks, hooks, sign-off by the closing shift leader. That's the floor-level view — "we did our work."

What happens _after_ is equally critical: **Admin must verify the business reality of each day** — revenue matched, hours confirmed, deviations handled, labor cost validated. This is the **Daily Reconciliation** — a mandatory admin approval that transforms raw operational data into verified business truth.

At the strategic level, each Season needs a final reconciliation that compares plan vs actual across the full period.

**Module 4 Session Sign-off** = "The kitchen is closed, tasks are done."  
**Module 10 Daily Reconciliation** = "The business day is verified — revenue, hours, cost, deviations."  
**Module 15 Season Planning** = "The budget, factors, and targets for this season."  
**Module 10 Season Reconciliation** = "The season is evaluated — budget vs actual, lessons learned."

---

## 2. Conceptual Model

```
Season (Core Architecture) + Season Budget (Module 15)
  │
  │  defines targets...
  │
  ├── Day Factor → Hour Factor → Revenue targets per hour
  │
  │  generates daily...
  │
  ├── Department Session (Module 4)
  │     └── Sign-off: "Operations complete" (floor-level)
  │
  │  feeds into...
  │
  ├── Daily Reconciliation (this module)
  │     ├── Settlement: OCR from kassa + terminal images
  │     ├── Shift approval: hours confirmed
  │     ├── Deviation handling: all 5 domains
  │     ├── KPI calculation: revenue/hour, labor %
  │     └── Admin approval → DAY CLOSED
  │
  │  aggregates into...
  │
  ├── Role Reconciliation (periodic)
  │     └── Per-role: hours, revenue, absence, productivity
  │
  │  aggregates into...
  │
  ├── Season Reconciliation (strategic)
  │     ├── Budget vs actual
  │     ├── Factor accuracy evaluation
  │     └── Learning data → next season
  │
  │  powers...
  │
  └── KPI Dashboard (live)
        ├── Proactive: revenue target per open hour (forward-looking)
        ├── Reactive: revenue per worked hour (backward-looking)
        └── Alerts: threshold breaches, budget burn, inefficiency
```

---

## 3. Daily Reconciliation

### 3.1 Two Phases

| Phase                   | When              | Who                                | What                               |
| ----------------------- | ----------------- | ---------------------------------- | ---------------------------------- |
| **Phase 1: Settlement** | End of day        | Closing employee (seniority-based) | Images, closing tasks, submit      |
| **Phase 2: Approval**   | Next business day | Admin/Manager                      | Verify, handle deviations, approve |

---

### 3.2 Phase 1: Settlement (Sättelfunktion)

#### Who performs settlement?

System selects automatically based on **seniority**:

```
Selection logic:
  1. Among employees currently on shift for this department
  2. Select highest seniority (tenure_start_date in workspace)
  3. 90% of the time = last person closing
  4. Logic is seniority-based, NOT "last punch-out"
  5. Fallback: if no one with sufficient authority → escalation per Module 4 sign-off rules
```

#### Settlement image capture

Closing employee uploads settlement proof:

**Required (minimum 2 images):**

- 📷 POS closing report (cash register daily summary)
- 📷 iSettle / payment terminal settlement report

**Optional:**

- 📷 Z-report
- 📷 Cash count photo

#### OCR processing pipeline

```
Image upload (JPEG/PNG)
  → Storage: Supabase Storage {workspace_id}/settlements/{date}/
  → Quality check (resolution ≥ 720p, not blurry)
  → OCR engine (Google Vision API or Azure Cognitive Services)
  → Text extraction (raw text stored)
  → Parser (regex + pattern matching, configurable per POS type)
  → Structured output:
      total_revenue      decimal
      card_payments      decimal
      cash_payments      decimal
      vat_amount         decimal
      transaction_count  integer
      confidence_score   float (0.0–1.0)
  → Cross-validation:
      POS total vs terminal total
      card + cash vs total (internal consistency)
      → Match within threshold → auto-fill reconciliation fields
      → Mismatch > threshold → auto-create deviation (domain: SYSTEM, subcategory: settlement_mismatch)
```

**Threshold (Policy-driven):**

```json
{
  "policy_type": "operations",
  "name": "Settlement tolerance",
  "rules_json": {
    "absolute_threshold_nok": 50,
    "percentage_threshold": 0.5,
    "trigger": "whichever_breached_first"
  }
}
```

#### Gatekeeper — hard lock before checkout

Closing employee **CANNOT punch out** until:

- ✅ All closing session hooks completed (Module 4)
- ✅ Settlement images uploaded (minimum 2)
- ✅ OCR validated OR mismatch deviation registered
- ✅ All CRITICAL deviations commented
- ✅ Reconciliation submitted

After submission: `reconciliation.status = SUBMITTED`

**This is a hard lock.** Punch-out is disabled until all conditions are met.

---

### 3.3 Phase 2: Admin Approval

Admin opens dashboard → sees days awaiting approval (traffic light: 🔴 overdue, 🟡 pending, 🟢 approved).

#### Approval interface sections:

**A. Revenue**

- OCR-extracted totals (tap to view original images)
- POS vs terminal comparison with difference highlighted
- Cash difference (if applicable)
- Confidence score from OCR
- Manual correction available (requires written justification)

**B. Labor (shifts)**

- All shifts for the day per department
- Punch in/out per person
- Calculated hours vs planned hours
- System-detected deviations per shift (late_checkin, overtime, missing_punch, break_violation)
- Per shift: Approve / Edit (with justification) / Request handoff / Dispute

**C. Deviations**

- Grouped by domain with color coding:
  - 🔴 Safety (HMS)
  - 🟠 Customer
  - 🟡 Procedure
  - 🔵 System (includes settlement mismatch)
  - ⚫ Material / Breakage
- Each: Acknowledge / Resolve (with notes) / Escalate
- HIGH/CRITICAL must be handled before day can be approved

**D. Tasks & Operations**

- Session sign-off summary from Module 4
- Incomplete tasks with required comments
- Handoff notes from closing employee

#### Day approval preconditions:

- All shifts handled (approved, edited, or disputed)
- Revenue confirmed (OCR match or deviation resolved)
- All HIGH/CRITICAL deviations addressed
- Settlement images present

**Result:** `reconciliation.status = APPROVED` → `DAY CLOSED`

**Locking:** Day locks immediately on approval. Re-opening requires admin action with full audit trail.

---

### 3.4 Handoff Motor (AI-assisted data collection)

When admin presses "Handoff" on a shift or deviation:

**Step 1: Chat dialog (AI)**

- System sends chat message to employee via Module 9
- AI asks targeted questions based on the specific issue:
  - "Du sjekket ut 22:14, men pause mangler. Hadde du pause?"
  - "Du jobbet 40 min over plan. Var det godkjent overtid?"
  - "Oppgave X står ufullført. Ble den gjort?"
- AI structures responses into report

**Step 2: Phone escalation**
Triggers: no response within policy deadline, low quality, CRITICAL severity.

- Voice call via Smartout Voice AI (Module 12)
- Conversation summarized in structured report

**Step 3: Admin receives report**

- Signal: "Handoff complete"
- Admin reviews, approves/rejects findings
- Full audit trail logged

---

### 3.5 Policy: Accumulation & Escalation

```json
{
  "policy_type": "operations",
  "name": "Reconciliation deadlines",
  "rules_json": {
    "max_unreconciled_days": 3,
    "escalation_after_days": 5,
    "escalation_target_role": "admin",
    "approval_deadline": "next_business_day",
    "who_can_approve": ["admin", "owner"],
    "lock_after_days": 30,
    "auto_lock_status": "unreconciled"
  }
}
```

All reconciliation rules are Policies (Module 11 Settings).

---

## 4. Deviation Motor

Extends Module 4's `deviation_flagged` on `session_task` into a comprehensive tracking system.

### 4.1 Five Domains

| Domain        | Code        | Source          | Examples                                       | Default severity |
| ------------- | ----------- | --------------- | ---------------------------------------------- | ---------------- |
| **Safety**    | `SAFETY`    | Employee        | Injury, near-miss, pest, gas, fire             | HIGH–CRITICAL    |
| **Customer**  | `CUSTOMER`  | Employee        | Complaint, refund, allergen incident           | MEDIUM–HIGH      |
| **Procedure** | `PROCEDURE` | Employee/System | Task skipped, wrong process, missing doc       | LOW–MEDIUM       |
| **System**    | `SYSTEM`    | Auto-detected   | Late check-in, overtime, settlement mismatch   | Per policy       |
| **Material**  | `MATERIAL`  | Employee        | Broken glass, equipment damage, wasted product | LOW–HIGH         |

### 4.2 Deviation Schema

```
deviation
  deviation_id         uuid (PK)
  workspace_id         fk → workspace
  department_id        fk → department | null
  session_id           fk → department_session | null
  reconciliation_id    fk → daily_reconciliation | null

  -- Classification
  domain               safety | customer | procedure | system | material
  subcategory          string (late_checkin, overtime, pest, glass_broken, etc.)
  severity             low | medium | high | critical

  -- Content
  title                string
  description          text | null
  cost_impact          decimal | null (estimated NOK)

  -- Links
  linked_shift_id      fk → shift | null
  linked_task_id       fk → session_task | null
  linked_location_id   fk → location | null
  linked_asset_id      fk → asset | null
  linked_booking_id    fk → booking | null (Module 14)

  -- Status
  status               open | acknowledged | resolved | escalated

  -- Resolution
  resolution_notes     text | null
  resolved_by          fk → profile | null
  resolved_at          timestamp | null

  -- Evidence
  attachments          jsonb | null ([{url, filename, type}])

  -- Policy impact
  blocks_day_approval  boolean (computed: severity + policy rules)
  requires_action      boolean
  payroll_impact       boolean

  -- Audit
  reported_by          fk → profile | null (null = system-generated)
  created_at           timestamp
  updated_at           timestamp
```

### 4.3 Severity Policy

```json
{
  "policy_type": "operations",
  "name": "Deviation severity rules",
  "rules_json": {
    "auto_critical": ["pest", "gas_smell", "fire", "food_poisoning", "serious_injury"],
    "blocks_approval_severities": ["critical", "high"],
    "requires_photo_domains": ["safety", "material"],
    "stop_the_line_triggers": ["pest", "gas_smell", "fire"]
  }
}
```

---

## 5. Reconciliation Data Model

### 5.1 Daily Reconciliation

```
daily_reconciliation
  reconciliation_id    uuid (PK)
  workspace_id         fk → workspace
  department_id        fk → department
  session_id           fk → department_session
  date                 date

  -- Status lifecycle
  status               open | submitted | awaiting_approval | approved | locked | unreconciled

  -- Phase 1 (Settlement by employee)
  settled_by           fk → profile
  settled_at           timestamp | null

  -- Phase 2 (Approval by admin)
  approved_by          fk → profile | null
  approved_at          timestamp | null
  approval_notes       text | null

  -- Revenue (from OCR or manual)
  revenue_total        decimal | null
  revenue_card         decimal | null
  revenue_cash         decimal | null
  revenue_vat          decimal | null
  revenue_transactions integer | null
  revenue_source       ocr | manual

  -- Labor (aggregated from shift approvals)
  total_planned_hours  decimal | null
  total_actual_hours   decimal | null
  total_labor_cost     decimal | null

  -- KPIs (calculated on approval)
  revenue_per_worked_hour   decimal | null
  labor_percentage          decimal | null

  -- Locking
  locked_at            timestamp | null
  locked_by            fk → profile | null

  created_at           timestamp
  updated_at           timestamp
```

### 5.2 Settlement Image

```
settlement_image
  image_id             uuid (PK)
  reconciliation_id    fk → daily_reconciliation
  workspace_id         fk → workspace

  source_type          pos | terminal | z_report | cash_count | other
  image_url            string (Supabase Storage)

  ocr_raw_text         text | null
  ocr_parsed           jsonb | null
  ocr_confidence       float | null (0.0–1.0)
  ocr_processed_at     timestamp | null

  uploaded_by          fk → profile
  uploaded_at          timestamp
```

### 5.3 Settlement Validation

```
settlement_validation
  validation_id        uuid (PK)
  reconciliation_id    fk → daily_reconciliation
  workspace_id         fk → workspace

  pos_total            decimal
  terminal_total       decimal
  difference           decimal
  difference_percent   float
  within_threshold     boolean
  deviation_id         fk → deviation | null

  created_at           timestamp
```

### 5.4 Shift Approval

```
shift_approval
  approval_id          uuid (PK)
  reconciliation_id    fk → daily_reconciliation
  shift_id             fk → shift
  workspace_id         fk → workspace

  punch_in             timestamp
  punch_out            timestamp | null
  planned_hours        decimal
  calculated_hours     decimal
  approved_hours       decimal | null

  status               pending | approved | edited | disputed
  edit_justification   text | null
  handoff_requested    boolean default false
  handoff_completed    boolean default false

  system_deviations    jsonb | null ([{type, details}])
  approved_by          fk → profile | null
  approved_at          timestamp | null

  created_at           timestamp
  updated_at           timestamp
```

---

## 6. Role Reconciliation

Periodic aggregation per role/position. Typically monthly but configurable.

```
role_reconciliation
  role_recon_id        uuid (PK)
  workspace_id         fk → workspace
  department_id        fk → department | null
  position_id          fk → position | null
  period_start         date
  period_end           date

  -- Aggregates
  active_employees     integer
  total_hours_worked   decimal
  total_hours_planned  decimal
  total_revenue        decimal | null (if role maps to department with revenue)
  sick_days            integer
  absence_days         integer
  deviation_count      integer
  task_completion_rate float (0.0–1.0)

  -- KPIs
  revenue_per_hour     decimal | null
  avg_labor_percentage decimal | null

  status               draft | confirmed
  confirmed_by         fk → profile | null
  confirmed_at         timestamp | null

  created_at           timestamp
  updated_at           timestamp
```

---

## 7. Season Reconciliation

Strategic evaluation that closes a Season.

```
season_reconciliation
  season_recon_id      uuid (PK)
  workspace_id         fk → workspace
  season_id            fk → season

  -- Budget comparison (data from Module 15)
  budget_total         decimal
  actual_total         decimal
  budget_variance      decimal
  budget_variance_pct  float

  -- Factor analysis
  day_factor_accuracy  jsonb (per-weekday: {planned, actual, variance})
  hour_factor_accuracy jsonb (per-hour: {planned, actual, variance})
  alcohol_factor_accuracy jsonb ({planned_units, actual_units, variance})

  -- Labor
  total_labor_hours    decimal
  total_labor_cost     decimal
  avg_labor_percentage float

  -- Quality
  total_deviations     integer
  deviations_by_domain jsonb ({safety: N, customer: N, ...})
  avg_task_completion  float

  -- Learning output
  recommended_day_factors    jsonb | null (AI-suggested for next season)
  recommended_hour_factors   jsonb | null
  recommended_alcohol_factor decimal | null
  insights                   text | null (AI-generated summary)

  status               draft | confirmed | archived
  confirmed_by         fk → profile | null
  confirmed_at         timestamp | null

  created_at           timestamp
  updated_at           timestamp
```

---

## 8. KPI Dashboard

### 8.1 Core KPIs

| KPI                              | Formula                                       | Type      | Purpose             |
| -------------------------------- | --------------------------------------------- | --------- | ------------------- |
| **Revenue per worked hour**      | `actual_revenue ÷ actual_labor_hours`         | Reactive  | Efficiency analysis |
| **Revenue target per open hour** | `day_target × (hour_factor ÷ Σ hour_factors)` | Proactive | Real-time steering  |
| **Labor %**                      | `labor_cost ÷ revenue`                        | Reactive  | Cost control        |
| **Task completion %**            | `completed_tasks ÷ planned_tasks`             | Reactive  | Quality             |
| **Deviation density**            | `deviations ÷ labor_hours`                    | Reactive  | Risk indicator      |
| **Time per unit**                | `hours ÷ units` (e.g. hotel rooms)            | Reactive  | Productivity        |

### 8.2 Proactive vs Reactive

|              | Reactive                        | Proactive                            |
| ------------ | ------------------------------- | ------------------------------------ |
| **Based on** | Worked hours (past)             | Open hours (forward)                 |
| **Used for** | Analysis, learning, alerts      | Live steering, staffing              |
| **When**     | After day / during review       | Live, right now                      |
| **Example**  | "Yesterday: 150 kr/worked hour" | "Now: need 15 000 kr/hour this hour" |

### 8.3 Alert Engine (Varslingssystem)

```
Policy: kpi_alerts
  rules_json: {
    "revenue_per_hour_min": 500,
    "labor_pct_max": 35,
    "hourly_target_gap_warn": 0.70,
    "hourly_target_gap_critical": 0.50,
    "budget_hours_warn_pct": 0.85,
    "room_time_max_minutes": 25
  }
```

| Alert            | Trigger                        | Action                        |
| ---------------- | ------------------------------ | ----------------------------- |
| Low productivity | Revenue/hour < threshold       | 🔔 Dashboard + push to admin  |
| Hourly gap       | Actual < 70% of hourly target  | ⚠️ Warning                    |
| Critical gap     | Actual < 50% of hourly target  | 🚨 Critical alert             |
| Budget burn      | Hours used > 85% of budget     | 🔔 "Budget hours running low" |
| Room overtime    | Actual time > norm + tolerance | ⚠️ Per-room alert             |
| Season behind    | Cumulative < budget line       | 📊 "You are X% behind target" |

### 8.4 Dashboard Layout (Web)

**Top bar (Live)**
| Widget | Content |
|--------|---------|
| Revenue today | Actual vs target |
| Revenue/hour now | Current hour performance |
| Labor hours used | Actual vs budget |
| Labor % | Current day |
| Alert count | Active alerts |

**Mid section (Analysis)**

- Hour-by-hour chart: target line vs actual bars
- Deviation ticker by domain
- Shift coverage map

**Bottom section (Detail)**

- Room productivity (hotel mode)
- Task completion by department
- Deviation list (filterable)

### 8.5 Dashboard Layout (Mobile — Leader view)

Simplified version of web:

- Revenue vs target (big number)
- Alert badges
- Quick access to reconciliation
- Deviation count

---

## 9. QR-Based Start/Stop Routines (Location System)

For hotels and multi-location operations: QR codes per location enable precise time tracking.

### 9.1 Structure

- Each room/location has a unique QR code linked to `location_id`
- QR scanning starts a **location-bound routine session**

### 9.2 Flow

```
Scan QR → Routine starts → Timer starts → App locks to this routine's tasks
  │
  During routine:
  ├── Complete checklist items
  ├── Register deviations (damage, missing items)
  ├── Register minibar changes
  ├── Add comments / photos
  ├── Post messages to this location
  │
  Scan QR again (or press "Complete") → Routine stops → Timer stops
  │
  Close-out prompt:
  ├── Any damage? → deviation (MATERIAL domain)
  ├── Minibar changes? → logged
  ├── Comments? → saved as session_note
  │
  Result:
  ├── Time logged against location
  ├── Automatic notification to reception: "Room X ready"
  ├── KPI: actual_minutes vs norm_minutes
```

### 9.3 Schema

```
location_routine_session
  lrs_id               uuid (PK)
  workspace_id         fk → workspace
  location_id          fk → location
  session_id           fk → department_session | null
  profile_id           fk → profile
  procedure_id         fk → procedure | null

  started_at           timestamp
  completed_at         timestamp | null
  duration_minutes     decimal | null (calculated)
  norm_minutes         decimal | null (from location or procedure config)

  status               in_progress | completed | abandoned
  completion_data      jsonb | null (checklist results, photos)
  deviations           jsonb | null (quick-log: [{type, note}])

  created_at           timestamp
  updated_at           timestamp
```

---

## 10. Integration Points

| Module                          | Integration                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Core / Governance**           | Policy drives all reconciliation rules, deviation severity, alert thresholds                        |
| **Module 2 (Org Structure)**    | Department, Location, Zone — scoping for all reports and reconciliation                             |
| **Module 3 (Scheduling)**       | Shift data feeds shift approvals in reconciliation                                                  |
| **Module 4 (Operations)**       | Department Session sign-off feeds Phase 1. Task data feeds reports. Session creates reconciliation. |
| **Module 5 (HACCP)**            | HACCP deviations flow into deviation motor. HACCP reports consume reconciled data.                  |
| **Module 8 (Payroll)**          | Approved shift hours → payroll input. Labor cost ← payroll rates.                                   |
| **Module 9 (Communication)**    | Handoff motor sends chat messages. Alerts push notifications.                                       |
| **Module 12 (AI)**              | OCR processing. Handoff dialog. Season learning. Alert intelligence.                                |
| **Module 14 (Production)**      | Production cost feeds into margin analysis. Booking data provides context.                          |
| **Module 15 (Season Planning)** | Budget, factors, targets consumed by KPI calculations and season reconciliation.                    |

---

## 11. Module Boundary

**This module owns:**

- Daily Reconciliation (lifecycle, approval, locking)
- Settlement (images, OCR, validation)
- Shift Approval (within reconciliation context)
- Deviation (full lifecycle across all 5 domains)
- Role Reconciliation
- Season Reconciliation
- KPI Dashboard (all views)
- Alert Engine
- QR-based location routine sessions
- All report generation

**This module does NOT own (but consumes):**

- Department Session and sign-off (Module 4)
- Shift scheduling and punch data (Module 3)
- Season budget, factors, targets (Module 15)
- Ingredient/recipe cost data (Module 14)
- Payroll rates (Module 8)
- Chat delivery (Module 9)
- AI engines (Module 12)
- Policy definitions (Core/Module 11)

---

## 12. Data Entities Summary

### New entities introduced by this module

| Entity                       | Purpose                             | Key relationships                              |
| ---------------------------- | ----------------------------------- | ---------------------------------------------- |
| **daily_reconciliation**     | Admin approval of business day      | Session, Department                            |
| **settlement_image**         | OCR source images                   | Reconciliation                                 |
| **settlement_validation**    | POS vs terminal cross-check         | Reconciliation, Deviation                      |
| **shift_approval**           | Per-shift hour verification         | Reconciliation, Shift                          |
| **deviation**                | Full deviation tracking (5 domains) | Session, Reconciliation, Task, Location, Asset |
| **role_reconciliation**      | Periodic per-role aggregation       | Department, Position                           |
| **season_reconciliation**    | Strategic season evaluation         | Season                                         |
| **location_routine_session** | QR-based time tracking per location | Location, Session, Profile                     |

---

## 13. Implementation Sequence

| Phase                            | Scope                                                                                                  | Duration   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |
| **1. Deviation data layer**      | `deviation` table. Five domains. Severity rules via Policy. Admin UI for viewing/handling.             | Week 1–2   |
| **2. Daily Reconciliation core** | `daily_reconciliation` + `shift_approval` tables. Phase 2 admin approval UI. Manual revenue entry.     | Week 3–4   |
| **3. Settlement & OCR**          | `settlement_image` + `settlement_validation`. Image upload. OCR pipeline. Auto-fill. Gatekeeper logic. | Week 5–7   |
| **4. KPI Dashboard**             | Core KPIs (revenue/hour, labor %). Dashboard widgets. Hour-by-hour chart.                              | Week 8–9   |
| **5. Alert Engine**              | Policy-driven thresholds. Push notifications. Dashboard alerts.                                        | Week 10    |
| **6. Handoff Motor**             | AI chat integration. Phone escalation. Structured reporting.                                           | Week 11–12 |
| **7. QR Location Routines**      | `location_routine_session`. QR scanning. Time tracking. Reception notifications.                       | Week 13–14 |
| **8. Role Reconciliation**       | `role_reconciliation`. Periodic aggregation. Admin confirmation UI.                                    | Week 15    |
| **9. Season Reconciliation**     | `season_reconciliation`. Budget vs actual. Factor analysis. AI learning output.                        | Week 16    |
| **10. Advanced reports**         | HR reports, operations reports, financial reports, PDF export, scheduled email delivery.               | Week 17–18 |

---

## 14. Migration Notes

- `daily_reconciliation` needs `workspace_id` for RLS. All reconciliation data scoped per workspace.
- Settlement images stored in Supabase Storage: `{workspace_id}/settlements/{date}/{image_id}.jpg`
- OCR pipeline as Edge Function calling external API (Google Vision). Results stored in `settlement_image.ocr_parsed`.
- `deviation` table replaces the flat `deviation_flagged` + `deviation_notes` on `session_task`. Existing flag data migrates to deviation records.
- KPI calculations can use materialized views or computed on-read depending on volume.
- QR codes generated per location, stored as `location.qr_code_url` or separate asset in Storage.
- Alert engine as Edge Function triggered by Realtime subscriptions on `daily_reconciliation` and `settlement_validation`.
- Season Reconciliation triggers when Season status changes to `archived`.

---

## 15. Design Decisions

| #   | Decision                      | Choice                               | Rationale                                                          |
| --- | ----------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| 1   | Reconciliation scope          | Per department per day               | Matches Department Session from Module 4                           |
| 2   | Settlement responsibility     | Seniority-based, not "last out"      | Ensures most experienced person handles settlement                 |
| 3   | OCR vs manual                 | OCR first, manual fallback           | Eliminates data entry errors, saves time                           |
| 4   | Deviation ownership           | This module, not Module 4            | Deviations span beyond operations (customer, material, settlement) |
| 5   | Hard lock on checkout         | Yes, non-negotiable                  | Data quality depends on completing settlement before leaving       |
| 6   | Approval deadline             | Policy-driven                        | Different workspaces have different needs                          |
| 7   | QR routines in this module    | Yes, not Module 4                    | QR is a measurement/reporting tool, not an operational task source |
| 8   | Season reconciliation trigger | Manual + prompt when season archived | Admin should review before data is locked                          |

---

_This module transforms Smartout from an operations tool into a business control system. Daily Reconciliation ensures data truth. KPI Dashboard enables real-time steering. Season Reconciliation closes the strategic loop. Together with Module 15 (Season Planning) and Module 14 (Production & Menu), this creates a complete restaurant management cockpit._
