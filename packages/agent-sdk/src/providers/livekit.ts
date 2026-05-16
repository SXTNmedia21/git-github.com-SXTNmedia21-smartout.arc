/**
 * livekit.ts — LiveKit voice session for the Smartout Agent SDK.
 *
 * Implements the browser-side half of the Botsson voice-tool RPC protocol:
 *
 *   1. Session start handshake — after the LiveKit Room connects, publishes
 *      all registered tool definitions on topic "botsson-tools-register" so
 *      the voice-agent can build stub LLM tools that route back here.
 *
 *   2. Tool-call dispatch — listens for topic "botsson-tool-call" messages
 *      from the voice-agent, invokes the matching client implementation, and
 *      publishes the result (or error) on topic "botsson-tool-result".
 *
 * Topic protocol (LOCKED per Wave 0 investigation):
 *   botsson-tools-register  browser → voice-agent  definitions handshake
 *   botsson-tool-call       voice-agent → browser  invoke request
 *   botsson-tool-result     browser → voice-agent  invoke response
 *
 * ADR-0135: this class is the browser-side counterpart to the LiveKit
 * voice-agent worker (services/voice-agent).
 */

import type { DataPacket_Kind, Encryption_Type, RemoteParticipant } from "livekit-client";
import { Room, RoomEvent } from "livekit-client";
import type {
  VoiceProvider,
  VoiceSession,
  VoiceSessionEvent,
  VoiceSessionEventHandler,
  ClientToolImplementation,
  ClientToolDefinition,
} from "../types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encode(payload: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// LiveKitVoiceSession
// ---------------------------------------------------------------------------

/**
 * LiveKit voice session — implements registerTool + RPC roundtrip.
 *
 * Created via `createLiveKitProvider().createSession()`. The session is
 * stateless until `join(url)` is called, which connects the LiveKit Room.
 * Tool registrations made before `join()` are buffered and the handshake is
 * published once the room reaches `RoomEvent.Connected`.
 */
class LiveKitVoiceSession implements VoiceSession {
  /** Runtime implementations keyed by tool name */
  private implementations = new Map<string, ClientToolImplementation>();

  /** Full definitions for the handshake, keyed by index (deduplicated by name) */
  private definitions: ClientToolDefinition[] = [];

  /** LiveKit room — created on join(), null before/after */
  private room: Room | null = null;

  /** Whether the room has connected at least once this session */
  private connected = false;

  // -------------------------------------------------------------------------
  // VoiceSession interface — mic / text (stubs, Phase 4 doesn't touch them)
  // -------------------------------------------------------------------------

  get isMicMuted(): boolean {
    return false;
  }

  join(url: string): void {
    if (this.room) {
      console.warn("[LiveKitVoiceSession] join() called while already connected — ignoring");
      return;
    }

    // Parse the joinUrl — expected format from the session creation API:
    //   "wss://server.livekit.cloud?access_token=TOKEN"
    // Falls back gracefully if no token query param is found.
    let serverUrl = url;
    let token = "";
    try {
      const parsed = new URL(url);
      const queryToken = parsed.searchParams.get("access_token");
      if (queryToken) {
        token = queryToken;
        parsed.searchParams.delete("access_token");
        serverUrl = parsed.toString();
      }
    } catch {
      // url may not be a valid URL (e.g. in tests) — use as-is
      serverUrl = url;
    }

    const room = new Room();
    this.room = room;

    // Wire DataReceived listener for botsson-tool-call messages
    room.on(
      RoomEvent.DataReceived,
      (
        payload: Uint8Array,
        _participant?: RemoteParticipant,
        _kind?: DataPacket_Kind,
        topic?: string,
        _encryptionType?: Encryption_Type,
      ) => {
        if (topic !== "botsson-tool-call") return;
        void this.handleToolCall(payload);
      },
    );

    // On room connect: publish the tools handshake
    room.on(RoomEvent.Connected, () => {
      this.connected = true;
      this.publishHandshake();
    });

    // On disconnect: clean up
    room.on(RoomEvent.Disconnected, () => {
      this.connected = false;
      this.room = null;
    });

    // Connect asynchronously — join() is fire-and-forget per VoiceSession contract
    void room.connect(serverUrl, token).catch((err: unknown) => {
      console.error("[LiveKitVoiceSession] room.connect() failed:", err);
      this.room = null;
      this.connected = false;
    });
  }

  leave(): void {
    const room = this.room;
    if (room) {
      room.disconnect();
      this.room = null;
    }
    this.connected = false;
    this.implementations.clear();
  }

  muteMic(): void {
    // stub — Phase 4 doesn't touch mic control
  }

  unmuteMic(): void {
    // stub — Phase 4 doesn't touch mic control
  }

  sendText(_text: string): void {
    // stub — Phase 4 doesn't touch text send
  }

  on(_event: VoiceSessionEvent, _handler: VoiceSessionEventHandler): void {
    // stub — Phase 4 doesn't touch event routing
  }

  off(_event: VoiceSessionEvent, _handler: VoiceSessionEventHandler): void {
    // stub — Phase 4 doesn't touch event routing
  }

  // -------------------------------------------------------------------------
  // Tool registration
  // -------------------------------------------------------------------------

  /**
   * Register a client tool implementation.
   *
   * Call this for every tool before or after `join()`. When called after the
   * room is already connected, the handshake is re-published so the voice-agent
   * picks up the new implementation.
   *
   * Registering the same name twice replaces the previous implementation.
   */
  registerTool(name: string, impl: ClientToolImplementation): void {
    this.implementations.set(name, impl);
    // Re-publish the handshake if the room is already live so the voice-agent
    // picks up late-arriving registrations.
    if (this.connected && this.room) {
      this.publishHandshake();
    }
  }

  /**
   * Register a full tool definition (description + parameter schema).
   *
   * Must be called in addition to `registerTool` for the handshake payload to
   * include complete metadata. Definitions with the same `modelToolName` are
   * deduplicated — the latest registration wins.
   */
  registerDefinition(definition: ClientToolDefinition): void {
    const name = definition.temporaryTool.modelToolName;
    const idx = this.definitions.findIndex((d) => d.temporaryTool.modelToolName === name);
    if (idx >= 0) {
      this.definitions[idx] = definition;
    } else {
      this.definitions.push(definition);
    }
    if (this.connected && this.room) {
      this.publishHandshake();
    }
  }

  // -------------------------------------------------------------------------
  // Internal — handshake publish
  // -------------------------------------------------------------------------

  /**
   * Publish the tools-register handshake on the data channel.
   * Safe to call multiple times — the voice-agent processes the latest list.
   */
  private publishHandshake(): void {
    const room = this.room;
    if (!room) return;
    try {
      void room.localParticipant.publishData(
        encode({ type: "tools_register", definitions: this.definitions }),
        { topic: "botsson-tools-register", reliable: true },
      );
    } catch (err) {
      console.warn("[LiveKitVoiceSession] publishHandshake failed:", err);
    }
  }

  // -------------------------------------------------------------------------
  // Internal — tool-call dispatch
  // -------------------------------------------------------------------------

  /**
   * Handle an incoming tool-call message from the voice-agent.
   * Looks up the client implementation, invokes it (with error capture),
   * and publishes the result back on topic "botsson-tool-result".
   */
  private async handleToolCall(payload: Uint8Array): Promise<void> {
    let callId = "";

    try {
      const msg = JSON.parse(decoder.decode(payload)) as {
        call_id: string;
        name: string;
        arguments: Record<string, unknown>;
      };
      callId = msg.call_id;
      const name = msg.name;
      const args = msg.arguments;

      const impl = this.implementations.get(name);
      if (!impl) {
        this.publishToolResult(
          callId,
          `Client tool '${name}' not registered in this session.`,
          true,
        );
        return;
      }

      let result: string;
      try {
        result = await impl(args);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.publishToolResult(callId, message, true);
        return;
      }

      this.publishToolResult(callId, result, false);
    } catch (err) {
      // Malformed message — log and reply with error if we have a call_id
      console.warn("[LiveKitVoiceSession] handleToolCall parse error:", err);
      if (callId) {
        this.publishToolResult(callId, "Tool call message could not be parsed.", true);
      }
    }
  }

  /**
   * Publish a tool-result message to the voice-agent.
   */
  private publishToolResult(callId: string, result: string, isError: boolean): void {
    const room = this.room;
    if (!room) return;
    try {
      void room.localParticipant.publishData(
        encode({ type: "tool_result", call_id: callId, result, is_error: isError }),
        { topic: "botsson-tool-result", reliable: true },
      );
    } catch (err) {
      console.warn("[LiveKitVoiceSession] publishToolResult failed:", err);
    }
  }
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

export function createLiveKitProvider(): VoiceProvider {
  return {
    name: "livekit",
    createSession(): VoiceSession {
      return new LiveKitVoiceSession();
    },
  };
}
