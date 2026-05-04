import { describe, it, expect, vi } from "vitest";
import { deriveProfileId, ActorDerivationError } from "../derive-profile-id.js";

function mockSupabase(rows: unknown) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: rows, error: null })),
          })),
        })),
      })),
    })),
  } as unknown as Parameters<typeof deriveProfileId>[2];
}

describe("deriveProfileId", () => {
  it("returns branded profile_id on happy path", async () => {
    const supabase = mockSupabase({ profile_id: "11111111-1111-1111-1111-111111111111" });
    const pid = await deriveProfileId("user-1", "ws-1", supabase);
    expect(pid).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("throws ActorDerivationError when no profile row", async () => {
    const supabase = mockSupabase(null);
    await expect(deriveProfileId("user-1", "ws-1", supabase)).rejects.toThrow(ActorDerivationError);
  });

  it("throws ActorDerivationError when profile_id is empty string (would fail brand)", async () => {
    const supabase = mockSupabase({ profile_id: "" });
    await expect(deriveProfileId("user-1", "ws-1", supabase)).rejects.toThrow(ActorDerivationError);
  });
});
