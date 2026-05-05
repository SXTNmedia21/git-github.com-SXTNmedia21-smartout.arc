import { describe, test, expect } from "vitest";
import {
  ClassificationResultSchema,
  ClassificationWarningSchema,
} from "../classification-result.js";

describe("ClassificationWarningSchema", () => {
  test("accepts a valid warning", () => {
    const result = ClassificationWarningSchema.safeParse({
      type: "employee_disadvantage",
      message_no: "Endring reduserer ansatt-fordel. Krever spesielt grundig consent.",
    });
    expect(result.success).toBe(true);
  });
});

describe("ClassificationResultSchema", () => {
  test("accepts a valid MATERIAL classification", () => {
    const result = ClassificationResultSchema.safeParse({
      classification: "material",
      requires_resigning: true,
      confidence: "HØY",
      reasoning_no:
        "Lønn økes; krever amendment iht. felt-klassifisering material. Aml. §14-6 første ledd bokstav i.",
      paragraph_references: ["Aml. §14-6 første ledd bokstav i"],
      source_urls: ["https://lovdata.no/dokument/NL/lov/2005-06-17-62/§14-6"],
      warnings: [],
      blocked_reason: null,
      alternative_actions: [],
    });
    expect(result.success).toBe(true);
  });

  test("accepts a BLOCKED classification with reason", () => {
    const result = ClassificationResultSchema.safeParse({
      classification: "blocked",
      requires_resigning: false,
      confidence: "HØY",
      reasoning_no: "Konvertering fra fast til midlertidig stilling er ulovlig uten saklig grunn.",
      paragraph_references: ["Aml. §14-9"],
      source_urls: ["https://lovdata.no/dokument/NL/lov/2005-06-17-62/§14-9"],
      warnings: [],
      blocked_reason: "Endring permanent→midlertidig krever saklig grunn iht. Aml. §14-9.",
      alternative_actions: ["Opprett ny kontrakt og terminer eksisterende"],
    });
    expect(result.success).toBe(true);
  });

  test("accepts ADMIN classification with no warnings", () => {
    const result = ClassificationResultSchema.safeParse({
      classification: "admin",
      requires_resigning: false,
      confidence: "HØY",
      reasoning_no: "Prøvetids-forlengelse pga. sykefravær er tillatt uten re-signering.",
      paragraph_references: ["Aml. §15-6 fjerde ledd"],
      source_urls: ["https://lovdata.no/dokument/NL/lov/2005-06-17-62/§15-6"],
      warnings: [],
      blocked_reason: null,
      alternative_actions: [],
    });
    expect(result.success).toBe(true);
  });

  test("rejects classification missing required classification field", () => {
    const result = ClassificationResultSchema.safeParse({
      // classification is missing
      requires_resigning: false,
      confidence: "MEDIUM",
      reasoning_no: "Tolkning...",
      paragraph_references: [],
      source_urls: [],
      warnings: [],
      blocked_reason: null,
      alternative_actions: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join("."));
      expect(fields).toContain("classification");
    }
  });

  test("rejects invalid source_url in source_urls array", () => {
    const result = ClassificationResultSchema.safeParse({
      classification: "material",
      requires_resigning: true,
      confidence: "HØY",
      reasoning_no: "Lønnsendring krever re-signering.",
      paragraph_references: ["Aml. §14-6 bokstav i"],
      source_urls: ["not-a-valid-url"],
      warnings: [],
      blocked_reason: null,
      alternative_actions: [],
    });
    expect(result.success).toBe(false);
  });
});
