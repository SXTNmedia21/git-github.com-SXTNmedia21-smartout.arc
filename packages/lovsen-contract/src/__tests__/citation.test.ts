import { describe, test, expect } from "vitest";
import { CitationSchema } from "../citation.js";

const VALID_HASH = "a".repeat(64); // valid 64-char hex SHA-256

describe("CitationSchema", () => {
  test("accepts a valid citation", () => {
    const result = CitationSchema.safeParse({
      lov: "aml",
      paragraph: "§14-6",
      verbatim_text: "Arbeidsavtalen skal minst inneholde opplysninger om...",
      hash: VALID_HASH,
      fetched_at: "2026-04-29T10:00:00.000Z",
      source_url: "https://lovdata.no/dokument/NL/lov/2005-06-17-62/§14-6",
    });
    expect(result.success).toBe(true);
  });

  test("accepts a citation with optional fields", () => {
    const result = CitationSchema.safeParse({
      lov: "aml",
      paragraph: "§10-9",
      ledd: "fjerde ledd",
      bokstav: "b",
      verbatim_text: "Arbeidstaker har rett til pause...",
      hash: VALID_HASH,
      fetched_at: "2026-04-29T09:55:00.000Z",
      source_url: "https://lovdata.no/dokument/NL/lov/2005-06-17-62/§10-9",
      law_version: "2024-07-01",
    });
    expect(result.success).toBe(true);
  });

  test("rejects citation missing required hash field", () => {
    const result = CitationSchema.safeParse({
      lov: "aml",
      paragraph: "§15-3",
      verbatim_text: "Oppsigelsesfristen er én måned...",
      // hash is missing
      fetched_at: "2026-04-29T10:00:00.000Z",
      source_url: "https://lovdata.no/dokument/NL/lov/2005-06-17-62/§15-3",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join("."));
      expect(fields).toContain("hash");
    }
  });

  test("rejects citation with invalid hash (not 64 hex chars)", () => {
    const result = CitationSchema.safeParse({
      lov: "aml",
      paragraph: "§14-6",
      verbatim_text: "Arbeidsavtalen skal...",
      hash: "not-a-hash",
      fetched_at: "2026-04-29T10:00:00.000Z",
      source_url: "https://lovdata.no/dokument/NL/lov/2005-06-17-62/§14-6",
    });
    expect(result.success).toBe(false);
  });

  test("rejects citation with invalid source_url", () => {
    const result = CitationSchema.safeParse({
      lov: "aml",
      paragraph: "§14-6",
      verbatim_text: "Arbeidsavtalen skal...",
      hash: VALID_HASH,
      fetched_at: "2026-04-29T10:00:00.000Z",
      source_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});
