// packages/ai/src/capabilities/payroll/__tests__/view-pii.test.ts
//
// Phase 5 (2026-05-08) — unit tests for view_personal_number and view_bank_account
// full-reveal bodies. Tests verify:
//   - ADR-0151 workspace-scoped forgery defence (cross-workspace returns not_found)
//   - ADR-0077 audit-emit fires on EVERY reveal attempt (success, null-value, cross-workspace,
//     AND gate-denial — was_revealed=false on blocked paths, true only when value sent to caller)
//   - is_self flag propagated correctly for self-access path
//
// Does NOT test Supabase network calls or pgsodium — tools.ts reads plaintext
// from profile.personal_number / profile.bank_account (pre-existing tech debt).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { viewPersonalNumber, viewBankAccount } from "../tools.js";
import type { AgentToolContext } from "../../types.js";
import type { NonEmptyString } from "@smartout/telemetry/server";

// Suppress real telemetry — captured via mock assertion below.
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  nonEmpty: (v: string) => v,
}));

// Import emit AFTER mock registration so we get the mock reference.
const { emit } = await import("@smartout/telemetry");

// Helper: cast emit call argument to the PII reveal shape so tsc can
// access .properties.data without narrowing the full SmartoutEvent union.
type PiiRevealProps = {
  event: string;
  workspace_id: string;
  actor_id: string;
  properties: {
    entity: { entity_type: string; entity_id: string };
    data: {
      target_profile_id: string;
      is_self: boolean;
      gate_evaluation_id: string | null;
      was_revealed: boolean;
    };
  };
};
function asPiiEmit(call: unknown): PiiRevealProps {
  return call as PiiRevealProps;
}

// ─── Fixture UUIDs ──────────────────────────────────────────────────────────

const WORKSPACE_A = "aaaaaaaa-0000-0000-0000-000000000001" as NonEmptyString;
const WORKSPACE_B = "bbbbbbbb-0000-0000-0000-000000000002" as NonEmptyString;
const ADMIN_PROFILE = "00000000-0000-0000-0000-000000000010" as NonEmptyString;
const TARGET_PROFILE = "00000000-0000-0000-0000-000000000020" as NonEmptyString;
const EVAL_ID = "eval-00000000-0000-0000-0000-000000000099";

// ─── Mock helpers ───────────────────────────────────────────────────────────

type MockRpcResult = {
  data: Record<string, unknown>;
  error: null;
};

/** Build a gate_action RPC mock that allows the call. */
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

/** Build a gate_action RPC mock that denies. */
function denyGate(reason = "min_role_failed"): MockRpcResult {
  return {
    data: {
      allow: false,
      reason,
      channel_allowed: true,
      downgrade_to: null,
      min_role_required: "admin",
      four_eyes_required: false,
      approvers_needed: 0,
      approvers_present: [],
      gate_evaluation_id: null,
    },
    error: null,
  };
}

/**
 * Build a Supabase builder chain mock that terminates in `.single()`.
 * `singleResult` is what `.single()` resolves to.
 */
function makeSupabaseMock(
  rpcResult: MockRpcResult,
  singleResult: { data: Record<string, unknown> | null; error: { message: string } | null },
): AgentToolContext["supabaseAdmin"] {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(singleResult),
  };

  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
    from: vi.fn().mockReturnValue(builder),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/** Minimal AgentToolContext for payroll PII reveal tests. */
function makeCtx(
  overrides: Partial<AgentToolContext> & {
    supabaseAdmin?: AgentToolContext["supabaseAdmin"];
  } = {},
): AgentToolContext {
  return {
    workspaceId: WORKSPACE_A,
    profileId: ADMIN_PROFILE,
    userId: "user-admin",
    sessionId: "test-session",
    channel: "chat",
    supabaseAdmin: makeSupabaseMock(allowGate(), {
      data: {
        personal_number: "01010112345",
        bank_account: "1234.56.78901",
        workspace_id: WORKSPACE_A,
      },
      error: null,
    }),
    ...overrides,
  };
}

// ─── view_personal_number ────────────────────────────────────────────────────

describe("view_personal_number", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path admin: reveals full personal_number + emits audit event with was_revealed=true", async () => {
    const ctx = makeCtx({
      supabaseAdmin: makeSupabaseMock(allowGate(), {
        data: { personal_number: "01010112345", workspace_id: WORKSPACE_A },
        error: null,
      }),
    });

    const raw = await viewPersonalNumber.execute({ profile_id: TARGET_PROFILE }, ctx);
    const result = JSON.parse(raw) as {
      ok: boolean;
      value: string;
      is_self: boolean;
      has_value: boolean;
      gate_evaluation_id: string;
    };

    expect(result.ok).toBe(true);
    expect(result.value).toBe("01010112345");
    expect(result.has_value).toBe(true);
    expect(result.is_self).toBe(false); // admin != target
    expect(result.gate_evaluation_id).toBe(EVAL_ID);

    expect(emit).toHaveBeenCalledOnce();
    const emitCall = asPiiEmit(vi.mocked(emit).mock.calls[0]![0]);
    expect(emitCall.event).toBe("payroll.personal_number_revealed");
    expect(emitCall.workspace_id).toBe(WORKSPACE_A);
    expect(emitCall.actor_id).toBe(ADMIN_PROFILE);
    expect(emitCall.properties.data.target_profile_id).toBe(TARGET_PROFILE);
    expect(emitCall.properties.data.is_self).toBe(false);
    expect(emitCall.properties.data.gate_evaluation_id).toBe(EVAL_ID);
    expect(emitCall.properties.data.was_revealed).toBe(true);
  });

  it("happy path self: employee reveals own profile — is_self=true, was_revealed=true", async () => {
    const ctx = makeCtx({
      profileId: TARGET_PROFILE as NonEmptyString,
      supabaseAdmin: makeSupabaseMock(allowGate(), {
        data: { personal_number: "01010112345", workspace_id: WORKSPACE_A },
        error: null,
      }),
    });

    const raw = await viewPersonalNumber.execute({ profile_id: TARGET_PROFILE }, ctx);
    const result = JSON.parse(raw) as { ok: boolean; is_self: boolean };

    expect(result.ok).toBe(true);
    expect(result.is_self).toBe(true);

    const emitCall = asPiiEmit(vi.mocked(emit).mock.calls[0]![0]);
    expect(emitCall.properties.data.is_self).toBe(true);
    expect(emitCall.properties.data.was_revealed).toBe(true);
  });

  it("cross-workspace: returns not_found + emit fires with was_revealed=false (ADR-0151 forgery defence)", async () => {
    // Admin in workspace A queries profile that lives in workspace B.
    // The SELECT WHERE workspace_id = WORKSPACE_A finds nothing → not_found.
    const ctx = makeCtx({
      workspaceId: WORKSPACE_A,
      supabaseAdmin: makeSupabaseMock(allowGate(), {
        data: null,
        error: { message: "Row not found" },
      }),
    });

    const raw = await viewPersonalNumber.execute({ profile_id: TARGET_PROFILE }, ctx);
    const result = JSON.parse(raw) as { ok: boolean; reason: string };

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_found");

    // Audit must still fire so the cross-workspace attempt is logged.
    expect(emit).toHaveBeenCalledOnce();
    const emitCall = asPiiEmit(vi.mocked(emit).mock.calls[0]![0]);
    expect(emitCall.event).toBe("payroll.personal_number_revealed");
    expect(emitCall.properties.data.target_profile_id).toBe(TARGET_PROFILE);
    expect(emitCall.properties.data.was_revealed).toBe(false);
  });

  it("gate denied: emit fires with was_revealed=false + gate_evaluation_id set (ADR-0077)", async () => {
    // Reviewe finding: gate denial MUST emit so ADR-0077 Bokføringsloven audit trail
    // captures every access attempt. was_revealed=false distinguishes "blocked" from "sent".
    const ctx = makeCtx({
      supabaseAdmin: makeSupabaseMock(denyGate("min_role_failed"), {
        data: null,
        error: null,
      }),
    });

    const raw = await viewPersonalNumber.execute({ profile_id: TARGET_PROFILE }, ctx);
    const result = JSON.parse(raw) as { ok: boolean; reason: string; detail: string };

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("authority_denied");
    expect(result.detail).toBe("min_role_failed");

    // ADR-0077: emit MUST fire on denial (reviewer finding Fix 1 CRITICAL).
    expect(emit).toHaveBeenCalledOnce();
    const emitCall = asPiiEmit(vi.mocked(emit).mock.calls[0]![0]);
    expect(emitCall.event).toBe("payroll.personal_number_revealed");
    expect(emitCall.properties.data.was_revealed).toBe(false);
    expect(emitCall.properties.data.target_profile_id).toBe(TARGET_PROFILE);
    // gate_evaluation_id: denyGate returns null (gate did not produce eval row on denial).
    expect(emitCall.properties.data.gate_evaluation_id).toBeNull();
  });
});

// ─── view_bank_account ───────────────────────────────────────────────────────

describe("view_bank_account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path admin: reveals full bank_account + emits audit event with was_revealed=true", async () => {
    const ctx = makeCtx({
      supabaseAdmin: makeSupabaseMock(allowGate(), {
        data: { bank_account: "1234.56.78901", workspace_id: WORKSPACE_A },
        error: null,
      }),
    });

    const raw = await viewBankAccount.execute({ profile_id: TARGET_PROFILE }, ctx);
    const result = JSON.parse(raw) as {
      ok: boolean;
      value: string;
      is_self: boolean;
      has_value: boolean;
      gate_evaluation_id: string;
    };

    expect(result.ok).toBe(true);
    expect(result.value).toBe("1234.56.78901");
    expect(result.has_value).toBe(true);
    expect(result.is_self).toBe(false);
    expect(result.gate_evaluation_id).toBe(EVAL_ID);

    expect(emit).toHaveBeenCalledOnce();
    const emitCall = asPiiEmit(vi.mocked(emit).mock.calls[0]![0]);
    expect(emitCall.event).toBe("payroll.bank_account_revealed");
    expect(emitCall.workspace_id).toBe(WORKSPACE_A);
    expect(emitCall.actor_id).toBe(ADMIN_PROFILE);
    expect(emitCall.properties.data.target_profile_id).toBe(TARGET_PROFILE);
    expect(emitCall.properties.data.is_self).toBe(false);
    expect(emitCall.properties.data.gate_evaluation_id).toBe(EVAL_ID);
    expect(emitCall.properties.data.was_revealed).toBe(true);
  });

  it("happy path self: employee reveals own bank account — is_self=true, was_revealed=true", async () => {
    const ctx = makeCtx({
      profileId: TARGET_PROFILE as NonEmptyString,
      supabaseAdmin: makeSupabaseMock(allowGate(), {
        data: { bank_account: "9876.54.32100", workspace_id: WORKSPACE_A },
        error: null,
      }),
    });

    const raw = await viewBankAccount.execute({ profile_id: TARGET_PROFILE }, ctx);
    const result = JSON.parse(raw) as { ok: boolean; is_self: boolean };

    expect(result.ok).toBe(true);
    expect(result.is_self).toBe(true);

    const emitCall = asPiiEmit(vi.mocked(emit).mock.calls[0]![0]);
    expect(emitCall.properties.data.is_self).toBe(true);
    expect(emitCall.properties.data.was_revealed).toBe(true);
  });

  it("cross-workspace: returns not_found + emit fires with was_revealed=false (ADR-0151 forgery defence)", async () => {
    const ctx = makeCtx({
      workspaceId: WORKSPACE_A,
      supabaseAdmin: makeSupabaseMock(allowGate(), {
        data: null,
        error: { message: "Row not found" },
      }),
    });

    const raw = await viewBankAccount.execute({ profile_id: TARGET_PROFILE }, ctx);
    const result = JSON.parse(raw) as { ok: boolean; reason: string };

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_found");

    expect(emit).toHaveBeenCalledOnce();
    const emitCall = asPiiEmit(vi.mocked(emit).mock.calls[0]![0]);
    expect(emitCall.event).toBe("payroll.bank_account_revealed");
    expect(emitCall.properties.data.target_profile_id).toBe(TARGET_PROFILE);
    expect(emitCall.properties.data.was_revealed).toBe(false);
  });

  it("gate denied: emit fires with was_revealed=false + gate_evaluation_id set (ADR-0077)", async () => {
    // Reviewer finding: gate denial MUST emit so ADR-0077 audit trail captures every attempt.
    const ctx = makeCtx({
      supabaseAdmin: makeSupabaseMock(denyGate("min_role_failed"), {
        data: null,
        error: null,
      }),
    });

    const raw = await viewBankAccount.execute({ profile_id: TARGET_PROFILE }, ctx);
    const result = JSON.parse(raw) as { ok: boolean; reason: string; detail: string };

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("authority_denied");
    expect(result.detail).toBe("min_role_failed");

    // ADR-0077: emit MUST fire on denial (reviewer finding Fix 2 CRITICAL).
    expect(emit).toHaveBeenCalledOnce();
    const emitCall = asPiiEmit(vi.mocked(emit).mock.calls[0]![0]);
    expect(emitCall.event).toBe("payroll.bank_account_revealed");
    expect(emitCall.properties.data.was_revealed).toBe(false);
    expect(emitCall.properties.data.target_profile_id).toBe(TARGET_PROFILE);
    expect(emitCall.properties.data.gate_evaluation_id).toBeNull();
  });
});
