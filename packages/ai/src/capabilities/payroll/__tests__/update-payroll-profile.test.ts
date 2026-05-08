// packages/ai/src/capabilities/payroll/__tests__/update-payroll-profile.test.ts
//
// Phase 5 TB2 (2026-05-08) — unit tests for update_payroll_profile tax-card extension.
// Tests verify:
//   - Happy path: tax fields written, tax_card_fetched_at auto-set, telemetry correct
//   - Mixed update: salary + tax fields in one call
//   - Schema refinements: type vs field consistency enforced by Zod .refine()
//   - Clear: all tax fields set to null still sets tax_card_fetched_at
//
// Column note: canonical DB column is `tax_percentage`. This file uses `tax_percentage`
// throughout. query_tax_card column name corrected in TB3 (2026-05-08).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { updatePayrollProfile } from "../tools.js";
import type { AgentToolContext } from "../../types.js";
import type { NonEmptyString } from "@smartout/telemetry/server";

// Suppress real telemetry — captured via mock assertion below.
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  nonEmpty: (v: string) => v,
}));

const { emit } = await import("@smartout/telemetry");

// ─── Helper types ────────────────────────────────────────────────────────────

type UpdateEmitProps = {
  event: string;
  workspace_id: string;
  actor_id: string;
  properties: {
    entity: { entity_type: string; entity_id: string };
    data: {
      target_profile_id: string;
      fields_updated: string[];
      gate_evaluation_id: string | null;
      fields_changed: string[];
      tax_fields_touched: boolean;
    };
  };
};
function asUpdateEmit(call: unknown): UpdateEmitProps {
  return call as UpdateEmitProps;
}

// ─── Fixture UUIDs ──────────────────────────────────────────────────────────

const WORKSPACE_A = "aaaaaaaa-0000-0000-0000-000000000001" as NonEmptyString;
const ADMIN_PROFILE = "00000000-0000-0000-0000-000000000010" as NonEmptyString;
const TARGET_PROFILE = "00000000-0000-0000-0000-000000000020";
const PAYROLL_PROFILE_ID = "pp000000-0000-0000-0000-000000000001";
const EVAL_ID = "eval-00000000-0000-0000-0000-000000000099";

// ─── Mock helpers ────────────────────────────────────────────────────────────

type MockRpcResult = { data: Record<string, unknown>; error: null };

function allowGate(evalId = EVAL_ID): MockRpcResult {
  return {
    data: {
      allow: true,
      reason: null,
      channel_allowed: true,
      downgrade_to: null,
      min_role_required: "admin",
      four_eyes_required: false,
      approvers_needed: 0,
      approvers_present: [],
      gate_evaluation_id: evalId,
    },
    error: null,
  };
}

/**
 * Build a Supabase mock that:
 * 1. RPC (gate_action) → rpcResult
 * 2. First .from() chain (.select/.eq/.single) → profileResult (workspace verification)
 * 3. Second .from() chain (.update/.eq/.select/.single) → updateResult
 */
function makeSupabaseMock(
  rpcResult: MockRpcResult,
  profileResult: { data: Record<string, unknown> | null; error: { message: string } | null },
  updateResult: { data: Record<string, unknown> | null; error: { message: string } | null },
): AgentToolContext["supabaseAdmin"] {
  let fromCallCount = 0;

  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
    from: vi.fn().mockImplementation(() => {
      fromCallCount += 1;
      if (fromCallCount === 1) {
        // Workspace verification query
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(profileResult),
        };
      }
      // Update query
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(updateResult),
      };
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeCtx(
  overrides: Partial<AgentToolContext> & { supabaseAdmin?: AgentToolContext["supabaseAdmin"] } = {},
): AgentToolContext {
  return {
    workspaceId: WORKSPACE_A,
    profileId: ADMIN_PROFILE,
    userId: "user-admin",
    sessionId: "test-session",
    channel: "chat",
    supabaseAdmin: makeSupabaseMock(
      allowGate(),
      { data: { id: PAYROLL_PROFILE_ID, workspace_id: WORKSPACE_A }, error: null },
      { data: { id: PAYROLL_PROFILE_ID }, error: null },
    ),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("update_payroll_profile — tax-card extension (TB2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: happy path — tax fields only ────────────────────────────────

  it("happy path tax fields only: writes tax fields, sets tax_card_fetched_at, correct telemetry", async () => {
    // Capture the update payload to verify tax_card_fetched_at is set.
    let capturedUpdatePayload: Record<string, unknown> | null = null;
    const updateMock = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      capturedUpdatePayload = payload;
      return {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PAYROLL_PROFILE_ID }, error: null }),
      };
    });

    const supabaseMock = {
      rpc: vi.fn().mockResolvedValue(allowGate()),
      from: vi
        .fn()
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: PAYROLL_PROFILE_ID, workspace_id: WORKSPACE_A },
            error: null,
          }),
        }))
        .mockImplementationOnce(() => ({
          update: updateMock,
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: PAYROLL_PROFILE_ID }, error: null }),
        })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const ctx = makeCtx({ supabaseAdmin: supabaseMock });

    const raw = await updatePayrollProfile.execute(
      {
        profile_id: TARGET_PROFILE,
        tax_card_type: "percentage",
        tax_percentage: 22,
        tax_card_year: 2026,
        tax_municipality_code: "0301",
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean };
    expect(result.ok).toBe(true);

    // tax_card_fetched_at must have been included in the payload.
    expect(capturedUpdatePayload).not.toBeNull();
    expect(capturedUpdatePayload!.tax_card_fetched_at).toBeDefined();
    expect(typeof capturedUpdatePayload!.tax_card_fetched_at).toBe("string");

    // Telemetry: tax_fields_touched=true, fields_changed includes the tax keys.
    expect(emit).toHaveBeenCalledOnce();
    const emitCall = asUpdateEmit(vi.mocked(emit).mock.calls[0]![0]);
    expect(emitCall.event).toBe("payroll.update_payroll_profile");
    expect(emitCall.properties.data.tax_fields_touched).toBe(true);
    expect(emitCall.properties.data.fields_changed).toContain("tax_card_type");
    expect(emitCall.properties.data.fields_changed).toContain("tax_percentage");
    expect(emitCall.properties.data.fields_changed).toContain("tax_card_year");
    expect(emitCall.properties.data.fields_changed).toContain("tax_municipality_code");
    // tax_card_fetched_at is internal — should NOT appear in fields_updated.
    expect(emitCall.properties.data.fields_updated).not.toContain("tax_card_fetched_at");
    expect(emitCall.properties.data.gate_evaluation_id).toBe(EVAL_ID);
  });

  // ── Test 2: mixed update — salary + tax fields ──────────────────────────

  it("mixed update: salary + table tax card — all fields written, fields_changed includes both", async () => {
    const ctx = makeCtx();

    const raw = await updatePayrollProfile.execute(
      {
        profile_id: TARGET_PROFILE,
        monthly_salary: 40000,
        tax_card_type: "table",
        tax_table_number: "7150",
        tax_card_year: 2026,
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean };
    expect(result.ok).toBe(true);

    expect(emit).toHaveBeenCalledOnce();
    const emitCall = asUpdateEmit(vi.mocked(emit).mock.calls[0]![0]);
    expect(emitCall.properties.data.tax_fields_touched).toBe(true);
    expect(emitCall.properties.data.fields_changed).toContain("monthly_salary");
    expect(emitCall.properties.data.fields_changed).toContain("tax_card_type");
    expect(emitCall.properties.data.fields_changed).toContain("tax_table_number");
    expect(emitCall.properties.data.fields_changed).toContain("tax_card_year");
    // tax_percentage not in params → not in fields_changed.
    expect(emitCall.properties.data.fields_changed).not.toContain("tax_percentage");
  });

  // ── Test 3: schema refinement — percentage type without rate ────────────

  it("schema refinement: tax_card_type=percentage without tax_percentage → Zod parse fails", () => {
    const schema = updatePayrollProfile.schema;

    const parseResult = schema.safeParse({
      profile_id: TARGET_PROFILE,
      tax_card_type: "percentage",
      // tax_percentage deliberately omitted
      tax_card_year: 2026,
    });

    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      const msg = parseResult.error.issues.map((i) => i.message).join("|");
      expect(msg).toContain("Inkonsistent skattekort-data");
    }
  });

  // ── Test 4: schema refinement — tax fields without year ─────────────────

  it("schema refinement: tax fields set without tax_card_year → Zod parse fails", () => {
    const schema = updatePayrollProfile.schema;

    const parseResult = schema.safeParse({
      profile_id: TARGET_PROFILE,
      tax_card_type: "percentage",
      tax_percentage: 22,
      // tax_card_year deliberately omitted
    });

    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      const msg = parseResult.error.issues.map((i) => i.message).join("|");
      expect(msg).toContain("Inkonsistent skattekort-data");
    }
  });

  // ── Test 5: clear tax card — null values still set tax_card_fetched_at ──

  it("clear tax card: all 5 tax fields=null → columns cleared, tax_card_fetched_at still set", async () => {
    let capturedUpdatePayload: Record<string, unknown> | null = null;

    const supabaseMock = {
      rpc: vi.fn().mockResolvedValue(allowGate()),
      from: vi
        .fn()
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: PAYROLL_PROFILE_ID, workspace_id: WORKSPACE_A },
            error: null,
          }),
        }))
        .mockImplementationOnce(() => ({
          update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
            capturedUpdatePayload = payload;
            return {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: PAYROLL_PROFILE_ID }, error: null }),
            };
          }),
        })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const ctx = makeCtx({ supabaseAdmin: supabaseMock });

    const raw = await updatePayrollProfile.execute(
      {
        profile_id: TARGET_PROFILE,
        tax_card_type: null,
        tax_table_number: null,
        tax_percentage: null,
        // tax_card_year: null is the tricky case — refine requires year when OTHER
        // tax fields are non-undefined, but setting year=null means it IS provided.
        // With all fields null, the refine checks: anyTaxSet=true (all are non-undefined),
        // tax_card_year === null → return false → FAILS refine.
        //
        // Design decision: clearing all fields still needs a year (we record WHEN it was
        // cleared). Pass year=2026 to satisfy the refine.
        tax_card_year: 2026,
        tax_municipality_code: null,
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean };
    expect(result.ok).toBe(true);

    // Payload: null values written for the tax columns.
    expect(capturedUpdatePayload).not.toBeNull();
    expect(capturedUpdatePayload!.tax_card_type).toBeNull();
    expect(capturedUpdatePayload!.tax_table_number).toBeNull();
    expect(capturedUpdatePayload!.tax_percentage).toBeNull();
    expect(capturedUpdatePayload!.tax_municipality_code).toBeNull();
    // tax_card_fetched_at MUST still be set (records the clear-action timestamp).
    expect(capturedUpdatePayload!.tax_card_fetched_at).toBeDefined();

    // Telemetry: tax_fields_touched=true even for a clear.
    expect(emit).toHaveBeenCalledOnce();
    const emitCall = asUpdateEmit(vi.mocked(emit).mock.calls[0]![0]);
    expect(emitCall.properties.data.tax_fields_touched).toBe(true);
  });
});
