import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkIntentCoverage,
  computeCoverageReport,
  extractRegisteredCapabilities,
  extractIntentEnumValues,
  DOCUMENTED_TOOLLESS,
} from "../check-intent-coverage.js";

const thisDir = dirname(fileURLToPath(import.meta.url));
const positiveRoot = join(thisDir, "fixtures/intent-coverage/positive");
const missingRoot = join(thisDir, "fixtures/intent-coverage/missing-in-enum");
const orphanRoot = join(thisDir, "fixtures/intent-coverage/orphan-in-enum");

describe("extractRegisteredCapabilities", () => {
  it("parses the capability keys from the registry record literal", () => {
    const src = `
const capabilities: Record<string, CapabilityDefinition> = {
  profile: profileCapability,
  "schedule": scheduleCapability,
  ui: uiCapability, // trailing line comment
};
`;
    expect(extractRegisteredCapabilities(src).sort()).toEqual(["profile", "schedule", "ui"]);
  });

  it("ignores commented-out keys", () => {
    const src = `
const capabilities: Record<string, CapabilityDefinition> = {
  profile: profileCapability,
  // deprecated: oldCapability,
  /* future_capability: future, */
  ui: uiCapability,
};
`;
    expect(extractRegisteredCapabilities(src).sort()).toEqual(["profile", "ui"]);
  });

  it("throws with a helpful message when the declaration is missing", () => {
    expect(() => extractRegisteredCapabilities("export const x = 1;")).toThrowError(
      /could not locate `const capabilities`/,
    );
  });
});

describe("extractIntentEnumValues", () => {
  it("parses enum values from z.enum([...]) inside intentSchema", () => {
    const src = `
export const intentSchema = z.object({
  intent: z.string(),
  capability: z.enum([
    "profile",
    "schedule",
    "general",
  ] as const),
});
`;
    expect(extractIntentEnumValues(src).sort()).toEqual(["general", "profile", "schedule"]);
  });

  it("throws with a helpful message when the enum is missing", () => {
    expect(() => extractIntentEnumValues("export const x = 1;")).toThrowError(
      /could not locate `capability: z.enum/,
    );
  });
});

describe("computeCoverageReport", () => {
  it("returns ok when registered + enum are aligned and allow-list covers extras", () => {
    const report = computeCoverageReport(
      ["profile", "schedule"],
      ["profile", "schedule", "knowledge", "general"],
    );
    expect(report.ok).toBe(true);
    expect(report.missingInEnum).toEqual([]);
    expect(report.orphanInEnum).toEqual([]);
  });

  it("flags a registered capability that the enum does not know about", () => {
    const report = computeCoverageReport(
      ["profile", "schedule", "shift_lifecycle"],
      ["profile", "schedule", "general"],
    );
    expect(report.ok).toBe(false);
    expect(report.missingInEnum).toEqual(["shift_lifecycle"]);
    expect(report.orphanInEnum).toEqual([]);
  });

  it("flags an enum value that is neither registered nor allow-listed", () => {
    const report = computeCoverageReport(
      ["profile"],
      ["profile", "phantom_capability", "knowledge", "general"],
    );
    expect(report.ok).toBe(false);
    expect(report.missingInEnum).toEqual([]);
    expect(report.orphanInEnum).toEqual(["phantom_capability"]);
  });

  it("treats `general` as always intentional", () => {
    expect(DOCUMENTED_TOOLLESS.has("general")).toBe(true);
  });

  it("treats `knowledge` and `payroll` as documented tool-less fall-throughs", () => {
    expect(DOCUMENTED_TOOLLESS.has("knowledge")).toBe(true);
    expect(DOCUMENTED_TOOLLESS.has("payroll")).toBe(true);
  });
});

describe("checkIntentCoverage (end-to-end with fixtures)", () => {
  it("returns ok for a clean positive fixture", () => {
    const report = checkIntentCoverage({ srcRoot: positiveRoot });
    expect(report.ok).toBe(true);
    expect(report.missingInEnum).toEqual([]);
    expect(report.orphanInEnum).toEqual([]);
  });

  it("reports missingInEnum when a registered capability is not in the enum", () => {
    const report = checkIntentCoverage({ srcRoot: missingRoot });
    expect(report.ok).toBe(false);
    expect(report.missingInEnum).toContain("shift_lifecycle");
  });

  it("reports orphanInEnum when an enum value has no matching registration", () => {
    const report = checkIntentCoverage({ srcRoot: orphanRoot });
    expect(report.ok).toBe(false);
    expect(report.orphanInEnum).toContain("phantom_capability");
  });
});
