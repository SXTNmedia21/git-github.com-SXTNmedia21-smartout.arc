import { describe, it, expect } from "vitest";
import {
  DeviationPayloadSchema,
  deviationDomainValues,
  deviationSeverityValues,
} from "@smartout/hms";

describe("DeviationPayloadSchema", () => {
  const validPayload = {
    title: "Kjoleskap over grenseverdi",
    domain: "safety" as const,
    severity: "critical" as const,
    workspace_id: "b0000000-0000-0000-0000-000000000000",
  };

  it("accepts a valid minimal payload", () => {
    const result = DeviationPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts a full payload with all optional fields", () => {
    const result = DeviationPayloadSchema.safeParse({
      ...validPayload,
      description: "Temperatur malt til 8.1C",
      department_id: "d0000000-0000-0000-0000-000000000001",
      session_id: "af000000-0000-0000-0000-000000000003",
      source_task_id: "ad000000-0000-0000-0000-000000000003",
      procedure_id: "c3000000-0000-0000-0000-000000000002",
      protocol_id: "c2000000-0000-0000-0000-000000000001",
      linked_shift_id: null,
      reported_by: "f0000000-0000-0000-0000-000000000001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = DeviationPayloadSchema.safeParse({
      ...validPayload,
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const { title, ...noTitle } = validPayload;
    const result = DeviationPayloadSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it("rejects invalid domain", () => {
    const result = DeviationPayloadSchema.safeParse({
      ...validPayload,
      domain: "invalid_domain",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid severity", () => {
    const result = DeviationPayloadSchema.safeParse({
      ...validPayload,
      severity: "extreme",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing workspace_id", () => {
    const { workspace_id, ...noWs } = validPayload;
    const result = DeviationPayloadSchema.safeParse(noWs);
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID workspace_id", () => {
    const result = DeviationPayloadSchema.safeParse({
      ...validPayload,
      workspace_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts null optional link fields", () => {
    const result = DeviationPayloadSchema.safeParse({
      ...validPayload,
      department_id: null,
      session_id: null,
      source_task_id: null,
      procedure_id: null,
      protocol_id: null,
      linked_shift_id: null,
      reported_by: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects description over 2000 chars", () => {
    const result = DeviationPayloadSchema.safeParse({
      ...validPayload,
      description: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe("deviation enum values", () => {
  it("domain values match DB enum", () => {
    expect(deviationDomainValues).toEqual([
      "safety",
      "customer",
      "procedure",
      "system",
      "material",
    ]);
  });

  it("severity values match DB enum", () => {
    expect(deviationSeverityValues).toEqual(["low", "medium", "high", "critical"]);
  });
});
