---
title: Restaurant Week Simulation — Plan
status: in_progress
created: 2026-05-25
updated: 2026-05-25
module: meta
tags: [simulation, plan]
---

# Simulation Plan — Bella Vista (busy Oslo bistro, 18 employees)

## Reference baseline (DO NOT RE-REPORT)

Existing 22 bugs from journey sweep 2026-05-23/24:
`docs/test-runs/2026-05-23-journey-sweep/BUGS.md`

Categories already covered: BUG-1..22 (SCHEMA × 2, PRODUCT × 17, HARNESS × 3, ENV × 4, OPS × 1).

This simulation must find **NEW** issues — gaps in coverage, missing UX, broken flows that the
mechanical sweep did not exercise. Reference an existing BUG-N by ID rather than re-reporting.

## Day-by-Day Expected Journeys

### Monday — Workspace setup + Maria onboarding (A1)

1. **Owner (Pontus) logs into platform-admin**, creates workspace for "Bella Vista" via I1 bootstrap.
   - Inputs: industry (Restaurant), niche (Bistro), tariff (Riksavtalen), location (Oslo)
   - Expected: D1 envelope, D3 framework, K1a/K1b seeds wired
2. **Owner invites Erik as manager** via `/dashboard/team/invite` or `inviteEmployee` capability.
3. **Erik logs in, completes manager onboarding** (workspace wizard).
4. **Erik invites Maria as new employee**, role=employee, status=trainee.
5. **Maria accepts invite, completes employee onboarding wizard**:
   - Personal info (D2 profile)
   - Contract signing (DocuSeal) — employment_contract row
   - Payroll info (employee_payroll_profile)
   - First-shift assignment (schedule_shift, status=draft)
6. **Maria runs through Botsson trainee bootcamp** — first 3 protocols (welcome, safety, allergens).
7. **Maria completes knowledge tests** → readiness score rises.

### Tuesday — Schedule planning (A2)

1. **Erik opens `/dashboard/schedule`**, views Week 22 (this week).
2. **Erik creates shifts** for all 18 employees, drag-drop on day grid.
3. **Erik assigns roles** (bartender, cook, server, busser, host).
4. **Erik checks tariff floor** — system auto-applies Riksavtalen rates.
5. **Erik publishes schedule** — fires `schedule.published` event → notifications fan out.
6. **Maria sees her shifts** on mobile app, day-line view.

### Wednesday — Day-line execution + announcements (A3 + A4)

1. **Maria clocks in at 16:00 via mobile** (GPS clock-in).
2. **Maria opens day-line** — sees session hooks (open prep, line check, allergen review).
3. **Maria completes hooks** — each fires C4 confirmation, telemetry emits.
4. **Erik publishes announcement** — "New summer menu live tomorrow" — fans to all on shift.
5. **Maria receives push notification + reads announcement**.
6. **Maria completes shift tasks** — clean station, refill, equipment check.
7. **End of shift checkout** — settlement_event, tips logged.

### Thursday — Sick call → cascade (A2 + A4)

1. **Sofia calls in sick at 14:00** for her 16:00-23:00 shift.
2. **Erik marks Sofia absent** — `schedule_absence` row, `schedule.shift.cancelled` event.
3. **System suggests replacements** — Botsson cascade computes available employees by readiness.
4. **Erik opens helpdesk query** to Sofia: "Get well, when back?"
5. **Helpdesk SLA timer starts**, manager-overdue badge after X hours.
6. **Erik assigns Kim to cover** — accept/decline flow on mobile.
7. **Kim accepts** — schedule_shift updated, notifications.

### Friday — Busy service + deviation (A3)

1. **All 14 staff clock in for Friday night.**
2. **Equipment failure** — POS terminal down → deviation logged on day-line.
3. **Manager handles deviation** — temporary workaround logged.
4. **Maria handles allergen incident** — control_list confirmation per protocol.
5. **End of shift — temporal lock** on time entries.
6. **Settlement run** — shift_pay_calculation_event, golden-month verifications.
7. **Cash count discrepancy** — deviation, manager sign-off.

### Saturday — Tips + training (A3)

1. **Tip pool distribution** — manager allocates per role.
2. **Maria continues training protocols** — wine knowledge, service standards.
3. **Knowledge tests for Maria** — readiness % climbs to "ready" threshold.
4. **Maria takes first solo section** — manager observes via day-line.

### Sunday — Period close + payroll + billing (A5)

1. **Owner (Pontus) opens `/platform-admin/billing`** — checks Bella Vista subscription.
2. **Pontus runs ad-hoc invoice** for plan upgrade (live Stripe).
3. **Erik opens `/dashboard/payroll`** — May period due to close.
4. **Erik reviews payroll lines** for all 18 employees.
5. **Erik resolves payroll deviations** (manual supplements, missing approvals).
6. **Erik locks period** — `payroll_period.status = locked`, A-melding draft generates.
7. **Owner reviews governance / readiness dashboard** — all-staff readiness, gaps surfaced.
8. **Owner signs off period** — settles.

## Surfaces to exercise

- Web dashboard (apps/web): all journeys
- Mobile app (apps/mobile): clock-in, day-line, chat, announcements, tasks, contract sign
- Edge Functions: workspace-api, engine-dispatch, contract-*, docuseal-*, stripe-webhook
- Capabilities: every capability in `packages/ai/src/capabilities/` should be touched at least once

## Out of scope (do not fabricate)

- Anything requiring actual UI rendering (we trace via code, not Playwright)
- Anything requiring live external services (Stripe API, DocuSeal API, SendGrid)
- Anything already in `docs/test-runs/2026-05-23-journey-sweep/BUGS.md` (reference, do not re-report)

## What "gap" vs "bug" means in this sim

- **Gap:** intended journey step has no implementation OR implementation is partial / disconnected.
  E.g. "Cascade replacement suggestion not wired to UI on absence" or "Tip distribution capability missing".
- **Bug:** implementation exists but has a code-level defect (auth check wrong, FK missing,
  validation throws, missing await, race condition).
