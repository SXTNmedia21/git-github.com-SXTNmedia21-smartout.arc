import { describe, it, expect, vi, beforeEach } from "vitest";

const { resolveMobileActor, createSignedUrl, fetchMock } = vi.hoisted(() => ({
  resolveMobileActor: vi.fn(),
  createSignedUrl: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("../../_shared/actor", () => ({ resolveMobileActor }));
vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from: () => ({ createSignedUrl }) } }),
}));
vi.stubGlobal("fetch", fetchMock);

import { POST } from "../extract/route";

function req(body: unknown, auth = "Bearer t") {
  return new Request("http://x/api/mobile/routine/extract", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mobile/routine/extract", () => {
  beforeEach(() => {
    resolveMobileActor.mockReset();
    createSignedUrl.mockReset();
    fetchMock.mockReset();
  });

  it("401 when no bearer", async () => {
    const res = await POST(req({ storage_path: "w/p/x.jpg" }, ""));
    expect(res.status).toBe(401);
  });

  it("forwards a signed URL and returns the engine draft", async () => {
    resolveMobileActor.mockResolvedValue({ workspaceId: "w", profileId: "p", userId: "u" });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed/x.jpg" }, error: null });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, draft: { routine_name: "R" } }), { status: 200 }),
    );
    const res = await POST(req({ storage_path: "w/p/x.jpg" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.draft.routine_name).toBe("R");
    const sent = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(sent.image_url).toBe("https://signed/x.jpg");
  });

  it("403 when storage_path is not in the actor workspace", async () => {
    resolveMobileActor.mockResolvedValue({ workspaceId: "w", profileId: "p" });
    const res = await POST(req({ storage_path: "OTHER/p/x.jpg" }));
    expect(res.status).toBe(403);
  });
});
