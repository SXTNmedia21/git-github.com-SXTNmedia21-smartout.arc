import { describe, it, expect } from "vitest";
import { parseSearchPrefix } from "../query-prefix";

describe("parseSearchPrefix", () => {
  it("maps ? prefix to knowledge mode", () => {
    const result = parseSearchPrefix("? allergen");
    expect(result.mode).toBe("knowledge");
    expect(result.query).toBe("allergen");
  });

  it("maps @ prefix to people mode", () => {
    const result = parseSearchPrefix("@ kristian");
    expect(result.mode).toBe("people");
    expect(result.query).toBe("kristian");
  });

  it("maps > prefix to commands mode", () => {
    const result = parseSearchPrefix("> innstillinger");
    expect(result.mode).toBe("commands");
    expect(result.query).toBe("innstillinger");
  });

  it("defaults to all mode when no prefix", () => {
    const result = parseSearchPrefix("vaktplan uke 12");
    expect(result.mode).toBe("all");
    expect(result.query).toBe("vaktplan uke 12");
  });

  it("handles prefix with no space after", () => {
    const result = parseSearchPrefix("?allergen");
    expect(result.mode).toBe("knowledge");
    expect(result.query).toBe("allergen");
  });

  it("handles empty string", () => {
    const result = parseSearchPrefix("");
    expect(result.mode).toBe("all");
    expect(result.query).toBe("");
  });

  it("handles prefix-only input", () => {
    const result = parseSearchPrefix("?");
    expect(result.mode).toBe("knowledge");
    expect(result.query).toBe("");
  });

  it("trims leading whitespace before checking prefix", () => {
    const result = parseSearchPrefix("  ? test");
    expect(result.mode).toBe("knowledge");
    expect(result.query).toBe("test");
  });
});
