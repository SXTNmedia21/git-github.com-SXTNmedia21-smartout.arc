/**
 * build-bootstrap-context.test.ts
 *
 * Verifies the server bootstrap builder returns the core role-scoped shape
 * required by the dashboard context contract.
 */

import { describe, expect, it, vi } from "vitest";
import { buildBootstrapContext } from "../build-bootstrap-context";

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "profile") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: "admin" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      // protocol_assignment
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ status: "completed" }, { status: "completed" }],
            error: null,
          }),
        }),
      };
    }),
  }),
}));

describe("buildBootstrapContext", () => {
  it("returns role-scoped context shape", async () => {
    const result = await buildBootstrapContext({
      workspaceId: "w1",
      profileId: "p1",
      pageId: "schedule",
    });

    expect(result.system.page_id).toBe("schedule");
    expect(Array.isArray(result.system.permissions)).toBe(true);
    expect(result.intelligence.readiness_score).toBeTypeOf("number");
  });
});
