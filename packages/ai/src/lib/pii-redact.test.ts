// packages/ai/src/lib/pii-redact.test.ts
// ADR-0184 § Redaction Pipeline — test coverage for known PII classes.

import { describe, expect, it } from "vitest";
import { redactPII, PII_CLASSES } from "./pii-redact.js";

describe("redactPII", () => {
  it("redacts Norwegian personnummer (11 digits with dash)", () => {
    const r = redactPII("Mitt fødselsnummer er 12345678901");
    expect(r.redacted).toBe("Mitt fødselsnummer er <personnummer>");
    expect(r.envelopes).toHaveLength(1);
    expect(r.envelopes[0]!.pii_class).toBe("personnummer");
    expect(r.envelopes[0]!.raw).toBe("12345678901");
  });

  it("redacts bank account (11 digits with standard format)", () => {
    const r = redactPII("Konto: 1234.56.78901");
    expect(r.redacted).toContain("<bank>");
    expect(r.envelopes[0]!.pii_class).toBe("bank");
  });

  it("redacts email addresses", () => {
    const r = redactPII("Send til test@example.no");
    expect(r.redacted).toContain("<email>");
    expect(r.envelopes[0]!.raw).toBe("test@example.no");
  });

  it("redacts Norwegian phone +47 format", () => {
    const r = redactPII("Ring +47 12345678");
    expect(r.redacted).toContain("<phone>");
  });

  it("returns original string when no PII present", () => {
    const r = redactPII("Hvor er kantinen?");
    expect(r.redacted).toBe("Hvor er kantinen?");
    expect(r.envelopes).toHaveLength(0);
  });

  it("handles multiple PII in same string", () => {
    const r = redactPII("Email: a@b.no og tlf +47 12345678");
    expect(r.envelopes).toHaveLength(2);
    expect(r.redacted).toContain("<email>");
    expect(r.redacted).toContain("<phone>");
  });

  it("redacts JSON object recursively (for LLM payload capture)", () => {
    const input = { message: "Personnummer: 12345678901", meta: { ok: true } };
    const r = redactPII(input);
    expect((r.redactedObj as { message: string }).message).toContain("<personnummer>");
    expect((r.redactedObj as { meta: { ok: boolean } }).meta.ok).toBe(true);
  });
});

describe("PII_CLASSES", () => {
  it("exports all 8 classes", () => {
    expect(PII_CLASSES).toEqual([
      "personnummer",
      "bank",
      "email",
      "phone",
      "address",
      "salary",
      "medical",
      "free_text",
    ]);
  });
});
