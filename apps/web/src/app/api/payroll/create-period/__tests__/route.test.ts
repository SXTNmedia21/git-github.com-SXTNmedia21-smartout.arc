/**
 * BFF tests for POST /api/payroll/create-period (SMA-343 S1a)
 *
 * Tests verify the HTTP contract:
 *   1. happy path → 200 { ok, period_id, status: 'open' }
 *   2. start_date >= end_date → 400 (Zod refine)
 *   3. equal start/end date → 400
 *   4. cross-origin → 403
 *   5. auth fails (no profile in workspace) → 401
 *   6. gate denies → 403
 *   7. DB duplicate (23505) → 409
 *   8. missing workspace_id → 400
 *   9. emits payroll.period_created on success
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────
// vi.hoisted ensures factories run before module imports.

const { rejectCrossOriginMock, resolvePayrollAuthMock } = vi.hoisted(() => ({
  rejectCrossOriginMock: vi.fn(),
  resolvePayrollAuthMock: vi.fn(),
}));

const { insertMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
}));

const { emitMock } = vi.hoisted(() => ({
  emitMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/api/payroll/_shared", () => ({
  rejectCrossOrigin: rejectCrossOriginMock,
  resolvePayrollAuth: resolvePayrollAuthMock,
}));

vi.mock("@/app/dashboard/_actions/_shared", () => ({
  gateAction: vi.fn().mockResolvedValue({ allow: true }),
}));

// Admin client returns a chainable mock that bottoms out at insertMock.
vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: insertMock,
      }),
    }),
  }),
}));

vi.mock("@smartout/telemetry", () => ({
  emit: emitMock,
  nonEmpty: vi.fn().mockImplementation((s: string) => s),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const WORKSPACE_ID = "aaaaaaaa-1111-4111-8111-111111111111";
const ACTOR_ID = "bbbbbbbb-2222-4222-8222-222222222222";
const PERIOD_ID = "cccccccc-3333-4333-8333-333333333333";

const AUTH_STUB = {
  userId: "user-u1",
  workspaceId: WORKSPACE_ID,
  profileId: ACTOR_ID,
  surface: "runtime_web" as const,
};

function makeReq(body: unknown, corsBlocked = false): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: {
      get: vi.fn().mockReturnValue(corsBlocked ? "https://evil.example.com" : null),
    },
  } as unknown as NextRequest;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/payroll/create-period — SMA-343", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rejectCrossOriginMock.mockReturnValue(null);
    resolvePayrollAuthMock.mockResolvedValue(AUTH_STUB);

    // Default: successful insert returns period id.
    insertMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: PERIOD_ID },
          error: null,
        }),
      }),
    });
  });

  it("happy path — valid input → 200 { ok, period_id, status: 'open' }", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      makeReq({ workspace_id: WORKSPACE_ID, start_date: "2026-06-01", end_date: "2026-06-30" }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.period_id).toBe(PERIOD_ID);
    expect(body.status).toBe("open");
  });

  it("start_date after end_date → 400 validation error", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      makeReq({ workspace_id: WORKSPACE_ID, start_date: "2026-06-30", end_date: "2026-06-01" }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
  });

  it("equal start_date and end_date → 400 validation error", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      makeReq({ workspace_id: WORKSPACE_ID, start_date: "2026-06-01", end_date: "2026-06-01" }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
  });

  it("cross-origin request → 403", async () => {
    const corsResponse = new Response(JSON.stringify({ error: "Cross-origin forbidden" }), {
      status: 403,
    });
    rejectCrossOriginMock.mockReturnValue(corsResponse);

    const { POST } = await import("../route");
    const res = await POST(
      makeReq(
        { workspace_id: WORKSPACE_ID, start_date: "2026-06-01", end_date: "2026-06-30" },
        true,
      ),
    );

    expect(res.status).toBe(403);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("no active profile in workspace → 401 unauthorized", async () => {
    resolvePayrollAuthMock.mockResolvedValue(null);

    const { POST } = await import("../route");
    const res = await POST(
      makeReq({ workspace_id: WORKSPACE_ID, start_date: "2026-06-01", end_date: "2026-06-30" }),
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(body.error).toBe("unauthorized");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("gate denies → 403 forbidden", async () => {
    const { gateAction } = await import("@/app/dashboard/_actions/_shared");
    vi.mocked(gateAction).mockResolvedValueOnce({
      allow: false,
      reason: "insufficient_role",
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: false,
      four_eyes_required: false,
      approvers_needed: 0,
    });

    const { POST } = await import("../route");
    const res = await POST(
      makeReq({ workspace_id: WORKSPACE_ID, start_date: "2026-06-01", end_date: "2026-06-30" }),
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("DB UNIQUE violation (23505) → 409 duplicate_period", async () => {
    insertMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "23505", message: "duplicate key value" },
        }),
      }),
    });

    const { POST } = await import("../route");
    const res = await POST(
      makeReq({ workspace_id: WORKSPACE_ID, start_date: "2026-06-01", end_date: "2026-06-30" }),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(body.error).toBe("duplicate_period");
  });

  it("missing workspace_id → 400 invalid body", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeReq({ start_date: "2026-06-01", end_date: "2026-06-30" }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("emits payroll.period_created on success", async () => {
    const { POST } = await import("../route");
    await POST(
      makeReq({ workspace_id: WORKSPACE_ID, start_date: "2026-06-01", end_date: "2026-06-30" }),
    );

    // emit is fire-and-forget (void), so we only verify it was called with the right event.
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "payroll.period_created",
      }),
    );
  });
});
