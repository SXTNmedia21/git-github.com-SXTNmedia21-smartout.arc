/**
 * Unit tests for the DEFAULT_WORKING_TIME_RULES constant and related types.
 *
 * Source: apps/web/src/app/dashboard/settings/_hooks/use-working-time-rules.ts
 *
 * These tests verify that the 6 pre-defined AML (arbeidsmiljøloven) compliance
 * rules (W01–W06) are structurally complete, carry the correct Norwegian labor
 * law defaults, and satisfy basic data-integrity invariants before they ever
 * reach the database.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_WORKING_TIME_RULES,
  type DefaultRule,
  type RuleSeverity,
} from "../_hooks/use-working-time-rules";

// The full ordered set of expected rule codes.
const EXPECTED_CODES = ["W01", "W02", "W03", "W04", "W05", "W06"] as const;
type RuleCode = (typeof EXPECTED_CODES)[number];

// Helper: look up a rule by code (throws if missing so failures are explicit).
function getRule(code: RuleCode): DefaultRule {
  const rule = DEFAULT_WORKING_TIME_RULES.find((r) => r.code === code);
  if (!rule) throw new Error(`Rule ${code} is missing from DEFAULT_WORKING_TIME_RULES`);
  return rule;
}

// ─── 1. Completeness ──────────────────────────────────────────────────────────

describe("DEFAULT_WORKING_TIME_RULES — completeness", () => {
  it("exports exactly 6 rules", () => {
    expect(DEFAULT_WORKING_TIME_RULES).toHaveLength(6);
  });

  it.each(EXPECTED_CODES)("includes rule %s", (code) => {
    expect(DEFAULT_WORKING_TIME_RULES.some((r) => r.code === code)).toBe(true);
  });
});

// ─── 2. Structure ─────────────────────────────────────────────────────────────

describe("DEFAULT_WORKING_TIME_RULES — each rule has required fields", () => {
  it.each(DEFAULT_WORKING_TIME_RULES)(
    "$code has code, name, description, threshold_value, severity",
    (rule) => {
      expect(rule.code).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(typeof rule.threshold_value).toBe("number");
      expect(rule.severity).toBeTruthy();
    },
  );
});

// ─── 3. W01–W06 specific default values ──────────────────────────────────────

describe("DEFAULT_WORKING_TIME_RULES — Norwegian AML defaults", () => {
  it("W01: max 9 hours per day, severity warn", () => {
    const rule = getRule("W01");
    expect(rule.threshold_value).toBe(9);
    expect(rule.severity).toBe("warn");
  });

  it("W02: max 40 hours per week, severity warn", () => {
    const rule = getRule("W02");
    expect(rule.threshold_value).toBe(40);
    expect(rule.severity).toBe("warn");
  });

  it("W03: min 11 hours daily rest, severity warn", () => {
    const rule = getRule("W03");
    expect(rule.threshold_value).toBe(11);
    expect(rule.severity).toBe("warn");
  });

  it("W04: min 35 hours weekly rest, severity warn", () => {
    const rule = getRule("W04");
    expect(rule.threshold_value).toBe(35);
    expect(rule.severity).toBe("warn");
  });

  it("W05: max 6 consecutive working days, severity warn", () => {
    const rule = getRule("W05");
    expect(rule.threshold_value).toBe(6);
    expect(rule.severity).toBe("warn");
  });

  it("W06: youth working time restriction, severity block", () => {
    const rule = getRule("W06");
    expect(rule.severity).toBe("block");
  });
});

// ─── 4. Severity values ───────────────────────────────────────────────────────

describe("DEFAULT_WORKING_TIME_RULES — severity values", () => {
  const validSeverities: RuleSeverity[] = ["block", "warn"];

  it.each(DEFAULT_WORKING_TIME_RULES)("$code severity is 'block' or 'warn'", (rule) => {
    expect(validSeverities).toContain(rule.severity);
  });
});

// ─── 5. Threshold values are positive ────────────────────────────────────────

describe("DEFAULT_WORKING_TIME_RULES — threshold values", () => {
  // W06 is the exception: it uses 0 as a sentinel value to indicate the rule
  // applies categorically (age-based restriction, not a numeric threshold).
  const rulesWithPositiveThresholds = DEFAULT_WORKING_TIME_RULES.filter((r) => r.code !== "W06");

  it.each(rulesWithPositiveThresholds)("$code threshold_value is greater than 0", (rule) => {
    expect(rule.threshold_value).toBeGreaterThan(0);
  });

  it("W06 threshold_value is 0 (categorical rule, no numeric threshold)", () => {
    expect(getRule("W06").threshold_value).toBe(0);
  });
});

// ─── 6. Rule codes are unique ─────────────────────────────────────────────────

describe("DEFAULT_WORKING_TIME_RULES — rule codes are unique", () => {
  it("contains no duplicate codes", () => {
    const codes = DEFAULT_WORKING_TIME_RULES.map((r) => r.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });
});
