// packages/ai/src/capabilities/legal/__tests__/tools.test.ts
//
// Unit tests for Phase 0c legal capability tool stubs.
// Verifies integration shape: schema validation, output structure,
// channel guard, and emit contract. Does NOT test Lovdata MCP logic
// (Phase 0c+ work). Real validator coverage is in test-corpus (Phase 0c+).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateAml146, classifyAmendment } from "../tools.js";
import type { AgentToolContext } from "../../types.js";
import type { NonEmptyString } from "@smartout/telemetry/server";

// Minimal AgentToolContext for route-invocation shape (mirrors publish-mission.ts pattern)
function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: "00000000-0000-0000-0000-000000000001" as NonEmptyString,
    profileId: "00000000-0000-0000-0000-000000000002" as NonEmptyString,
    userId: "user-abc",
    sessionId: "test-session",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabaseAdmin: {} as any,
    channel: "system",
    ...overrides,
  };
}

// Suppress telemetry emit in tests
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  nonEmpty: (v: string) => v,
}));

describe("validateAml146 (Phase 0c stub)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pass=true for any contract_id in stub mode (channel=system)", async () => {
    const ctx = makeCtx({ channel: "system" });
    const raw = await validateAml146.execute(
      { contract_id: "11111111-1111-1111-1111-111111111111", validation_mode: "strict" },
      ctx,
    );

    const result = JSON.parse(raw) as {
      pass: boolean;
      status: string;
      errors: unknown[];
      warnings: unknown[];
      validator_version: string;
    };

    expect(result.pass).toBe(true);
    expect(result.status).toBe("passes");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.validator_version).toBe("aml-14-6-2024-07-stub");
  });

  it("returns pass=true for channel=chat (primary Botsson surface)", async () => {
    const ctx = makeCtx({ channel: "chat" });
    const raw = await validateAml146.execute(
      { contract_id: "22222222-2222-2222-2222-222222222222", validation_mode: "advisory" },
      ctx,
    );

    const result = JSON.parse(raw) as { pass: boolean };
    expect(result.pass).toBe(true);
  });

  it("blocks voice channel (ADR-0078 Layer 3 guard)", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const raw = await validateAml146.execute(
      { contract_id: "33333333-3333-3333-3333-333333333333", validation_mode: "strict" },
      ctx,
    );

    const result = JSON.parse(raw) as {
      pass: boolean;
      errors: Array<{ paragraph: string }>;
    };

    expect(result.pass).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.paragraph).toBe("ADR-0078");
  });

  it("returns parseable JSON from send-route integration shape", async () => {
    // This test mirrors exactly the JSON.parse block in /api/contracts/send.
    const ctx = makeCtx({ channel: "system" });
    const aml146Raw = await validateAml146.execute(
      { contract_id: "44444444-4444-4444-4444-444444444444", validation_mode: "strict" },
      ctx,
    );

    let aml146Result: {
      pass?: boolean;
      status?: string;
      errors?: Array<{ severity: string; paragraph: string }>;
    };
    expect(() => {
      aml146Result = JSON.parse(aml146Raw) as typeof aml146Result;
    }).not.toThrow();

    // The route's 422 branch fires when pass===false; must not fire on stub.
    expect(aml146Result!.pass).not.toBe(false);
  });
});

describe("classifyAmendment (Phase 0c stub)", () => {
  it("classifies each field_change and returns stub classification", async () => {
    const ctx = makeCtx({ channel: "system" });
    const raw = await classifyAmendment.execute(
      {
        contract_id: "55555555-5555-5555-5555-555555555555",
        field_changes: [
          { column: "monthly_salary", from: 32000, to: 35000 },
          { column: "job_title", from: "Servitør", to: "Hovmester" },
        ],
      },
      ctx,
    );

    const result = JSON.parse(raw) as {
      classifications: Array<{
        classification: string;
        requires_resigning: boolean;
        confidence: string;
      }>;
    };

    expect(result.classifications).toHaveLength(2);
    // Stub returns "admin" for all — real logic is Phase 0c+
    for (const c of result.classifications) {
      expect(c.classification).toBe("admin");
      expect(c.requires_resigning).toBe(false);
      expect(c.confidence).toBe("LAV");
    }
  });

  it("blocks non-system channels (server-only tool, ADR-0078)", async () => {
    const ctx = makeCtx({ channel: "chat" });
    const raw = await classifyAmendment.execute(
      {
        contract_id: "66666666-6666-6666-6666-666666666666",
        field_changes: [{ column: "monthly_salary", from: 30000, to: 31000 }],
      },
      ctx,
    );

    const result = JSON.parse(raw) as { error?: string; adr?: string };
    expect(result.error).toContain("system-kanal");
    expect(result.adr).toBe("ADR-0078");
  });
});
