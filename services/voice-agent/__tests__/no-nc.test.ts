import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * ADR-0282 R5 invariant: voice-agent MUST NOT apply noise cancellation.
 *
 * Krisp NC runs on the local participant (browser / mobile client).
 * If the voice-agent also applied NC, audio would be double-processed,
 * degrading quality. This test scans the agent source to verify NC
 * code is absent.
 */
describe("voice-agent NC-off invariant (ADR-0282 R5)", () => {
  it("does not import or reference Krisp / NC plugin in agent.ts", () => {
    const src = readFileSync(join(__dirname, "../src/agent.ts"), "utf8");
    expect(src).not.toMatch(/krisp|NoiseFilter|noise-filter/i);
  });

  it("does not import or reference Krisp / NC plugin in adapter.ts", () => {
    const src = readFileSync(join(__dirname, "../src/adapter.ts"), "utf8");
    expect(src).not.toMatch(/krisp|NoiseFilter|noise-filter/i);
  });
});
