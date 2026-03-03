import { describe, it, expect } from "vitest";
import { mergeBusinessData } from "../lib/data-merger";

describe("mergeBusinessData", () => {
  it("prefers brreg legal data over scraped data", () => {
    const result = mergeBusinessData(
      { companyName: "Scraped Name", phone: "12345678" },
      { navn: "Legal Name", organisasjonsnummer: "999888777" },
    );
    expect(result.legalName).toBe("Legal Name");
    expect(result.name).toBe("Legal Name");
    expect(result.orgNumber).toBe("999888777");
    expect(result.phone).toBe("12345678");
  });

  it("falls back to scraped name when no brreg data", () => {
    const result = mergeBusinessData({ companyName: "Scraped Restaurant" }, null);
    expect(result.name).toBe("Scraped Restaurant");
    expect(result.legalName).toBe("");
  });

  it("formats brreg address correctly", () => {
    const result = mergeBusinessData(null, {
      navn: "Test AS",
      forretningsadresse: {
        adresse: ["Strandgata 12"],
        postnummer: "3126",
        poststed: "TØNSBERG",
      },
    });
    expect(result.address).toBe("Strandgata 12");
    expect(result.postalCode).toBe("3126");
    expect(result.city).toBe("Tønsberg");
  });

  it("extracts NACE industry code", () => {
    const result = mergeBusinessData(null, {
      navn: "Test",
      naeringskode1: {
        kode: "56.101",
        beskrivelse: "Drift av restauranter og kafeer",
      },
    });
    expect(result.industryCode).toBe("56.101");
    expect(result.industry).toBe("Drift av restauranter og kafeer");
  });

  it("handles both sources being null", () => {
    const result = mergeBusinessData(null, null);
    expect(result.name).toBe("");
    expect(result.address).toBe("");
  });
});
