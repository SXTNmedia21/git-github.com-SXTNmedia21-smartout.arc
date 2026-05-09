// services/stage-engine/src/routes/adapters/__tests__/ultravox.test.ts
// Vitest: ultravox adapter workspace_id forgery rejection (ADR-0151)
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";

vi.mock("@smartout/ai", () => ({
  SEASON_LIFECYCLE_MISSION_ID: "season-lifecycle",
}));
vi.mock("@smartout/ai/router/intent-classifier", () => ({
  classifyIntent: vi.fn(),
}));
vi.mock("../../../core/session-manager.js", () => ({
  createSession: vi.fn(),
  loadAuthorizedSession: vi.fn(),
  loadMission: vi.fn(),
}));
vi.mock("../../../lib/ultravox.js", () => ({
  createUltravoxCall: vi.fn(),
  buildUltravoxTools: vi.fn(() => []),
}));
vi.mock("../../../lib/supabase.js", () => ({
  supabaseAdmin: {},
}));
vi.mock("../../../core/guardian-bus.js", () => ({
  emitGuardianEvent: vi.fn(),
}));
vi.mock("../../../core/guardian-evaluator.js", () => ({
  evaluateSession: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../config.js", () => ({
  config: { ENGINE_URL: "https://stage-engine.test" },
}));

import { ultravox } from "../ultravox.js";
import { createSession } from "../../../core/session-manager.js";
import { createUltravoxCall } from "../../../lib/ultravox.js";
import type { AuthContext } from "../../../types/auth.js";

beforeEach(() => {
  vi.resetAllMocks();
});

function buildAppWithAuth(auth: AuthContext | null) {
  const app = new Hono<{ Variables: { auth: AuthContext | null } }>();
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    await next();
  });
  app.route("/", ultravox);
  return app;
}

describe("POST /adapters/ultravox/create-call — workspace_id forgery rejection (ADR-0151)", () => {
  it("returns 403 when body.workspace_id mismatches auth.workspaceId", async () => {
    const realWorkspaceId = "11111111-1111-1111-1111-111111111111";
    const forgedWorkspaceId = "22222222-2222-2222-2222-222222222222";
    const app = buildAppWithAuth({
      method: "api_key",
      workspaceId: realWorkspaceId,
      userId: "u",
    });

    const res = await app.request("/adapters/ultravox/create-call", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({
        mission_id: "mr-botsson",
        workspace_id: forgedWorkspaceId,
      }),
    });

    expect(res.status).toBe(403);
    expect(createSession).not.toHaveBeenCalled();
    expect(createUltravoxCall).not.toHaveBeenCalled();
  });

  it("accepts body.workspace_id when it matches auth.workspaceId", async () => {
    const realWorkspaceId = "11111111-1111-1111-1111-111111111111";
    const app = buildAppWithAuth({
      method: "api_key",
      workspaceId: realWorkspaceId,
      userId: "u",
    });

    vi.mocked(createSession).mockResolvedValue({
      session_id: "s",
      workspace_id: realWorkspaceId,
      mission_id: "mr-botsson",
      status: "active",
      current_stage_id: null,
      system_prompt: "x",
    } as never);
    vi.mocked(createUltravoxCall).mockResolvedValue({
      ok: true,
      data: { callId: "c", joinUrl: "u" },
    } as never);

    const res = await app.request("/adapters/ultravox/create-call", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({
        mission_id: "mr-botsson",
        workspace_id: realWorkspaceId,
      }),
    });

    expect(res.status).toBe(200);
    const sessionArg = vi.mocked(createSession).mock.calls[0][0];
    expect(sessionArg.workspace_id).toBe(realWorkspaceId);
  });

  it("falls back to body.workspace_id when auth has no workspaceId (onboarding path)", async () => {
    const onboardingWorkspaceId = "33333333-3333-3333-3333-333333333333";
    const app = buildAppWithAuth({ method: "api_key", userId: "u" });

    vi.mocked(createSession).mockResolvedValue({
      session_id: "s",
      workspace_id: onboardingWorkspaceId,
      mission_id: "onboarding-interview",
      status: "active",
      current_stage_id: null,
      system_prompt: "x",
    } as never);
    vi.mocked(createUltravoxCall).mockResolvedValue({
      ok: true,
      data: { callId: "c", joinUrl: "u" },
    } as never);

    const res = await app.request("/adapters/ultravox/create-call", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({
        mission_id: "onboarding-interview",
        workspace_id: onboardingWorkspaceId,
      }),
    });

    expect(res.status).toBe(200);
    const sessionArg = vi.mocked(createSession).mock.calls[0][0];
    expect(sessionArg.workspace_id).toBe(onboardingWorkspaceId);
  });
});
