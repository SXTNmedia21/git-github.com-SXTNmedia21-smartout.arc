import { describe, test, expect } from "vitest";
import { LovsenAnswerSchema } from "../lovsen-answer.js";

const VALID_HASH = "b".repeat(64);
const VALID_CITATION = {
  lov: "aml",
  paragraph: "§15-6",
  verbatim_text:
    "I prøvetid kan arbeidsgiver si opp arbeidstaker med 14 dagers varsel med begrunnelse i...",
  hash: VALID_HASH,
  fetched_at: "2026-04-29T09:00:00.000Z",
  source_url: "https://lovdata.no/dokument/NL/lov/2005-06-17-62/§15-6",
};

const VALID_CONFIDENCE = {
  level: "HØY" as const,
  score: 0.95,
  reasons: ["Direkte sitat fra Aml. §15-6 første ledd hentet fra Lovdata"],
  stale_paragraph: false,
  missing_data: [],
};

describe("LovsenAnswerSchema", () => {
  test("accepts a minimal valid LovsenAnswer (no optional fields)", () => {
    const result = LovsenAnswerSchema.safeParse({
      answer_no:
        "Ja — i prøvetid kan du si opp basert på manglende tilpasning iht. Aml. §15-6 første ledd.",
      citations: [VALID_CITATION],
      confidence: VALID_CONFIDENCE,
      escalation_recommended: false,
    });
    expect(result.success).toBe(true);
  });

  test("accepts a full LovsenAnswer with validation result", () => {
    const result = LovsenAnswerSchema.safeParse({
      answer_no: "Kontrakten oppfyller §14-6 med 1 advarsel.",
      citations: [VALID_CITATION],
      confidence: VALID_CONFIDENCE,
      validation: {
        validation_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        contract_id: "550e8400-e29b-41d4-a716-446655440000",
        validated_at: "2026-04-29T10:00:00.000Z",
        validator_version: "aml-14-6-2024-07",
        source_url: "https://lovdata.no/dokument/NL/lov/2005-06-17-62/§14-6",
        source_fetched_at: "2026-04-29T09:55:00.000Z",
        result: "pass_with_warnings",
        issues: [
          {
            severity: "warning",
            paragraph: "Aml. §14-6 første ledd bokstav o",
            field: "training_rights",
            message_no: "Kompetanseutviklingsrett ikke beskrevet (post juli 2024-krav)",
            remediation: "Legg til training_rights-felt i kontrakten",
            confidence: "MEDIUM",
          },
        ],
        summary_no: "Kontrakten oppfyller §14-6 med 1 advarsel.",
      },
      disclaimer: undefined,
      escalation_recommended: false,
    });
    expect(result.success).toBe(true);
  });

  test("rejects LovsenAnswer with empty citations array", () => {
    const result = LovsenAnswerSchema.safeParse({
      answer_no: "Svaret er...",
      citations: [], // must have at least one citation
      confidence: VALID_CONFIDENCE,
      escalation_recommended: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes("citation"))).toBe(true);
    }
  });

  test("rejects LovsenAnswer missing required answer_no field", () => {
    const result = LovsenAnswerSchema.safeParse({
      // answer_no is missing
      citations: [VALID_CITATION],
      confidence: VALID_CONFIDENCE,
      escalation_recommended: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join("."));
      expect(fields).toContain("answer_no");
    }
  });

  test("accepts escalation_recommended: true with disclaimer", () => {
    const result = LovsenAnswerSchema.safeParse({
      answer_no: "Dette er en gråsone som krever juridisk vurdering.",
      citations: [VALID_CITATION],
      confidence: {
        level: "LAV",
        score: 0.2,
        reasons: ["Gråsone — ingen klar lovhjemmel"],
        stale_paragraph: false,
        missing_data: ["juridisk_kontekst"],
      },
      disclaimer: "Dette er veiledning, ikke juridisk rådgivning. Kontakt advokat ved tvil.",
      escalation_recommended: true,
    });
    expect(result.success).toBe(true);
  });
});
