---
title: Payroll User Flows
status: draft
updated: 2026-05-06
created: 2026-05-06
module: payroll
tags: [payroll, user-flows, manager, admin, employee, mobile-parity]
---

# Payroll User Flows

> Manager + admin + employee. Every flow has gate-checks, telemetry, and audit. Mobile parity rule (ADR-0133): web composes (period authoring + approval), mobile witnesses (employee read-only).

## 1. Surface Map

| Surface | Audience | Verb | File |
|---|---|---|---|
| `/dashboard/payroll` | admin/manager | review, lock, approve | apps/web (Phase 1) |
| `/dashboard/payroll/[periodId]` | admin/manager | line review per profile | apps/web (Phase 1) |
| `/dashboard/payroll/[periodId]/[profileId]` | admin/manager | per-shift drawer | apps/web (Phase 1) |
| `/dashboard/payroll/settings` | admin/owner | salary codes, supplement rules, holiday calendar | apps/web (exists, fragmented; consolidate Phase 1) |
| `/dashboard/my-salary` | employee | own past payslips | apps/web (exists, read-only) |
| `(me)/payroll/payslip-list` | employee mobile | list payslips | apps/mobile (exists) |
| `(me)/payroll/payslip-detail` | employee mobile | one payslip drawer | apps/mobile (exists) |
| Botsson chat | admin | chat-driven payroll ops via capability | packages/ai (Phase 1+ tools) |

---

## 2. Roles + Permissions Matrix

| Op | employee | manager | admin | owner |
|---|---|---|---|---|
| View own payslip | ✓ | ✓ | ✓ | ✓ |
| View other employee's payslip | — | — | ✓ | ✓ |
| Acknowledge deviation (severity=error) | — | ✓ | ✓ | ✓ |
| Add manual supplement | — | confirm | confirm | ✓ |
| Override calculation line via change_proposal | — | propose | approve | approve |
| Lock period | — | — | ✓ | ✓ |
| Approve period | — | — | ✓ (four-eyes optional) | ✓ |
| Unlock period (open phase only) | — | — | ✓ | ✓ |
| Approved → reopened | — | — | — | — (always corrective period) |
| Export period (CSV/PDF/A-melding/Tripletex) | — | — | ✓ | ✓ |
| Reveal personnummer / kontonummer | — | — | ✓ (audit-emit) | ✓ (audit-emit) |
| Edit `employee_payroll_profile` | self (limited) | — | ✓ | ✓ |
| Edit `tariff_rate_table` | — | — | — (platform seed) | — |
| Edit workspace tariff override | — | — | ✓ | ✓ |

---

## 3. Flow A — Period Review (Golden Path)

**Trigger:** 5. i påfølgende måned. Manager/admin opens `/dashboard/payroll`.

```
1. List view shows all periods. Default sort: end_date DESC.
   Status badges: open (orange), locked (yellow), approved (green), exported (gray)
   For each open period: row count, total deviations, total gross.

2. Click open period → /dashboard/payroll/[periodId]
   Header: period dates, total gross/net, employee count, deviation summary
   Tabs: Lines | Deviations | Manual supplements | Tip pool | Export
   Default tab: Lines

3. Lines tab: table per profile
   Columns: name, scheduled hours, actual hours, OT, kveldstillegg, helgetillegg,
            holiday, manual supplements, deductions, gross, net (after tax)
   Row click → drawer (Flow C)
   Filter: department, deviation flag, wage_type, search by name

4. Deviations tab: list of severity=error + warning
   Each row: profile name, check_id (W01-W12), message, link to source shift
   Action: "Acknowledge" button → opens form (acknowledger comment required)
   Action: "Resolve via override" → triggers Flow D (line override)

5. Manual supplements tab: list of admin-added rows
   Action: "Add new" → Flow E

6. Tip pool tab (if pool exists for period):
   Status: calculated/approved/paid
   On period lock → tip_distribution.payroll_period_id is set
   Calculations from tip pool show as tip lines in employee's calculation_lines

7. Click "Lock period" (only if all severity=error acknowledged)
   Confirmation modal:
     - Period: 2026-04-01 → 2026-04-30
     - Total gross: kr 234,567.00
     - Locked rows: 89 calculations across 12 employees
     - Employee count: 12
     - Action is reversible to 'open' but not after 'approved'
   On confirm:
     - capability.lock_period called via gateAction (level=confirm, min_role=admin)
     - period.status = 'locked', locked_by, locked_at set
     - tip_distribution.payroll_period_id set for current pool
     - emit('payroll.period_locked', {...})
     - Toast: "Period locked. Ready for approval."

8. Click "Approve period"
   Pre-check: period.status === 'locked'
   Pre-check: no severity=error deviations un-acknowledged
   Confirmation modal w/ same info + "I confirm payroll is ready for export"
   If workspace policy requires four-eyes:
     - First approver clicks → period.status stays 'locked',
       change_proposal of type 'period_approval' created
     - Second admin sees in inbox, approves → period.status = 'approved'
   Else:
     - period.status = 'approved' immediately
   On approve:
     - emit('payroll.period_approved', {...})
     - Toast: "Period approved. Ready to export."

9. Click "Export"
   Modal w/ format choices: CSV (aggregat) | CSV (audit) | PDF lønnsslipp | A-melding XML | Tripletex
   For each: status indicator (not exported / exported on date)
   On export:
     - capability.export_period called
     - payroll_export_event row created (status=processing)
     - Server runs exporter, writes payroll_export_line rows
     - On completion: artifact_url set if applicable, status=completed
     - period.status='exported' on first successful export
     - emit('payroll.export_completed', {...})
     - UI shows download link or sync confirmation
```

**Telemetry summary for Flow A:**
- Step 7: `payroll.period_locked`
- Step 8 (single approver): `payroll.period_approved`
- Step 8 (four-eyes denied): `payroll.period_rejected`
- Step 9: `payroll.export_initiated`, `payroll.export_completed`

---

## 4. Flow B — Acknowledge Deviation

**Trigger:** Manager sees red flag on Lines tab or Deviations tab.

```
1. Click deviation row.
2. Drawer shows:
   - Profile name + shift date + check_id
   - Rule paragraf (e.g. "Aml. §10-8 første ledd — hviletid 11t")
   - Computed values (e.g. "Rest period: 9.5h, required: 11h")
   - Linked schedule_shift_id (click → opens schedule editor)
   - Source data snapshot (time_entry punch_in/out)
3. "Acknowledge" form:
   - Reason (required, free text, min 10 chars)
   - Optional: linked change_proposal for permanent fix
4. Submit:
   - capability.acknowledge_deviation called (level=suggest, min_role=manager)
   - payroll_deviation row updated: acknowledged_by, acknowledged_at, resolution
   - emit('payroll.deviation_acknowledged', {...})
   - Toast confirms.
5. Deviations tab refreshes; row moves to "Acknowledged" filter.
```

**Cannot acknowledge:**
- W11 (Bokføringsloven §13 violation) — never user-resolvable.
- W03 (lønn under min) and W08 (prøvetid > 6 mnd) — must trigger amendment, not acknowledgment.

---

## 5. Flow C — Per-Shift Drill-Down (Read)

**Trigger:** Manager clicks profile row in Lines tab.

```
Drawer opens with:
  - Header: profile, period, total gross
  - Tabs: Shifts | Lines | Audit (provenance)
  - Shifts tab: list of all schedule_shift in period
    Per shift: date, planned vs actual (from time_entry), interpretation breakdown
              (regular/OT/night/holiday/weekend), cost snapshot, applied tariff version
  - Lines tab: per-line view (worked, supplement, deduction)
    Click line → shows source: which framework_rule fired, which tariff rate, source_text_applied
  - Audit tab: shift_pay_calculation_event timeline for this profile this period
    Each entry: rule_type, rate_value_applied, quantity_value, subtotal, derivation_version
    Supersession chain visible (current row + prior versions)

Actions from drawer:
  - "Add manual supplement" → Flow E
  - "Override line" → Flow D
  - "Reveal bank account" / "Reveal personnummer" → audit-emitting reveal
```

---

## 6. Flow D — Override Calculation Line (via change_proposal)

**Trigger:** Manager finds wrong line; admin can approve fix.

```
1. From Lines drawer, click line → "Override" button.
2. Form:
   - Line type read-only
   - Current value (rate, hours, amount) read-only
   - Proposed value (editable)
   - Reason (required, free text)
   - Linked deviation (optional, if fixing W-flag)
3. Submit:
   - capability.override_calculation_line called (level=confirm, min_role=manager for propose)
   - change_proposal created (status=pending, kind=wage_line_override)
   - emit('payroll.line_override_proposed', {...})

4. Admin sees in inbox `/dashboard/inbox?type=wage_override`.
5. Admin reviews → Approve / Reject.
   On approve:
     - change_proposal.status = 'approved', approved_by, approved_at
     - applyWageLineOverride function:
       - Inserts new payroll_calculation row (append-only) with overridden value
       - New shift_pay_calculation_event with provenance.triggered_by_event='manual_override'
       - Old shift_pay_calculation_event rows superseded
     - emit('payroll.line_overridden', { proposal_id, ... })
   On reject:
     - change_proposal.status = 'rejected', rejected_by, rejection_reason
     - emit('payroll.line_override_rejected', {...})

6. If proposed by admin (skip approver): change_proposal directly approved + applied.
   Workspace policy (`requires_four_eyes_for_wage_override`) elevates to two-step.
```

---

## 7. Flow E — Add Manual Supplement

**Trigger:** Manager wants to add tip, bonus, or correction.

```
1. From Lines drawer, click "Add manual supplement" or from Manual supplements tab.
2. Form:
   - Salary code (select from payroll_salary_code, filter by category)
   - Hours OR amount (mutually exclusive based on rate_adjustment_type)
   - Effective shift_id (optional; if blank, attaches to period only)
   - Reason (required)
3. Submit:
   - capability.add_manual_supplement called (level=confirm, min_role=manager)
   - payroll_manual_supplement row inserted
   - Recalc-trigger: aggregate_period RPC re-runs for this profile
   - New payroll_calculation row inserted (append-only)
   - emit('payroll.manual_supplement_added', {...})
   - Toast confirms; Lines tab refreshes.

Constraints:
  - Period must be 'open' (cannot add to locked/approved period; admin must unlock first or new period)
  - Sum check: warn if added supplement causes total deviation > 20% from prior calc
```

---

## 8. Flow F — Employee Read (Mobile)

**Trigger:** Employee opens `(me)/payroll/payslip-list`.

```
1. List view: past payslips, ordered by period_end DESC.
   Per row: period (Apr 2026), gross, net (after tax + deductions), deviation count
2. Click row → payslip-detail drawer.
3. Detail view:
   - Period header
   - Tabs: Summary | Lines | Shifts
   - Summary: gross, OT, supplements, holiday, deductions, tax, net
   - Lines: full payroll_calculation_line list
   - Shifts: collapsed per-shift cost
   - Action: "Last ned PDF" → opens stored PDF (Phase 4)
   - Action: "Vis kontonummer" → RevealableField triggers audit-emit
4. No edit, no override, no acknowledge from mobile.
```

---

## 9. Flow G — Period Recalc (Admin-Triggered)

**Trigger:** Admin updates tariff override mid-period; needs full recalc.

```
1. Settings page → tariff override edit.
2. After save, banner appears: "Recalculate affected period?"
3. Click yes:
   - capability.recalculate_period called (level=confirm, min_role=admin)
   - Server kicks engine_process: derive_shift_hours → snapshot_shift_cost → aggregate_period
   - Old shift_pay_calculation_event rows superseded
   - New payroll_calculation rows appended
   - emit('payroll.recalc_triggered', {...})
   - Banner: "Recalculation in progress. Your current view will refresh in ~30s."
4. Auto-refresh detects new calculation_version, repopulates lines.

Constraints:
  - Only works on period.status = 'open'.
  - Locked/approved periods reject (W: "Cannot recalculate locked period; create corrective period.")
```

---

## 10. Flow H — Period Unlock (Open Phase Only)

**Trigger:** Admin needs to add a forgotten manual supplement after locking but before approving.

```
1. From period view header, "Unlock to make changes".
2. Confirmation modal: "This will reopen the period for edits. Tip pool will be detached. Continue?"
3. On confirm:
   - period.status = 'open', locked_by/at set to NULL
   - tip_distribution.payroll_period_id NULL'd (re-set on next lock)
   - emit('payroll.period_unlocked', {...})

Constraints:
  - Only allowed on period.status = 'locked'. Approved → corrective period only.
  - Requires admin role (workspace policy can elevate to four-eyes).
```

---

## 11. Flow I — Botsson Chat-Driven Payroll Ops

Per ADR-0078, all payroll capability ops are chat-only (no voice). Examples:

```
User: "Lås payroll for april 2026"
Botsson: Calls capability.lock_period
       (intent classifier routes 'payroll' capability)
       (gate_action: confirm-level → asks Botsson to confirm with admin)
Botsson: "Du er i ferd med å låse april-perioden (kr 234,567 over 12 ansatte). Bekrefter du?"
User:    "Ja"
Botsson: lock_period(period_id) → success
Botsson: "April-perioden er låst. Klar for godkjenning. Vil du godkjenne nå, eller skal en annen admin se på den først?"

User: "Legg 200kr drikkepenger på Anna for fredag-vakta"
Botsson: Looks up profile by name (workspace-scoped)
Botsson: Looks up shift_id by date + employee
Botsson: capability.add_manual_supplement(profile_id, shift_id, code='tips', amount=200,
                                          reason='Drikkepenger fra gjest')
       → confirm gate → Botsson asks user for confirmation
User:    "Bekrefter"
Botsson: success → emit
Botsson: "Lagt til. Annas total for april er nå kr X."
```

All chat-driven ops produce same audit/telemetry as direct UI ops.

---

## 12. Edge Cases + Error UX

| Scenario | UX |
|---|---|
| Approve period with un-acknowledged errors | Block with list of unacknowledged W-codes |
| Tariff version differs between calculation and current | Banner: "Tariff has changed. Recalculate?" with "Recalc" or "Ignore" |
| Period close cron failed | Admin sees red banner on `/dashboard/payroll`; engine_process state visible |
| Lønnsslipp PDF generation fails | Export modal shows per-employee status; failed rows have "Retry" button |
| Tripletex returns 401 | Banner: "Tripletex token expired. Reconnect to sync." with admin-only "Reconnect" CTA |
| A-melding XML rejected by Altinn | Period stays in 'approved'; alert in inbox; admin must investigate via export modal detail |
| Employee changes bank account mid-period | Old account on past payslips, new account from validation_at forward; audit-emit on update |
| Skatteetaten skattekort 404 (not registered) | W05 deviation; payslip generates but tax_card_type='frikort' default with 0% (warns admin) |
| Profile deactivated mid-period | Period cuts off at `valid_until`; final payslip generated, exported as final |

---

## 13. Notification & Inbox Patterns

Reuse existing `change_proposal` inbox pattern:
- `/dashboard/inbox?type=wage_override` — line override proposals
- `/dashboard/inbox?type=period_approval` — four-eyes approvals
- `/dashboard/inbox?type=tariff_amendment` — Riksavtalen amendments (ADR-0252)

Push notifications (mobile):
- `payroll.payslip_published` — when period exported, employee gets push to view
- `payroll.constructive_dismissal_flagged` — admin gets push on MATERIAL ≥20% reduction

Email (via SendGrid):
- Final lønnsslipp PDF as attachment on period.exported (configurable per workspace)
- A-melding submission confirmation to admin email

---

## 14. Mobile-Web Parity Boundary

Per ADR-0133:

| Concern | Web | Mobile |
|---|---|---|
| View own payslip | ✓ (read) | ✓ (read) |
| View team payroll | ✓ (admin) | — |
| Lock/approve period | ✓ | — |
| Acknowledge deviation | ✓ | — |
| Add manual supplement | ✓ | — |
| Override line | ✓ | — |
| Export | ✓ | — |
| Reveal PII (own) | ✓ | ✓ |
| Reveal PII (other) | ✓ (admin) | — |
| Botsson payroll chat | ✓ | ✓ (chat surface, gated through web BFF per ADR-0132) |

Mobile is witness, web is composer.
