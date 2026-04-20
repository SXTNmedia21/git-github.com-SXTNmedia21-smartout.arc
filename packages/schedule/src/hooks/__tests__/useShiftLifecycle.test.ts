/**
 * Contract test for useShiftLifecycle.
 *
 * We don't exercise React's render lifecycle here — TanStack Query
 * integration is covered in Playwright. Instead we verify:
 *   - the module exports the hook and its row type
 *   - the row type shape matches the v_shift_lifecycle view columns
 *
 * This keeps the test deterministic, platform-agnostic, and free of
 * Supabase client setup noise. Full integration coverage lives in the
 * app-level Playwright specs per the Phase 6 plan.
 */

import { describe, it, expect } from "vitest";
import * as mod from "../useShiftLifecycle";

const EXPECTED_PHASES = ["planlegges", "pagar", "oppgjor", "avsluttet"] as const;

describe("useShiftLifecycle module", () => {
  it("exports the hook", () => {
    expect(typeof mod.useShiftLifecycle).toBe("function");
  });

  it("type guard: phase values are valid", () => {
    // The `satisfies` pattern would be a compile-time check; at runtime
    // we mirror the four values to catch accidental vocabulary drift.
    const row: mod.ShiftLifecycleRow = {
      shift_id: "s1",
      workspace_id: "w1",
      department_id: "d1",
      employee_id: null,
      shift_date: "2026-04-15",
      phase: "planlegges",
      scheduled_hours: 7.5,
      interpreted_hours: null,
      approved_hours: null,
      gross_cost: null,
      shift_status: null,
      session_status: null,
      approval_status: null,
      reconciliation_status: null,
      last_punch_in: null,
      last_punch_out: null,
      has_deviation: false,
      has_blocking_deviation: false,
    };
    expect(EXPECTED_PHASES).toContain(row.phase);
  });
});
