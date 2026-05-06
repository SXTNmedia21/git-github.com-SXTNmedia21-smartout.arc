// apps/e2e/runners/__tests__/speed-profile.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveRuntimeSpeedProfile } from "../speed-profile-env";

describe("resolveRuntimeSpeedProfile", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.JOURNEY_SPEED_PROFILE;
    delete process.env.JOURNEY_SPEED_PROFILE;
  });

  afterEach(() => {
    if (originalEnv !== undefined) process.env.JOURNEY_SPEED_PROFILE = originalEnv;
  });

  it("env var wins over IR profile", () => {
    process.env.JOURNEY_SPEED_PROFILE = "normal";
    expect(resolveRuntimeSpeedProfile("ai_companion")).toBe("normal");
  });

  it("IR profile wins when no env var", () => {
    expect(resolveRuntimeSpeedProfile("ai_companion")).toBe("ai_companion");
  });

  it("falls back to full when neither set", () => {
    expect(resolveRuntimeSpeedProfile(undefined)).toBe("full");
  });

  it("ignores invalid env var, falls back to IR", () => {
    process.env.JOURNEY_SPEED_PROFILE = "turbo";
    expect(resolveRuntimeSpeedProfile("normal")).toBe("normal");
  });
});
