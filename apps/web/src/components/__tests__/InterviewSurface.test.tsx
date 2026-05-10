import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("InterviewSurface", () => {
  const source = readFileSync(join(__dirname, "../voice-assistant.tsx"), "utf8");

  it("does not import UltravoxSession", () => {
    expect(source).not.toMatch(/UltravoxSession|ultravox-client/);
  });

  it("exports InterviewSurface as a named export", () => {
    expect(source).toMatch(/export function InterviewSurface|export \{ InterviewSurface \}/);
  });
});
