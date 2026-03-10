import { describe, it, expect } from "vitest";
import { normalizeScrapeData } from "../lib/showcase-scrape";

describe("showcase scrape normalizer", () => {
  it("normalizes missing fields safely", () => {
    const result = normalizeScrapeData(null);
    expect(result.summary).toBe("");
    expect(result.locations).toEqual([]);
  });

  it("normalizes known scraped payload", () => {
    const result = normalizeScrapeData({
      summary: "Test",
      email: "x@y.no",
      phone: "123",
      locations: [{ name: "Kjokken" }, { name: "" }],
    });
    expect(result.locations).toEqual(["Kjokken", "Ukjent lokasjon"]);
  });
});
