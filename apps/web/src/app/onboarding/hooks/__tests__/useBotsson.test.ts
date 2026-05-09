import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("useBotsson (post-rewrite)", () => {
  const source = readFileSync(join(__dirname, "../useBotsson.ts"), "utf8");

  it("does not import UltravoxSession", () => {
    expect(source).not.toMatch(/UltravoxSession/);
    expect(source).not.toMatch(/ultravox-client/);
  });

  it("handles advanceToNextSection as the only client-side tool, with no Ultravox tool registrations", () => {
    // No Ultravox-style server-bound tool registrations
    const ultravoxToolCalls = source.match(/registerToolImplementation\(/g) ?? [];
    expect(ultravoxToolCalls.length).toBe(0);
    // advanceToNextSection is still referenced (handled via data channel or similar)
    expect(source).toMatch(/advanceToNextSection/);
  });
});
