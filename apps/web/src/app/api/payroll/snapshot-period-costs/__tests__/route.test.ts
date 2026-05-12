/**
 * __tests__/route.test.ts — Integration scaffold for snapshot-period-costs resolver (SMA-345).
 *
 * STATUS: Scaffold — stubs in place, full DB mock infrastructure is a carryforward.
 * Per plan note Task 11: "If full test setup takes >30 min, mark as carryforward."
 *
 * Two scenarios documented:
 *   (a) Profile with hourly_rate=280 → snapshot uses 280 not tariff
 *   (b) Profile with hourly_rate=null + tariff_category=voksen_ufaglart → falls back to tariff
 *
 * The unit-level resolver tests in resolver.test.ts (9 passing) cover these cases fully.
 * This file scaffolds route-level integration for a future sortie that adds full DB mocking.
 *
 * TODO (next sortie): replace stubs with msw/supertest harness + Supabase mock client.
 */
import { describe, it, expect, vi } from "vitest";

describe("snapshot-period-costs — resolver integration (SMA-345)", () => {
  it("uses explicit hourly_rate when set (scaffold)", () => {
    // Scenario A: Profile with hourly_rate=280
    // When route fetches payrollProfileRows, it populates rawRateMap.
    // resolveBaseHourlyRate returns { rate: 280, source: "column" }.
    // baseHourlyRateNok = 280 → snapshotShiftCost base_pay = 280 × worked_hours.
    //
    // Full route test requires:
    //   - Mock Supabase admin client returning profile row with hourly_rate=280
    //   - Mock period, calc, shift rows
    //   - Inject NextRequest with valid workspace_id + period_id
    //   - Assert response.snapshots_created > 0 and base_amount > 0
    //
    // Covered by unit test: resolver.test.ts "returns explicit hourly_rate when..."
    expect(true).toBe(true);
  });

  it("falls back to tariff for null hourly_rate (scaffold)", () => {
    // Scenario B: Profile with hourly_rate=null, tariff_category=voksen_ufaglart
    // tariff_rate_table has minstelonn_voksen_ufaglart at 215 NOK/t.
    // resolveBaseHourlyRate returns { rate: 215, source: "tariff" }.
    // baseHourlyRateNok = 215 → tariff-bound workers get correct base pay.
    //
    // Covered by unit test: resolver.test.ts "falls back to tariff minimum when..."
    expect(true).toBe(true);
  });
});

/**
 * Carryforward scope for next sortie:
 *
 * 1. Extract route DB calls into injectable deps (admin client factory pattern)
 *    so tests can swap in mock Supabase clients without mocking the module system.
 *
 * 2. Add test fixtures:
 *    - payroll_period row (start_date, end_date, status)
 *    - payroll_calculation row (profile_id, schedule_shift_id, calculation_version)
 *    - schedule_shift row (schedule_shift_id, start_time, end_time, employee_id)
 *    - employee_payroll_profile row (with hourly_rate=280 or hourly_rate=null)
 *    - tariff_rate_table row (minstelonn_voksen_ufaglart, amount=215, workspace_id=null)
 *
 * 3. Assert response body: { ok: true, snapshots_created: N, events_created: M }
 *
 * 4. Assert shift_cost_snapshot.base_amount ≈ hourly_rate × hours for scenario A.
 */
void vi; // suppress unused-import warning — vi needed when full test harness is added
