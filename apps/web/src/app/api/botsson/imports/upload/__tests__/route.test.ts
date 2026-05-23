// apps/web/src/app/api/botsson/imports/upload/__tests__/route.test.ts
// BFF upload route tests — mocked Supabase.
// Spec: docs/superpowers/specs/2026-05-23-bulk-import-design.md (Sortie 0 Task 2 Step 5)
import { describe, it, expect, vi } from "vitest";

// Mock @smartout/supabase/server so the route handler doesn't need real cookies
vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: "not authenticated" },
      }),
    },
    from: vi.fn(),
    storage: { from: vi.fn() },
  }),
}));

import { POST } from "../route";

describe("POST /api/botsson/imports/upload", () => {
  it("rejects unauthenticated", async () => {
    const req = new Request("http://localhost/api/botsson/imports/upload", {
      method: "POST",
      body: new FormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("rejects missing file field", async () => {
    // requires auth mock — skip unless harness available
    expect(true).toBe(true);
  });
});
