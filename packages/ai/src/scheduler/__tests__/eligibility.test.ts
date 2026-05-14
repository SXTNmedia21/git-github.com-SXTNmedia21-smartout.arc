/**
 * packages/ai/src/scheduler/__tests__/eligibility.test.ts
 *
 * Vitest suite for the WFM eligibility helper.
 * 7 tests — one per BlockerCode + 2 happy-path tests (no blockers, multiple eligible).
 *
 * All inputs are deterministic. No DB calls. No async.
 * Date strings use ISO 8601 UTC (Z suffix) to avoid timezone ambiguity.
 *
 * Per PLAN Task 4: 7 hard-constraint tests (one per BlockerCode) + 2 happy-path tests.
 */

import { describe, expect, it } from "vitest";

import {
  type Absence,
  type EligibilityContext,
  type EligibilityProfile,
  type EligibilityShift,
  type EmploymentContract,
  type ExistingShift,
  type FrameworkRule,
  eligibilityFor,
} from "../eligibility.js";

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const WORKSPACE_ID = "ws-00000000-0000-0000-0000-000000000001";

/** Base profile — competent for 'chef', active contract, no conflicts. */
const BASE_PROFILE: EligibilityProfile = {
  profile_id: "p-00000000-0000-0000-0000-000000000001",
  workspace_id: WORKSPACE_ID,
  competent_roles: ["chef", "prep_cook"],
  employment_status: "active",
};

/**
 * Candidate shift: Monday 2026-06-15, 10:00–18:00 UTC (8 hours), role = 'chef'.
 * Used as the baseline candidate across most tests.
 */
const CANDIDATE_SHIFT: EligibilityShift = {
  shift_id: "sh-candidate",
  workspace_id: WORKSPACE_ID,
  role: "chef",
  start_at: "2026-06-15T10:00:00Z",
  end_at: "2026-06-15T18:00:00Z",
  duration_hours: 8,
};

/** Active contract covering 2026 entirely. */
const ACTIVE_CONTRACT: EmploymentContract = {
  contract_id: "ct-active",
  start_date: "2026-01-01",
  end_date: null,
  status: "active",
};

/** Default framework rules: daily max 9h, weekly max 40h, min rest 8h. */
const DEFAULT_RULES: FrameworkRule[] = [
  { rule_type: "aml_daily_max_hours", value_hours: 9 },
  { rule_type: "aml_weekly_max_hours", value_hours: 40 },
  { rule_type: "tariff_min_rest_hours", value_hours: 8 },
];

/** Clean context — no conflicts. */
const CLEAN_CONTEXT: EligibilityContext = {
  existing_shifts: [],
  absences: [],
  framework_rules: DEFAULT_RULES,
  active_contract: ACTIVE_CONTRACT,
};

// ─── Helper factory ───────────────────────────────────────────────────────────

/** Build an existing shift on the given day with given hours. */
function makeExistingShift(startIso: string, endIso: string, durationHours: number): ExistingShift {
  return {
    shift_id: `sh-existing-${startIso}`,
    start_at: startIso,
    end_at: endIso,
    duration_hours: durationHours,
  };
}

// ─── Test: happy path 1 ───────────────────────────────────────────────────────

describe("eligibilityFor — happy paths", () => {
  it("returns eligible=true with empty blockers when all checks pass", () => {
    const result = eligibilityFor(BASE_PROFILE, CANDIDATE_SHIFT, CLEAN_CONTEXT);

    expect(result.eligible).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("is deterministic: same input twice returns same result", () => {
    const first = eligibilityFor(BASE_PROFILE, CANDIDATE_SHIFT, CLEAN_CONTEXT);
    const second = eligibilityFor(BASE_PROFILE, CANDIDATE_SHIFT, CLEAN_CONTEXT);

    expect(first).toEqual(second);
  });
});

// ─── Test: not_competent_for_role ─────────────────────────────────────────────

describe("eligibilityFor — not_competent_for_role", () => {
  it("returns blocker when profile lacks the required role", () => {
    const shiftWithUnknownRole: EligibilityShift = {
      ...CANDIDATE_SHIFT,
      role: "sommelier",
    };

    const result = eligibilityFor(BASE_PROFILE, shiftWithUnknownRole, CLEAN_CONTEXT);

    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("not_competent_for_role");
  });
});

// ─── Test: aml_hour_floor_exceeded (daily max) ───────────────────────────────

describe("eligibilityFor — aml_hour_floor_exceeded", () => {
  it("returns blocker when daily hours would exceed max with candidate shift", () => {
    // Existing shift: 2h on same day → 2h + 8h candidate = 10h > 9h limit
    const existingToday = makeExistingShift("2026-06-15T07:00:00Z", "2026-06-15T09:00:00Z", 2);

    const result = eligibilityFor(BASE_PROFILE, CANDIDATE_SHIFT, {
      ...CLEAN_CONTEXT,
      existing_shifts: [existingToday],
    });

    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("aml_hour_floor_exceeded");
  });
});

// ─── Test: aml_weekly_cap_exceeded ───────────────────────────────────────────

describe("eligibilityFor — aml_weekly_cap_exceeded", () => {
  it("returns blocker when weekly hours would exceed max with candidate shift", () => {
    // Week of 2026-06-15 (Mon–Sun). 5 × 8h = 40h already. Adding 8h candidate → 48h > 40h.
    const existingShifts: ExistingShift[] = [
      makeExistingShift("2026-06-09T10:00:00Z", "2026-06-09T18:00:00Z", 8), // Tue prev week — wrong week (should not count)
      makeExistingShift("2026-06-16T10:00:00Z", "2026-06-16T18:00:00Z", 8), // Tue same week
      makeExistingShift("2026-06-17T10:00:00Z", "2026-06-17T18:00:00Z", 8), // Wed same week
      makeExistingShift("2026-06-18T10:00:00Z", "2026-06-18T18:00:00Z", 8), // Thu same week
      makeExistingShift("2026-06-19T10:00:00Z", "2026-06-19T18:00:00Z", 8), // Fri same week
      makeExistingShift("2026-06-20T10:00:00Z", "2026-06-20T18:00:00Z", 8), // Sat same week
    ];
    // 5 × 8h = 40h from Tue–Sat + 8h candidate Mon = 48h > 40h

    const result = eligibilityFor(BASE_PROFILE, CANDIDATE_SHIFT, {
      ...CLEAN_CONTEXT,
      existing_shifts: existingShifts,
    });

    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("aml_weekly_cap_exceeded");
  });
});

// ─── Test: tariff_rest_period_violation ──────────────────────────────────────

describe("eligibilityFor — tariff_rest_period_violation", () => {
  it("returns blocker when gap after previous shift is less than min rest", () => {
    // Existing shift ends at 06:00, candidate starts 10:00 → 4h gap < 8h min rest
    const tooRecent = makeExistingShift("2026-06-15T00:00:00Z", "2026-06-15T06:00:00Z", 6);

    const result = eligibilityFor(BASE_PROFILE, CANDIDATE_SHIFT, {
      ...CLEAN_CONTEXT,
      existing_shifts: [tooRecent],
    });

    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("tariff_rest_period_violation");
  });
});

// ─── Test: absence_overlap ───────────────────────────────────────────────────

describe("eligibilityFor — absence_overlap", () => {
  it("returns blocker when profile has an absence overlapping the candidate shift", () => {
    const absence: Absence = {
      absence_id: "abs-vacation",
      // Vacation covers entire week — overlaps candidate 10:00–18:00
      start_at: "2026-06-15T00:00:00Z",
      end_at: "2026-06-22T00:00:00Z",
    };

    const result = eligibilityFor(BASE_PROFILE, CANDIDATE_SHIFT, {
      ...CLEAN_CONTEXT,
      absences: [absence],
    });

    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("absence_overlap");
  });
});

// ─── Test: existing_shift_overlap ────────────────────────────────────────────

describe("eligibilityFor — existing_shift_overlap", () => {
  it("returns blocker when profile is already booked in the candidate shift window", () => {
    // Existing shift 12:00–20:00 overlaps candidate 10:00–18:00
    const concurrent = makeExistingShift("2026-06-15T12:00:00Z", "2026-06-15T20:00:00Z", 8);

    const result = eligibilityFor(BASE_PROFILE, CANDIDATE_SHIFT, {
      ...CLEAN_CONTEXT,
      existing_shifts: [concurrent],
    });

    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("existing_shift_overlap");
  });
});

// ─── Test: no_active_contract ────────────────────────────────────────────────

describe("eligibilityFor — no_active_contract", () => {
  it("returns blocker when there is no active contract", () => {
    const result = eligibilityFor(BASE_PROFILE, CANDIDATE_SHIFT, {
      ...CLEAN_CONTEXT,
      active_contract: null,
    });

    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("no_active_contract");
  });

  it("returns blocker when contract is inactive (status != active)", () => {
    const inactiveContract: EmploymentContract = {
      ...ACTIVE_CONTRACT,
      status: "inactive",
    };

    const result = eligibilityFor(BASE_PROFILE, CANDIDATE_SHIFT, {
      ...CLEAN_CONTEXT,
      active_contract: inactiveContract,
    });

    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("no_active_contract");
  });

  it("returns blocker when contract ended before shift date", () => {
    const expiredContract: EmploymentContract = {
      ...ACTIVE_CONTRACT,
      end_date: "2026-05-01", // expired before 2026-06-15
    };

    const result = eligibilityFor(BASE_PROFILE, CANDIDATE_SHIFT, {
      ...CLEAN_CONTEXT,
      active_contract: expiredContract,
    });

    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("no_active_contract");
  });
});

// ─── Test: missing context throws ────────────────────────────────────────────

describe("eligibilityFor — fail-fast on missing context (L-0177)", () => {
  it("throws when context.existing_shifts is undefined", () => {
    expect(() =>
      eligibilityFor(BASE_PROFILE, CANDIDATE_SHIFT, {
        existing_shifts: undefined as unknown as ExistingShift[],
        absences: [],
        framework_rules: DEFAULT_RULES,
        active_contract: ACTIVE_CONTRACT,
      }),
    ).toThrow("context.existing_shifts is required");
  });

  it("throws when context.framework_rules is undefined", () => {
    expect(() =>
      eligibilityFor(BASE_PROFILE, CANDIDATE_SHIFT, {
        existing_shifts: [],
        absences: [],
        framework_rules: undefined as unknown as FrameworkRule[],
        active_contract: ACTIVE_CONTRACT,
      }),
    ).toThrow("context.framework_rules is required");
  });
});
