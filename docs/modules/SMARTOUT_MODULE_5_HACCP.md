# Module 5: HACCP & Matsikkerhet (Food Safety)

> **Smartout.io** — Functional documentation for migration
> Version 1.0 | February 2026
> **Dependencies:** Core Architecture v2 (Governance Model), Module 2 (Assets, Locations, Zones), Module 4 (Department Sessions, Session Tasks, Hooks)

---

## 1. Module Overview

HACCP (Hazard Analysis and Critical Control Points) compliance is not a separate system in Smartout — it's a **specific use case of the Governance model** applied to food safety. This module documents how the existing architecture (Policy → Protocol → Procedure → Routine → Runbook → Control List) is configured for Mattilsynet compliance.

**Key insight:** Every HACCP requirement maps directly to existing Core types. This module introduces **no new data tables** — it defines how existing infrastructure is configured for food safety, plus a thin HACCP-specific data layer for things like temperature thresholds and CCP definitions that need structured storage beyond what `rules_json` provides.

### What This Module Covers

| HACCP Need | Smartout Implementation |
|------------|----------------------|
| Temperature logging | Session Hook → Routine → session_task with `completion_data` (temperature readings) |
| Hygiene checklists | Procedure with ordered steps → materialized as session_tasks via hooks |
| Deviation reporting | `deviation_flagged` on session_task → triggers Runbook → escalation chain |
| Corrective actions | Runbook (event-triggered procedure) → Control List (verification) |
| Critical control points | Asset (with `asset_type: ccp`) + Policy → Protocol → Routine |
| Compliance documentation | session_task audit trail + completion_data + AI-compiled reports |
| Inspector readiness | Filtered views: all HACCP tasks with timestamps, who, what, deviations |
| Certifications | Profile-level certificate tracking with expiry and renewal alerts |

### What This Module Does NOT Do

- ❌ No separate HACCP task engine — uses session_task from Module 4
- ❌ No separate checklist builder — uses Procedure/ProcedureStep from Governance
- ❌ No separate scheduling — uses Session Hooks and Routines from Module 4
- ❌ No separate deviation system — uses deviation_flagged + Runbook from Module 4/Governance

---

## 2. The HACCP → Governance Mapping

### 2.1 How HACCP Principles Map to Smartout

| HACCP Principle | Smartout Equivalent |
|----------------|-------------------|
| **Principle 1:** Conduct hazard analysis | Admin identifies hazards → creates Policy with `policy_type: haccp` |
| **Principle 2:** Determine CCPs | Admin marks Assets as `asset_type: ccp` with thresholds in `metadata` |
| **Principle 3:** Establish critical limits | Stored in `haccp_control_point.critical_limit_min/max` |
| **Principle 4:** Monitoring procedures | Routine with `trigger_type: scheduled` + Session Hooks for timed checks |
| **Principle 5:** Corrective actions | Runbook with escalation chain, triggered when deviation_flagged = true |
| **Principle 6:** Verification procedures | Control List (follow-up on Routines and Runbooks) |
| **Principle 7:** Documentation | session_task audit trail, completion_data, AI-compiled HACCP reports |

### 2.2 The Full HACCP Chain in Smartout

```
Admin creates:
  Policy (policy_type: haccp)
    "All refrigeration units must maintain temperature between 0–4°C"
    scope: workspace | department | location
    │
    └── Protocol (status: active)
          "Refrigeration Temperature Control Protocol"
          │
          ├── Procedure: "Temperature Measurement"
          │     Step 1: Open temperature log on device
          │     Step 2: Measure walk-in fridge (target: 0–4°C)
          │     Step 3: Measure dessert fridge (target: 0–4°C)
          │     Step 4: Measure freezer (target: below -18°C)
          │     Step 5: Record readings
          │     Step 6: Flag any deviations
          │
          ├── Routine: "4-Hour Temperature Check"
          │     trigger_type: scheduled
          │     → Materialized via Session Hook:
          │       trigger_anchor: open, trigger_offset: 60
          │       repeat_interval: 240 (every 4 hours)
          │     assigned_to: any_on_shift (kitchen)
          │     control_list_id: → "Temperature Verification"
          │     control_frequency: every_nth (every 3rd time)
          │
          ├── Runbook: "Temperature Deviation Response"
          │     trigger_event: temperature_deviation
          │     trigger_conditions: { reading > critical_limit_max OR < critical_limit_min }
          │     escalation_chain:
          │       Level 1: Team leader (immediate)
          │       Level 2: Kitchen manager (20 min)
          │       Level 3: Admin (60 min)
          │     → ALWAYS triggers Control List: "Deviation Follow-up"
          │
          ├── Control List: "Temperature Verification"
          │     Items:
          │       - "Were all units checked?" (yes/no)
          │       - "Any readings out of range?" (yes/no)
          │       - "Corrective action taken?" (text, conditional)
          │     assigned_to: team_leader
          │
          ├── Knowledge Test: "Temperature Safety Quiz"
          │     "What is the maximum allowed fridge temp?" → 4°C
          │     "What do you do if freezer reads -15°C?" → Flag deviation, notify leader
          │     pass_threshold: 80%
          │     max_attempts: 3
          │
          └── Confirmation: "Temperature Protocol Acknowledgment"
                "I have read and understand the temperature control protocol
                 and my responsibility to report deviations immediately."
                requires_signature: true
```

---

## 3. Temperature Logging

### 3.1 How It Works at Runtime

Temperature logging happens through **session_task** instances created by **session hooks**. There is no separate temperature logging table — the temperature data lives in `session_task.completion_data`.

```
Department Session: Kitchen — Monday Feb 24
  │
  ├── Hook fires: "Temperature Check" (10:00, 14:00, 18:00, 22:00)
  │     │
  │     └── Creates session_task:
  │           title: "Temperaturmåling — Kjøkken"
  │           category: "haccp"
  │           source_type: hook
  │           procedure_id: → "Temperature Measurement"
  │           priority: critical
  │           is_required: true
  │           assigned_to_type: any_on_shift
  │
  ├── Employee completes task:
  │     status: completed
  │     completed_by: Anna (profile_id)
  │     completed_at: 2026-02-24T10:12:00
  │     completion_data: {
  │       "readings": [
  │         { "asset_id": "...", "asset_name": "Walk-in fridge", "value": 3.2, "unit": "celsius", "within_limits": true },
  │         { "asset_id": "...", "asset_name": "Dessert fridge", "value": 3.8, "unit": "celsius", "within_limits": true },
  │         { "asset_id": "...", "asset_name": "Freezer", "value": -19.5, "unit": "celsius", "within_limits": true }
  │       ],
  │       "method": "manual",
  │       "notes": null
  │     }
  │     deviation_flagged: false
  │
  └── If deviation detected:
        deviation_flagged: true
        deviation_notes: "Walk-in fridge reading 6.1°C — above critical limit"
        completion_data: {
          "readings": [
            { "asset_id": "...", "asset_name": "Walk-in fridge", "value": 6.1, "unit": "celsius", "within_limits": false },
            ...
          ]
        }
        → Runbook "Temperature Deviation Response" triggered automatically
        → AI logs event in ai_session_event
        → Escalation chain starts
```

### 3.2 Temperature Input UI (Mobile)

When the employee opens a temperature check task, the mobile app renders a form derived from the associated CCP assets:

```
┌─────────────────────────────────┐
│  Temperaturmåling — Kjøkken     │
│  10:00 · Kritisk                │
│                                 │
│  Walk-in Kjøl          [___]°C  │
│  Grense: 0–4°C          ✓ OK   │
│                                 │
│  Dessert-kjøl           [___]°C │
│  Grense: 0–4°C          ✓ OK   │
│                                 │
│  Fryser                 [___]°C │
│  Grense: under -18°C    ✓ OK   │
│                                 │
│  Notat (valgfritt):             │
│  [________________________]     │
│                                 │
│  [Fullfør ✓]                    │
└─────────────────────────────────┘
```

If a reading is out of range, the field turns red and `deviation_flagged` is automatically set. The employee must add a deviation note before completing.

### 3.3 Temperature History & Reports

All historical temperature data is queryable through `session_task`:

```sql
-- All temperature readings for the last 30 days, Kitchen
SELECT 
  st.completed_at,
  st.completed_by,
  st.completion_data->'readings' as readings,
  st.deviation_flagged,
  st.deviation_notes
FROM session_task st
JOIN department_session ds ON st.session_id = ds.session_id
WHERE ds.department_id = :kitchen_id
  AND st.category = 'haccp'
  AND st.procedure_id = :temp_procedure_id
  AND st.status = 'completed'
  AND st.completed_at >= NOW() - INTERVAL '30 days'
ORDER BY st.completed_at DESC;
```

**Report format for Mattilsynet inspection:**

| Date | Time | Unit | Reading | Limit | Status | Measured by | Deviation action |
|------|------|------|---------|-------|--------|-------------|-----------------|
| 24.02 | 10:12 | Walk-in | 3.2°C | 0–4°C | ✅ OK | Anna S. | — |
| 24.02 | 10:12 | Freezer | -19.5°C | < -18°C | ✅ OK | Anna S. | — |
| 24.02 | 14:05 | Walk-in | 6.1°C | 0–4°C | ❌ Avvik | Erik P. | Compressor checked, reset. Re-measured at 3.4°C after 30 min. |

---

## 4. Hygiene Checklists

### 4.1 Implementation via Procedures

Hygiene checklists are **Procedures** with ordered steps, attached to Protocols under HACCP policies. They materialize as session_tasks through hooks.

**Example: Daily Kitchen Cleaning Checklist**

```
Policy: "Kitchen Hygiene Standards"
  policy_type: haccp
  │
  └── Protocol: "Daily Kitchen Hygiene"
        │
        ├── Procedure: "Morning Cleaning"
        │     Step 1: Sanitize all prep surfaces (is_required: true)
        │     Step 2: Check soap dispensers and paper towels (is_required: true)
        │     Step 3: Inspect floor drains (is_required: true)
        │     Step 4: Clean door handles and light switches (is_required: false)
        │
        ├── Procedure: "Service Cleaning" 
        │     Step 1: Wipe down stations between service (is_required: true)
        │     Step 2: Empty and sanitize waste bins (is_required: true)
        │     Step 3: Clean spills immediately (is_required: true)
        │
        └── Procedure: "Closing Deep Clean"
              Step 1: Deep clean all cooking surfaces (is_required: true)
              Step 2: Clean and sanitize all equipment (is_required: true)
              Step 3: Mop floors with sanitizer (is_required: true)
              Step 4: Clean grease traps (is_required: true, weekly only)
              Step 5: Clean exhaust hoods (is_required: true, weekly only)
              Step 6: Take photo of cleaned kitchen (is_required: true)
```

**Each step becomes a session_task** when the hook fires. The employee checks them off one by one. Step 6 uses `completion_data` to store the photo URL (Supabase Storage).

### 4.2 Photo Documentation

For steps that require photo evidence:

```json
// completion_data for a photo-required step
{
  "photo_urls": [
    "https://storage.supabase.co/.../kitchen-clean-20260224-2200.jpg"
  ],
  "photo_taken_at": "2026-02-24T22:05:00Z",
  "notes": "All surfaces cleaned and sanitized"
}
```

Photos are stored in Supabase Storage under `{workspace_id}/haccp/{date}/{task_id}/`. RLS ensures workspace isolation.

### 4.3 Signing and Timestamp

Every completed session_task already has:
- `completed_by` (who did it)
- `completed_at` (when)
- `completion_data` (what they recorded)

This is the digital signature. For procedures requiring explicit acknowledgment, a **Confirmation** is attached to the Protocol — "I confirm I completed the cleaning according to procedure."

---

## 5. Deviation Reporting

### 5.1 How Deviations Work

Deviations are reported through the existing `session_task` fields:

| Field | Purpose |
|-------|---------|
| `deviation_flagged` | Boolean — was there a problem? |
| `deviation_notes` | Free text describing the deviation |
| `completion_data` | Structured data: photos, readings, measurements |

**Deviation categories** are derived from the task's parent Procedure/Policy context, not a separate field. The category taxonomy:

- **Food safety** — temperature, cross-contamination, allergen, storage
- **Hygiene** — cleaning failure, pest sighting, sanitation breach
- **Safety** — equipment malfunction, injury, fire hazard
- **Quality** — food quality, presentation, recipe deviation
- **Equipment** — broken equipment, maintenance needed
- **Other** — anything not fitting above categories

### 5.2 Deviation → Runbook → Corrective Action Flow

```
Deviation flagged on session_task
  │
  ├── AI classifies severity:
  │     CRITICAL: Temperature > 8°C, pest sighting, allergen cross-contamination
  │     HIGH: Equipment failure, cleaning skipped on critical area
  │     MEDIUM: Minor temperature deviation, cleaning delay
  │     LOW: Non-critical equipment issue, cosmetic concern
  │
  ├── Runbook triggers (based on trigger_conditions):
  │     Level 1: Notify team leader immediately
  │     Level 2: Notify department manager after 20 min if unresolved
  │     Level 3: Notify admin after 60 min if still unresolved
  │
  ├── Corrective action documented:
  │     → New session_task created (source_type: ad_hoc or from Runbook)
  │     → Assigned to appropriate person
  │     → Must be completed with notes explaining corrective action
  │
  └── Control List triggered:
        → Team leader verifies: "Was corrective action effective?"
        → "Is the issue resolved?"
        → "Any follow-up needed?"
        → Control List completion closes the deviation loop
```

### 5.3 Deviation History

All deviations are permanently recorded in the session_task audit trail. They cannot be deleted or modified after completion. This is critical for Mattilsynet compliance.

```sql
-- All deviations for the last 90 days
SELECT 
  st.completed_at,
  ds.department_id,
  st.title,
  st.deviation_notes,
  st.completion_data,
  st.completed_by,
  p.display_name as reported_by_name
FROM session_task st
JOIN department_session ds ON st.session_id = ds.session_id
JOIN profile p ON st.completed_by = p.profile_id
WHERE st.workspace_id = :workspace_id
  AND st.deviation_flagged = true
  AND st.completed_at >= NOW() - INTERVAL '90 days'
ORDER BY st.completed_at DESC;
```

---

## 6. Critical Control Points (CCPs)

### 6.1 CCP as Assets

Critical control points are defined as **Assets** (from Module 2) with `asset_type: ccp`. This connects them to Locations, Zones, and the Governance model.

However, CCP-specific data (temperature limits, monitoring frequency, etc.) needs structured storage beyond what the generic Asset `metadata` field provides. For this, we introduce a thin HACCP layer:

```
haccp_control_point
  ccp_id               uuid (PK)
  asset_id             fk → asset (the physical unit/control point)
  workspace_id         fk → workspace
  policy_id            fk → policy | null (which HACCP policy this CCP enforces)
  
  -- Identity
  ccp_code             string (CCP-001, CCP-002 — display code)
  name                 string ("Walk-in Fridge Temperature", "Cooking Core Temperature")
  description          text | null
  hazard_description   text ("Bacterial growth from improper refrigeration")
  
  -- Critical limits
  measurement_type     temperature | time | visual | ph | humidity | other
  measurement_unit     celsius | fahrenheit | minutes | ph | percent | custom
  critical_limit_min   decimal | null (null = no lower limit)
  critical_limit_max   decimal | null (null = no upper limit)
  target_value         decimal | null (ideal value, not just within limits)
  
  -- Monitoring
  monitoring_frequency text ("Every 4 hours during operation")
  monitoring_method    text ("Digital thermometer in center of unit")
  routine_id           fk → routine | null (which routine monitors this CCP)
  
  -- Corrective action reference
  runbook_id           fk → runbook | null (which runbook triggers on deviation)
  
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

### 6.2 CCP Setup Experience

When an admin creates a HACCP policy, the AI assists:

```
Admin: "Alle kjøleskap skal holde 0-4 grader"

Mr. Botsson: "Forstått. Jeg setter opp en HACCP-policy for kjøletemperatur.

              Hvilke kjøleenheter har dere?
              Jeg ser disse registrert i systemet:
              ☑ Walk-in kjøl (Hovedkjøkken)
              ☑ Dessert-kjøl (Hovedkjøkken)
              ☑ Bar-kjøl (Bar)
              ☐ Legg til ny...

              Skal temperatursjekken kjøres hver 4. time, som er standard?"

Admin: "Ja, men bar-kjølen sjekkes bare to ganger om dagen"

Mr. Botsson: "Notert. Jeg oppretter:
              - Policy: Kjøletemperaturkontroll
              - Protocol med prosedyre, rutine, og runbook
              - CCP for hver enhet med riktige grenser
              - Session Hooks for kjøkken (hver 4. time) og bar (2x daglig)
              
              Vil du gjennomgå før jeg aktiverer?"
```

### 6.3 CCP Inspection Report

A pre-formatted report showing all CCPs, their limits, monitoring frequency, last readings, and deviation history. Designed to be shown directly to Mattilsynet inspectors.

```
HACCP KONTROLLPUNKTER — [Workspace Name]
Generert: 24.02.2026 14:30

CCP-001: Walk-in Kjøl (Hovedkjøkken)
  Fare: Bakterievekst ved feil kjøletemperatur
  Kritisk grense: 0–4°C
  Overvåkning: Hver 4. time under drift
  Siste 7 målinger:
    24.02 10:12  3.2°C  ✅   Anna S.
    24.02 14:05  3.4°C  ✅   Erik P.
    23.02 10:08  3.1°C  ✅   Anna S.
    23.02 14:15  6.1°C  ❌   Erik P.  → Korrigering: Kompressor sjekket, temp normalisert etter 30 min
    ...
  Avvik siste 30 dager: 1
  Korrigerende tiltak: 1/1 lukket

CCP-002: Fryser (Hovedkjøkken)
  Fare: Tining og bakterievekst
  Kritisk grense: Under -18°C
  ...
```

---

## 7. Certifications & Training

### 7.1 Certificate Tracking

Food safety certifications are tracked per Profile. This is the one HACCP-specific data structure that doesn't fit neatly into existing tables:

```
haccp_certificate
  certificate_id       uuid (PK)
  profile_id           fk → profile
  workspace_id         fk → workspace
  
  -- Certificate details
  certificate_type     mattilsynet_basic | allergen | hygiene_pass | first_aid | fire_safety | custom
  name                 string ("Mattrygghets-kurs", "Allergenkurs")
  issuer               string | null ("Mattilsynet", "Kurssenteret AS")
  certificate_number   string | null
  
  -- Validity
  issued_date          date
  expiry_date          date | null (null = no expiry)
  
  -- Documentation
  document_url         string | null (scan/PDF in Supabase Storage)
  
  -- Status
  status               valid | expiring_soon | expired | revoked
  renewal_reminder_days integer (default: 30 — days before expiry to start alerting)
  
  created_at           timestamp
  updated_at           timestamp
```

### 7.2 Expiry Alerts

The AI monitors certificate expiry dates and proactively alerts:

- **30 days before expiry:** Notification to employee + manager: "Anna's food safety certificate expires March 26. Schedule renewal."
- **7 days before expiry:** Escalation to admin: "Anna's certificate expires in 7 days. She cannot perform HACCP tasks without valid certification."
- **On expiry:** Employee is flagged in the system. HACCP tasks assigned to them get a warning badge. Managers see the compliance risk in their dashboard.

### 7.3 Training Integration (Module 6)

Required HACCP knowledge is enforced through the Governance model:
- Policy requires a specific certificate type
- Protocol includes a Knowledge Test on food safety
- Employees who fail the test or lack the certificate cannot be assigned to HACCP-critical tasks
- Cross-reference with Position `skill_requirements` — certain positions require valid HACCP certification

---

## 8. AI HACCP Layer

### 8.1 AI Responsibilities for HACCP

The Operation Engine (Module 4, Section 18) handles HACCP-specific monitoring as part of its general session monitoring. HACCP-specific behaviors:

| AI Function | HACCP Application |
|-------------|-------------------|
| **TRIAGE** | Temperature reading out of range → classify as CRITICAL, route to shift lead + manager immediately |
| **MONITOR** | Track: are all scheduled HACCP tasks completed on time? Any CCPs missed? Certificate expiring? |
| **COMPILE** | Include HACCP status in Day Brief: "All temperature checks OK yesterday. 1 deviation on Walk-in fridge (resolved)." |
| **PREDICT** | "Walk-in fridge has shown readings trending upward over 3 days (2.1 → 3.2 → 3.8°C). Suggest maintenance check before critical limit breach." |
| **ACT** | Auto-trigger Runbook when deviation confirmed. Auto-assign corrective action task. |
| **LEARN** | "Temperature deviations correlate with delivery days — suggest additional check 1 hour after delivery." |

### 8.2 Smart Deviation Detection

The AI doesn't just check if a reading is out of limits — it detects patterns:

- **Trend detection:** Gradual temperature increase over days → proactive maintenance alert
- **Time correlation:** Deviations happen after deliveries → suggest post-delivery check routine
- **Person correlation:** One employee consistently logs borderline readings → suggest retraining
- **Equipment correlation:** Same unit deviates repeatedly → escalate to maintenance

---

## 9. Mattilsynet Compliance

### 9.1 What Mattilsynet Requires

Norwegian food safety law (Matloven) and Mattilsynet's HACCP guidance requires:

1. **Written HACCP plan** → Policy + Protocol in Smartout
2. **Identified CCPs with critical limits** → `haccp_control_point` linked to Assets
3. **Monitoring records** → session_task completion_data
4. **Corrective action records** → Runbook execution + Control List completion
5. **Verification that system works** → Control List periodic reviews
6. **Documentation accessible on demand** → HACCP report generator

### 9.2 Inspection Mode

When an inspector arrives, the manager can pull up an "Inspection View" that shows:

- All active HACCP policies and their protocols
- All CCPs with current status and limits
- Temperature logs for any period (filterable)
- Deviation history with corrective actions
- Employee certifications and training status
- Control List completion records

This view is read-only, pre-formatted, and can be exported to PDF. It shows only HACCP-relevant data — no scheduling, payroll, or other module data.

### 9.3 Compliance Score

A workspace-level metric derived from:
- % of scheduled HACCP tasks completed on time
- % of deviations with documented corrective action
- % of employees with valid certifications
- % of Control Lists completed
- Age of HACCP plan (policies updated within last 12 months)

Displayed on the manager dashboard as a health indicator. Below 80% triggers admin alert.

---

## 10. Data Entities Summary

### New Tables (this module only)

| Entity | Purpose | Key fields |
|--------|---------|------------|
| **haccp_control_point** | CCP definitions with critical limits | ccp_code, measurement_type, critical_limit_min/max, linked to Asset + Policy + Routine + Runbook |
| **haccp_certificate** | Per-employee food safety certifications | certificate_type, expiry_date, document_url, renewal alerts |

### Existing Tables Used (no modifications needed)

| Entity | HACCP Usage |
|--------|-------------|
| **Asset** | Physical equipment marked as `asset_type: ccp` |
| **Policy** | HACCP policies with `policy_type: haccp` |
| **Protocol** | Enforcement container for HACCP policies |
| **Procedure** | Step-by-step instructions for HACCP tasks |
| **Routine** | Scheduled monitoring of CCPs |
| **Runbook** | Deviation response workflows |
| **Control List** | Verification of routine completion and corrective actions |
| **Knowledge Test** | HACCP knowledge verification for employees |
| **Confirmation** | Employee sign-off on HACCP protocols |
| **session_task** | Runtime task instances with `category: haccp` and `completion_data` for readings |
| **session_hook** | Timed triggers for HACCP routines |
| **ai_session_event** | AI monitoring log for HACCP events |

---

## 11. Integration Points

| Module | Integration |
|--------|-------------|
| **Core Architecture** | Governance model (Policy → Protocol → full chain). Asset type `ccp`. |
| **Module 2: Org Structure** | Assets (equipment), Locations (where CCPs are), Zones (specific areas) |
| **Module 3: Scheduling** | HACCP tasks visible in shift context. Employees with expired certs flagged. |
| **Module 4: Operations** | Department Session is the container. Session Hooks trigger HACCP routines. Session Tasks are the trackable units. Deviation → Runbook → Control List all within session context. |
| **Module 6: Training** | HACCP Knowledge Tests, certification training, cross-training on HACCP procedures |
| **Module 9: Communication** | Deviation alerts via push/SMS/voice. HACCP status in Day Brief. |
| **Module 10: Reports** | HACCP compliance report, temperature history, deviation trends, Mattilsynet inspection report |
| **Module 12: AI** | Operation Engine monitors HACCP in real-time. Predictive maintenance. Pattern detection. |

---

## 12. Implementation Sequence

| Phase | Scope | Duration |
|-------|-------|----------|
| **1. CCP data layer** | `haccp_control_point` table. Link Assets to CCPs. Admin UI for defining CCPs with limits. | Week 1–2 |
| **2. Temperature logging UI** | Mobile form for temperature input. CCP-aware task rendering. Auto-deviation detection. | Week 3–4 |
| **3. Hygiene checklists** | Procedure-based checklists with photo upload. Session hook integration. | Week 5–6 |
| **4. Deviation flow** | deviation_flagged → Runbook trigger → corrective action → Control List closure. Full loop. | Week 7–8 |
| **5. Certificate tracking** | `haccp_certificate` table. Expiry monitoring. AI alerts. Admin management UI. | Week 9–10 |
| **6. Inspection reports** | HACCP report generator. PDF export. Inspection mode view. Compliance score. | Week 11–12 |
| **7. AI intelligence** | Trend detection, pattern correlation, predictive maintenance, smart routing. | Week 13–14 |

---

## 13. Migration Notes

Specific considerations for migration from Bubble to Next.js/Supabase:

- `haccp_control_point` needs `workspace_id` for RLS scoping
- Temperature readings stored as JSONB in `session_task.completion_data` — consider a materialized view for fast historical queries across many sessions
- Photo uploads for hygiene checklists go to Supabase Storage under `{workspace_id}/haccp/` path with workspace-scoped RLS
- HACCP report generation should be an Edge Function that queries session_task data and formats into structured output
- Certificate expiry checking can run as a nightly n8n workflow or scheduled Edge Function
- RLS: HACCP data follows same rules as session_task — employees see own completions, managers see department, admin sees all
- Consider `pg_trgm` index on deviation_notes for full-text search across deviation history
- For Mattilsynet export: Edge Function that generates PDF using headless rendering or structured template
- Offline support (React Native): temperature readings can be queued locally and synced when online, with local timestamp preserved

---

*This module demonstrates the power of the Governance model — HACCP compliance requires no new task engine, no separate scheduling, and no custom deviation system. Everything is built on Policy → Protocol → Procedure → Routine → Runbook → Control List, materialized through Department Sessions and tracked through session_tasks. The only new tables are `haccp_control_point` (CCP definitions) and `haccp_certificate` (employee certifications).*
