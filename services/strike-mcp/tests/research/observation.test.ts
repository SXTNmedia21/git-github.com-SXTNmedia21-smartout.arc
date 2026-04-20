import { describe, it, expect } from "vitest";
import { observe, observeWithSidecar } from "../../src/research/observation.js";
import type { BubbleRecord } from "../../src/bubble/types.js";

describe("observe (default: redacted mode)", () => {
  it("returns zero totals and empty fields for an empty record set", () => {
    const result = observe([]);
    expect(result).toEqual({ totalRecords: 0, fields: {} });
  });

  it("counts occurrences across records", () => {
    const records: BubbleRecord[] = [
      { _id: "1", name: "Alpha" },
      { _id: "2", name: "Beta" },
      { _id: "3", name: "Gamma" },
    ];
    const result = observe(records);
    expect(result.totalRecords).toBe(3);
    expect(result.fields._id.occurrences).toBe(3);
    expect(result.fields.name.occurrences).toBe(3);
  });

  it("treats null and undefined as non-occurrence", () => {
    const records: BubbleRecord[] = [
      { _id: "1", name: "Alpha", maybe: null },
      { _id: "2", name: "Beta", maybe: undefined },
      { _id: "3", name: "Gamma", maybe: "present" },
    ];
    const result = observe(records);
    expect(result.fields.maybe.occurrences).toBe(1);
    expect(result.fields.maybe.valueTypes).toEqual(["string"]);
    // In redacted mode, "present" → "string<7>"
    expect(result.fields.maybe.sampleValues).toEqual(["string<7>"]);
  });

  it("does not register a field that is null in every record", () => {
    const records: BubbleRecord[] = [
      { _id: "1", ghost: null },
      { _id: "2", ghost: null },
    ];
    const result = observe(records);
    expect(result.fields.ghost).toBeUndefined();
  });

  it("captures distinct value types, deduped and sorted", () => {
    const records: BubbleRecord[] = [
      { _id: "1", mixed: "text" },
      { _id: "2", mixed: 42 },
      { _id: "3", mixed: true },
      { _id: "4", mixed: "more text" },
      { _id: "5", mixed: 7 },
    ];
    const result = observe(records);
    expect(result.fields.mixed.occurrences).toBe(5);
    expect(result.fields.mixed.valueTypes).toEqual([
      "boolean",
      "number",
      "string",
    ]);
  });

  it("classifies arrays and objects distinctly", () => {
    const records: BubbleRecord[] = [
      { _id: "1", payload: [1, 2, 3] },
      { _id: "2", payload: { nested: true } },
    ];
    const result = observe(records);
    expect(result.fields.payload.valueTypes).toEqual(["array", "object"]);
  });

  it("captures up to 3 distinct sample values in redacted form", () => {
    const records: BubbleRecord[] = [
      { _id: "1", color: "red" },
      { _id: "2", color: "red" },
      { _id: "3", color: "blue" },
      { _id: "4", color: "green" },
      { _id: "5", color: "yellow" },
    ];
    const result = observe(records);
    // "red"(3), "blue"(4), "green"(5) — redacted as string<N>
    expect(result.fields.color.sampleValues).toEqual([
      "string<3>",
      "string<4>",
      "string<5>",
    ]);
    expect(result.fields.color.occurrences).toBe(5);
  });

  it("handles fields that appear only on some records", () => {
    const records: BubbleRecord[] = [
      { _id: "1", name: "A", optional: "x" },
      { _id: "2", name: "B" },
      { _id: "3", name: "C", optional: "y" },
    ];
    const result = observe(records);
    expect(result.fields.name.occurrences).toBe(3);
    expect(result.fields.optional.occurrences).toBe(2);
    expect(result.totalRecords).toBe(3);
  });

  it("is pure: does not mutate input records", () => {
    const records: BubbleRecord[] = [
      { _id: "1", name: "Alpha", tags: ["a", "b"] },
    ];
    const snapshot = JSON.parse(JSON.stringify(records));
    observe(records);
    expect(records).toEqual(snapshot);
  });

  it("redacts strings to string<N> with correct length", () => {
    const records: BubbleRecord[] = [{ _id: "1", word: "hello" }];
    const result = observe(records);
    expect(result.fields.word.sampleValues).toEqual(["string<5>"]);
  });

  it("redacts numbers to 'number'", () => {
    const records: BubbleRecord[] = [{ _id: "1", count: 42 }];
    const result = observe(records);
    expect(result.fields.count.sampleValues).toEqual(["number"]);
  });

  it("redacts booleans to 'boolean'", () => {
    const records: BubbleRecord[] = [{ _id: "1", active: true }];
    const result = observe(records);
    expect(result.fields.active.sampleValues).toEqual(["boolean"]);
  });

  it("redacts arrays to array<N> with correct element count", () => {
    const records: BubbleRecord[] = [{ _id: "1", tags: ["a", "b", "c"] }];
    const result = observe(records);
    expect(result.fields.tags.sampleValues).toEqual(["array<3>"]);
  });

  it("redacts objects to 'object'", () => {
    const records: BubbleRecord[] = [{ _id: "1", meta: { x: 1 } }];
    const result = observe(records);
    expect(result.fields.meta.sampleValues).toEqual(["object"]);
  });
});

describe("observe (raw mode)", () => {
  it("preserves raw values when mode is 'raw'", () => {
    const records: BubbleRecord[] = [
      { _id: "1", name: "Alpha" },
      { _id: "2", name: "Beta" },
    ];
    const result = observe(records, "raw");
    expect(result.fields.name.sampleValues).toEqual(["Alpha", "Beta"]);
  });
});

describe("observe (sidecar mode)", () => {
  it("redacts values in the main observation in sidecar mode", () => {
    const records: BubbleRecord[] = [{ _id: "1", name: "Alpha" }];
    const result = observe(records, "sidecar");
    expect(result.fields.name.sampleValues).toEqual(["string<5>"]);
  });
});

describe("observeWithSidecar", () => {
  it("returns redacted observation and raw sidecar", () => {
    const records: BubbleRecord[] = [
      { _id: "1", name: "Alpha" },
      { _id: "2", name: "Beta" },
    ];
    const { observation, sidecar } = observeWithSidecar(records);
    // observation is redacted
    expect(observation.fields.name.sampleValues).toEqual(["string<5>", "string<4>"]);
    // sidecar holds raw values
    expect(sidecar.name).toEqual(["Alpha", "Beta"]);
  });

  it("sidecar contains up to 3 raw values per field", () => {
    const records: BubbleRecord[] = [
      { _id: "1", color: "red" },
      { _id: "2", color: "blue" },
      { _id: "3", color: "green" },
      { _id: "4", color: "yellow" },
    ];
    const { sidecar } = observeWithSidecar(records);
    expect(sidecar.color).toHaveLength(3);
    expect(sidecar.color).toContain("red");
  });
});
