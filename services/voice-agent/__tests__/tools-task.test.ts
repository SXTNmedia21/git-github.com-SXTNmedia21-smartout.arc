// tools-task.test.ts — ADR-0298 row 5a vitest coverage.
//
// Tests the 6-tool task surface in tools-task.ts without hitting stage-engine.
// ask() is injected as a vi.fn() — we verify the query strings forwarded to it.
//
// execute() signature (from @livekit/agents FunctionTool):
//   (args, opts: { ctx, toolCallId, abortSignal? }) => Promise<Result>
// For these unit tests opts is irrelevant — we pass a minimal stub.
//
// T8 imports adapter.ts which pulls in @livekit/agents + @livekit/rtc-node
// (native binary). All adapter-layer imports are mocked below to keep tests
// fast and portable.

import { describe, it, expect, vi, beforeAll } from "vitest";
import { buildTaskTools } from "../src/tools-task.js";

// Minimal second-argument stub for FunctionTool.execute()
const OPTS = { ctx: {} as never, toolCallId: "test-call-id" };

// ── T8 mocks — must be declared before dynamic import of adapter ─────────────
// adapter.ts → adapter-internal.ts imports @livekit/rtc-node (Rust native)
// adapter.ts → tools-orb.ts, tools-schedule.ts publish data-channel events
// Mock the entire chain that touches native binaries.

vi.mock("../src/adapter-internal.js", () => ({
  setActiveLkRoom: vi.fn(),
  _publishActivity: vi.fn(),
}));

vi.mock("../src/context.js", () => ({
  getSessionContextSnapshot: vi.fn().mockReturnValue({
    user: { profile_id: "test-profile", role: "employee" },
    workspace: { workspace_id: "test-workspace" },
    route: null,
  }),
  setSessionContext: vi.fn(),
}));

// @livekit/rtc-node ships a native Rust binary; mock the whole package.
vi.mock("@livekit/rtc-node", () => ({
  Room: class MockRoom {},
  RoomEvent: {},
  DataPacketKind: { RELIABLE: 0 },
}));

// ---------------------------------------------------------------------------

describe("tools-task (ADR-0298 row 5a)", () => {
  // ── T1 ───────────────────────────────────────────────────────────────────
  it("T1 list_my_tasks calls ask() with default range query", async () => {
    const ask = vi.fn().mockResolvedValue("ok");
    const tools = buildTaskTools(ask);
    await tools.list_my_tasks.execute({}, OPTS);
    expect(ask).toHaveBeenCalledWith(
      expect.stringContaining("Vis mine åpne oppgaver"),
      "list_my_tasks",
    );
  });

  // ── T2 ───────────────────────────────────────────────────────────────────
  it("T2 complete_task calls ask() with id + source", async () => {
    const ask = vi.fn().mockResolvedValue("ok");
    const tools = buildTaskTools(ask);
    await tools.complete_task.execute({ id: "task-uuid-123", source: "session" }, OPTS);
    const callArg: string = ask.mock.calls[0][0];
    expect(callArg).toContain("task-uuid-123");
    expect(callArg).toContain("session");
    expect(ask.mock.calls[0][1]).toBe("complete_task");
  });

  // ── T3 ───────────────────────────────────────────────────────────────────
  it("T3 create_personal_task includes title + optional fields", async () => {
    const ask = vi.fn().mockResolvedValue("ok");
    const tools = buildTaskTools(ask);
    await tools.create_personal_task.execute(
      {
        title: "Ring leverandør",
        due_at: "2026-05-22T12:00:00Z",
        priority: "high",
      },
      OPTS,
    );
    const callArg: string = ask.mock.calls[0][0];
    expect(callArg).toContain("Ring leverandør");
    expect(callArg).toContain("2026-05-22T12:00:00Z");
    expect(callArg).toContain("high");
  });

  // ── T4 ───────────────────────────────────────────────────────────────────
  it("T4 create_session_task includes session_id + reason", async () => {
    const ask = vi.fn().mockResolvedValue("ok");
    const tools = buildTaskTools(ask);
    await tools.create_session_task.execute(
      {
        session_id: "sess-uuid",
        title: "Sjekk kjøl",
        reason: "Halv-vakt audit krav",
      },
      OPTS,
    );
    const callArg: string = ask.mock.calls[0][0];
    expect(callArg).toContain("sess-uuid");
    expect(callArg).toContain("Sjekk kjøl");
    expect(callArg).toContain("Halv-vakt audit krav");
  });

  // ── T5 ───────────────────────────────────────────────────────────────────
  it("T5 create_day_task includes date + title", async () => {
    const ask = vi.fn().mockResolvedValue("ok");
    const tools = buildTaskTools(ask);
    await tools.create_day_task.execute({ date: "2026-05-22", title: "Stenge tidlig" }, OPTS);
    const callArg: string = ask.mock.calls[0][0];
    expect(callArg).toContain("2026-05-22");
    expect(callArg).toContain("Stenge tidlig");
  });

  // ── T6 ───────────────────────────────────────────────────────────────────
  it("T6 cancel_personal_task includes id + reason", async () => {
    const ask = vi.fn().mockResolvedValue("ok");
    const tools = buildTaskTools(ask);
    await tools.cancel_personal_task.execute(
      { id: "task-uuid", reason: "Ikke relevant lenger" },
      OPTS,
    );
    const callArg: string = ask.mock.calls[0][0];
    expect(callArg).toContain("task-uuid");
    expect(callArg).toContain("Ikke relevant lenger");
  });

  // ── T7 ───────────────────────────────────────────────────────────────────
  it("T7 buildTaskTools returns exactly 6 keys", () => {
    const tools = buildTaskTools(vi.fn());
    expect(Object.keys(tools).sort()).toEqual([
      "cancel_personal_task",
      "complete_task",
      "create_day_task",
      "create_personal_task",
      "create_session_task",
      "list_my_tasks",
    ]);
  });

  // ── T8 ───────────────────────────────────────────────────────────────────
  it("T8 buildAllBotssonTools merges task tools", async () => {
    const { buildAllBotssonTools } = await import("../src/adapter.js");
    const tools = buildAllBotssonTools();
    expect(tools).toHaveProperty("list_my_tasks");
    expect(tools).toHaveProperty("complete_task");
    expect(tools).toHaveProperty("create_personal_task");
    expect(tools).toHaveProperty("create_session_task");
    expect(tools).toHaveProperty("create_day_task");
    expect(tools).toHaveProperty("cancel_personal_task");
  });
});
