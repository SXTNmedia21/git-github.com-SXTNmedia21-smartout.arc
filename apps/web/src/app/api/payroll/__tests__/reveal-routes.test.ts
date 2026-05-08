/**
 * BFF tests for:
 *   POST /api/payroll/reveal-personal-number
 *   POST /api/payroll/reveal-bank-account
 *
 * Both routes are symmetric HTTP glue — they delegate to the capability tool
 * which owns gate + emit + workspace-scoped SELECT. Tests verify the HTTP
 * layer contract: CORS guard, body validation, auth resolution, tool delegation,
 * and status-code mapping.
 *
 * 4 cases per route (8 total):
 *   1. happy path: valid request → tool returns ok:true → 200 with value
 *   2. cross-origin: rejectCrossOrigin returns response → 403
 *   3. invalid body: missing profileId → 400 invalid_request
 *   4. tool denies not_found: tool returns ok:false reason:not_found → 404
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
// vi.hoisted ensures mock factories run before module imports.

const { rejectCrossOriginMock, resolvePayrollAuthMock, createAdminClientMock } = vi.hoisted(() => ({
  rejectCrossOriginMock: vi.fn(),
  resolvePayrollAuthMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

const { viewPersonalNumberExecuteMock, viewBankAccountExecuteMock } = vi.hoisted(() => ({
  viewPersonalNumberExecuteMock: vi.fn(),
  viewBankAccountExecuteMock: vi.fn(),
}));

vi.mock("@/app/api/payroll/_shared", () => ({
  rejectCrossOrigin: rejectCrossOriginMock,
  resolvePayrollAuth: resolvePayrollAuthMock,
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@smartout/ai/capabilities/payroll/tools", () => ({
  viewPersonalNumber: { execute: viewPersonalNumberExecuteMock },
  viewBankAccount: { execute: viewBankAccountExecuteMock },
  // Pass-through stubs for any other named exports the module provides.
  viewLonnsgrunnlag: { execute: vi.fn() },
  updatePayrollProfile: { execute: vi.fn() },
  queryTaxCard: { execute: vi.fn() },
  setPensionScheme: { execute: vi.fn() },
  salaryQuery: { execute: vi.fn() },
  lockPeriod: { execute: vi.fn() },
  acknowledgeDeviation: { execute: vi.fn() },
  setOvertimeMode: { execute: vi.fn() },
  adjustTimebankBalance: { execute: vi.fn() },
  forceTimebankPayout: { execute: vi.fn() },
  queryTimebankBalance: { execute: vi.fn() },
  addManualSupplement: { execute: vi.fn() },
  deleteManualSupplement: { execute: vi.fn() },
  overrideCalculationLine: { execute: vi.fn() },
  exportPeriod: { execute: vi.fn() },
}));

// ─── Fixture data ─────────────────────────────────────────────────────────────

const WORKSPACE_ID = "aaaaaaaa-1111-4111-8111-111111111111";
const ACTOR_ID = "bbbbbbbb-2222-4222-8222-222222222222";
const TARGET_PROFILE_ID = "cccccccc-3333-4333-8333-333333333333";
const EVAL_ID = "dddddddd-4444-4444-8444-444444444444";

const AUTH_STUB = {
  userId: "user-u1",
  workspaceId: WORKSPACE_ID,
  profileId: ACTOR_ID,
  surface: "runtime_web" as const,
};

const ADMIN_STUB = {};

/**
 * Build a minimal NextRequest-like object for route invocation.
 * Only json() is used by the routes; the rest are not touched during these tests.
 */
function makeReq(body: unknown, corsBlocked = false): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: {
      get: vi.fn().mockReturnValue(corsBlocked ? "https://evil.example.com" : null),
    },
  } as unknown as NextRequest;
}

// ─── Tool result builders ─────────────────────────────────────────────────────

function toolOk(value: string | null = "12345678901", isSelf = false): string {
  return JSON.stringify({
    ok: true,
    value,
    is_self: isSelf,
    has_value: value !== null,
    gate_evaluation_id: EVAL_ID,
  });
}

function toolDenied(reason: string): string {
  return JSON.stringify({ ok: false, reason, detail: reason });
}

// ─── reveal-personal-number ──────────────────────────────────────────────────

describe("POST /api/payroll/reveal-personal-number", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rejectCrossOriginMock.mockReturnValue(null);
    resolvePayrollAuthMock.mockResolvedValue(AUTH_STUB);
    createAdminClientMock.mockReturnValue(ADMIN_STUB);
  });

  it("happy path: valid request → tool returns ok:true → 200 with value", async () => {
    viewPersonalNumberExecuteMock.mockResolvedValue(toolOk("12345678901", false));

    const { POST } = await import("../reveal-personal-number/route");
    const res = await POST(makeReq({ profileId: TARGET_PROFILE_ID }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.value).toBe("12345678901");
    expect(body.is_self).toBe(false);
    expect(body.has_value).toBe(true);
    expect(body.gate_evaluation_id).toBe(EVAL_ID);

    expect(viewPersonalNumberExecuteMock).toHaveBeenCalledWith(
      { profile_id: TARGET_PROFILE_ID },
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        profileId: ACTOR_ID,
        channel: "chat",
      }),
    );
  });

  it("cross-origin: rejectCrossOrigin returns response → 403", async () => {
    const corsResponse = new Response(JSON.stringify({ error: "Cross-origin forbidden" }), {
      status: 403,
    });
    rejectCrossOriginMock.mockReturnValue(corsResponse);

    const { POST } = await import("../reveal-personal-number/route");
    const res = await POST(makeReq({ profileId: TARGET_PROFILE_ID }));

    expect(res.status).toBe(403);
    expect(viewPersonalNumberExecuteMock).not.toHaveBeenCalled();
  });

  it("invalid body: missing profileId → 400 invalid_request", async () => {
    const { POST } = await import("../reveal-personal-number/route");
    const res = await POST(makeReq({ notAProfileId: "garbage" }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("invalid_request");
    expect(viewPersonalNumberExecuteMock).not.toHaveBeenCalled();
  });

  it("tool denies not_found: tool returns ok:false reason:not_found → 404", async () => {
    viewPersonalNumberExecuteMock.mockResolvedValue(toolDenied("not_found"));

    const { POST } = await import("../reveal-personal-number/route");
    const res = await POST(makeReq({ profileId: TARGET_PROFILE_ID }));

    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("not_found");
  });
});

// ─── reveal-bank-account ─────────────────────────────────────────────────────

describe("POST /api/payroll/reveal-bank-account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rejectCrossOriginMock.mockReturnValue(null);
    resolvePayrollAuthMock.mockResolvedValue(AUTH_STUB);
    createAdminClientMock.mockReturnValue(ADMIN_STUB);
  });

  it("happy path: valid request → tool returns ok:true → 200 with value", async () => {
    viewBankAccountExecuteMock.mockResolvedValue(toolOk("12345678901", true));

    const { POST } = await import("../reveal-bank-account/route");
    const res = await POST(makeReq({ profileId: TARGET_PROFILE_ID }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.value).toBe("12345678901");
    expect(body.is_self).toBe(true);
    expect(body.has_value).toBe(true);
    expect(body.gate_evaluation_id).toBe(EVAL_ID);

    expect(viewBankAccountExecuteMock).toHaveBeenCalledWith(
      { profile_id: TARGET_PROFILE_ID },
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        profileId: ACTOR_ID,
        channel: "chat",
      }),
    );
  });

  it("cross-origin: rejectCrossOrigin returns response → 403", async () => {
    const corsResponse = new Response(JSON.stringify({ error: "Cross-origin forbidden" }), {
      status: 403,
    });
    rejectCrossOriginMock.mockReturnValue(corsResponse);

    const { POST } = await import("../reveal-bank-account/route");
    const res = await POST(makeReq({ profileId: TARGET_PROFILE_ID }));

    expect(res.status).toBe(403);
    expect(viewBankAccountExecuteMock).not.toHaveBeenCalled();
  });

  it("invalid body: missing profileId → 400 invalid_request", async () => {
    const { POST } = await import("../reveal-bank-account/route");
    const res = await POST(makeReq({ notAProfileId: "garbage" }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("invalid_request");
    expect(viewBankAccountExecuteMock).not.toHaveBeenCalled();
  });

  it("tool denies not_found: tool returns ok:false reason:not_found → 404", async () => {
    viewBankAccountExecuteMock.mockResolvedValue(toolDenied("not_found"));

    const { POST } = await import("../reveal-bank-account/route");
    const res = await POST(makeReq({ profileId: TARGET_PROFILE_ID }));

    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("not_found");
  });
});
