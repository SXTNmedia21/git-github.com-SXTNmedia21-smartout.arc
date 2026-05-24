import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
const createClientMock = vi.fn(async () => ({ from: fromMock }));
const resolveCurrentProfileMock = vi.fn();

vi.mock("@smartout/supabase/server", () => ({
  createClient: () => createClientMock(),
}));
vi.mock("../_shared", () => ({
  resolveCurrentProfile: () => resolveCurrentProfileMock(),
}));

import { pinDayControlPanelContextAction } from "../pin-day-control-panel-context";

describe("pinDayControlPanelContextAction", () => {
  beforeEach(() => {
    insertMock.mockReset().mockResolvedValue({ error: null });
    fromMock.mockClear();
    createClientMock.mockClear();
    resolveCurrentProfileMock.mockReset();
  });

  it("writes engine_memory row with surface=day_control_panel discriminator", async () => {
    resolveCurrentProfileMock.mockResolvedValue({
      profileId: "p-1",
      workspaceId: "ws-1",
    });

    const result = await pinDayControlPanelContextAction({
      sessionId: "00000000-0000-0000-0000-000000000001",
      departmentName: "Sal",
      date: "2026-05-23",
    });

    expect(result.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("engine_memory");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: "p-1",
        workspace_id: "ws-1",
        memory_type: "fact",
        content: expect.stringContaining("via DayControlPanel"),
      }),
    );
  });

  it("L-0177 fail-fast: returns ok:false when profile cannot be resolved", async () => {
    resolveCurrentProfileMock.mockResolvedValue(null);

    const result = await pinDayControlPanelContextAction({
      sessionId: "00000000-0000-0000-0000-000000000001",
      departmentName: "Sal",
      date: "2026-05-23",
    });

    expect(result.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns ok:false on invalid input shape (Zod guard)", async () => {
    const result = await pinDayControlPanelContextAction({
      sessionId: "not-a-uuid",
      departmentName: "",
      date: "",
    } as never);

    expect(result.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
