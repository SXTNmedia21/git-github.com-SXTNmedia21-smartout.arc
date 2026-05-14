/**
 * Tests for LiveKitVoiceSession — registerTool + RPC roundtrip.
 *
 * Strategy: mock livekit-client so Room is fully in-process. The mock Room
 * exposes a `simulateDataReceived(topic, payload)` helper that fires the
 * DataReceived event directly, allowing us to drive the full RPC cycle
 * without a real WebSocket connection.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock livekit-client
// ---------------------------------------------------------------------------

type DataReceivedCallback = (
  payload: Uint8Array,
  participant: undefined,
  kind: undefined,
  topic: string,
) => void;

type ConnectedCallback = () => void;
type DisconnectedCallback = () => void;

/**
 * Minimal mock of a LiveKit Room.
 * Stores event listeners and exposes test helpers.
 */
class MockLocalParticipant {
  publishedMessages: Array<{ payload: Uint8Array; topic: string; reliable: boolean }> = [];

  publishData(data: Uint8Array, options?: { topic?: string; reliable?: boolean }): Promise<void> {
    this.publishedMessages.push({
      payload: data,
      topic: options?.topic ?? "",
      reliable: options?.reliable ?? false,
    });
    return Promise.resolve();
  }
}

class MockRoom {
  localParticipant = new MockLocalParticipant();
  private dataListeners: DataReceivedCallback[] = [];
  private connectedListeners: ConnectedCallback[] = [];
  private disconnectedListeners: DisconnectedCallback[] = [];
  connectCalled = false;
  connectUrl = "";
  connectToken = "";
  disconnectCalled = false;

  on(event: string, cb: (...args: unknown[]) => void): this {
    if (event === "dataReceived") {
      this.dataListeners.push(cb as DataReceivedCallback);
    } else if (event === "connected") {
      this.connectedListeners.push(cb as ConnectedCallback);
    } else if (event === "disconnected") {
      this.disconnectedListeners.push(cb as DisconnectedCallback);
    }
    return this;
  }

  connect(url: string, token: string): Promise<void> {
    this.connectCalled = true;
    this.connectUrl = url;
    this.connectToken = token;
    return Promise.resolve();
  }

  disconnect(): void {
    this.disconnectCalled = true;
    // Fire disconnected event
    for (const cb of this.disconnectedListeners) {
      cb();
    }
  }

  // Test helpers

  /** Simulate the room becoming Connected (triggers handshake publish) */
  simulateConnected(): void {
    for (const cb of this.connectedListeners) {
      cb();
    }
  }

  /** Simulate an incoming data message from the voice-agent */
  simulateDataReceived(topic: string, payload: unknown): void {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    for (const cb of this.dataListeners) {
      cb(bytes, undefined, undefined, topic);
    }
  }

  /** Decode a published message at the given index */
  decodeMessage(index: number): unknown {
    const msg = this.localParticipant.publishedMessages[index];
    if (!msg) throw new Error(`No message at index ${index}`);
    return JSON.parse(new TextDecoder().decode(msg.payload)) as unknown;
  }
}

let currentMockRoom: MockRoom;

vi.mock("livekit-client", () => {
  return {
    Room: class MockRoomCtor {
      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        currentMockRoom = new MockRoom();
        return currentMockRoom;
      }
    },
    RoomEvent: {
      DataReceived: "dataReceived",
      Connected: "connected",
      Disconnected: "disconnected",
    },
  };
});

// ---------------------------------------------------------------------------
// Import session factory AFTER mock is set up
// ---------------------------------------------------------------------------

const { createLiveKitProvider } = await import("../livekit");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession() {
  const provider = createLiveKitProvider();
  const session = provider.createSession();
  return session;
}

function decodeMsg(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LiveKitVoiceSession", () => {
  beforeEach(() => {
    // Reset published messages between tests
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. registerTool stores impl; calling twice overwrites
  // -------------------------------------------------------------------------
  it("registerTool stores impl in map; second call for same name overwrites", async () => {
    const session = makeSession();
    session.join("wss://fake");
    currentMockRoom.simulateConnected();

    const firstImpl = vi.fn().mockResolvedValue("first");
    const secondImpl = vi.fn().mockResolvedValue("second");

    session.registerTool("my_tool", firstImpl);
    session.registerTool("my_tool", secondImpl);

    // Trigger a call to verify the latest impl is used
    currentMockRoom.simulateDataReceived("botsson-tool-call", {
      type: "tool_call",
      call_id: "c1",
      name: "my_tool",
      arguments: {},
    });

    // Wait for the async handleToolCall to settle
    await new Promise((r) => setTimeout(r, 0));

    expect(firstImpl).not.toHaveBeenCalled();
    expect(secondImpl).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // 2. Session-start handshake publishes botsson-tools-register
  // -------------------------------------------------------------------------
  it("publishes botsson-tools-register with all definitions when session connects", () => {
    const session = makeSession();
    session.join("wss://fake");

    const def1 = {
      temporaryTool: {
        modelToolName: "navigate",
        description: "Navigate to a page",
        dynamicParameters: [],
        client: {} as Record<string, never>,
      },
    };
    const def2 = {
      temporaryTool: {
        modelToolName: "show_schedule",
        description: "Show the schedule",
        dynamicParameters: [],
        client: {} as Record<string, never>,
      },
    };

    // Register definitions before connect fires
    if ("registerDefinition" in session && typeof session.registerDefinition === "function") {
      session.registerDefinition(def1);
      session.registerDefinition(def2);
    }

    // Trigger connected event — handshake fires
    currentMockRoom.simulateConnected();

    const messages = currentMockRoom.localParticipant.publishedMessages;
    const handshake = messages.find((m) => m.topic === "botsson-tools-register");
    expect(handshake).toBeDefined();
    expect(handshake!.reliable).toBe(true);

    const body = decodeMsg(handshake!.payload) as {
      type: string;
      definitions: unknown[];
    };
    expect(body.type).toBe("tools_register");
    expect(body.definitions).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // 3. DataReceived botsson-tool-call → impl invoked → botsson-tool-result
  // -------------------------------------------------------------------------
  it("DataReceived botsson-tool-call invokes impl and publishes tool-result", async () => {
    const session = makeSession();
    session.join("wss://fake");
    currentMockRoom.simulateConnected();

    const impl = vi.fn().mockResolvedValue("I navigated to /dashboard");
    session.registerTool("navigate", impl);

    currentMockRoom.simulateDataReceived("botsson-tool-call", {
      type: "tool_call",
      call_id: "abc-123",
      name: "navigate",
      arguments: { path: "/dashboard" },
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(impl).toHaveBeenCalledWith({ path: "/dashboard" });

    const messages = currentMockRoom.localParticipant.publishedMessages;
    const resultMsg = messages.find((m) => m.topic === "botsson-tool-result");
    expect(resultMsg).toBeDefined();
    expect(resultMsg!.reliable).toBe(true);

    const body = decodeMsg(resultMsg!.payload) as {
      type: string;
      call_id: string;
      result: string;
      is_error: boolean;
    };
    expect(body.type).toBe("tool_result");
    expect(body.call_id).toBe("abc-123");
    expect(body.result).toBe("I navigated to /dashboard");
    expect(body.is_error).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 4. Unknown tool name → is_error: true with "not registered" message
  // -------------------------------------------------------------------------
  it("unknown tool name publishes is_error:true with 'not registered' message", async () => {
    const session = makeSession();
    session.join("wss://fake");
    currentMockRoom.simulateConnected();

    currentMockRoom.simulateDataReceived("botsson-tool-call", {
      type: "tool_call",
      call_id: "xyz-999",
      name: "nonexistent_tool",
      arguments: {},
    });

    await new Promise((r) => setTimeout(r, 0));

    const messages = currentMockRoom.localParticipant.publishedMessages;
    const resultMsg = messages.find((m) => m.topic === "botsson-tool-result");
    expect(resultMsg).toBeDefined();

    const body = decodeMsg(resultMsg!.payload) as {
      type: string;
      call_id: string;
      result: string;
      is_error: boolean;
    };
    expect(body.call_id).toBe("xyz-999");
    expect(body.is_error).toBe(true);
    expect(body.result).toContain("nonexistent_tool");
    expect(body.result).toContain("not registered");
  });

  // -------------------------------------------------------------------------
  // 5. Implementation throws → is_error: true with error message
  // -------------------------------------------------------------------------
  it("impl throws → publishes is_error:true with the error message", async () => {
    const session = makeSession();
    session.join("wss://fake");
    currentMockRoom.simulateConnected();

    const throwingImpl = vi.fn().mockRejectedValue(new Error("DB connection failed"));
    session.registerTool("query_db", throwingImpl);

    currentMockRoom.simulateDataReceived("botsson-tool-call", {
      type: "tool_call",
      call_id: "err-001",
      name: "query_db",
      arguments: { sql: "SELECT 1" },
    });

    await new Promise((r) => setTimeout(r, 0));

    const messages = currentMockRoom.localParticipant.publishedMessages;
    const resultMsg = messages.find((m) => m.topic === "botsson-tool-result");
    expect(resultMsg).toBeDefined();

    const body = decodeMsg(resultMsg!.payload) as {
      type: string;
      call_id: string;
      result: string;
      is_error: boolean;
    };
    expect(body.call_id).toBe("err-001");
    expect(body.is_error).toBe(true);
    expect(body.result).toBe("DB connection failed");
  });

  // -------------------------------------------------------------------------
  // 6. leave() clears implementations and disconnects room
  // -------------------------------------------------------------------------
  it("leave() disconnects the room and clears impl map", async () => {
    const session = makeSession();
    session.join("wss://fake");
    currentMockRoom.simulateConnected();

    session.registerTool("some_tool", () => "result");
    session.leave();

    expect(currentMockRoom.disconnectCalled).toBe(true);

    // After leave, a stale tool-call should not publish anything
    // (room ref is cleared)
    const prevCount = currentMockRoom.localParticipant.publishedMessages.length;
    currentMockRoom.simulateDataReceived("botsson-tool-call", {
      type: "tool_call",
      call_id: "late-001",
      name: "some_tool",
      arguments: {},
    });

    await new Promise((r) => setTimeout(r, 0));

    // No new messages after leave
    expect(currentMockRoom.localParticipant.publishedMessages.length).toBe(prevCount);
  });
});
