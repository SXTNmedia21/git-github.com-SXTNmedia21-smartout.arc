import { describe, test, expect } from "vitest";
import { ValidationResultSchema, ValidationIssueSchema } from "../validation-result.js";

const CONTRACT_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALIDATION_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

describe("ValidationIssueSchema", () => {
  test("accepts a valid validation issue", () => {
    const result = ValidationIssueSchema.safeParse({
      severity: "error",
      paragraph: "Aml. §14-6 første ledd bokstav f",
      field: "trial_period_months",
      message_no: "Prøvetid 8 mnd overstiger maksimum 6 mnd iht. Aml. §15-6 første ledd",
      remediation: "Sett trial_period_months ≤ 6, eller fjern prøvetid",
      confidence: "HØY",
    });
    expect(result.success).toBe(true);
  });

  test("rejects issue missing required field", () => {
    const result = ValidationIssueSchema.safeParse({
      severity: "error",
      paragraph: "Aml. §14-6 første ledd bokstav f",
      // field is missing
      message_no: "Prøvetid for lang",
      remediation: "Korriger prøvetid",
      confidence: "HØY",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join("."));
      expect(fields).toContain("field");
    }
  });
});

describe("ValidationResultSchema", () => {
  test("accepts a valid pass result with no issues", () => {
    const result = ValidationResultSchema.safeParse({
      validation_id: VALIDATION_ID,
      contract_id: CONTRACT_ID,
      validated_at: "2026-04-29T10:00:00.000Z",
      validator_version: "aml-14-6-2024-07",
      source_url: "https://lovdata.no/dokument/NL/lov/2005-06-17-62/§14-6",
      source_fetched_at: "2026-04-29T09:55:00.000Z",
      result: "pass",
      issues: [],
      summary_no: "Kontrakten oppfyller alle krav i §14-6.",
    });
    expect(result.success).toBe(true);
  });

  test("accepts a fail result with issues", () => {
    const result = ValidationResultSchema.safeParse({
      validation_id: VALIDATION_ID,
      contract_id: CONTRACT_ID,
      validated_at: "2026-04-29T10:00:00.000Z",
      validator_version: "aml-14-6-2024-07",
      source_url: "https://lovdata.no/dokument/NL/lov/2005-06-17-62/§14-6",
      source_fetched_at: "2026-04-29T09:55:00.000Z",
      result: "fail",
      issues: [
        {
          severity: "error",
          paragraph: "Aml. §14-6 første ledd bokstav j",
          field: "agreed_weekly_hours",
          message_no: "Avtalt ukentlig arbeidstid mangler",
          remediation: "Fyll inn agreed_weekly_hours",
          confidence: "HØY",
        },
      ],
      summary_no: "Kontrakten har 1 blocker. Signeringsflyt blokkert.",
    });
    expect(result.success).toBe(true);
  });

  test("accepts review_required result", () => {
    const result = ValidationResultSchema.safeParse({
      validation_id: VALIDATION_ID,
      contract_id: CONTRACT_ID,
      validated_at: "2026-04-29T10:00:00.000Z",
      validator_version: "aml-14-6-2024-07",
      source_url: "https://lovdata.no/dokument/NL/lov/2005-06-17-62/§14-6",
      source_fetched_at: "2026-04-29T09:55:00.000Z",
      result: "review_required",
      issues: [],
      summary_no: "Gråsone oppdaget — manuell gjennomgang kreves.",
    });
    expect(result.success).toBe(true);
  });

  test("rejects result missing required contract_id field", () => {
    const result = ValidationResultSchema.safeParse({
      validation_id: VALIDATION_ID,
      // contract_id is missing
      validated_at: "2026-04-29T10:00:00.000Z",
      validator_version: "aml-14-6-2024-07",
      source_url: "https://lovdata.no/dokument/NL/lov/2005-06-17-62/§14-6",
      source_fetched_at: "2026-04-29T09:55:00.000Z",
      result: "pass",
      issues: [],
      summary_no: "OK",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join("."));
      expect(fields).toContain("contract_id");
    }
  });
});
