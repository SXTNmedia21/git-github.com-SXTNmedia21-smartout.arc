import { describe, it, expect, vi, beforeEach } from "vitest";

const { resolveMobileActor, rpc, emit } = vi.hoisted(() => ({
  resolveMobileActor: vi.fn(),
  rpc: vi.fn(),
  emit: vi.fn(),
}));
vi.mock("../../_shared/actor", () => ({ resolveMobileActor }));
vi.mock("@smartout/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("@smartout/telemetry", () => ({ emit, nonEmpty: (v: string) => v }));

import { POST } from "../commit/route";

const DRAFT = {
  routine_name: "Åpningsrutine",
  trigger_type: "scheduled",
  trigger_config: { times: ["07:00"] },
  location_id: "c0000000-0000-0000-0000-000000000000",
  new_location: null,
  team_ids: [],
  protocol_id: null,
  steps: [{ title: "Lås opp", description: "dør", is_required: true, estimated_minutes: null }],
  source_reference: "w/p/x.jpg",
};
function req(body: unknown, auth = "Bearer t") {
  return new Request("http://x/api/mobile/routine/commit", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mobile/routine/commit", () => {
  beforeEach(() => {
    resolveMobileActor.mockReset();
    rpc.mockReset();
    emit.mockReset();
  });

  it("403 when gate denies", async () => {
    resolveMobileActor.mockResolvedValue({ workspaceId: "w", profileId: "p" });
    rpc.mockResolvedValueOnce({ data: { allow: false, reason: "ikke_tillatt" }, error: null });
    const res = await POST(req(DRAFT));
    expect(res.status).toBe(403);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("commits + emits created_from_image + governance_unassigned (null protocol)", async () => {
    resolveMobileActor.mockResolvedValue({ workspaceId: "w", profileId: "p" });
    rpc.mockResolvedValueOnce({ data: { allow: true }, error: null }).mockResolvedValueOnce({
      data: {
        ok: true,
        routine_id: "r-1",
        procedure_id: "pc-1",
        location_id: "loc-1",
        governance_status: "unassigned",
      },
      error: null,
    });
    const res = await POST(req(DRAFT));
    expect(res.status).toBe(200);
    expect((await res.json()).routine_id).toBe("r-1");
    const events = emit.mock.calls.map((c) => (c[0] as { event: string }).event);
    expect(events).toContain("routine.created_from_image");
    expect(events).toContain("routine.governance_unassigned");
  });
});
