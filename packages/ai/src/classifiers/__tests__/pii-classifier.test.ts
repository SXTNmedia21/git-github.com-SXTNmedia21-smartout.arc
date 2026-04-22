/**
 * pii-classifier.test.ts — Unit tests for the Norwegian PII classifier
 * (ADR-0166). Every regex category gets positive + negative coverage,
 * plus overlap handling, redaction placement, hash determinism, and
 * edge cases around empty input.
 */

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { classifyPii, PII_CLASSIFIER_VERSION, type PiiCategory } from "../pii-classifier.js";

const categoriesOf = (text: string): PiiCategory[] =>
  classifyPii(text).matches.map((m) => m.category);

describe("classifyPii — version and shape", () => {
  it("stamps result with the frozen classifier version", () => {
    const result = classifyPii("hello");
    expect(result.classifierVersion).toBe(PII_CLASSIFIER_VERSION);
  });

  it("exports a stable version constant", () => {
    // Trip-wire: changing the rules requires bumping the version on purpose.
    expect(PII_CLASSIFIER_VERSION).toBe("1.0.0-regex-nor");
  });

  it("returns durationMs as a non-negative number", () => {
    const result = classifyPii("hello world");
    expect(typeof result.durationMs).toBe("number");
    expect(Number.isFinite(result.durationMs)).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("empty string has no matches, not detected, hash is deterministic", () => {
    const result = classifyPii("");
    expect(result.detected).toBe(false);
    expect(result.matches).toEqual([]);
    expect(result.redactedText).toBe("");
    expect(result.originalContentHash).toBe(createHash("sha256").update("", "utf8").digest("hex"));
  });

  it("whitespace-only text has no matches", () => {
    const result = classifyPii("   \n\t ");
    expect(result.detected).toBe(false);
    expect(result.matches).toEqual([]);
  });
});

describe("classifyPii — originalContentHash determinism", () => {
  it("returns the same SHA-256 for the same input", () => {
    const input = "min personnummer er 12109512345";
    const h1 = classifyPii(input).originalContentHash;
    const h2 = classifyPii(input).originalContentHash;
    expect(h1).toBe(h2);
    expect(h1).toBe(createHash("sha256").update(input, "utf8").digest("hex"));
  });

  it("hash changes when even one character changes", () => {
    const a = classifyPii("hei").originalContentHash;
    const b = classifyPii("hej").originalContentHash;
    expect(a).not.toBe(b);
  });

  it("hash is 64 lowercase hex characters", () => {
    const { originalContentHash } = classifyPii("noe tekst");
    expect(originalContentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("classifyPii — personnummer", () => {
  it("detects 11 digits without space (DDMMYYXXXXX)", () => {
    const result = classifyPii("Mitt fnr er 12109512345.");
    expect(result.detected).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      category: "personnummer",
      matchedText: "12109512345",
    });
  });

  it("detects 11 digits with a single space after DDMMYY", () => {
    const result = classifyPii("fnr: 121095 12345");
    expect(result.detected).toBe(true);
    expect(result.matches[0]?.category).toBe("personnummer");
  });

  it("does NOT match 10 digits", () => {
    const result = classifyPii("nummer 1234567890");
    expect(result.matches.find((m) => m.category === "personnummer")).toBeUndefined();
  });

  it("does NOT match 12 digits adjacent", () => {
    // \b word-boundary plus exact 11 prevents over-greedy match of a 12-digit string.
    const result = classifyPii("123456789012");
    expect(result.matches.find((m) => m.category === "personnummer")).toBeUndefined();
  });
});

describe("classifyPii — iban (Norwegian)", () => {
  it("detects NO-IBAN with no spaces", () => {
    const result = classifyPii("send til NO9386011117947");
    expect(categoriesOf(result.redactedText + " guard")).not.toContain("iban");
    const hit = result.matches.find((m) => m.category === "iban");
    expect(hit?.matchedText).toBe("NO9386011117947");
  });

  it("detects NO-IBAN with spaces every 4 characters", () => {
    const result = classifyPii("IBAN: NO93 8601 1117 947");
    expect(result.matches.some((m) => m.category === "iban")).toBe(true);
  });

  it("case-insensitive on NO prefix", () => {
    const result = classifyPii("iban no9386011117947 please");
    expect(result.matches.some((m) => m.category === "iban")).toBe(true);
  });

  it("does NOT match non-NO IBAN prefix", () => {
    const result = classifyPii("SE9386011117947");
    expect(result.matches.find((m) => m.category === "iban")).toBeUndefined();
  });
});

describe("classifyPii — bank_account_nor", () => {
  it("detects 11-digit konto with dots in 4-2-5 form", () => {
    const result = classifyPii("konto: 1234.56.78901");
    expect(result.matches.some((m) => m.category === "bank_account_nor")).toBe(true);
  });

  it("detects 11-digit konto with spaces in 4-2-5 form", () => {
    const result = classifyPii("1234 56 78901");
    expect(result.matches.some((m) => m.category === "bank_account_nor")).toBe(true);
  });

  it("does NOT match 11 digits followed by more digits", () => {
    const result = classifyPii("123456789012345");
    expect(result.matches.find((m) => m.category === "bank_account_nor")).toBeUndefined();
  });
});

describe("classifyPii — phone_nor", () => {
  it("detects 8-digit phone with spaces (22 22 22 22)", () => {
    const result = classifyPii("ring meg på 22 22 22 22");
    expect(result.matches.some((m) => m.category === "phone_nor")).toBe(true);
  });

  it("detects 8-digit phone without spaces", () => {
    const result = classifyPii("22222222");
    expect(result.matches.some((m) => m.category === "phone_nor")).toBe(true);
  });

  it("detects +47 prefix with space", () => {
    const result = classifyPii("+47 98 76 54 32");
    expect(result.matches.some((m) => m.category === "phone_nor")).toBe(true);
  });

  it("does NOT match 7-digit run", () => {
    const result = classifyPii("1234567");
    expect(result.matches.find((m) => m.category === "phone_nor")).toBeUndefined();
  });
});

describe("classifyPii — email", () => {
  it("detects a simple email", () => {
    const result = classifyPii("skriv til pontus@smartout.no");
    expect(result.matches.some((m) => m.category === "email")).toBe(true);
  });

  it("detects email with plus-addressing", () => {
    const result = classifyPii("user+tag@example.co.uk");
    expect(result.matches.some((m) => m.category === "email")).toBe(true);
  });

  it("does NOT match a bare word with @ but no TLD", () => {
    const result = classifyPii("hei@there");
    expect(result.matches.find((m) => m.category === "email")).toBeUndefined();
  });
});

describe("classifyPii — redaction placement", () => {
  it("replaces a single match with the category placeholder", () => {
    const result = classifyPii("fnr er 12109512345.");
    expect(result.redactedText).toBe("fnr er [PII: personnummer].");
  });

  it("preserves text that contains no PII", () => {
    const input = "dette er en helt vanlig melding";
    const result = classifyPii(input);
    expect(result.redactedText).toBe(input);
    expect(result.detected).toBe(false);
  });

  it("replaces multiple matches in order", () => {
    const result = classifyPii("ring 22 22 22 22 eller mail til pontus@smartout.no");
    expect(result.detected).toBe(true);
    // Phone detected first in priority order, email second.
    expect(result.redactedText).toContain("[PII: phone_nor]");
    expect(result.redactedText).toContain("[PII: email]");
    expect(result.redactedText).not.toContain("22 22 22 22");
    expect(result.redactedText).not.toContain("pontus@smartout.no");
  });
});

describe("classifyPii — overlap priority", () => {
  it("earlier-priority rule wins when the same span could match two categories", () => {
    // "12109512345" matches personnummer (priority 1). bank_account_nor
    // (priority 3) would also match the same 11-digit span. Personnummer
    // must win.
    const result = classifyPii("12109512345");
    const categories = result.matches.map((m) => m.category);
    expect(categories).toContain("personnummer");
    expect(categories).not.toContain("bank_account_nor");
  });
});

describe("classifyPii — multiple distinct PII in one message", () => {
  it("detects personnummer + phone + email in the same message", () => {
    const msg = "Fnr 12109512345, tlf 22 22 22 22, mail test@example.com";
    const result = classifyPii(msg);
    const cats = new Set(result.matches.map((m) => m.category));
    expect(cats.has("personnummer")).toBe(true);
    expect(cats.has("phone_nor")).toBe(true);
    expect(cats.has("email")).toBe(true);
    expect(result.redactedText).not.toContain("12109512345");
    expect(result.redactedText).not.toContain("22 22 22 22");
    expect(result.redactedText).not.toContain("test@example.com");
  });
});

describe("classifyPii — match positions are correct", () => {
  it("startIndex/endIndex round-trip to the original substring", () => {
    const msg = "prefix 12109512345 suffix";
    const result = classifyPii(msg);
    const m = result.matches[0];
    expect(m).toBeDefined();
    if (!m) return;
    expect(msg.slice(m.startIndex, m.endIndex)).toBe(m.matchedText);
  });
});

describe("classifyPii — repeated calls are stateless", () => {
  it("two runs on the same input return identical results", () => {
    const msg = "fnr 12109512345";
    const a = classifyPii(msg);
    const b = classifyPii(msg);
    expect(a.detected).toBe(b.detected);
    expect(a.matches.length).toBe(b.matches.length);
    expect(a.matches[0]?.matchedText).toBe(b.matches[0]?.matchedText);
    expect(a.originalContentHash).toBe(b.originalContentHash);
    expect(a.redactedText).toBe(b.redactedText);
  });

  it("running on input A then B does not leak state (no regex lastIndex bleed)", () => {
    const a = classifyPii("fnr 12109512345");
    const b = classifyPii("fnr 98765432109");
    expect(a.detected).toBe(true);
    expect(b.detected).toBe(true);
    expect(a.matches[0]?.matchedText).toBe("12109512345");
    expect(b.matches[0]?.matchedText).toBe("98765432109");
  });
});
