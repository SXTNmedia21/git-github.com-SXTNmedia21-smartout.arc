import { describe, it, expect, vi, beforeEach } from "vitest";
import { pinOppgaverContextAction } from "../pin-oppgaver-context";

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({ insert: vi.fn(async () => ({ error: null })) })),
  })),
}));

vi.mock("../_shared", () => ({
  resolveCurrentProfile: vi.fn(async () => ({
    profileId: "p1",
    workspaceId: "w1",
    role: "manager",
  })),
}));

describe("pinOppgaverContextAction (L-0177 fail-fast)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Zod-invalid input → { ok: false }", async () => {
    const res = await pinOppgaverContextAction({
      date_iso: "not-a-date",
      active_view: "area",
      active_filters: {},
    });
    expect(res).toEqual({ ok: false });
  });

  it("missing profile → { ok: false }", async () => {
    const shared = await import("../_shared");
    (shared.resolveCurrentProfile as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null,
    );
    const res = await pinOppgaverContextAction({
      date_iso: "2026-05-24",
      active_view: "area",
      active_filters: {},
    });
    expect(res).toEqual({ ok: false });
  });

  it("happy path returns { ok: true }", async () => {
    const res = await pinOppgaverContextAction({
      date_iso: "2026-05-24",
      active_view: "area",
      active_filters: {},
    });
    expect(res).toEqual({ ok: true });
  });
});
