/**
 * people-actions.test.ts
 *
 * Unit tests for the `gatedUpdate` migration of profile mutations
 * (ADR-0091 WP3 pilot). Each case mirrors a real gate outcome:
 *
 *   1. applied   — gatedUpdate resolves → { ok: true }
 *   2. proposed  — gatedUpdate throws GateDeniedError({ outcome: 'proposed' })
 *                  → { ok: true, pendingProposal: <id> }
 *   3. denied    — gatedUpdate throws GateDeniedError({ outcome: 'blocked' })
 *                  → { ok: false, error: <reason> }
 *   4. fetch-fail — currentProfile lookup returns null
 *                  → { ok: false, error: 'Profile not found' }
 *   5. no-regress — applied path still emits legacy telemetry event so
 *                   downstream analytics pipelines remain unaffected
 *
 * Mocking pattern mirrors apps/web/src/app/api/schedule/send-message/__tests__/route.test.ts
 * (vi.hoisted → vi.mock per package). `gatedUpdate` is mocked wholesale so
 * we don't exercise the RPC; the contract under test is "call-site glue".
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, gatedUpdateMock, emitMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  gatedUpdateMock: vi.fn(),
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
    gatedUpdate: gatedUpdateMock,
  };
});

vi.mock("@smartout/telemetry", () => ({
  emit: emitMock,
}));

// Import AFTER mocks are registered so the module picks up the mocked deps.
import { GateDeniedError } from "@smartout/supabase/gate-client";
import { updateProfileRole, deactivateProfile, reactivateProfile } from "../people-actions";

/**
 * Builds a minimal Supabase client that supports the shape this file uses:
 *   - auth.getUser()
 *   - from("profile").select("*").eq("profile_id", id).single()
 *   - from("profile").select("profile_id").eq().eq().limit().maybeSingle()
 *     (the resolveActorId path)
 *
 * Only the paths the gated helpers actually traverse are mocked — everything
 * else returns noop stubs so an unexpected call surfaces as `undefined` and
 * fails the assertion, not a cryptic runtime error.
 */
function buildSupabaseMock(opts: {
  currentProfile: Record<string, unknown> | null;
  actorProfileId?: string | null;
}) {
  const currentProfile = opts.currentProfile;
  const actorId = opts.actorProfileId ?? "actor-1";

  const fetchProfileChain = {
    single: vi
      .fn()
      .mockResolvedValue(
        currentProfile ? { data: currentProfile, error: null } : { data: null, error: null },
      ),
  };

  const resolveActorChain = {
    maybeSingle: vi.fn().mockResolvedValue({ data: { profile_id: actorId }, error: null }),
  };

  const from = vi.fn((_table: string) => ({
    select: vi.fn((cols: string) => {
      if (cols === "*") {
        // fetchCurrentProfile path
        return { eq: vi.fn().mockReturnValue(fetchProfileChain) };
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

describe("updateProfileRole (gated)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    gatedUpdateMock.mockReset();
    emitMock.mockReset();
  });

  it("returns { ok: true } when gate applies the write and emits legacy event", async () => {
    // case 1: applied — no pendingProposal
    createClientMock.mockResolvedValue(
      buildSupabaseMock({ currentProfile: { profile_id: "prof-1", role: "employee" } }),
    );
    gatedUpdateMock.mockResolvedValue({
      data: [{ profile_id: "prof-1", role: "manager" }],
      outcome: "applied",
      exceptionReason: null,
    });

    const result = await updateProfileRole("prof-1", "ws-1", "manager");

    expect(result).toEqual({ ok: true });
    expect(gatedUpdateMock).toHaveBeenCalledTimes(1);
    const call = gatedUpdateMock.mock.calls[0] ?? [];
    const [, table, patch, ctx] = call;
    expect(table).toBe("profile");
    expect(patch).toEqual({ role: "manager" });
    expect(ctx).toMatchObject({
      entityType: "profile",
      entityId: "prof-1",
      workspaceId: "ws-1",
      capability: "profile:update:role",
      // PK column override — profile uses `profile_id`, not `id`.
      // Without this the post-gate write would silently match 0 rows.
      entityIdColumn: "profile_id",
    });
    // case 5: no-regress — legacy "profile role updated" still fires on applied path
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "profile role updated" }),
    );
  });

  it("returns { ok: true, pendingProposal } when gate proposes", async () => {
    // case 2: proposed
    createClientMock.mockResolvedValue(
      buildSupabaseMock({ currentProfile: { profile_id: "prof-1", role: "employee" } }),
    );
    gatedUpdateMock.mockRejectedValue(
      new GateDeniedError({
        outcome: "proposed",
        proposalId: "prop-123",
        reason: "framework-trigger-matched",
      }),
    );

    const result = await updateProfileRole("prof-1", "ws-1", "manager");

    expect(result).toEqual({ ok: true, pendingProposal: "prop-123" });
    // pilot intentionally skips "profile update proposed" telemetry —
    // audit trail comes from gate_evaluation + change_proposal rows.
    expect(emitMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: "profile role updated" }),
    );
  });

  it("returns { ok: false, error } when gate denies (blocked)", async () => {
    // case 3: denied
    createClientMock.mockResolvedValue(
      buildSupabaseMock({ currentProfile: { profile_id: "prof-1", role: "employee" } }),
    );
    gatedUpdateMock.mockRejectedValue(
      new GateDeniedError({
        outcome: "blocked",
        proposalId: null,
        reason: "authority-missing",
      }),
    );

    const result = await updateProfileRole("prof-1", "ws-1", "manager");

    expect(result).toEqual({ ok: false, error: "authority-missing" });
    expect(emitMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: "profile role updated" }),
    );
  });

  it("returns { ok: false, error } when current profile not found", async () => {
    // case 4: fetch-fail — fetchCurrentProfile returns null before gate is called
    createClientMock.mockResolvedValue(buildSupabaseMock({ currentProfile: null }));

    const result = await updateProfileRole("prof-missing", "ws-1", "manager");

    expect(result).toEqual({ ok: false, error: "Profile not found" });
    expect(gatedUpdateMock).not.toHaveBeenCalled();
  });
});

describe("deactivateProfile / reactivateProfile (gated)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    gatedUpdateMock.mockReset();
    emitMock.mockReset();
  });

  it("deactivateProfile passes status=offboarding + is_active=false to gate", async () => {
    createClientMock.mockResolvedValue(
      buildSupabaseMock({ currentProfile: { profile_id: "prof-1", status: "active" } }),
    );
    gatedUpdateMock.mockResolvedValue({ data: [], outcome: "applied", exceptionReason: null });

    const result = await deactivateProfile("prof-1", "ws-1");

    expect(result).toEqual({ ok: true });
    const deactivateCall = gatedUpdateMock.mock.calls[0] ?? [];
    const [, , deactivatePatch] = deactivateCall;
    expect(deactivatePatch).toEqual({ status: "offboarding", is_active: false });
  });

  it("reactivateProfile passes status=active + is_active=true and surfaces proposal id", async () => {
    createClientMock.mockResolvedValue(
      buildSupabaseMock({ currentProfile: { profile_id: "prof-1", status: "inactive" } }),
    );
    gatedUpdateMock.mockRejectedValue(
      new GateDeniedError({
        outcome: "proposed",
        proposalId: "prop-456",
        reason: "framework-trigger-matched",
      }),
    );

    const result = await reactivateProfile("prof-1", "ws-1");

    expect(result).toEqual({ ok: true, pendingProposal: "prop-456" });
    const reactivateCall = gatedUpdateMock.mock.calls[0] ?? [];
    const [, , reactivatePatch] = reactivateCall;
    expect(reactivatePatch).toEqual({ status: "active", is_active: true });
  });
});
