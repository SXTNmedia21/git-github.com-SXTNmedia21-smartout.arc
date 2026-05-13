/**
 * update-deviation-action.test.ts — coverage for the two Server Actions
 * that replaced the inline `supabase.from("deviation").update(...)` calls
 * in EventDetailPanel.tsx. Closes F-SC-04-15.
 *
 * Tests assert on:
 *   - Authentication path (no profile → ok=false, no DB / gate calls)
 *   - L-0177 fail-fast on missing row + cross-workspace mismatch
 *   - Idempotent short-circuit (already-resolved / already-acknowledged)
 *   - Gate denial path → no UPDATE, no emit
 *   - Happy path → UPDATE + canonical emit shape
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveCurrentProfileMock, gateActionMock, createAdminClientMock, emitMock } = vi.hoisted(
  () => ({
    resolveCurrentProfileMock: vi.fn(),
    gateActionMock: vi.fn(),
    createAdminClientMock: vi.fn(),
    emitMock: vi.fn(),
  }),
);

vi.mock("../_shared", () => ({
  resolveCurrentProfile: resolveCurrentProfileMock,
  gateAction: gateActionMock,
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@smartout/telemetry", () => ({
  emit: emitMock,
  nonEmpty: (v: string) => v,
}));

// Import after vi.mock — Server Actions resolve dependencies eagerly.
import { acknowledgeDeviationAction, resolveDeviationAction } from "../update-deviation-action";

// ── Fixtures ────────────────────────────────────────────────────────────────
const WS_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const DEVIATION_ID = "33333333-3333-4333-8333-333333333333";

function buildLoadChain(result: {
  data: {
    deviation_id: string;
    workspace_id: string;
    status: string;
    title: string;
    domain: string;
  } | null;
  error: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, _maybeSingle: maybeSingle, _eq: eq };
}

function buildUpdateChain(result: { error: unknown }) {
  const eq = vi.fn().mockResolvedValue({ data: null, error: result.error });
  const update = vi.fn().mockReturnValue({ eq });
  return { update, _eq: eq };
}

function buildAdminClient(params: {
  loadResult: Parameters<typeof buildLoadChain>[0];
  updateError?: unknown;
}) {
  const loadChain = buildLoadChain(params.loadResult);
  const updateChain = buildUpdateChain({ error: params.updateError ?? null });

  let firstCall = true;
  const from = vi.fn((table: string) => {
    if (table !== "deviation") throw new Error(`unexpected from(${table})`);
    if (firstCall) {
      firstCall = false;
      return { select: loadChain.select };
    }
    return { update: updateChain.update };
  });

  return { from, _loadChain: loadChain, _updateChain: updateChain };
}

beforeEach(() => {
  resolveCurrentProfileMock.mockReset();
  gateActionMock.mockReset();
  createAdminClientMock.mockReset();
  emitMock.mockReset();

  // Default — manager authenticated
  resolveCurrentProfileMock.mockResolvedValue({
    profileId: PROFILE_ID,
    workspaceId: WS_ID,
    role: "manager",
  });
});

// ── resolveDeviationAction ──────────────────────────────────────────────────

describe("resolveDeviationAction", () => {
  it("returns ok=false 'Ikke autentisert.' when no profile", async () => {
    resolveCurrentProfileMock.mockResolvedValue(null);
    const result = await resolveDeviationAction({
      deviation_id: DEVIATION_ID,
      resolution_notes: "Resolved on the spot",
    });
    expect(result).toEqual({ ok: false, error: "Ikke autentisert." });
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(gateActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns ok=false when row not found (L-0177 fail-fast)", async () => {
    const admin = buildAdminClient({
      loadResult: { data: null, error: null },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await resolveDeviationAction({
      deviation_id: DEVIATION_ID,
      resolution_notes: "Doesn't matter, row missing",
    });
    expect(result).toEqual({ ok: false, error: "Avviket finnes ikke." });
    expect(gateActionMock).not.toHaveBeenCalled();
  });

  it("returns ok=false on workspace mismatch (L-0177 fail-fast)", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          deviation_id: DEVIATION_ID,
          workspace_id: "deadbeef-dead-4eef-8eef-deadbeefdead",
          status: "open",
          title: "spill in kitchen",
          domain: "hms",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await resolveDeviationAction({
      deviation_id: DEVIATION_ID,
      resolution_notes: "Cross-workspace attempt blocked",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/annet arbeidsrom/i);
    expect(gateActionMock).not.toHaveBeenCalled();
  });

  it("idempotent — already resolved short-circuits without gate / emit", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          deviation_id: DEVIATION_ID,
          workspace_id: WS_ID,
          status: "resolved",
          title: "spill",
          domain: "hms",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await resolveDeviationAction({
      deviation_id: DEVIATION_ID,
      resolution_notes: "Already done",
    });

    expect(result).toEqual({
      ok: true,
      deviationId: DEVIATION_ID,
      status: "resolved",
    });
    expect(gateActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns ok=false when gate denies — no UPDATE, no emit", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          deviation_id: DEVIATION_ID,
          workspace_id: WS_ID,
          status: "open",
          title: "spill",
          domain: "hms",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);
    gateActionMock.mockResolvedValue({
      allow: false,
      reason: "insufficient_role",
    });

    const result = await resolveDeviationAction({
      deviation_id: DEVIATION_ID,
      resolution_notes: "Will be blocked by gate",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/insufficient_role|ikke autorisert/i);
    expect(emitMock).not.toHaveBeenCalled();
    // Update chain's `update` function never invoked
    expect(admin._updateChain.update).not.toHaveBeenCalled();
  });

  it("happy path — UPDATE + emit 'deviation resolved' on success", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          deviation_id: DEVIATION_ID,
          workspace_id: WS_ID,
          status: "open",
          title: "spill in kitchen",
          domain: "hms",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);
    gateActionMock.mockResolvedValue({ allow: true });

    const notes = "Cleaned up. Mopped. Notified team.";
    const result = await resolveDeviationAction({
      deviation_id: DEVIATION_ID,
      resolution_notes: notes,
    });

    expect(result).toEqual({
      ok: true,
      deviationId: DEVIATION_ID,
      status: "resolved",
    });
    expect(gateActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "hms.resolve_deviation",
        actionType: "resolve",
        entityId: DEVIATION_ID,
        workspaceId: WS_ID,
      }),
    );
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "deviation resolved",
        workspace_id: WS_ID,
        actor_id: PROFILE_ID,
      }),
    );
    const emitArg = emitMock.mock.calls[0]?.[0];
    expect(emitArg?.properties?.data?.resolution_notes).toBe(notes);
    expect(emitArg?.properties?.entity?.entity_id).toBe(DEVIATION_ID);
  });

  it("rejects validation: resolution_notes < 5 chars", async () => {
    const result = await resolveDeviationAction({
      deviation_id: DEVIATION_ID,
      resolution_notes: "no",
    });
    expect(result.ok).toBe(false);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });
});

// ── acknowledgeDeviationAction ──────────────────────────────────────────────

describe("acknowledgeDeviationAction", () => {
  it("returns ok=false 'Ikke autentisert.' when no profile", async () => {
    resolveCurrentProfileMock.mockResolvedValue(null);
    const result = await acknowledgeDeviationAction({ deviation_id: DEVIATION_ID });
    expect(result).toEqual({ ok: false, error: "Ikke autentisert." });
  });

  it("returns ok=false when row not found", async () => {
    const admin = buildAdminClient({
      loadResult: { data: null, error: null },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await acknowledgeDeviationAction({ deviation_id: DEVIATION_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/finnes ikke/i);
  });

  it("returns ok=false on workspace mismatch", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          deviation_id: DEVIATION_ID,
          workspace_id: "deadbeef-dead-4eef-8eef-deadbeefdead",
          status: "open",
          title: "spill",
          domain: "hms",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await acknowledgeDeviationAction({ deviation_id: DEVIATION_ID });
    expect(result.ok).toBe(false);
    expect(gateActionMock).not.toHaveBeenCalled();
  });

  it("idempotent — already acknowledged short-circuits", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          deviation_id: DEVIATION_ID,
          workspace_id: WS_ID,
          status: "acknowledged",
          title: "spill",
          domain: "hms",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await acknowledgeDeviationAction({ deviation_id: DEVIATION_ID });
    expect(result).toEqual({
      ok: true,
      deviationId: DEVIATION_ID,
      status: "acknowledged",
    });
    expect(gateActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("idempotent — already resolved short-circuits (resolved > acknowledged)", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          deviation_id: DEVIATION_ID,
          workspace_id: WS_ID,
          status: "resolved",
          title: "spill",
          domain: "hms",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await acknowledgeDeviationAction({ deviation_id: DEVIATION_ID });
    expect(result).toEqual({
      ok: true,
      deviationId: DEVIATION_ID,
      status: "resolved",
    });
  });

  it("gate denial returns ok=false, no UPDATE, no emit", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          deviation_id: DEVIATION_ID,
          workspace_id: WS_ID,
          status: "open",
          title: "spill",
          domain: "hms",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);
    gateActionMock.mockResolvedValue({ allow: false, reason: "channel_blocked" });

    const result = await acknowledgeDeviationAction({ deviation_id: DEVIATION_ID });
    expect(result.ok).toBe(false);
    expect(emitMock).not.toHaveBeenCalled();
    expect(admin._updateChain.update).not.toHaveBeenCalled();
  });

  it("happy path — UPDATE + emit 'deviation updated' status='acknowledged'", async () => {
    const admin = buildAdminClient({
      loadResult: {
        data: {
          deviation_id: DEVIATION_ID,
          workspace_id: WS_ID,
          status: "open",
          title: "spill",
          domain: "hms",
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);
    gateActionMock.mockResolvedValue({ allow: true });

    const result = await acknowledgeDeviationAction({ deviation_id: DEVIATION_ID });
    expect(result).toEqual({
      ok: true,
      deviationId: DEVIATION_ID,
      status: "acknowledged",
    });
    expect(gateActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "hms.acknowledge_deviation",
        actionType: "acknowledge",
        entityId: DEVIATION_ID,
      }),
    );
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "deviation updated",
        workspace_id: WS_ID,
        actor_id: PROFILE_ID,
      }),
    );
    const emitArg = emitMock.mock.calls[0]?.[0];
    expect(emitArg?.properties?.data?.status).toBe("acknowledged");
  });
});
