---
title: "User Journeys — Cascade Foundation"
status: done
updated: 2026-03-22
created: 2026-03-22
module: cascade
tags: [cascade, journeys, rules, tariff, bootstrap, governance]
---

# User Journeys — Cascade Foundation

## Journey: Admin — New Workspace Gets Cascade Data Automatically

**Precondition:** Admin completes onboarding wizard (or /join flow).

1. Admin finishes workspace setup in `/onboarding` → System calls `finalize-workspace` EF
2. `finalize-workspace` triggers `bootstrap-cascade` EF → System runs 10-step bootstrap
3. System seeds: workspace base hours (from wizard intake or defaults), department types (inferred from names), department hours (with industry offsets), framework binding (hospitality.no.default.v1), tariff rates (Riksavtalen copy), planning cycle (4-week default), season budget enrichment, day/hour factors, payroll templates, authority config
4. System logs bootstrap to `workspace_bootstrap_run` → Admin can verify in settings
5. Admin sees cascade data ready in settings → Framework rules, tariff rates, change proposals all visible

**Postcondition:** Workspace has full cascade dimension data seeded. Schedule planner can evaluate rules from day one.

**Error paths:**

- Bootstrap fails on any step → status = 'partial', admin warned, can re-run from settings
- K1a seed missing → framework binding step logs warning, continues with partial data
- Department name not recognized → classified as operational with low confidence, flagged in warnings

---

## Journey: Admin — Invite Employee with Contract + Payroll Cascade

**Precondition:** Workspace exists with bootstrap complete. Admin is on People page.

1. Admin opens invite dialog → Sees "Ansatt" / "Gjest" toggle (defaults to Ansatt)
2. Admin selects "Ansatt" → System shows employment fields: stillingstype, lønnstype, timer/uke, startdato
3. Admin fills fields, selects payroll template if available → Clicks "Send invitasjon"
4. System creates invitation with `invite_employment_type = 'employee'` + metadata
5. Employee receives invite, accepts via `/invite/[token]` → System runs accept-invitation cascade:
   - Creates profile (trainee → active in same transaction)
   - Creates draft employment_contract
   - Creates employee_payroll_profile (from template if selected)
6. Employee is immediately operational → Profile active, payroll profile seeded, contract in draft

**Postcondition:** Employee has profile + draft contract + payroll profile. Ready for scheduling.

**Error paths:**

- Guest invite: only profile created (active directly), no contract/payroll
- Template not found: payroll profile created with defaults (ufaglart, hourly)
- Invite already accepted: returns existing profile, no duplicate

---

## Journey: Admin — Edit Shift with Rule Feedback

**Precondition:** Workspace has framework rules seeded. Schedule planner open.

1. Admin creates or edits a shift in shift-modal.tsx
2. System evaluates framework rules in real-time as admin changes times/employee:
   - Loads framework rules + workspace overrides (cached 10 min)
   - Builds entity context: daily hours, weekly hours, rest gap, employee age
   - Calls evaluateFrameworkRules() pure function
3. If rules violated → Warning badge appears in modal footer:
   - Yellow: allowed with exception
   - Orange: review required
   - Red: blocked (e.g., under-18 night work, rest < 11h)
4. Admin sees reason text → Can choose to save anyway (warnings are advisory)
5. Admin saves shift → Shift saved regardless of warnings

**Postcondition:** Shift saved. Rule evaluation result visible. No hard block.

**Error paths:**

- No employee selected → no rule evaluation (employee context required)
- No framework binding → no rules to evaluate, no warnings shown
- Employee payroll profile missing → partial evaluation (no age check possible)

---

## Journey: Admin — Publish Shifts with Batch Validation

**Precondition:** Shifts created for the week. Admin ready to publish.

1. Admin selects shifts to publish → Clicks publish button
2. System runs batch validation: groups shifts by employee, evaluates rules for each
3. Publish dialog shows summary:
   - "12 shifts ready, 0 issues" → green, proceed
   - "12 shifts ready, 2 warnings, 1 blocked" → shows expandable detail per violation
4. Admin reviews violations → Can proceed ("Publiser likevel") or cancel
5. On publish → System emits "shift published" with shift_ids → Engine dispatches cost snapshot
6. `cascade_cost_snapshot` handler computes planned costs per shift → Inserts shift_cost_snapshot rows

**Postcondition:** Shifts published. Planned cost snapshots materialized in shift_cost_snapshot.

**Error paths:**

- No framework rules → validation shows "0 issues", proceeds normally
- Engine dispatch fails → shifts still published, cost snapshots can be backfilled

---

## Journey: Admin — Manage Framework Rules in Settings

**Precondition:** Workspace has framework binding. Admin in dashboard settings.

1. Admin navigates to Settings → "Regelverk" section → "Arbeidsregler" tab
2. System shows list of framework rules: Norwegian description, category, AML source reference
3. Each rule shows current outcome (allowed/blocked/review_required)
4. For overridable rules: admin can toggle outcome (e.g., "blocked" → "review_required")
5. Admin sets validity period (valid_from / valid_until) for the override
6. System writes workspace_rule_override → Cached rules invalidate in schedule hooks

**Postcondition:** Workspace rule override active. Schedule rule checks use new outcome.

**Error paths:**

- Non-overridable rules: toggle is locked, admin cannot change
- Override expired: system ignores it, falls back to framework default

---

## Journey: Admin — View and Adjust Tariff Rates

**Precondition:** Workspace has tariff rates (seeded from K1a bootstrap).

1. Admin navigates to Settings → "Regelverk" → "Tariffsatser" tab
2. System shows workspace tariff rates with platform baseline comparison:
   - "Kveldstillegg: 15.65 kr/t (Riksavtalen: 15.65 kr/t)"
3. Admin clicks "Juster" on a rate → Enters new amount + effective date
4. System inserts new effective-dated row (append-only, doesn't mutate history)
5. Old rate remains for historical cost calculations, new rate applies going forward

**Postcondition:** Workspace tariff rate adjusted. Future cost snapshots use new rate.

---

## Journey: Admin — Change Workspace Hours via Proposal

**Precondition:** Workspace has operating hours and departments with derived hours.

1. Admin changes workspace base hours in settings
2. System creates change proposal (status: pending) with preview:
   - Affected departments (is_derived = true)
   - Affected future sessions
   - Auto-adjust shifts (unconfirmed) vs impacted confirmed shifts
3. Admin reviews in ChangeProposalDialog → Approves or rejects
4. On approve + apply → System cascades: base hours → department hours → sessions → shifts
5. Confirmed/published shifts flagged for manual review, not auto-changed

**Postcondition:** Hours updated across the cascade. Audit trail in change_proposal + activity_trail.

**Error paths:**

- Source entity changed between preview and apply → proposal marked stale, admin must re-preview
- Apply fails → proposal status = failed, admin can re-review

---

## Journey: System — Season Budget Propagates to Daily Targets

**Precondition:** Season budget saved with revenue target + labor percentage + day factors.

1. Admin saves season budget → System emits "season_budget updated"
2. Event routes to engine_event → Triggers cascade_budget_propagation process
3. Handler loads budget + day factors from DB → Calls propagateBudgetTargets() pure function
4. Pure function distributes total revenue across dates weighted by day factors:
   - Higher weight Fri-Sat → more revenue/staff allocated
   - Labor cost = revenue × labor_percentage
   - Staff hours = labor cost ÷ avg hourly wage
5. Handler upserts workspace_budget rows for each date in the season

**Postcondition:** Daily staffing targets in workspace_budget. Schedule planner shows target vs scheduled comparison.

**Error paths:**

- No day factors → equal distribution (fallback)
- Zero avg_hourly_wage → staff hours = 0 (no division by zero)
- Day factors changed later → same flow re-triggers, upserts overwrite previous values

---

## Journey: System — Shift Completion Creates Actual Cost Snapshot

**Precondition:** Shift was published (planned cost snapshot exists). Employee completes shift.

1. Employee or manager marks shift as completed (punch-out / actual_end)
2. System emits "shift completed" with shift_ids
3. Event routes to engine_event → Triggers cascade_cost_snapshot process
4. Handler loads shift (actual_start, actual_end) + employee payroll profile from DB
5. Resolves tariff supplements based on actual times (evening, weekend, holiday)
6. Inserts shift_cost_snapshot with basis = 'actual', using actual times

**Postcondition:** Two cost snapshots exist: planned (from publish) and actual (from completion). Accounting can compare estimated vs actual labor costs.

**Error paths:**

- actual_start/actual_end columns not yet on schedule_shift → handler uses planned times as fallback
- No payroll profile → base_rate = 0, supplements still computed
