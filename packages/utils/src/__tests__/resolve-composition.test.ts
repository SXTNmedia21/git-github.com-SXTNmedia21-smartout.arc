/**
 * Type-shape tests for resolve-composition types.
 * No DB calls — validates that the exported types compile correctly.
 */

import { describe, expect, it } from "vitest";
import type {
  ComplianceLevel,
  ComplianceValidation,
  ContractDraftProposal,
  MandatoryClause,
} from "../resolve-composition";

describe("resolve-composition types", () => {
  it("ComplianceLevel accepts ok, warning, blocker", () => {
    const levels: ComplianceLevel[] = ["ok", "warning", "blocker"];
    expect(levels).toHaveLength(3);
    expect(levels).toContain("ok");
    expect(levels).toContain("warning");
    expect(levels).toContain("blocker");
  });

  it("ComplianceValidation has required fields", () => {
    const validation: ComplianceValidation = {
      rule_id: "test-rule",
      rule_type: "gate",
      level: "ok",
      message: "Test passes",
    };
    expect(validation.rule_id).toBe("test-rule");
    expect(validation.level).toBe("ok");
    expect(validation.field).toBeUndefined();
  });

  it("ComplianceValidation supports optional fields", () => {
    const validation: ComplianceValidation = {
      rule_id: "test-rule",
      rule_type: "commercial",
      level: "warning",
      message: "Rate below tariff",
      field: "hourly_rate",
      expected_value: "200",
      actual_value: "180",
    };
    expect(validation.field).toBe("hourly_rate");
    expect(validation.expected_value).toBe("200");
  });

  it("MandatoryClause has locked=true for mandatory rules", () => {
    const clause: MandatoryClause = {
      rule_id: "lov-001",
      title: "Arbeidsmiljoloven §14-6",
      text: "Written contract required",
      enforcement_level: "critical",
      locked: true,
    };
    expect(clause.locked).toBe(true);
    expect(clause.enforcement_level).toBe("critical");
  });

  it("ContractDraftProposal has correct shape", () => {
    const proposal: ContractDraftProposal = {
      employment_terms: {
        position_title: "Servitor",
        hourly_rate: 210.5,
        monthly_salary: null,
        employment_percentage: 100,
        employment_category: "fast",
        start_date: "2026-04-09",
      },
      framework_snapshot: {
        framework_id: "fw-001",
        framework_name: "Riksavtalen",
        snapshot_date: "2026-04-09T10:00:00.000Z",
        rules: [
          {
            rule_id: "r-001",
            rule_type: "gate",
            description: "Minimum hourly rate",
            enforcement_level: "critical",
          },
        ],
      },
      mandatory_clauses: [
        {
          rule_id: "r-001",
          title: "MIN-RATE",
          text: "Minimum hourly rate per Riksavtalen",
          enforcement_level: "critical",
          locked: true,
        },
      ],
      validations: {
        ok: [
          {
            rule_id: "tariff-check",
            rule_type: "commercial",
            level: "ok",
            message: "Tariff rate found: 210.5",
          },
        ],
        warning: [],
        blocker: [],
      },
      placeholder_status: {
        filled: ["personal_number", "bank_account", "address"],
        missing: [],
      },
    };

    // Structure checks
    expect(proposal.employment_terms.employment_percentage).toBe(100);
    expect(proposal.framework_snapshot.rules).toHaveLength(1);
    expect(proposal.mandatory_clauses[0]?.locked).toBe(true);
    expect(proposal.validations.ok).toHaveLength(1);
    expect(proposal.validations.warning).toHaveLength(0);
    expect(proposal.validations.blocker).toHaveLength(0);
    expect(proposal.placeholder_status.filled).toContain("address");
    expect(proposal.placeholder_status.missing).toHaveLength(0);
  });

  it("ContractDraftProposal with missing PII has blockers", () => {
    const proposal: ContractDraftProposal = {
      employment_terms: {
        position_title: "",
        hourly_rate: null,
        monthly_salary: null,
        employment_percentage: 100,
        employment_category: "fast",
        start_date: "2026-04-09",
      },
      framework_snapshot: {
        framework_id: "fw-001",
        framework_name: "Riksavtalen",
        snapshot_date: "2026-04-09T10:00:00.000Z",
        rules: [],
      },
      mandatory_clauses: [],
      validations: {
        ok: [],
        warning: [
          {
            rule_id: "tariff-check",
            rule_type: "commercial",
            level: "warning",
            message: "No tariff rate found",
          },
        ],
        blocker: [
          {
            rule_id: "pii-completeness",
            rule_type: "gate",
            level: "blocker",
            message: "Missing: personal_number, bank_account, address",
            field: "personal_number, bank_account, address",
          },
        ],
      },
      placeholder_status: {
        filled: [],
        missing: ["personal_number", "bank_account", "address"],
      },
    };

    expect(proposal.validations.blocker).toHaveLength(1);
    expect(proposal.validations.blocker[0]?.level).toBe("blocker");
    expect(proposal.placeholder_status.missing).toHaveLength(3);
    expect(proposal.employment_terms.hourly_rate).toBeNull();
  });
});
