/**
 * packages/ai/src/scheduler/__tests__/greedy.test.ts
 *
 * Vitest suite for the greedy solver (solveGreedy).
 * 8 tests per PLAN Task 1:
 *   1. determinism — same input → same proposed_shifts order (solver_run_id differs)
 *   2. gap-detection — ineligible profiles produce gap entries
 *   3. fairness tie-break — lowest-utilized profile wins same-eligibility race
 *   4. AML daily cap — profile at daily limit is skipped
 *   5. absence exclusion — absent profile is skipped
 *   6. no-double-book — profile not assigned to two overlapping shifts in same run
 *   7. demand-coverage — all eligible demand filled
 *   8. hash-stability — same canonical input → same solver_inputs_hash
 *
 * All tests: pure synchronous, no DB calls, deterministic fixtures.
 */

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import { solveGreedy } from "../solver/greedy.js";
import type { SolverInput, SolverProfile, DemandBucket } from "../solver/greedy.js";
import type {
  FrameworkRule,
  ExistingShift,
  Absence,
  EmploymentContract,
  EligibilityProfile,
} from "../eligibility.js";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const WORKSPACE_ID = "ws-00000000-0000-0000-0000-000000000001";
const DEPT_A = "dept-0000-0000-0000-0000-000000000001";
const POS_CHEF = "pos-00000000-0000-0000-0000-000000000001";

const STANDARD_RULES: FrameworkRule[] = [
  { rule_type: "aml_daily_max_hours", value_hours: 9 },
  { rule_type: "aml_weekly_max_hours", value_hours: 40 },
  { rule_type: "tariff_min_rest_hours", value_hours: 8 },
];

const ACTIVE_CONTRACT: EmploymentContract = {
  contract_id: "contract-000001",
  start_date: "2026-01-01",
  end_date: null,
  status: "active",
};

function makeProfile(id: string, utiliziedHours = 0): SolverProfile {
  const profile: EligibilityProfile = {
    profile_id: id,
    workspace_id: WORKSPACE_ID,
    competent_roles: ["chef"],
    employment_status: "active",
  };
  return {
    profile,
    utilized_hours: utiliziedHours,
    existing_shifts: [],
    absences: [],
    framework_rules: STANDARD_RULES,
    active_contract: ACTIVE_CONTRACT,
  };
}

function makeBucket(startHour: number, score = 1, deptId = DEPT_A): DemandBucket {
  // Monday 2026-06-15 as base date, 1h buckets
  const start = `2026-06-15T${String(startHour).padStart(2, "0")}:00:00Z`;
  const end = `2026-06-15T${String(startHour + 1).padStart(2, "0")}:00:00Z`;
  return {
    department_id: deptId,
    start_at: start,
    end_at: end,
    score,
    position_id: POS_CHEF,
    role: "chef",
  };
}

function makeBaseInput(profiles: SolverProfile[], buckets: DemandBucket[]): SolverInput {
  return {
    workspace_id: WORKSPACE_ID,
    planning_cycle: {
      planning_cycle_id: "cycle-00000000-0000-0000-0000-000000000001",
      department_id: DEPT_A,
      starts_at: "2026-06-15T00:00:00Z",
      ends_at: "2026-06-22T00:00:00Z",
    },
    demand_buckets: buckets,
    profiles,
    framework_rules: STANDARD_RULES,
    existing_shifts: [],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("solveGreedy", () => {
  // ── 1. Determinism ──────────────────────────────────────────────────────────
  it("produces the same proposed_shifts order on identical inputs", () => {
    const profiles = [makeProfile("p1"), makeProfile("p2")];
    const buckets = [makeBucket(10, 1), makeBucket(14, 1)];
    const input = makeBaseInput(profiles, buckets);

    const result1 = solveGreedy(input);
    const result2 = solveGreedy(input);

    // solver_run_id MUST differ (per-call UUID for audit uniqueness)
    expect(result1.solver_run_id).not.toBe(result2.solver_run_id);

    // but proposed_shifts order and content must be identical
    expect(result1.proposed_shifts.length).toBe(result2.proposed_shifts.length);
    for (let i = 0; i < result1.proposed_shifts.length; i++) {
      expect(result1.proposed_shifts[i]!.assigned_profile_id).toBe(
        result2.proposed_shifts[i]!.assigned_profile_id,
      );
      expect(result1.proposed_shifts[i]!.start_at).toBe(result2.proposed_shifts[i]!.start_at);
    }
    expect(result1.gaps.length).toBe(result2.gaps.length);
  });

  // ── 2. Gap detection ────────────────────────────────────────────────────────
  it("creates a gap when no eligible profiles are available", () => {
    // Profile not competent for role "sommelier" but bucket demands it
    const sp: SolverProfile = {
      profile: {
        profile_id: "p1",
        workspace_id: WORKSPACE_ID,
        competent_roles: ["chef"], // not sommelier
        employment_status: "active",
      },
      utilized_hours: 0,
      existing_shifts: [],
      absences: [],
      framework_rules: STANDARD_RULES,
      active_contract: ACTIVE_CONTRACT,
    };

    const bucket: DemandBucket = {
      department_id: DEPT_A,
      start_at: "2026-06-15T10:00:00Z",
      end_at: "2026-06-15T11:00:00Z",
      score: 1,
      position_id: POS_CHEF,
      role: "sommelier", // no one competent
    };

    const input = makeBaseInput([sp], [bucket]);
    const result = solveGreedy(input);

    expect(result.proposed_shifts).toHaveLength(0);
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0]!.blocker_codes).toContain("not_competent_for_role");
    expect(result.gap_rate).toBe(1);
  });

  // ── 3. Fairness tie-break ───────────────────────────────────────────────────
  it("picks lowest-utilized profile first (tie-break profile_id ASC)", () => {
    // p-lower has 10 hours utilized, p-higher has 20 hours.
    // Both are competent. Solver should pick p-lower.
    const pLower = makeProfile("p-aaaaaaa-lower", 10);
    const pHigher = makeProfile("p-bbbbbbb-higher", 20);

    const bucket = makeBucket(10, 1);
    const input = makeBaseInput([pHigher, pLower], [bucket]); // intentionally reversed order

    const result = solveGreedy(input);
    expect(result.proposed_shifts).toHaveLength(1);
    expect(result.proposed_shifts[0]!.assigned_profile_id).toBe("p-aaaaaaa-lower");
  });

  // ── 4. AML daily cap ────────────────────────────────────────────────────────
  it("skips profile already at daily hour cap", () => {
    // Profile has 9h existing today — adding 1h more would exceed 9h daily cap.
    const existingToday: ExistingShift = {
      shift_id: "existing-shift-001",
      start_at: "2026-06-15T00:00:00Z",
      end_at: "2026-06-15T09:00:00Z",
      duration_hours: 9,
    };

    const sp: SolverProfile = {
      profile: {
        profile_id: "p-capped",
        workspace_id: WORKSPACE_ID,
        competent_roles: ["chef"],
        employment_status: "active",
      },
      utilized_hours: 9,
      existing_shifts: [existingToday],
      absences: [],
      framework_rules: STANDARD_RULES,
      active_contract: ACTIVE_CONTRACT,
    };

    // Fresh profile to fill the slot
    const pFresh = makeProfile("p-fresh", 0);

    const bucket = makeBucket(10, 1); // 10:00-11:00
    const input = makeBaseInput([sp, pFresh], [bucket]);

    const result = solveGreedy(input);
    expect(result.proposed_shifts).toHaveLength(1);
    // The capped profile should NOT be assigned; p-fresh should take the slot
    expect(result.proposed_shifts[0]!.assigned_profile_id).toBe("p-fresh");
  });

  // ── 5. Absence exclusion ────────────────────────────────────────────────────
  it("skips profile with absence overlapping the proposed shift", () => {
    const absence: Absence = {
      absence_id: "abs-001",
      start_at: "2026-06-15T00:00:00Z",
      end_at: "2026-06-15T23:59:59Z",
    };

    const spAbsent: SolverProfile = {
      profile: {
        profile_id: "p-absent",
        workspace_id: WORKSPACE_ID,
        competent_roles: ["chef"],
        employment_status: "active",
      },
      utilized_hours: 0,
      existing_shifts: [],
      absences: [absence],
      framework_rules: STANDARD_RULES,
      active_contract: ACTIVE_CONTRACT,
    };

    const pAvailable = makeProfile("p-available", 5);

    const bucket = makeBucket(10, 1);
    const input = makeBaseInput([spAbsent, pAvailable], [bucket]);

    const result = solveGreedy(input);
    expect(result.proposed_shifts).toHaveLength(1);
    expect(result.proposed_shifts[0]!.assigned_profile_id).toBe("p-available");
  });

  // ── 6. No double-booking ────────────────────────────────────────────────────
  it("does not assign the same profile to overlapping shifts within one run", () => {
    // One profile only. Two overlapping buckets (10-11 and 10:30-11:30).
    const sp = makeProfile("p-solo", 0);

    const bucket1: DemandBucket = {
      department_id: DEPT_A,
      start_at: "2026-06-15T10:00:00Z",
      end_at: "2026-06-15T11:00:00Z",
      score: 1,
      position_id: POS_CHEF,
      role: "chef",
    };
    const bucket2: DemandBucket = {
      department_id: DEPT_A,
      start_at: "2026-06-15T10:30:00Z",
      end_at: "2026-06-15T11:30:00Z",
      score: 1,
      position_id: POS_CHEF,
      role: "chef",
    };

    const input = makeBaseInput([sp], [bucket1, bucket2]);
    const result = solveGreedy(input);

    // First bucket fills. Second is blocked by overlap → gap.
    expect(result.proposed_shifts).toHaveLength(1);
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0]!.blocker_codes).toContain("existing_shift_overlap");
  });

  // ── 7. Demand coverage ──────────────────────────────────────────────────────
  it("fills all demand when enough eligible profiles exist", () => {
    // 3 profiles, 2 distinct buckets each demanding 1 headcount
    const profiles = [makeProfile("p-a", 0), makeProfile("p-b", 2), makeProfile("p-c", 4)];
    const buckets = [makeBucket(10, 1), makeBucket(14, 1)];
    const input = makeBaseInput(profiles, buckets);

    const result = solveGreedy(input);
    expect(result.proposed_shifts).toHaveLength(2);
    expect(result.gaps).toHaveLength(0);
    expect(result.gap_rate).toBe(0);
    expect(result.objective_score).toBeGreaterThan(0);
  });

  // ── 8. Hash stability ───────────────────────────────────────────────────────
  it("produces the same solver_inputs_hash for identical canonical inputs", () => {
    const profiles = [makeProfile("p1", 0), makeProfile("p2", 10)];
    const buckets = [makeBucket(10, 2), makeBucket(14, 1)];
    const input = makeBaseInput(profiles, buckets);

    const result1 = solveGreedy(input);
    const result2 = solveGreedy(input);

    expect(result1.solver_inputs_hash).toBe(result2.solver_inputs_hash);
    // Verify it's a valid SHA-256 hex string (64 chars)
    expect(result1.solver_inputs_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
