import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveAvailability } from "../welcome-wizard-actions";

// Mock resolveCurrentProfile from _shared (the actual import source).
const resolveCurrentProfileMock = vi.fn();
vi.mock("../_shared", () => ({
  resolveCurrentProfile: (...args: unknown[]) => resolveCurrentProfileMock(...args),
}));

// Mock createClient from @smartout/supabase/server (the actual import source).
const supabaseMock = {
  from: vi.fn(),
};
vi.mock("@smartout/supabase/server", () => ({
  createClient: async () => supabaseMock,
}));

// Mock telemetry — emit is fire-and-forget; nonEmpty passthrough for test clarity.
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn(async () => undefined),
  nonEmpty: (s: string | null | undefined) => s as string,
}));

// Default happy-path profile.
const defaultProfile = {
  profileId: "p-1",
  workspaceId: "w-1",
  role: "employee",
};

describe("saveAvailability", () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    resolveCurrentProfileMock.mockReset();
    resolveCurrentProfileMock.mockResolvedValue(defaultProfile);
  });

  it("rejects invalid weekday codes", async () => {
    const r = await saveAvailability({ unavailableDays: ["XX" as never] });
    expect(r.ok).toBe(false);
  });

  it("inserts a row per unavailable day with RRULE weekly", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    // Chain: .delete().eq().eq().eq() returns { error: null }
    const delBuilder = {
      eq: vi.fn().mockReturnThis(),
    };
    // Last .eq() in the chain needs to resolve.
    let eqCallCount = 0;
    delBuilder.eq.mockImplementation(function (this: typeof delBuilder) {
      eqCallCount++;
      if (eqCallCount >= 3) {
        // Third .eq() call — resolve with error: null.
        return Promise.resolve({ error: null });
      }
      return delBuilder;
    });

    supabaseMock.from.mockReturnValue({
      delete: () => delBuilder,
      insert,
    });

    const r = await saveAvailability({ unavailableDays: ["MO", "WE"] });
    expect(r.ok).toBe(true);
    expect(insert).toHaveBeenCalledOnce();
    const rows = (insert.mock.calls[0]?.[0] ?? []) as Array<{
      preference_type: string;
      rrule: string;
      reason: string;
    }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      preference_type: "unavailable",
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      reason: "onboarding-wizard",
    });
    expect(rows[1]).toMatchObject({
      rrule: "FREQ=WEEKLY;BYDAY=WE",
    });
  });

  it("clears prior wizard rows then inserts nothing when all days available", async () => {
    const insert = vi.fn();
    let eqCallCount = 0;
    const delBuilder = {
      eq: vi.fn().mockImplementation(function (this: typeof delBuilder) {
        eqCallCount++;
        if (eqCallCount >= 3) {
          return Promise.resolve({ error: null });
        }
        return delBuilder;
      }),
    };

    supabaseMock.from.mockReturnValue({
      delete: () => delBuilder,
      insert,
    });

    const r = await saveAvailability({ unavailableDays: [] });
    expect(r.ok).toBe(true);
    expect(insert).not.toHaveBeenCalled();
  });
});
