/**
 * payroll-schemas.test.ts
 * Unit tests for the five payroll Zod schemas and their constants.
 * Only schemas and constants are imported — hooks are excluded because they
 * require React context and Supabase clients that don't exist in a node test env.
 */
import { describe, it, expect } from "vitest";

import { payrollSettingsSchema } from "../_hooks/use-payroll-settings";
import { salaryCodeSchema, SALARY_CODE_CATEGORIES } from "../_hooks/use-salary-codes";
import { breakRuleSchema, TRIGGER_TYPES } from "../_hooks/use-break-rules";
import {
  supplementRuleSchema,
  SUPPLEMENT_TYPES,
  RATE_TYPES,
  START_TYPES,
  getDefaultValues,
} from "../_hooks/use-supplement-rules";
import { mealRuleSchema, MEAL_TYPES } from "../_hooks/use-meal-rules";

// ─── payrollSettingsSchema ───────────────────────────────────────────────────

describe("payrollSettingsSchema", () => {
  const valid = {
    period_type: "monthly" as const,
    period_start_day: 1,
    default_worked_hours_salary_code: null,
    default_monthly_salary_code: null,
    shift_grouping: "department" as const,
    employer_social_security_pct: 14.1,
    vacation_pay_pct: 12,
    pension_pct: 2,
  };

  it("passes with a complete valid object", () => {
    expect(() => payrollSettingsSchema.parse(valid)).not.toThrow();
  });

  it("accepts all period_type enum values", () => {
    const types = ["monthly", "biweekly", "weekly"] as const;
    for (const period_type of types) {
      expect(payrollSettingsSchema.safeParse({ ...valid, period_type }).success).toBe(true);
    }
  });

  it("rejects an invalid period_type", () => {
    expect(payrollSettingsSchema.safeParse({ ...valid, period_type: "quarterly" }).success).toBe(
      false,
    );
  });

  it("accepts all shift_grouping enum values", () => {
    const groupings = ["department", "wage", "wage_type"] as const;
    for (const shift_grouping of groupings) {
      expect(payrollSettingsSchema.safeParse({ ...valid, shift_grouping }).success).toBe(true);
    }
  });

  it("rejects an invalid shift_grouping", () => {
    expect(payrollSettingsSchema.safeParse({ ...valid, shift_grouping: "location" }).success).toBe(
      false,
    );
  });

  it("coerces string numbers for period_start_day", () => {
    const result = payrollSettingsSchema.parse({ ...valid, period_start_day: "15" });
    expect(result.period_start_day).toBe(15);
  });

  it("coerces string decimals for percentage fields", () => {
    const result = payrollSettingsSchema.parse({
      ...valid,
      employer_social_security_pct: "14.1",
      vacation_pay_pct: "12.5",
      pension_pct: "2.0",
    });
    expect(result.employer_social_security_pct).toBe(14.1);
    expect(result.vacation_pay_pct).toBe(12.5);
    expect(result.pension_pct).toBe(2.0);
  });

  it("rejects period_start_day below 1", () => {
    expect(payrollSettingsSchema.safeParse({ ...valid, period_start_day: 0 }).success).toBe(false);
  });

  it("rejects period_start_day above 28", () => {
    expect(payrollSettingsSchema.safeParse({ ...valid, period_start_day: 29 }).success).toBe(false);
  });

  it("accepts period_start_day at boundary values 1 and 28", () => {
    expect(payrollSettingsSchema.safeParse({ ...valid, period_start_day: 1 }).success).toBe(true);
    expect(payrollSettingsSchema.safeParse({ ...valid, period_start_day: 28 }).success).toBe(true);
  });

  it("rejects employer_social_security_pct above 100", () => {
    expect(
      payrollSettingsSchema.safeParse({ ...valid, employer_social_security_pct: 101 }).success,
    ).toBe(false);
  });

  it("accepts null for default salary code fields", () => {
    const result = payrollSettingsSchema.parse({
      ...valid,
      default_worked_hours_salary_code: null,
      default_monthly_salary_code: null,
    });
    expect(result.default_worked_hours_salary_code).toBeNull();
    expect(result.default_monthly_salary_code).toBeNull();
  });

  it("fails when period_type is missing", () => {
    const { period_type: _omitted, ...withoutPeriodType } = valid;
    expect(payrollSettingsSchema.safeParse(withoutPeriodType).success).toBe(false);
  });

  it("fails when shift_grouping is missing", () => {
    const { shift_grouping: _omitted, ...withoutGrouping } = valid;
    expect(payrollSettingsSchema.safeParse(withoutGrouping).success).toBe(false);
  });
});

// ─── salaryCodeSchema ────────────────────────────────────────────────────────

describe("salaryCodeSchema", () => {
  const valid = {
    code: "100",
    name: "Ordinær timelønn",
    description: null,
    external_code: null,
    category: "worked_hours" as const,
    a_melding_code: null,
    is_active: true,
  };

  it("passes with a complete valid object", () => {
    expect(() => salaryCodeSchema.parse(valid)).not.toThrow();
  });

  it("accepts all SALARY_CODE_CATEGORIES values", () => {
    for (const category of SALARY_CODE_CATEGORIES) {
      expect(salaryCodeSchema.safeParse({ ...valid, category }).success).toBe(true);
    }
  });

  it("rejects an invalid category", () => {
    expect(salaryCodeSchema.safeParse({ ...valid, category: "bonus" }).success).toBe(false);
  });

  it("rejects empty code string", () => {
    expect(salaryCodeSchema.safeParse({ ...valid, code: "" }).success).toBe(false);
  });

  it("rejects empty name string", () => {
    expect(salaryCodeSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("accepts null for optional fields", () => {
    const result = salaryCodeSchema.parse({
      ...valid,
      description: null,
      external_code: null,
      a_melding_code: null,
    });
    expect(result.description).toBeNull();
    expect(result.external_code).toBeNull();
    expect(result.a_melding_code).toBeNull();
  });

  it("fails when code is missing", () => {
    const { code: _omitted, ...withoutCode } = valid;
    expect(salaryCodeSchema.safeParse(withoutCode).success).toBe(false);
  });

  it("fails when is_active is missing", () => {
    const { is_active: _omitted, ...withoutActive } = valid;
    expect(salaryCodeSchema.safeParse(withoutActive).success).toBe(false);
  });

  it("SALARY_CODE_CATEGORIES constant contains expected values", () => {
    expect(SALARY_CODE_CATEGORIES).toContain("worked_hours");
    expect(SALARY_CODE_CATEGORIES).toContain("supplement");
    expect(SALARY_CODE_CATEGORIES).toContain("overtime");
    expect(SALARY_CODE_CATEGORIES).toContain("absence");
    expect(SALARY_CODE_CATEGORIES).toContain("deduction");
    expect(SALARY_CODE_CATEGORIES).toContain("monthly_salary");
  });
});

// ─── breakRuleSchema ─────────────────────────────────────────────────────────

describe("breakRuleSchema", () => {
  const validAfterDuration = {
    name: "30-min pause etter 5t",
    trigger_type: "after_duration" as const,
    trigger_minutes: 300,
    trigger_time: null,
    duration_minutes: 30,
    min_shift_duration_minutes: 0,
    is_paid: false,
    department_ids: [],
    employee_group_ids: [],
    weekdays: [],
    is_active: true,
    valid_from: null,
    valid_until: null,
  };

  const validTimeOfDay = {
    name: "Pause kl 12",
    trigger_type: "time_of_day" as const,
    trigger_minutes: null,
    trigger_time: "12:00",
    duration_minutes: 30,
    min_shift_duration_minutes: 0,
    is_paid: false,
    department_ids: [],
    employee_group_ids: [],
    weekdays: [],
    is_active: true,
    valid_from: null,
    valid_until: null,
  };

  it("passes for trigger_type after_duration with trigger_minutes provided", () => {
    expect(() => breakRuleSchema.parse(validAfterDuration)).not.toThrow();
  });

  it("passes for trigger_type time_of_day with trigger_time provided", () => {
    expect(() => breakRuleSchema.parse(validTimeOfDay)).not.toThrow();
  });

  it("fails when trigger_type is after_duration but trigger_minutes is missing", () => {
    const result = breakRuleSchema.safeParse({
      ...validAfterDuration,
      trigger_minutes: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("trigger_minutes");
    }
  });

  it("fails when trigger_type is time_of_day but trigger_time is missing", () => {
    const result = breakRuleSchema.safeParse({
      ...validTimeOfDay,
      trigger_time: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("trigger_time");
    }
  });

  it("fails when trigger_type is time_of_day but only trigger_minutes is provided (no trigger_time)", () => {
    const result = breakRuleSchema.safeParse({
      ...validTimeOfDay,
      trigger_minutes: 120,
      trigger_time: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid trigger_type enum value", () => {
    expect(
      breakRuleSchema.safeParse({ ...validAfterDuration, trigger_type: "on_request" }).success,
    ).toBe(false);
  });

  it("coerces string to number for trigger_minutes", () => {
    const result = breakRuleSchema.parse({
      ...validAfterDuration,
      trigger_minutes: "300",
    });
    expect(result.trigger_minutes).toBe(300);
  });

  it("coerces string to number for duration_minutes", () => {
    const result = breakRuleSchema.parse({ ...validAfterDuration, duration_minutes: "30" });
    expect(result.duration_minutes).toBe(30);
  });

  it("rejects duration_minutes less than 1", () => {
    expect(breakRuleSchema.safeParse({ ...validAfterDuration, duration_minutes: 0 }).success).toBe(
      false,
    );
  });

  it("accepts arrays of UUIDs for department_ids and employee_group_ids", () => {
    const result = breakRuleSchema.parse({
      ...validAfterDuration,
      department_ids: ["550e8400-e29b-41d4-a716-446655440000"],
      employee_group_ids: ["550e8400-e29b-41d4-a716-446655440001"],
    });
    expect(result.department_ids).toHaveLength(1);
    expect(result.employee_group_ids).toHaveLength(1);
  });

  it("rejects non-UUID strings in department_ids", () => {
    expect(
      breakRuleSchema.safeParse({ ...validAfterDuration, department_ids: ["not-a-uuid"] }).success,
    ).toBe(false);
  });

  it("accepts weekdays 0-6 and rejects out-of-range values", () => {
    expect(breakRuleSchema.safeParse({ ...validAfterDuration, weekdays: [0, 3, 6] }).success).toBe(
      true,
    );
    expect(breakRuleSchema.safeParse({ ...validAfterDuration, weekdays: [7] }).success).toBe(false);
  });

  it("fails when name is missing", () => {
    const { name: _omitted, ...withoutName } = validAfterDuration;
    expect(breakRuleSchema.safeParse(withoutName).success).toBe(false);
  });

  it("TRIGGER_TYPES constant contains expected values", () => {
    expect(TRIGGER_TYPES).toContain("after_duration");
    expect(TRIGGER_TYPES).toContain("time_of_day");
  });
});

// ─── supplementRuleSchema ────────────────────────────────────────────────────

describe("supplementRuleSchema", () => {
  const valid = {
    name: "Kveldskveld tillegg",
    supplement_type: "normal" as const,
    salary_code: null,
    rate_type: "fixed_per_hour" as const,
    rate_value: 50,
    is_active: true,
    sort_order: 0,
    employee_group_ids: [],
    employee_types: [],
    shift_type_ids: [],
    affected_by_breaks: true,
    affects_salaried: false,
    enforced_payment: false,
    consider_midnight: false,
    valid_from: null,
    valid_until: null,
    start_type: "time_of_day" as const,
    time_window_start: "18:00",
    time_window_end: "22:00",
    after_minutes: null,
    weekdays: [],
    holiday_calendar_id: null,
    weekly_threshold_hours: null,
    weekly_max_hours: null,
    daily_threshold_hours: null,
    daily_max_hours: null,
    default_rate: null,
    allow_rate_override: false,
    contract_rule_id: null,
    evaluation_field: null,
    threshold_value: null,
  };

  it("passes with a complete valid object", () => {
    expect(() => supplementRuleSchema.parse(valid)).not.toThrow();
  });

  it("accepts all SUPPLEMENT_TYPES values", () => {
    for (const supplement_type of SUPPLEMENT_TYPES) {
      expect(supplementRuleSchema.safeParse({ ...valid, supplement_type }).success).toBe(true);
    }
  });

  it("rejects an invalid supplement_type", () => {
    expect(supplementRuleSchema.safeParse({ ...valid, supplement_type: "bonus" }).success).toBe(
      false,
    );
  });

  it("accepts all RATE_TYPES values", () => {
    for (const rate_type of RATE_TYPES) {
      expect(supplementRuleSchema.safeParse({ ...valid, rate_type }).success).toBe(true);
    }
  });

  it("rejects an invalid rate_type", () => {
    expect(supplementRuleSchema.safeParse({ ...valid, rate_type: "daily_flat" }).success).toBe(
      false,
    );
  });

  it("accepts all START_TYPES values for start_type", () => {
    for (const start_type of START_TYPES) {
      expect(supplementRuleSchema.safeParse({ ...valid, start_type }).success).toBe(true);
    }
  });

  it("accepts null for start_type", () => {
    expect(supplementRuleSchema.safeParse({ ...valid, start_type: null }).success).toBe(true);
  });

  it("coerces string rate_value to number", () => {
    const result = supplementRuleSchema.parse({ ...valid, rate_value: "14.1" });
    expect(result.rate_value).toBe(14.1);
  });

  it("coerces string sort_order to integer", () => {
    const result = supplementRuleSchema.parse({ ...valid, sort_order: "5" });
    expect(result.sort_order).toBe(5);
  });

  it("rejects rate_value below 0", () => {
    expect(supplementRuleSchema.safeParse({ ...valid, rate_value: -1 }).success).toBe(false);
  });

  it("accepts null for all nullable type-specific fields", () => {
    const result = supplementRuleSchema.parse({
      ...valid,
      salary_code: null,
      start_type: null,
      time_window_start: null,
      time_window_end: null,
      after_minutes: null,
      holiday_calendar_id: null,
      weekly_threshold_hours: null,
      weekly_max_hours: null,
      daily_threshold_hours: null,
      daily_max_hours: null,
      default_rate: null,
      contract_rule_id: null,
      evaluation_field: null,
      threshold_value: null,
    });
    expect(result.salary_code).toBeNull();
    expect(result.weekly_threshold_hours).toBeNull();
    expect(result.daily_max_hours).toBeNull();
  });

  it("accepts empty arrays for scope filter fields", () => {
    const result = supplementRuleSchema.parse({
      ...valid,
      employee_group_ids: [],
      shift_type_ids: [],
      weekdays: [],
    });
    expect(result.employee_group_ids).toHaveLength(0);
  });

  it("rejects non-UUID strings in employee_group_ids", () => {
    expect(
      supplementRuleSchema.safeParse({ ...valid, employee_group_ids: ["not-a-uuid"] }).success,
    ).toBe(false);
  });

  it("fails when name is empty", () => {
    expect(supplementRuleSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("fails when supplement_type is missing", () => {
    const { supplement_type: _omitted, ...withoutType } = valid;
    expect(supplementRuleSchema.safeParse(withoutType).success).toBe(false);
  });

  describe("SUPPLEMENT_TYPES constant", () => {
    it("contains all six supplement types", () => {
      expect(SUPPLEMENT_TYPES).toContain("normal");
      expect(SUPPLEMENT_TYPES).toContain("week_based");
      expect(SUPPLEMENT_TYPES).toContain("day_based");
      expect(SUPPLEMENT_TYPES).toContain("manual");
      expect(SUPPLEMENT_TYPES).toContain("holiday");
      expect(SUPPLEMENT_TYPES).toContain("contract_rule");
      expect(SUPPLEMENT_TYPES).toHaveLength(6);
    });
  });

  describe("getDefaultValues", () => {
    it("returns schema-conforming defaults for every supplement type once a name is supplied", () => {
      // getDefaultValues intentionally leaves name as "" (blank form field).
      // The schema rejects empty names via min(1), so we supply one here.
      // This test verifies all OTHER fields in the defaults are schema-valid.
      for (const type of SUPPLEMENT_TYPES) {
        const defaults = getDefaultValues(type);
        expect(supplementRuleSchema.safeParse({ ...defaults, name: "Test" }).success).toBe(true);
      }
    });

    it("returns name as empty string (form default — not schema-valid on its own)", () => {
      for (const type of SUPPLEMENT_TYPES) {
        expect(getDefaultValues(type).name).toBe("");
      }
    });

    it("sets start_type to time_of_day only for normal type", () => {
      expect(getDefaultValues("normal").start_type).toBe("time_of_day");
      expect(getDefaultValues("week_based").start_type).toBeNull();
      expect(getDefaultValues("manual").start_type).toBeNull();
    });

    it("initialises all array fields as empty arrays", () => {
      const defaults = getDefaultValues("normal");
      expect(defaults.employee_group_ids).toEqual([]);
      expect(defaults.shift_type_ids).toEqual([]);
      expect(defaults.weekdays).toEqual([]);
    });
  });
});

// ─── mealRuleSchema ──────────────────────────────────────────────────────────

describe("mealRuleSchema", () => {
  const valid = {
    name: "Måltidstrekk",
    meal_type: "deduction" as const,
    salary_code: null,
    amount: 45,
    min_shift_hours: 5,
    department_ids: [],
    employee_group_ids: [],
    shift_type_ids: [],
    is_active: true,
  };

  it("passes with a complete valid object", () => {
    expect(() => mealRuleSchema.parse(valid)).not.toThrow();
  });

  it("accepts all MEAL_TYPES values", () => {
    for (const meal_type of MEAL_TYPES) {
      expect(mealRuleSchema.safeParse({ ...valid, meal_type }).success).toBe(true);
    }
  });

  it("rejects an invalid meal_type", () => {
    expect(mealRuleSchema.safeParse({ ...valid, meal_type: "allowance" }).success).toBe(false);
  });

  it("coerces string amount to number", () => {
    const result = mealRuleSchema.parse({ ...valid, amount: "45.50" });
    expect(result.amount).toBe(45.5);
  });

  it("coerces string min_shift_hours to number", () => {
    const result = mealRuleSchema.parse({ ...valid, min_shift_hours: "5" });
    expect(result.min_shift_hours).toBe(5);
  });

  it("rejects amount below 0", () => {
    expect(mealRuleSchema.safeParse({ ...valid, amount: -1 }).success).toBe(false);
  });

  it("rejects min_shift_hours below 0", () => {
    expect(mealRuleSchema.safeParse({ ...valid, min_shift_hours: -0.1 }).success).toBe(false);
  });

  it("accepts amount of 0 (free meal contribution)", () => {
    expect(mealRuleSchema.safeParse({ ...valid, amount: 0 }).success).toBe(true);
  });

  it("accepts null for salary_code", () => {
    const result = mealRuleSchema.parse({ ...valid, salary_code: null });
    expect(result.salary_code).toBeNull();
  });

  it("accepts a non-null salary_code string", () => {
    const result = mealRuleSchema.parse({ ...valid, salary_code: "MAT" });
    expect(result.salary_code).toBe("MAT");
  });

  it("accepts UUIDs in scope filter arrays", () => {
    const result = mealRuleSchema.parse({
      ...valid,
      department_ids: ["550e8400-e29b-41d4-a716-446655440000"],
      shift_type_ids: ["550e8400-e29b-41d4-a716-446655440001"],
    });
    expect(result.department_ids).toHaveLength(1);
    expect(result.shift_type_ids).toHaveLength(1);
  });

  it("rejects non-UUID strings in department_ids", () => {
    expect(mealRuleSchema.safeParse({ ...valid, department_ids: ["not-a-uuid"] }).success).toBe(
      false,
    );
  });

  it("fails when name is empty", () => {
    expect(mealRuleSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("fails when meal_type is missing", () => {
    const { meal_type: _omitted, ...withoutMealType } = valid;
    expect(mealRuleSchema.safeParse(withoutMealType).success).toBe(false);
  });

  it("fails when is_active is missing", () => {
    const { is_active: _omitted, ...withoutActive } = valid;
    expect(mealRuleSchema.safeParse(withoutActive).success).toBe(false);
  });

  it("MEAL_TYPES constant contains deduction and contribution", () => {
    expect(MEAL_TYPES).toContain("deduction");
    expect(MEAL_TYPES).toContain("contribution");
    expect(MEAL_TYPES).toHaveLength(2);
  });
});
