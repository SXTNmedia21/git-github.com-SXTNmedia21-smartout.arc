// apps/journey-control/src/lib/__tests__/ir-ts-emitter.test.ts
import { describe, it, expect } from "vitest";
import { emitIRToTypescript } from "../ir-ts-emitter";
import type { JourneyIR } from "@smartout/journey-ir";

describe("emitIRToTypescript", () => {
  it("produces a valid TS module exporting the IR const", () => {
    const ir: JourneyIR = {
      version: "2.0.0",
      slug: "P-002",
      title: "Test",
      module: "test",
      steps: [],
    };
    const ts = emitIRToTypescript(ir);
    expect(ts).toContain('import type { JourneyIR } from "@smartout/journey-ir"');
    expect(ts).toContain("export const P002");
    expect(ts).toContain('"2.0.0"');
    expect(ts).toContain('"P-002"');
  });

  it("emits valid identifier for hyphenated slug", () => {
    const ir: JourneyIR = {
      version: "2.0.0",
      slug: "P-002",
      title: "Test",
      module: "test",
      steps: [],
    };
    const ts = emitIRToTypescript(ir);
    // Identifier must be P002 (no hyphen)
    expect(ts).toMatch(/export const P002[^_]/);
  });
});
