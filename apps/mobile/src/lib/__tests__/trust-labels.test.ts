/**
 * Tests for getTrustLabel() — trust tier determination for monetary figures.
 *
 * Pure function that determines confidence level (estimate/recorded/settled)
 * for displaying earnings based on data source and shift phase.
 *
 * Trust tiers:
 * - estimate: preliminary calculation, shown with "~" prefix
 * - recorded: verified time entry data
 * - settled: canonical payroll source (payslip, ledger)
 */

import { getTrustLabel } from "../trust-labels";
import type { TrustLabelInput } from "../trust-labels";

describe("getTrustLabel", () => {
  describe("payroll_period source — always settled", () => {
    it("returns settled for payroll_period in before_shift phase", () => {
      const input: TrustLabelInput = {
        phase: "before_shift",
        dataSource: "payroll_period",
      };

      const result = getTrustLabel(input);

      expect(result.tier).toBe("settled");
      expect(result.label).toBe("Avregnet i lønn");
      expect(result.prefix).toBe("");
      expect(result.showDisclaimer).toBe(false);
    });

    it("returns settled for payroll_period in during_shift phase", () => {
      const input: TrustLabelInput = {
        phase: "during_shift",
        dataSource: "payroll_period",
      };

      const result = getTrustLabel(input);

      expect(result.tier).toBe("settled");
      expect(result.label).toBe("Avregnet i lønn");
    });

    it("returns settled for payroll_period in after_shift phase", () => {
      const input: TrustLabelInput = {
        phase: "after_shift",
        dataSource: "payroll_period",
      };

      const result = getTrustLabel(input);

      expect(result.tier).toBe("settled");
    });

    it("returns settled for payroll_period in no_shift phase", () => {
      const input: TrustLabelInput = {
        phase: "no_shift",
        dataSource: "payroll_period",
      };

      const result = getTrustLabel(input);

      expect(result.tier).toBe("settled");
    });
  });

  describe("absence_quota source — always settled", () => {
    it("returns settled for absence_quota regardless of phase", () => {
      const input: TrustLabelInput = {
        phase: "before_shift",
        dataSource: "absence_quota",
      };

      const result = getTrustLabel(input);

      expect(result.tier).toBe("settled");
      expect(result.label).toBe("Avregnet i lønn");
      expect(result.prefix).toBe("");
      expect(result.showDisclaimer).toBe(false);
    });
  });

  describe("timebank_entry source — always settled", () => {
    it("returns settled for timebank_entry (append-only ledger)", () => {
      const input: TrustLabelInput = {
        phase: "no_shift",
        dataSource: "timebank_entry",
      };

      const result = getTrustLabel(input);

      expect(result.tier).toBe("settled");
      expect(result.label).toBe("Avregnet i lønn");
    });

    it("returns settled for timebank_entry in any phase", () => {
      const phases = ["before_shift", "during_shift", "after_shift", "no_shift"] as const;

      phases.forEach((phase) => {
        const result = getTrustLabel({
          phase,
          dataSource: "timebank_entry",
        });

        expect(result.tier).toBe("settled");
      });
    });
  });

  describe("time_entry source — always recorded", () => {
    it("returns recorded for time_entry in before_shift phase", () => {
      const input: TrustLabelInput = {
        phase: "before_shift",
        dataSource: "time_entry",
      };

      const result = getTrustLabel(input);

      expect(result.tier).toBe("recorded");
      expect(result.label).toBe("Registrert tid");
      expect(result.prefix).toBe("");
      expect(result.showDisclaimer).toBe(false);
    });

    it("returns recorded for time_entry in during_shift phase", () => {
      const input: TrustLabelInput = {
        phase: "during_shift",
        dataSource: "time_entry",
      };

      const result = getTrustLabel(input);

      expect(result.tier).toBe("recorded");
      expect(result.label).toBe("Registrert tid");
    });

    it("returns recorded for time_entry in after_shift phase", () => {
      const input: TrustLabelInput = {
        phase: "after_shift",
        dataSource: "time_entry",
      };

      const result = getTrustLabel(input);

      expect(result.tier).toBe("recorded");
    });

    it("returns recorded for time_entry regardless of phase", () => {
      const phases = ["before_shift", "during_shift", "after_shift", "no_shift"] as const;

      phases.forEach((phase) => {
        const result = getTrustLabel({
          phase,
          dataSource: "time_entry",
        });

        expect(result.tier).toBe("recorded");
      });
    });
  });

  describe("calculated source with before_shift — estimate", () => {
    it("returns estimate for calculated in before_shift phase", () => {
      const input: TrustLabelInput = {
        phase: "before_shift",
        dataSource: "calculated",
      };

      const result = getTrustLabel(input);

      expect(result.tier).toBe("estimate");
      expect(result.label).toBe("Foreløpig estimat");
      expect(result.prefix).toBe("~");
      expect(result.showDisclaimer).toBe(true);
    });
  });

  describe("calculated source with during_shift — estimate", () => {
    it("returns estimate for calculated in during_shift phase", () => {
      const input: TrustLabelInput = {
        phase: "during_shift",
        dataSource: "calculated",
      };

      const result = getTrustLabel(input);

      expect(result.tier).toBe("estimate");
      expect(result.label).toBe("Foreløpig estimat");
      expect(result.prefix).toBe("~");
      expect(result.showDisclaimer).toBe(true);
    });
  });

  describe("calculated source with after_shift — recorded", () => {
    it("returns recorded for calculated in after_shift phase (derived from time_entry)", () => {
      const input: TrustLabelInput = {
        phase: "after_shift",
        dataSource: "calculated",
      };

      const result = getTrustLabel(input);

      expect(result.tier).toBe("recorded");
      expect(result.label).toBe("Registrert tid");
      expect(result.prefix).toBe("");
      expect(result.showDisclaimer).toBe(false);
    });
  });

  describe("calculated source with no_shift — estimate (default)", () => {
    it("returns estimate for calculated in no_shift phase", () => {
      const input: TrustLabelInput = {
        phase: "no_shift",
        dataSource: "calculated",
      };

      const result = getTrustLabel(input);

      expect(result.tier).toBe("estimate");
      expect(result.prefix).toBe("~");
      expect(result.showDisclaimer).toBe(true);
    });
  });

  describe("Norwegian labels", () => {
    it("returns correct Norwegian label for estimate tier", () => {
      const result = getTrustLabel({
        phase: "before_shift",
        dataSource: "calculated",
      });

      expect(result.label).toBe("Foreløpig estimat");
    });

    it("returns correct Norwegian label for recorded tier", () => {
      const result = getTrustLabel({
        phase: "after_shift",
        dataSource: "time_entry",
      });

      expect(result.label).toBe("Registrert tid");
    });

    it("returns correct Norwegian label for settled tier", () => {
      const result = getTrustLabel({
        phase: "no_shift",
        dataSource: "payroll_period",
      });

      expect(result.label).toBe("Avregnet i lønn");
    });
  });

  describe("prefix handling", () => {
    it("returns prefix '~' only for estimates", () => {
      const estimateResult = getTrustLabel({
        phase: "before_shift",
        dataSource: "calculated",
      });

      expect(estimateResult.prefix).toBe("~");

      const recordedResult = getTrustLabel({
        phase: "after_shift",
        dataSource: "time_entry",
      });

      expect(recordedResult.prefix).toBe("");

      const settledResult = getTrustLabel({
        phase: "no_shift",
        dataSource: "payroll_period",
      });

      expect(settledResult.prefix).toBe("");
    });

    it("returns empty prefix for all non-estimate tiers", () => {
      const recorded = getTrustLabel({
        phase: "after_shift",
        dataSource: "calculated",
      });
      const settled = getTrustLabel({
        phase: "no_shift",
        dataSource: "timebank_entry",
      });

      expect(recorded.prefix).toBe("");
      expect(settled.prefix).toBe("");
    });
  });

  describe("disclaimer handling", () => {
    it("shows disclaimer only for estimates", () => {
      const estimateResult = getTrustLabel({
        phase: "during_shift",
        dataSource: "calculated",
      });

      expect(estimateResult.showDisclaimer).toBe(true);

      const recordedResult = getTrustLabel({
        phase: "after_shift",
        dataSource: "calculated",
      });

      expect(recordedResult.showDisclaimer).toBe(false);

      const settledResult = getTrustLabel({
        phase: "no_shift",
        dataSource: "payroll_period",
      });

      expect(settledResult.showDisclaimer).toBe(false);
    });

    it("never shows disclaimer for recorded or settled tiers", () => {
      const allTiers = [
        { phase: "after_shift" as const, dataSource: "time_entry" as const },
        { phase: "no_shift" as const, dataSource: "absence_quota" as const },
        { phase: "before_shift" as const, dataSource: "timebank_entry" as const },
        { phase: "no_shift" as const, dataSource: "payroll_period" as const },
      ];

      allTiers.forEach((input) => {
        const result = getTrustLabel(input);
        expect(result.showDisclaimer).toBe(false);
      });
    });
  });

  describe("complete result structure", () => {
    it("returns all required properties for estimate", () => {
      const result = getTrustLabel({
        phase: "before_shift",
        dataSource: "calculated",
      });

      expect(result).toHaveProperty("tier");
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("prefix");
      expect(result).toHaveProperty("showDisclaimer");
      expect(Object.keys(result)).toEqual(["tier", "label", "prefix", "showDisclaimer"]);
    });

    it("returns all required properties for recorded", () => {
      const result = getTrustLabel({
        phase: "after_shift",
        dataSource: "time_entry",
      });

      expect(result).toHaveProperty("tier");
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("prefix");
      expect(result).toHaveProperty("showDisclaimer");
    });

    it("returns all required properties for settled", () => {
      const result = getTrustLabel({
        phase: "no_shift",
        dataSource: "payroll_period",
      });

      expect(result).toHaveProperty("tier");
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("prefix");
      expect(result).toHaveProperty("showDisclaimer");
    });
  });

  describe("edge case: all source-phase combinations", () => {
    const sources = [
      "calculated",
      "time_entry",
      "payroll_period",
      "absence_quota",
      "timebank_entry",
    ] as const;
    const phases = ["no_shift", "before_shift", "during_shift", "after_shift"] as const;

    it("handles all source-phase combinations without errors", () => {
      sources.forEach((source) => {
        phases.forEach((phase) => {
          const result = getTrustLabel({ phase, dataSource: source });

          expect(result.tier).toBeDefined();
          expect(result.label).toBeDefined();
          expect(result.prefix).toBeDefined();
          expect(result.showDisclaimer).toBeDefined();
        });
      });
    });
  });
});
