import { describe, it, expect } from "vitest";
import { translateUltravoxApiParams } from "../livekit";

describe("translateUltravoxApiParams", () => {
  it("maps voice slug to LiveKit voice config", () => {
    const out = translateUltravoxApiParams({
      voice: "lise-warm-no",
      language_hint: "no",
      first_speaker: "agent",
      inactivity_timeout: 30000,
    });

    expect(out).toMatchObject({
      voiceId: "lise-warm-no",
      language: "no",
      initialSpeaker: "agent",
      sessionTimeoutMs: 30000,
    });
  });

  it("defaults language to 'no' when language_hint missing", () => {
    const out = translateUltravoxApiParams({ voice: "lise-warm-no" });
    expect(out.language).toBe("no");
  });

  it("defaults initialSpeaker to 'user' when first_speaker missing", () => {
    const out = translateUltravoxApiParams({ voice: "lise-warm-no" });
    expect(out.initialSpeaker).toBe("user");
  });

  it("defaults sessionTimeoutMs to 60000 when inactivity_timeout missing", () => {
    const out = translateUltravoxApiParams({ voice: "lise-warm-no" });
    expect(out.sessionTimeoutMs).toBe(60_000);
  });

  it("rejects invalid first_speaker enum", () => {
    expect(() =>
      translateUltravoxApiParams({
        voice: "lise-warm-no",
        first_speaker: "invalid" as never,
      }),
    ).toThrow(/first_speaker/);
  });

  it("rejects negative inactivity_timeout", () => {
    expect(() =>
      translateUltravoxApiParams({
        voice: "lise-warm-no",
        inactivity_timeout: -100,
      }),
    ).toThrow(/inactivity_timeout/);
  });
});
