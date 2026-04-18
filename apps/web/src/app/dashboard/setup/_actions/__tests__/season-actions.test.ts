/**
 * season-actions.test.ts
 *
 * Unit tests for the Gatedwrite Wave 2A Season Server Actions
 * (`createSeason` + `updateSeason`). Covers the three canonical gate
 * outcomes per action (applied / proposed / denied) plus the
 * fetch-fail branch for updates.
 *
 * Mocking mirrors the people-actions pilot:
 *   - `@smartout/supabase/server` is mocked so `createClient()` returns
 *     a scripted client (auth.getUser + profile-lookup chain).
 *   - `@smartout/supabase/gate-client` has `gatedInsert`/`gatedUpdate`
 *     mocked via the shared `makeGateSpies` helper. We intentionally
 *     do NOT exercise the real RPC dispatch — the contract under test
 *     is Server-Action glue + telemetry event correctness.
 *   - `@smartout/telemetry`'s `emit` is mocked and asserted for exact
 *     event-name + properties-shape (catches the registry-miss bug
 *     fixed in Wave 2A: wizard used to emit `"button clicked"`).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGateSpies, makeGateDeniedError } from "@/test-utils/gate-mocks";

const gateSpies = vi.hoisted(() => ({
  gatedInsert: vi.fn(),
  gatedUpdate: vi.fn(),
  gatedDelete: vi.fn(),
}));

const { createClientMock, emitMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  emitMock: vi.fn(),
}));

vi.mock("@smartout/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@smartout/supabase/gate-client", async () => {
  const actual = await vi.importActual<typeof import("@smartout/supabase/gate-client")>(
    "@smartout/supabase/gate-client",
  );
  return {
    ...actual,
    gatedInsert: gateSpies.gatedInsert,
    gatedUpdate: gateSpies.gatedUpdate,
    gatedDelete: gateSpies.gatedDelete,
  };
});

vi.mock("@smartout/telemetry", () => ({
  emit: emitMock,
}));

// Import AFTER mocks so the module binds to mocked deps.
import { createSeason, updateSeason } from "../season-actions";

/**
 * Builds a minimal Supabase client covering the two traversal paths:
 *   - `auth.getUser()`
 *   - `from("profile").select("profile_id").eq().eq().limit().maybeSingle()`
 *     (resolveActorId)
 *   - `from("season").select("*").eq("season_id", id).single()`
 *     (fetchCurrentSeason — update path only)
 */
function buildSupabaseMock(opts: {
  currentSeason?: Record<string, unknown> | null;
  actorProfileId?: string | null;
}) {
  const currentSeason = opts.currentSeason ?? null;
  const actorId = opts.actorProfileId ?? "actor-1";

  const fetchSeasonChain = {
    single: vi
      .fn()
      .mockResolvedValue(
        currentSeason ? { data: currentSeason, error: null } : { data: null, error: null },
      ),
  };

  const resolveActorChain = {
    maybeSingle: vi.fn().mockResolvedValue({ data: { profile_id: actorId }, error: null }),
  };

  const from = vi.fn((_table: string) => ({
    select: vi.fn((cols: string) => {
      if (cols === "*") {
        // fetchCurrentSeason path
        return { eq: vi.fn().mockReturnValue(fetchSeasonChain) };
      }
      // resolveActorId path: .select("profile_id").eq().eq().limit().maybeSingle()
      return {
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(resolveActorChain),
          }),
        }),
      };
    }),
  }));

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
    from,
  };
}

// Smoke-test that the shared helper is wired; protects against accidental
// removal / rename that would break Wave 2B+ tests that copy this file.
describe("gate-mocks helper", () => {
  it("makeGateSpies returns three callable spies", () => {
    const spies = makeGateSpies();
    expect(spies.gatedInsert).toBeDefined();
    expect(spies.gatedUpdate).toBeDefined();
    expect(spies.gatedDelete).toBeDefined();
  });
});

describe("createSeason (gated)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    gateSpies.gatedInsert.mockReset();
    gateSpies.gatedUpdate.mockReset();
    emitMock.mockReset();
  });

  const validInput = {
    workspaceId: "ws-1",
    name: "Sommersesong 2026",
    startDate: "2026-06-01",
    endDate: "2026-08-31",
  };

  it("applied: returns { ok: true } and emits 'season created' (NOT 'button clicked')", async () => {
    createClientMock.mockResolvedValue(buildSupabaseMock({}));
    gateSpies.gatedInsert.mockResolvedValue({
      data: [{ season_id: "season-new" }],
      outcome: "applied",
      exceptionReason: null,
    });

    const result = await createSeason(validInput);

    expect(result).toEqual({ ok: true });
    expect(gateSpies.gatedInsert).toHaveBeenCalledTimes(1);
    const [, table, row, ctx] = gateSpies.gatedInsert.mock.calls[0] ?? [];
    expect(table).toBe("season");
    expect(row).toMatchObject({
      name: "Sommersesong 2026",
      slug: "sommersesong-2026",
      start_date: "2026-06-01",
      end_date: "2026-08-31",
      status: "draft",
      workspace_id: "ws-1",
    });
    expect(ctx).toMatchObject({
      entityType: "season",
      entityId: null,
      workspaceId: "ws-1",
      capability: "season:create",
      entityIdColumn: "season_id",
    });

    // REGISTRY FIX — registered event, not the legacy "button clicked" bug.
    expect(emitMock).toHaveBeenCalledTimes(1);
    const emittedEvent = emitMock.mock.calls[0]?.[0];
    expect(emittedEvent.event).toBe("season created");
    expect(emittedEvent.event).not.toBe("button clicked");
    expect(emittedEvent.properties).toEqual({
      entity: { entity_type: "season", entity_id: "season-new" },
      data: { name: "Sommersesong 2026", status: "draft" },
    });
  });

  it("proposed: returns { ok: true, pendingProposal } and does NOT emit", async () => {
    createClientMock.mockResolvedValue(buildSupabaseMock({}));
    gateSpies.gatedInsert.mockRejectedValue(
      makeGateDeniedError({ outcome: "proposed", proposalId: "prop-abc" }),
    );

    const result = await createSeason(validInput);

    expect(result).toEqual({ ok: true, pendingProposal: "prop-abc" });
    // Telemetry fires ONLY on the applied branch — proposal rows live in
    // change_proposal + gate_evaluation audit tables already.
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("denied (blocked): returns { ok: false, error } and does NOT emit", async () => {
    createClientMock.mockResolvedValue(buildSupabaseMock({}));
    gateSpies.gatedInsert.mockRejectedValue(
      makeGateDeniedError({ outcome: "blocked", reason: "season-overlap-not-allowed" }),
    );

    const result = await createSeason(validInput);

    expect(result).toEqual({ ok: false, error: "season-overlap-not-allowed" });
    expect(emitMock).not.toHaveBeenCalled();
  });
});

describe("updateSeason (gated)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    gateSpies.gatedInsert.mockReset();
    gateSpies.gatedUpdate.mockReset();
    emitMock.mockReset();
  });

  const seasonId = "season-1";
  const workspaceId = "ws-1";
  const currentSeason = {
    season_id: seasonId,
    name: "Sommersesong 2026",
    slug: "sommersesong-2026",
    start_date: "2026-06-01",
    end_date: "2026-08-31",
    status: "draft",
  };

  it("applied: returns { ok: true } and emits 'season updated' with correct shape", async () => {
    createClientMock.mockResolvedValue(buildSupabaseMock({ currentSeason }));
    gateSpies.gatedUpdate.mockResolvedValue({
      data: [{ season_id: seasonId }],
      outcome: "applied",
      exceptionReason: null,
    });

    const result = await updateSeason(seasonId, workspaceId, {
      name: "Høstsesong 2026",
      start_date: "2026-09-01",
      end_date: "2026-11-30",
    });

    expect(result).toEqual({ ok: true });
    expect(gateSpies.gatedUpdate).toHaveBeenCalledTimes(1);
    const [, table, patch, ctx] = gateSpies.gatedUpdate.mock.calls[0] ?? [];
    expect(table).toBe("season");
    expect(patch).toEqual({
      name: "Høstsesong 2026",
      start_date: "2026-09-01",
      end_date: "2026-11-30",
    });
    expect(ctx).toMatchObject({
      entityType: "season",
      entityId: seasonId,
      workspaceId,
      capability: "season:update",
      entityIdColumn: "season_id",
    });

    // REGISTRY FIX — registered `"season updated"` event, matches registry.ts:1085.
    expect(emitMock).toHaveBeenCalledTimes(1);
    const emittedEvent = emitMock.mock.calls[0]?.[0];
    expect(emittedEvent.event).toBe("season updated");
    expect(emittedEvent.event).not.toBe("button clicked");
    expect(emittedEvent.properties).toEqual({
      entity: { entity_type: "season", entity_id: seasonId },
      data: { start_date: "2026-09-01", end_date: "2026-11-30" },
    });
  });

  it("proposed: returns { ok: true, pendingProposal } and does NOT emit", async () => {
    createClientMock.mockResolvedValue(buildSupabaseMock({ currentSeason }));
    gateSpies.gatedUpdate.mockRejectedValue(
      makeGateDeniedError({ outcome: "proposed", proposalId: "prop-upd-1" }),
    );

    const result = await updateSeason(seasonId, workspaceId, { name: "Endret" });

    expect(result).toEqual({ ok: true, pendingProposal: "prop-upd-1" });
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("denied (blocked): returns { ok: false, error } and does NOT emit", async () => {
    createClientMock.mockResolvedValue(buildSupabaseMock({ currentSeason }));
    gateSpies.gatedUpdate.mockRejectedValue(
      makeGateDeniedError({ outcome: "blocked", reason: "authority-missing" }),
    );

    const result = await updateSeason(seasonId, workspaceId, { name: "Endret" });

    expect(result).toEqual({ ok: false, error: "authority-missing" });
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("fetch-fail: returns { ok: false, error: 'Season not found' } and does NOT call gate", async () => {
    createClientMock.mockResolvedValue(buildSupabaseMock({ currentSeason: null }));

    const result = await updateSeason("season-missing", workspaceId, { name: "x" });

    expect(result).toEqual({ ok: false, error: "Season not found" });
    expect(gateSpies.gatedUpdate).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });
});
