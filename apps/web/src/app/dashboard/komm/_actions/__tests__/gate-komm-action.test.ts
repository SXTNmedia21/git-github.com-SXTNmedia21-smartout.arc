/**
 * gate-komm-action.test.ts
 *
 * Unit tests for the komm authority gate Server Action. Mocks the canonical
 * `gateAction` + `resolveCurrentProfile` from `_actions/_shared.ts` and
 * asserts the four decision branches:
 *
 *   1. No authenticated profile → deny ("Ikke autentisert")
 *   2. gate_action returns allow=false → deny with passthrough reason
 *   3. gate_action returns channel_allowed=false on voice → deny with
 *      ADR-0078 message
 *   4. gate_action returns allow=true + channel_allowed=true → allow
 *
 * The wrapper is the boundary between client tools and the gate_action
 * RPC. These tests prove the boundary correctly enforces ADR-0151
 * (server-derived profile_id) + ADR-0078 (channel allowlist) + ADR-0099
 * (authority gate result handling).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../_actions/_shared", () => ({
  resolveCurrentProfile: vi.fn(),
  gateAction: vi.fn(),
}));

import { gateKommAction } from "../gate-komm-action";
import { resolveCurrentProfile, gateAction } from "../../../_actions/_shared";

const mockResolveProfile = vi.mocked(resolveCurrentProfile);
const mockGateAction = vi.mocked(gateAction);

describe("gateKommAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies when no authenticated profile resolves", async () => {
    mockResolveProfile.mockResolvedValue(null);

    const result = await gateKommAction({
      capability: "komm.send_message",
      channel: "chat",
    });

    expect(result).toEqual({ allow: false, reason: "Ikke autentisert" });
    expect(mockGateAction).not.toHaveBeenCalled();
  });

  it("denies with passthrough reason when gate_action returns allow=false", async () => {
    mockResolveProfile.mockResolvedValue({
      profileId: "prof-1",
      workspaceId: "ws-1",
      role: "employee",
    });
    mockGateAction.mockResolvedValue({
      allow: false,
      reason: "min_role=manager required",
      downgrade_to: null,
      min_role_required: "manager",
      channel_allowed: true,
      four_eyes_required: false,
      approvers_needed: 0,
    });

    const result = await gateKommAction({
      capability: "komm.send_message",
      channel: "chat",
      entityId: "ch-1",
    });

    expect(result).toEqual({ allow: false, reason: "min_role=manager required" });
    expect(mockGateAction).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      capability: "komm.send_message",
      channel: "chat",
      actorProfileId: "prof-1",
      actionType: "execute",
      entityId: "ch-1",
    });
  });

  it("denies with ADR-0078 message when channel_allowed=false on voice", async () => {
    mockResolveProfile.mockResolvedValue({
      profileId: "prof-1",
      workspaceId: "ws-1",
      role: "manager",
    });
    mockGateAction.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: false,
      four_eyes_required: false,
      approvers_needed: 0,
    });

    const result = await gateKommAction({
      capability: "komm.send_message",
      channel: "voice",
    });

    expect(result.allow).toBe(false);
    if (result.allow === false) {
      expect(result.reason).toContain("voice");
      expect(result.reason).toContain("ADR-0078");
    }
  });

  it("denies with channel-not-allowed message when channel_allowed=false on chat", async () => {
    mockResolveProfile.mockResolvedValue({
      profileId: "prof-1",
      workspaceId: "ws-1",
      role: "manager",
    });
    mockGateAction.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: false,
      four_eyes_required: false,
      approvers_needed: 0,
    });

    const result = await gateKommAction({
      capability: "komm.create_channel",
      channel: "chat",
    });

    expect(result.allow).toBe(false);
    if (result.allow === false) {
      expect(result.reason).not.toContain("voice");
    }
  });

  it("allows when gate_action returns allow=true and channel_allowed=true", async () => {
    mockResolveProfile.mockResolvedValue({
      profileId: "prof-1",
      workspaceId: "ws-1",
      role: "manager",
    });
    mockGateAction.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: true,
      four_eyes_required: false,
      approvers_needed: 0,
    });

    const result = await gateKommAction({
      capability: "komm.send_message",
      channel: "chat",
      entityId: "ch-1",
    });

    expect(result).toEqual({
      allow: true,
      downgradeTo: null,
      channelAllowed: true,
    });
  });

  it("propagates downgrade_to in the allow result for caller awareness", async () => {
    mockResolveProfile.mockResolvedValue({
      profileId: "prof-1",
      workspaceId: "ws-1",
      role: "employee",
    });
    mockGateAction.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: "suggest",
      min_role_required: null,
      channel_allowed: true,
      four_eyes_required: false,
      approvers_needed: 0,
    });

    const result = await gateKommAction({
      capability: "komm.send_message",
      channel: "chat",
    });

    expect(result.allow).toBe(true);
    if (result.allow === true) {
      expect(result.downgradeTo).toBe("suggest");
    }
  });

  it("denies with SOD message when actor is in approvers (self-approval)", async () => {
    mockResolveProfile.mockResolvedValue({
      profileId: "prof-1",
      workspaceId: "ws-1",
      role: "manager",
    });
    mockGateAction.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: true,
      four_eyes_required: true,
      approvers_needed: 1,
    });

    const result = await gateKommAction({
      capability: "komm.send_message",
      channel: "chat",
      approvers: ["prof-1"],
    });

    expect(result.allow).toBe(false);
    if (result.allow === false) {
      expect(result.reason).toContain("Separation of Duties");
      expect(result.requiresApproval).toBe(true);
      expect(result.approversNeeded).toBe(1);
    }
  });

  it("denies with approver-count message when approvers below threshold", async () => {
    mockResolveProfile.mockResolvedValue({
      profileId: "prof-1",
      workspaceId: "ws-1",
      role: "manager",
    });
    mockGateAction.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: true,
      four_eyes_required: true,
      approvers_needed: 2,
    });

    const result = await gateKommAction({
      capability: "komm.send_message",
      channel: "chat",
      approvers: ["prof-2"],
    });

    expect(result.allow).toBe(false);
    if (result.allow === false) {
      expect(result.reason).toContain("2 godkjennere");
      expect(result.reason).toContain("har 1");
      expect(result.requiresApproval).toBe(true);
      expect(result.approversNeeded).toBe(2);
    }
  });

  it("denies when approvers empty but four_eyes_required=true", async () => {
    mockResolveProfile.mockResolvedValue({
      profileId: "prof-1",
      workspaceId: "ws-1",
      role: "manager",
    });
    mockGateAction.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: true,
      four_eyes_required: true,
      approvers_needed: 1,
    });

    const result = await gateKommAction({
      capability: "komm.send_message",
      channel: "chat",
    });

    expect(result.allow).toBe(false);
    if (result.allow === false) {
      expect(result.requiresApproval).toBe(true);
    }
  });

  it("allows when four_eyes_required=true and distinct approvers meet threshold", async () => {
    mockResolveProfile.mockResolvedValue({
      profileId: "prof-1",
      workspaceId: "ws-1",
      role: "manager",
    });
    mockGateAction.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: true,
      four_eyes_required: true,
      approvers_needed: 2,
    });

    const result = await gateKommAction({
      capability: "komm.send_message",
      channel: "chat",
      approvers: ["prof-2", "prof-3"],
    });

    expect(result.allow).toBe(true);
  });

  it("excludes actor from approver count even if listed (no self-counting)", async () => {
    mockResolveProfile.mockResolvedValue({
      profileId: "prof-1",
      workspaceId: "ws-1",
      role: "manager",
    });
    mockGateAction.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: true,
      four_eyes_required: true,
      approvers_needed: 1,
    });

    // Actor is prof-1; approvers list has actor + one distinct → SOD denial
    // takes precedence over count check (self-approval is forbidden).
    const result = await gateKommAction({
      capability: "komm.send_message",
      channel: "chat",
      approvers: ["prof-1", "prof-2"],
    });

    expect(result.allow).toBe(false);
    if (result.allow === false) {
      expect(result.reason).toContain("Separation of Duties");
    }
  });

  it("re-derives actor_profile_id from server, never trusts caller input (ADR-0151)", async () => {
    mockResolveProfile.mockResolvedValue({
      profileId: "server-derived-prof",
      workspaceId: "server-derived-ws",
      role: "manager",
    });
    mockGateAction.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: true,
      four_eyes_required: false,
      approvers_needed: 0,
    });

    await gateKommAction({
      capability: "komm.join_call",
      channel: "voice",
    });

    expect(mockGateAction).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "server-derived-ws",
        actorProfileId: "server-derived-prof",
      }),
    );
  });
});
