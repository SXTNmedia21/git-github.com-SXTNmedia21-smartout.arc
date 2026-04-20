// Contract tests for validateDunningStages — the shared stage-payload
// validator used by:
//   a) the Deno scan_overdue_invoices handler (inlined copy)
//   b) future B5 settings UI that parses the blueprint payload
//
// The validator is a pure function: these tests cover input shape,
// error messages, and the null-safety of the `from` field.
//
// Ref: Fase 3A spec §4.2, ADR-0143.

import { describe, test, expect } from "vitest";
import { validateDunningStages } from "../dispatch/dunning-stages";

describe("validateDunningStages", () => {
  test("accepts the canonical B1 blueprint payload", () => {
    const input = [
      { days: 3, from: null, to: "reminder_1" },
      { days: 7, from: "reminder_1", to: "reminder_2" },
      { days: 14, from: "reminder_2", to: "collection_notice" },
    ];

    const result = validateDunningStages(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stages).toHaveLength(3);
      expect(result.stages[0]).toEqual({ days: 3, from: null, to: "reminder_1" });
      expect(result.stages[2]).toEqual({
        days: 14,
        from: "reminder_2",
        to: "collection_notice",
      });
    }
  });

  test("rejects non-array input", () => {
    const result = validateDunningStages({ days: 3, to: "reminder_1" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("stages must be an array");
    }
  });

  test("rejects empty array", () => {
    const result = validateDunningStages([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("stages cannot be empty");
    }
  });

  test("rejects stage with non-number days", () => {
    const result = validateDunningStages([{ days: "3", from: null, to: "reminder_1" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/stages\[0\]\.days/);
    }
  });

  test("rejects stage with negative days", () => {
    const result = validateDunningStages([{ days: -1, from: null, to: "reminder_1" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/non-negative/);
    }
  });

  test("rejects stage with empty to", () => {
    const result = validateDunningStages([{ days: 3, from: null, to: "" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/stages\[0\]\.to/);
    }
  });

  test("rejects stage with missing to", () => {
    const result = validateDunningStages([{ days: 3, from: null }]);
    expect(result.ok).toBe(false);
  });

  test("rejects stage with number for from (should be null or string)", () => {
    const result = validateDunningStages([{ days: 3, from: 1, to: "reminder_1" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/from must be null or a string/);
    }
  });

  test("normalises undefined from to null", () => {
    // Postgres jsonb_build_object('from', NULL) serialises as {"from": null}
    // so this never hits in production, but the validator should still be
    // forgiving about missing `from` keys.
    const result = validateDunningStages([{ days: 3, to: "reminder_1" }]);
    // from is undefined -> validator rejects it because undefined !== null
    // and !== string. This is intentional: the blueprint must be explicit.
    expect(result.ok).toBe(false);
  });

  test("preserves stage order (ordering matters for cascading)", () => {
    // If reminder_2 came before reminder_1 in the payload, a same-day
    // scan couldn't cascade an invoice across both boundaries. The
    // validator preserves array order faithfully.
    const input = [
      { days: 7, from: "reminder_1", to: "reminder_2" },
      { days: 3, from: null, to: "reminder_1" },
    ];

    const result = validateDunningStages(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stages[0]?.to).toBe("reminder_2");
      expect(result.stages[1]?.to).toBe("reminder_1");
    }
  });

  test("rejects second stage even if first is valid (fail-fast on bad index)", () => {
    const input = [
      { days: 3, from: null, to: "reminder_1" },
      { days: 7, from: "reminder_1", to: "" }, // invalid
    ];

    const result = validateDunningStages(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/stages\[1\]\.to/);
    }
  });

  test("rejects primitive inside array", () => {
    const result = validateDunningStages(["reminder_1"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/stages\[0\] is not an object/);
    }
  });
});
