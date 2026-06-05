---
title: Workspace-Configurable Policies — Time-tracking & Payroll
status: draft
created: 2026-05-06
updated: 2026-05-06
module: payroll
tags: [payroll, time-tracking, policies, compliance, aml, gdpr, riksavtalen]
---

# Workspace-Configurable Policies — Time-tracking & Payroll

> Research basis: Norwegian arbeidsmiljølov (aml), Riksavtalen 2022–2024 (Fellesforbundet/NHO Reiseliv), Datatilsynet guidance, competitive analysis (Planday, Tamigo, ConnectTeam, Deputy, Quinyx).
> Confidence markers: HIGH = law is explicit; MEDIUM = interpretation from principles; LAV = inferred from competitive practice.

---

## Existing configurable settings (do not duplicate)

| Table | Columns already there |
|---|---|
| `shift_clock_config` | `gps_required`, `gps_radius_meters`, `gps_reference_lat/lng`, `adhoc_shifts_enabled`, `adhoc_requires_approval`, `punch_window_minutes` — cascades workspace → department → team |
| `payroll_workspace_settings` | `period_type`, `period_start_day`, `shift_grouping`, `employer_social_security_pct`, `vacation_pay_pct`, `pension_pct`, `default_worked_hours_salary_code`, `default_monthly_salary_code` |
| `payroll.break_rule` | `trigger_type` (after_duration / time_of_day), `trigger_minutes`, `trigger_time`, `duration_minutes`, `min_shift_duration_minutes`, `is_paid`, `department_ids`, `employee_group_ids` |
| `payroll.working_time_rule` | `code`, `threshold_value`, `severity` (block/warn), `scope_type` (workspace/department/employee_group) — AML W01–W06 |
| `payroll.supplement_rule` | Supplement types, rates, time-of-day triggers |
| `payroll.shift_type` | `allow_supplements`, `allow_breaks`, `allow_meal_deduction`, `count_in_payroll`, `affects_salaried` |
| `tips_workspace_settings` | `tips_enabled` |

All policies below are **net-new** unless stated otherwise.

---

## 1. Overtime Authorization

### Norwegian law (aml §10-6)

- Overtime = work exceeding 9h/day or 40h/week (normal limits). Riksavtalen tariff: applies the same thresholds.
- **Minimum supplement: 40% above ordinary wage** (aml §10-6 (1)). Riksavtalen sets this at **50%** — higher rate wins.
- **OT is owed even without pre-approval.** aml §10-6 states the employer must pay the supplement for overtime performed. The obligation to pay arises from the work being performed, not from approval. An employee who works OT without authorization can be disciplined, but the employer cannot withhold the OT supplement. [HIGH confidence — Norwegian legal consensus from Arbeidstilsynet and LO advisories.]
- aml requires employer to *drøfte* (consult) employees' representatives before implementing OT, but "consult" ≠ "obtain pre-approval from the employee who performs the work."
- Riksavtalen: employees under 18 must not work overtime.

### Industry practice (Planday, Tamigo, Deputy)

- Planday: OT gate at **planning time** — TOIL/Flex shift types separate from normal. Manager assigns shift type. No runtime block.
- Deputy: "Regular Working Hours" threshold configures OT calculation. Approval of timesheets is post-hoc, not pre-event.
- ConnectTeam: real-time alerts when approaching OT, but does not block clock-out.

### Policy options

**A. No gate** — OT is calculated post-hoc at payroll run. Manager approves timesheets.
**B. Planning gate** — Schedule must contain an explicit "overtime shift type" for hours above threshold. Unplanned OT still recorded but flagged as deviation.
**C. Runtime soft gate** — employee sees OT warning on punch-out; manager notified; timesheet requires manual approval. No block.

### Recommended default + config

> Norwegian law does not permit withholding OT pay for lack of approval. Therefore a **hard block at punch-out is legally risky** — if the system prevents punch-out, the employer could argue the employee never worked those hours, which is a false record.

| Setting | Type | Default | Cascade dimension |
|---|---|---|---|
| `overtime_gate` | ENUM `none \| planning \| soft_warn` | `soft_warn` | D5 workspace default |
| `overtime_soft_warn_threshold_minutes` | INT | `15` (warn after 15 min over shift end) | D5 |
| `overtime_require_manager_approval` | BOOLEAN | `true` (timesheet approval required for OT lines) | D5 / C4 |

Per-employee override: none (law applies uniformly). Per-shift-type override: `payroll.shift_type.allow_supplements` already controls whether OT supplement can apply to a given shift type.

---

## 2. Time Rounding (Avrunding av punch in/out)

### Common practice

- Intervals: 5, 10, 15, 20, 30, 60 minutes. Industry standard is 5 or 15.
- Modes: round to nearest, always round down, always round up, or custom per punch-direction.
- Planday: supports 5/10/15/20/30/60 min; separate rules for early punch-in, late punch-in, early punch-out, late punch-out; default is **no rounding** (show actual punched time).
- Deputy: enable/disable auto-rounding; rounds pending timesheets before auto-approval.
- ConnectTeam: rounding available but not documented in public docs.

### Norwegian legal status

- aml §10-7: employer must record **actual** working time for each employee. The statute says "faktisk arbeidstid."
- **Systematic rounding that disadvantages the employee is legally problematic.** Norwegian legal practice: rounding punch-in forward (later) or punch-out backward (earlier) is a form of underpayment. No specific court ruling found, but the principle follows from aml §10-7 + the obligation to pay all overtime (§10-6). [MEDIUM confidence — no case law directly on rounding, but principle is clear from statute.]
- Rounding toward the scheduled shift time is least risky — it treats the employee as if they started/ended exactly on schedule, which matches what they were paid for.
- "Off-the-clock" equivalents in Norway: aml §10-7 + employer's duty to pay all OT means an employer who uses rounding to shave time is exposed to claims for unpaid overtime. No class-action mechanism like the US, but Arbeidstilsynet can fine and employees can claim individually.
- Riksavtalen: no specific rounding clause found. Some collective agreements elsewhere specify rounding up to nearest 30 min for sporadic OT under 30 min is not paid — this is tariff-specific, not a general rule.

### Best-practice recommendation

- **Always round toward the employee** (punch-in rounds down to earlier 5-min mark; punch-out rounds up to next 5-min mark). This is the most defensible approach.
- Alternatively: **round to scheduled time when within a configurable window** (e.g., ±10 minutes of scheduled start/end → snap to scheduled time). This is what Planday's "deviation rules" implement.
- Banker's rounding (half-even) adds complexity with no legal advantage over toward-employee rounding.

| Setting | Type | Default | Cascade dimension |
|---|---|---|---|
| `punch_rounding_enabled` | BOOLEAN | `false` (no rounding — actual time) | D5 |
| `punch_rounding_interval_minutes` | INT `5\|10\|15\|20\|30` | `15` (if enabled) | D5 |
| `punch_rounding_mode` | ENUM `toward_employee \| toward_schedule \| nearest` | `toward_employee` | D5 |
| `punch_rounding_window_minutes` | INT | `10` (within window: snap to schedule) | D5 |

Per-employee override: **not recommended** — creates audit complexity and differential treatment risk. Per-shift-type override: none.

---

## 3. Punch-in Without Assigned Shift

### Options

**A. Block** — employee cannot punch in without an existing shift.
- Pro: clean payroll, no ghost entries, no accidental OT.
- Con: inflexible for hospitality where staff get pulled in last-minute ("kan du hjelpe til nå?"). Creates friction that leads to unrecorded work = aml §10-7 violation.

**B. Auto-create shift on punch** — system creates a schedule_shift row with default position/department.
- Pro: seamless for employee; time is always recorded.
- Con: payroll engine sees a shift with no planned hours = no scheduled end → no auto-punch-out → forgotten punch-out risk. Also triggers OT cap calculation from a cold start — which D3 framework_rule cannot anticipate.
- Requires: default position and default department configured per workspace.

**C. Timesheet-only entry** — punch creates a timesheet row NOT linked to a schedule_shift; manager must review and convert.
- Pro: least invasive; captures actual time without creating a provisional shift; defers payroll impact until manager confirms.
- Con: conversion step adds manager burden; if not converted, hours are invisible to payroll engine.

### Industry standard for restaurants

Tamigo, Planday, Deputy: **Option B with approval gate** is the de-facto standard for hospitality. Deputy calls it "unscheduled timesheets" — created, flagged for manager approval, counted in payroll once approved. `adhoc_shifts_enabled` + `adhoc_requires_approval` in `shift_clock_config` already implement this.

### Riksavtalen / OT-cap interaction

- Ad-hoc shifts created on punch must be included in weekly OT cap calculation (aml §10-6: 10h OT/week, 25h/4 weeks, 200h/year).
- If payroll engine only tracks OT against scheduled shifts, ad-hoc punches can slip through the OT cap — **legal exposure**.
- Option B requires the derivation layer to include ad-hoc shift hours in OT aggregation. [HIGH concern — must verify in shift_derivation_layer.]

| Setting | Already exists? | Table |
|---|---|---|
| `adhoc_shifts_enabled` | YES | `shift_clock_config` |
| `adhoc_requires_approval` | YES | `shift_clock_config` |
| `adhoc_default_position_id` | **NO — new** | `shift_clock_config` |
| `adhoc_default_department_id` | **NO — new** | `shift_clock_config` |

New columns needed: `adhoc_default_position_id UUID REFERENCES position(position_id)` and `adhoc_default_department_id UUID REFERENCES department(department_id)` on `shift_clock_config`.

---

## 4. Location Restrictions (Innsjekk-begrensning)

### Options and their mechanisms

**A. Anywhere (ingen begrensning)**
- No location check. Simplest.
- GDPR: no location data collected at all — zero personvern-risk.

**B. GPS-geofence** — must punch within X meters of department GPS coords.
- `shift_clock_config` already has: `gps_required`, `gps_radius_meters`, `gps_reference_lat`, `gps_reference_lng`.
- GDPR/Datatilsynet: **This IS a control measure (kontrolltiltak) under aml §9-1.**
  - aml §9-1: control measure must have *saklig grunn* (legitimate purpose) and must not impose *uforholdsmessig belastning* (disproportionate burden).
  - aml §9-2: employer must *drøfte* (discuss) the measure with employee representatives before implementation. Must inform affected employees of: purpose, scope, how data is used.
  - GDPR Art. 25: privacy-by-design — only collect location at the moment of punch-in, not continuously. Do not store precise coordinates after verification is done.
  - **Storing a binary "was inside geofence: yes/no" is far less risky than storing the exact coordinates of where the employee punched in.**
  - Datatilsynet guidance (vehicle tracking ruling 2021): any GPS/location tracking at workplace requires documented legitimate purpose, proportionality assessment, and prior employee information. A DPIA (Data Protection Impact Assessment) is required for systematic employee location tracking (GDPR Art. 35).
  - The Coop Finnmark case (2021, NOK 400 000 fine) was about camera surveillance/sharing, not GPS — but the principle applies: inadequate basis + no documented process = fine.

**C. Network restriction (workspace WiFi)**
- Employee must be on a designated network SSID or IP range.
- GDPR: lower risk than GPS — no precise location, just network presence. Still a kontrolltiltak requiring §9-2 consultation.
- Practical problem: restaurants often have poor or no employee WiFi; guest networks are shared; VPNs bypass it.

**D. QR code** — employee scans a code displayed at a physical terminal/poster at the venue.
- No location data stored. Employee presence implied by scan.
- GDPR: minimal — only timestamp + profile + scan event. No location data.
- Industry: ConnectTeam offers "Kiosk mode" (shared tablet at entrance). Tamigo offers QR scanning.
- Best for small venues with a fixed entrance point.

**E. Bluetooth beacon** — proximity to a hardware beacon at the venue.
- GDPR: similar to WiFi — proximity inference, not GPS coordinates.
- Practical: requires beacon hardware purchase and maintenance. Not standard in Nordic hospitality.

### Norwegian legal requirements for B (GPS geofence)

Under aml §9-1 + §9-2 + GDPR:
1. **Document the purpose** in writing (e.g., "ensure employees are at the work location when they start their paid shift").
2. **Drøfte med tillitsvalgte** (discuss with shop steward) before enabling.
3. **Inform all affected employees** before activation: what data is collected, how long it's kept, who sees it.
4. **Data minimization**: collect only a yes/no result or a single coordinate at punch time. Do not track employee location during the shift.
5. **Retention**: location data at punch-in should be deleted after the payroll period is locked (e.g., 60 days). Not stored indefinitely.
6. **DPIA required** if implemented systematically across all departments. [HIGH confidence on §9-2 process; MEDIUM on DPIA threshold — depends on scale.]

### Recommended default for Norwegian hospitality

**Default: Option A (no restriction).** Geofence (B) available to opt in per department — the most common hospitality scenario has staff coming in through a back entrance or changing elsewhere. GPS accuracy inside buildings is often ±50–100 m, making a 200 m default radius effectively useless anyway. QR kiosk (D) is the best alternative if management wants physical verification without GPS complexity.

| Setting | Already exists? | Note |
|---|---|---|
| `gps_required` | YES | `shift_clock_config` |
| `gps_radius_meters` | YES | `shift_clock_config` |
| `gps_reference_lat/lng` | YES | `shift_clock_config` |
| `network_restriction_enabled` | **NO** | New — low priority |
| `qr_kiosk_required` | **NO** | New — recommended to add |
| `punch_location_retention_days` | **NO** | New — GDPR compliance |

Cascade dimension: D5 (workspace default) + per-department override in `shift_clock_config`. C4 gate should require admin-level authorization to enable GPS/location restriction (it is a §9-1 kontrolltiltak).

---

## 5. Additional Policies

### 5.1 Break Auto-deduction

**What**: system deducts a fixed unpaid break duration from worked hours regardless of whether the employee physically recorded a break.

**Options**: off (deduct only what was recorded); auto-deduct N minutes when shift ≥ X hours.

**Existing**: `payroll.break_rule` already handles this (`trigger_type=after_duration`, `is_paid=false`). **No new table needed.**

**Norwegian law**: aml §10-9 requires a break when shift > 5.5h. Whether the break is paid or unpaid depends on whether the employee can leave the workplace. In most restaurant contexts: kitchen staff cannot leave = **break must be paid**. Auto-deducting an unpaid break for kitchen staff is an aml §10-9 violation. [HIGH confidence.]

**Default**: no auto-deduction. Let break_rule be configured explicitly with `is_paid` set correctly.

**Cascade**: `payroll.break_rule` is already D5 (workspace) with department/employee_group scoping.

---

### 5.2 Punch-in Buffer (Early Clock-in Window)

**What**: how many minutes before shift start an employee can punch in and have it count as shift start.

**Existing**: `shift_clock_config.punch_window_minutes` (default 30) controls the total window. This appears to be a symmetric window — needs clarification on whether it's before-only, after-only, or both.

**Gap**: no separate `early_punch_buffer_minutes` and `late_punch_grace_minutes` fields. `punch_window_minutes` as a single value cannot express "allow 15 min early but up to 60 min late."

**Industry**: Planday has separate rules per punch direction. Deputy has "grace period" for start vs end separately.

**New settings needed**:

| Setting | Type | Default | Cascade |
|---|---|---|---|
| `early_punch_buffer_minutes` | INT | `15` (can punch 15 min before shift start) | D5 / dept override |
| `late_punch_grace_minutes` | INT | `60` (can punch up to 60 min after shift end — e.g., forgot to punch out before leaving for transport) | D5 |

---

### 5.3 Forgotten Punch-out Handling

**What**: if an employee never punches out, what happens?

**Options**:
- A. Manager must manually enter punch-out time.
- B. Auto-close at scheduled shift end (punch_out = scheduled_end_time).
- C. Auto-close at shift end + configurable buffer (e.g., scheduled_end + 30 min).
- D. Prompt employee at next punch-in: "Du glemte å stemple ut. Hva tid gikk du?"

**Industry**: Planday: timesheet flagged as missing, manager edits. Deputy: auto-approval can close at shift end. ConnectTeam: sends push notification if employee forgets.

**Norwegian law**: aml §10-7 requires accurate records. Auto-closing at scheduled end is legally safer than leaving a blank record, but potentially **underpays if employee worked longer** (then manager edit is necessary to correct). A push notification (D) preserves accuracy.

| Setting | Type | Default | Cascade |
|---|---|---|---|
| `forgotten_punchout_action` | ENUM `flag_for_manager \| auto_close_at_shift_end \| auto_close_with_buffer \| notify_employee` | `notify_employee` then `flag_for_manager` | D5 |
| `forgotten_punchout_buffer_minutes` | INT | `30` (if auto_close_with_buffer) | D5 |
| `forgotten_punchout_notify_delay_minutes` | INT | `60` (send push 60 min after shift end if no punch-out) | D5 |

---

### 5.4 Manager Edits to Punches

**What**: can a manager edit an employee's recorded punch-in/out time? Must they provide a reason? Must the employee acknowledge?

**Norwegian law**: aml §10-7 requires accurate records — manager edits are legitimate as corrections. No legal requirement for employee acknowledgment of edits, but it is best practice and protects against disputes. [MEDIUM confidence.]

**Industry**: Deputy: all edits are logged with before/after. Planday: edit history maintained. ConnectTeam: edits require reason text.

| Setting | Type | Default | Cascade |
|---|---|---|---|
| `manager_edit_requires_reason` | BOOLEAN | `true` | D5 |
| `manager_edit_notify_employee` | BOOLEAN | `true` | D5 |
| `employee_can_dispute_edit` | BOOLEAN | `true` | D5 |
| `dispute_timeout_hours` | INT | `48` (employee has 48h to dispute; silence = accepted) | D5 |

Cascade: D5 default. Per-employee override: none. Manager edit action gated by C4 (manager role minimum).

---

### 5.5 Employee Punch Corrections / Disputes

**What**: can an employee submit a correction request for their own punch record?

**Options**: not allowed; allowed — pending manager approval; auto-apply if within threshold.

**Industry**: Deputy: employees can comment on timesheets. Planday: employees can request corrections. ConnectTeam: dispute flow with manager approval.

| Setting | Type | Default | Cascade |
|---|---|---|---|
| `employee_correction_enabled` | BOOLEAN | `true` | D5 |
| `employee_correction_max_days_back` | INT | `7` (can only correct within 7 days) | D5 |
| `employee_correction_auto_approve_threshold_minutes` | INT | `0` (all corrections require manager approval by default) | D5 |

Cascade: D5. C4: correction submission requires employee role; approval requires manager role.

---

### 5.6 Rest Period Enforcement (11-timersregelen)

**What**: aml §10-8 requires 11 consecutive hours of rest between two work periods. Should the system block a punch-in if the employee has not had 11h rest since last punch-out?

**Norwegian law**: aml §10-8 (1): minimum 11h continuous rest within 24h. Exception by written agreement with union: can reduce to 8h with compensatory rest. Tariff agreements can deviate only when compensatory rest is provided. [HIGH confidence.]

**Industry**: no platform found that hard-blocks punch-in for rest violations. All flag as deviation for manager review.

**Options**: off; warn (flag deviation, allow punch); block (prevent punch-in, require manager override).

**Recommended**: `warn` by default — a hard block could itself create an aml issue if the employee *must* work (emergency coverage). Manager must acknowledge and create a `deviation` record.

| Setting | Type | Default | Cascade |
|---|---|---|---|
| `rest_period_enforcement` | ENUM `off \| warn \| block` | `warn` | D5 |
| `rest_period_min_hours` | NUMERIC | `11.0` (aml default; 8.0 if agreement exists) | D3 (framework_rule binding) |
| `rest_period_block_requires_manager_override` | BOOLEAN | `true` | D5 / C4 |

Cascade: D3 governs the legal threshold (framework_rule); D5 governs the enforcement behavior. Per-employee: not applicable (law applies uniformly). Per-shift-type: shift_type could be marked `exempt_rest_enforcement` for on-call types (with care).

---

### 5.7 Offline Punch (Cache + Sync Later)

**What**: if employee has no internet connection, should the app cache the punch event and sync when connection is restored?

**Norwegian law**: no specific requirement. aml §10-7 requires records be maintained — an offline cache that syncs is compliant as long as the timestamp is accurate (device clock, not server receipt time). [HIGH confidence on compliance; offline sync is a data integrity design choice, not a legal one.]

**Current state**: `timesheet.time_entry` is written by mobile app via offline write queue (per table comment). This is already implemented.

**Policy**: binary on/off, plus a maximum cache duration before the punch is discarded as unresolvable.

| Setting | Type | Default | Cascade |
|---|---|---|---|
| `offline_punch_enabled` | BOOLEAN | `true` | D5 |
| `offline_punch_max_cache_hours` | INT | `24` (discard if offline longer than 24h without sync) | D5 |

Already largely implemented in mobile offline queue. Configuration row is missing; add to `shift_clock_config`.

---

### 5.8 Trainee/Restricted Punch-in

**What**: can a trainee punch in alone, or must a supervisor be present / have a co-worker confirm?

**Norwegian law**: no specific statutory restriction on trainees punching in alone. However, some collective agreements and workplace rules require that a responsible person be present when a trainee (lærling) works. Workplace HSE rules may require supervision for certain roles. [MEDIUM confidence — no specific aml rule; tariff/HSE dependent.]

**Industry**: no platform found with "co-worker confirmation" for punch-in. Standard approach is to assign trainees to shifts where a supervisor is already scheduled.

| Setting | Type | Default | Cascade |
|---|---|---|---|
| `trainee_punch_requires_supervisor_present` | BOOLEAN | `false` | D2 (per-employee flag) |

This is a per-employee setting (profile-level), not workspace-default. Cascade: D2.

---

### 5.9 Split Shift / Multi-Punch in One Day

**What**: can an employee punch in twice in one day (split shift), creating two separate time_entry rows? How are the two segments treated in payroll?

**Norwegian law**: split shifts are common in hospitality and legal under aml. OT is calculated on daily total across segments. The gap between segments does not count as rest for the 11-hour rule purposes if it is too short. [HIGH confidence on aml treatment; MEDIUM on gap/rest interaction.]

**Industry**: Planday and Deputy support multiple timesheets per day linked to separate shifts.

**Options**: allow (each punch links to a distinct shift_id); allow with minimum gap (prevent accidental double-punch); disallow (force single continuous punch per day).

| Setting | Type | Default | Cascade |
|---|---|---|---|
| `split_shift_enabled` | BOOLEAN | `true` | D5 |
| `split_shift_min_gap_minutes` | INT | `30` (must be at least 30 min between segments — prevents accidental double-punch) | D5 |

Cascade: D5 default. Per-employee: no. Per-shift-type: `payroll.shift_type.allow_conflicting_shifts` already exists — check before creating a second open entry.

---

### 5.10 Shift Swap — Punch Ownership

**What**: when two employees swap shifts mid-period, who "owns" the time_entry rows?

**Norwegian law**: each time_entry is owned by the employee who performed the work. If A swaps with B, B's time_entry is under B's profile_id regardless of who was originally scheduled. OT calculation is per-employee. [HIGH confidence — basic payroll principle.]

**Current state**: `timesheet.time_entry.profile_id` is the person who punched in. Shift swap changes the schedule_shift assignment. No policy setting needed — this is a data model consequence, not a configurable policy.

**Implementation note**: when a swap is approved, the swap approval process must update `schedule_shift.profile_id` BEFORE the employee punches in; otherwise the punch creates an ad-hoc entry for the swapping employee.

---

### 5.11 Forced Break Reminder

**What**: push notification sent to employee after N hours of continuous work, reminding them to take a break.

**Norwegian law**: aml §10-9 requires a break after 5.5h — a reminder at e.g. 5h is a proactive compliance tool. Not legally required, but demonstrates good faith. [HIGH on law; LAV on whether reminder counts for anything legally.]

| Setting | Type | Default | Cascade |
|---|---|---|---|
| `break_reminder_enabled` | BOOLEAN | `true` | D5 |
| `break_reminder_after_hours` | NUMERIC | `5.0` (remind after 5h worked — 30 min before legal requirement) | D5 |

Cascade: D5 default. Per-employee: no. Delivered via `notifications` package push.

---

### 5.12 Timesheet Auto-Approval

**What**: after N hours/days with no action, should pending timesheets auto-approve?

**Norwegian law**: no requirement for manual approval, but aml §10-7 requires the employer to maintain records. Auto-approval with audit log is compliant. [MEDIUM confidence.]

**Industry**: Deputy: configurable auto-approve with configurable delay. Planday: no auto-approve — manager must act.

| Setting | Type | Default | Cascade |
|---|---|---|---|
| `timesheet_auto_approve_enabled` | BOOLEAN | `false` | D5 |
| `timesheet_auto_approve_after_hours` | INT | `72` (3 days after shift end) | D5 |
| `timesheet_auto_approve_exclude_ot` | BOOLEAN | `true` (never auto-approve if OT present) | D5 |

Cascade: D5. C4: auto-approval trigger is engine action, gated by workspace-level setting.

---

## 6. Mapping to Cascade Dimensions

| Policy | Workspace default | Per-employee override | Per-shift-type override | Cascade dim | C4 gate |
|---|---|---|---|---|---|
| Overtime gate | D5 | No | Via shift_type.allow_supplements | D5 | Manager approval for OT timesheet |
| OT require manager approval | D5 | No | No | D5 / C4 | Manager |
| Punch rounding mode/interval | D5 | No | No | D5 | Admin |
| Punch rounding window | D5 | No | No | D5 | Admin |
| GPS geofence (existing) | D5 → dept | No | No | D5 / shift_clock_config | Admin (§9-1 gate) |
| Adhoc shift enabled (existing) | D5 → dept | No | No | D5 | Admin |
| Adhoc default position/dept | D5 → dept | No | No | D5 | Admin |
| QR kiosk required | D5 → dept | No | No | D5 | Admin |
| Location data retention days | D5 | No | No | D5 / GDPR | Admin |
| Break auto-deduct (existing) | payroll.break_rule | By employee_group | By department | D5 (payroll) | Manager |
| Early punch buffer | D5 → dept | No | No | D5 | Admin |
| Late punch grace | D5 → dept | No | No | D5 | Admin |
| Forgotten punchout action | D5 | No | No | D5 | Admin |
| Manager edit requires reason | D5 | No | No | D5 | Admin |
| Employee correction enabled | D5 | No | No | D5 | Admin |
| Rest period enforcement | D5 (behavior) | No | Shift type exempt flag | D3 (threshold) / D5 (behavior) | Manager override for block |
| Offline punch enabled | D5 | No | No | D5 | Admin |
| Trainee punch restriction | No default | D2 (per-profile) | No | D2 | Manager |
| Split shift enabled | D5 | No | Via shift_type.allow_conflicting | D5 | Admin |
| Shift swap punch ownership | Not configurable — data model | — | — | D2 (time_entry.profile_id) | — |
| Break reminder | D5 | No | No | D5 | Admin |
| Timesheet auto-approve | D5 | No | No | D5 / C4 | Admin |

---

## Sources

- [aml §10-6 — Overtid (Lovdata)](https://lovdata.no/nav/lov/2005-06-17-62/kap10)
- [aml §10-7 — Registrering av arbeidstid (Arbeidstilsynet)](https://www.arbeidstilsynet.no/arbeidstid-og-organisering/arbeidstid/registrering-av-arbeidstid/)
- [aml §10-8 — Daglig og ukentlig arbeidsfri (Arbinn/NHO)](https://arbinn.nho.no/arbeidsrett/arbeidstid-ferie-og-permisjon/arbeidstid-skift-og-turnus/artikler/hviletid/)
- [aml §10-9 — Pauser (Lovdata artikkel)](https://lovdata.no/artikkel/lunsj_og_andre_pauser_i_arbeidstiden/3673)
- [aml §9-1/§9-2 — Kontrolltiltak (Lovdata)](https://lovdata.no/nav/lov/2005-06-17-62/kap9)
- [Datatilsynet — GPS og sporing av yrkesbiler](https://www.datatilsynet.no/personvern-pa-ulike-omrader/personvern-pa-arbeidsplassen/overvaking-kjoretoy/)
- [Datatilsynet — Lokalisering](https://www.datatilsynet.no/personvern-pa-ulike-omrader/overvaking-og-sporing/lokalisering/)
- [Datatilsynet — Coop Finnmark vedtak 2021](https://www.datatilsynet.no/regelverk-og-verktoy/lover-og-regler/avgjorelser-fra-datatilsynet/2021/vedtak-om-overtredelsesgebyr-til-coop-finnmark/)
- [Riksavtalen 2022–2024 — Fellesforbundet/NHO Reiseliv](https://www.fellesforbundet.no/lonn-og-tariff/tariffavtaler/riksavtalen/)
- [LO — Overtid uten forhåndsgodkjenning](https://www.lo.no/hva-vi-mener/lo-advokatene/nyheter-fra-lo-advokatene/nar-og-hvem-har-krav-pa-overtid/)
- [Overtid — Lovdata artikkel](https://lovdata.no/artikkel/overtid__hva_er_det_og_hvilke_rettigheter_har_du/4336)
- [Planday — Punch Clock rounding rules](https://help.planday.com/en/articles/30453-punch-clock-configure-rounding-rules)
- [Planday — Automatic and manual breaks](https://help.planday.com/en/articles/30476-how-to-set-up-automatic-or-manual-breaks)
- [Tamigo — Geofencing](https://blog.tamigo.com/track-worked-hours-geofencing)
- [ConnectTeam — GPS Location Tracking](https://help.connecteam.com/en/articles/6489778-time-clock-gps-location-tracking-geolocation)
- [Deputy — Timesheet rounding](https://help.deputy.com/hc/en-au/articles/4689509976463-Rounding-timesheets-settings-in-Deputy)
- [Deputy — Overtime settings](https://help.deputy.com/hc/en-au/articles/5340237644815-How-does-overtime-work-in-Deputy)
