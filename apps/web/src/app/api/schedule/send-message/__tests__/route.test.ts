/**
 * route.test.ts
 * Validates authorization behavior in schedule send-message API route.
 * Ensures forbidden paths stop before downstream admin lookup and SMS dispatch.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "../route";

const { createClientMock, createAdminClientMock, sendSmsBatchMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  sendSmsBatchMock: vi.fn(),
}));

vi.mock("@smartout/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@smartout/notifications", () => ({
  sendSmsBatch: sendSmsBatchMock,
}));

/**
 * Builds a minimal profile membership query chain used by the route.
 * Why: route calls from().select().eq().eq().maybeSingle() before guard checks.
 *
 * @param result - Membership query result returned by maybeSingle().
 * @returns Mocked query chain with tracked function references.
 */
function buildMembershipChain(result: {
  data: { profile_id: string; role: string } | null;
  error: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const secondEq = vi.fn().mockReturnValue({ maybeSingle });
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
  const select = vi.fn().mockReturnValue({ eq: firstEq });
  const from = vi.fn().mockReturnValue({ select });

  return { from, select, firstEq, secondEq, maybeSingle };
}

/**
 * Creates a minimal NextRequest-like object for POST route invocation.
 * Why: only json() is required for this authorization-path test coverage.
 *
 * @returns Request with a valid send-message payload body.
 */
function createRequest(): NextRequest {
  return {
    json: vi.fn().mockResolvedValue({
      workspaceId: "11111111-1111-1111-1111-111111111111",
      dateId: "2026-03-28",
      message: "Ops update",
      channels: ["sms"],
      audience: "all",
    }),
  } as unknown as NextRequest;
}

describe("POST /api/schedule/send-message authorization", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    createAdminClientMock.mockReset();
    sendSmsBatchMock.mockReset();
  });

  it("returns 403 for unauthorized membership role and stops downstream side-effects", async () => {
    const membershipChain = buildMembershipChain({
      data: { profile_id: "p-1", role: "employee" },
      error: null,
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: membershipChain.from,
    });

    const response = await POST(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toContain("insufficient authority");
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(sendSmsBatchMock).not.toHaveBeenCalled();
  });

  it("returns 403 when membership is missing and stops downstream side-effects", async () => {
    const membershipChain = buildMembershipChain({
      data: null,
      error: null,
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: membershipChain.from,
    });

    const response = await POST(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: "Forbidden" });
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(sendSmsBatchMock).not.toHaveBeenCalled();
  });
});
