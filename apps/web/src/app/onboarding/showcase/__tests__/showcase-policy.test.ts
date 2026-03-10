import { describe, it, expect } from "vitest";
import { canSpeak, getCapabilityState, getPolicySummary } from "../lib/showcase-policy";

describe("showcase policy", () => {
  it("blocks speech when manual toggle is off", () => {
    expect(canSpeak({ voiceEnabled: false, hasManualTrigger: true })).toBe(false);
  });

  it("allows speech only with manual trigger", () => {
    expect(canSpeak({ voiceEnabled: true, hasManualTrigger: true })).toBe(true);
    expect(canSpeak({ voiceEnabled: true, hasManualTrigger: false })).toBe(false);
  });

  it("returns capability state map", () => {
    const state = getCapabilityState({ hasScrapeUrl: true, manualSpeech: true });
    expect(state.fetch).toBe("enabled");
    expect(state.speech).toBe("manual");
  });

  it("creates policy summary for UI", () => {
    expect(getPolicySummary({ manualSpeech: true })).toContain("manual");
  });
});
