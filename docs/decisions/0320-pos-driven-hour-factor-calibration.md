---
title: "POS-Driven hour_factor Calibration — V2 Trigger Conditions"
id: ADR_0320
status: accepted
layer: decision
created: 2026-05-14
updated: 2026-05-14
---

# ADR-0320: POS-Driven hour_factor Calibration — V2 Trigger Conditions

## Context and Problem Statement

Scheduler V1 (ADR-0307) reads `hour_factor` rows from cascade D4 — coefficients set
manually by the manager. POS sale events (ADR-0305) and the aggregation view
`public.v_pos_sales_hour` exist. A calibration loop (POS actuals → `hour_factor`
recalculation) is the natural V2 evolution.

Three reasons to defer this loop explicitly rather than scaffold it now:

1. **Mock data in V1.** ADR-0305 V1 uses `mockPull` — synthetic sale events. Training
   a calibration algorithm on mock data injects drift into canonical D4 coefficients.
   Managers will observe their `hour_factor` values drifting toward mock-data means
   with no real-world cause.

2. **Algorithm is a research frontier.** Rolling mean? Exponential smoothing? EWMA?
   Department-specific vs workspace-wide? Outlier detection threshold? None of these
   are settled. A stub calibration cron without a decided algorithm produces
   `activity_trail` entries for "machine calibrations" that never actually calibrate
   anything — telemetry-domain pollution (L-0271 class).

3. **Cascade reproducibility violation risk.** If mock-trained `hour_factor` values
   persist between mock-data teardown and real-data onboarding, cascade D4 is seeded
   with noise. This is an irreversible data-quality event at workspace bootstrap.

## Decision Outcome

**Defer calibration loop to a follow-on ADR.** V1 ships with manual `hour_factor`
as sole source. `public.v_pos_sales_hour` view exists for future consumption only.

### V2 Trigger Conditions

ALL five conditions must be satisfied before the calibration loop ADR may be opened:

**Condition 1 — Real data baseline.**
ADR-0310 (real Lightspeed REST V2, non-mock) shipped AND at least one workspace has
30 consecutive days of non-mock `pos_sale_event` data. Verified by: `SELECT COUNT(*)`
on `pos_sale_event WHERE workspace_id = ? AND created_at > NOW() - INTERVAL '30 days'
AND raw_payload->>'_mock' IS NULL`.

**Condition 2 — Authority surface decided.**
Which capability writes `hour_factor`? Three candidates:

- `scheduler` (consumer of `hour_factor`) — violation of produce-consume boundary.
- `pos_account_management` (producer of sale events) — reasonable but cross-domain
  write into D4.
- NEW `cascade_calibration` capability — cleanest boundary; requires ADR-0173 frozen-4
  compliance check before creation.

This question MUST have an accepted ADR answer before calibration code is written.

**Condition 3 — Telemetry discriminator.**
A new telemetry event `hour_factor.machine_calibrated` must exist in `packages/telemetry/src/registry.ts`,
distinct from any human-edit event. Calibration writes MUST emit this event.
Without this discriminator, audit trail cannot distinguish human judgment from
algorithm output — a GDPR-adjacent transparency issue for employees whose shifts
are affected.

**Condition 4 — Algorithm spec.**
A written spec (ADR or appendix) covering:
- Rolling window `N` (days) with rationale.
- Outlier detection method and threshold.
- Department-specific vs workspace-wide scope.
- Minimum data points before any write occurs (guard against sparse-data corruption).

**Condition 5 — Write semantics decision.**
Two options (both acceptable, neither default):

- **Option A:** Direct write to `hour_factor` rows — clean, simple, irreversible without
  audit trail unless explicitly logged.
- **Option B (preferred):** Derived view `cascade.v_hour_factor_calibrated` LEFT JOIN
  of human-set `hour_factor` + observed calibration coefficient — preserves manual override,
  never overwrites canonical D4, readable by scheduler via view alias.

Option B is preferred because it satisfies Cascade Invariant 1 (D4 data owned by planning
cycle, not machine) while enabling calibrated demand inputs. Option A requires explicit
ADR justification.

## Consequences

- **Good, because** V1 ships transparent — manager retains full canonical D4 ownership.
- **Good, because** no stub-cron-without-algorithm that pollutes `activity_trail`.
- **Good, because** the 5-condition gate prevents premature calibration from corrupting
  workspace bootstrap with mock-trained noise.
- **Bad, because** demand-forecasting quality is limited by manual coefficient accuracy
  until V2 ships. Expected V2 window: 2-4 months after ADR-0310 (real Lightspeed REST).
- **Agent Impact:**
  - Agents MUST NOT write to `hour_factor` from POS-derived logic until this ADR has
    a follow-on with accepted status.
  - `public.v_pos_sales_hour` view MAY be read for dashboarding and reporting.
    It MUST NOT be used as automatic write-source for D4 coefficients.
  - External marketing copy MUST NOT claim "POS-driven scheduling" until Condition 1 satisfied.
    Use "POS-aware" (view exists, data flows) not "POS-driven" (calibration loop active).

---

> Register in `docs/decisions/0000-decision-log.md`. No migration associated.
> Follow-on ADR opens when all 5 conditions met. Sibling: ADR-0305 (POS adapter),
> ADR-0307 (scheduler V1), ADR-0319 (vendor lifecycle).
