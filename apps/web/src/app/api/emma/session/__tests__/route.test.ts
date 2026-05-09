import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/auth/get-server-context", () => ({
  getServerContext: vi.fn(),
}));

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getServerContext } from "@/lib/auth/get-server-context";
import { createClient } from "@smartout/supabase/server";

describe("/api/emma/session GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with session payload for authenticated user with workspace", async () => {
    vi.mocked(getServerContext).mockResolvedValue({
      user: { id: "user-1" } as never,
      profile: { profile_id: "profile-1", workspace_id: "ws-1", role: "employee" } as never,
      accessToken: undefined,
      authMethod: "cookie" as const,
    });

    vi.mocked(createClient).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: "session-1",
                      mode: "agent",
                      mission_id: "onboarding-interview",
                      state: { current_section: "season", answered: ["business"] },
                    },
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      }),
    } as never);

    const req = new Request("http://localhost/api/emma/session");
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      sessionId: "session-1",
      missionId: "onboarding-interview",
      state: { current_section: "season", answered: ["business"] },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerContext).mockResolvedValue(null);

    const req = new Request("http://localhost/api/emma/session");
    const res = await GET(req as never);

    expect(res.status).toBe(401);
  });

  it("returns 404 when no engine_sessions row exists for workspace", async () => {
    vi.mocked(getServerContext).mockResolvedValue({
      user: { id: "user-1" } as never,
      profile: { profile_id: "profile-1", workspace_id: "ws-1", role: "employee" } as never,
      accessToken: undefined,
      authMethod: "cookie" as const,
    });

    vi.mocked(createClient).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as never);

    const req = new Request("http://localhost/api/emma/session");
    const res = await GET(req as never);

    expect(res.status).toBe(404);
  });
});
