// types.ts — Canonical type definitions for the Botsson SDK.
//
// This is the single source of truth for all Botsson harness types.
// BotssonActivityEvent is defined here and MUST NOT be redefined in
// apps/web or services — import from this package instead.

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** Voice + chat session lifecycle state */
export type BotssonStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "disconnecting"
  | "disconnected";

/** Which surface Botsson is active on */
export type BotssonMode = "idle" | "voice" | "chat";

// ---------------------------------------------------------------------------
// Chat types
// ---------------------------------------------------------------------------

/** A single turn in a chat conversation */
export type ChatTurn = {
  role: "user" | "assistant";
  text: string;
  /** ISO timestamp — set by the client when the turn was appended */
  timestamp: string;
};

/** Resolved capability + intent from stage-engine */
export type ChatIntent = {
  capability: string;
  confidence: number;
};

/** Payload returned by the chat client's askSmartout() */
export type ChatReply = {
  text: string;
  sessionId: string;
  intent?: ChatIntent;
};

// ---------------------------------------------------------------------------
// Activity events — streamed from voice-agent over LiveKit data channel
// These mirror the schema from services/voice-agent/src/adapter.ts:publishActivity
// ---------------------------------------------------------------------------

/** Voice-agent connected to the LiveKit room */
export type ActivityConnected = {
  type: "connected";
  roomName: string;
  agent: string;
  provider: string;
  voice: string;
  ts: number;
};

/** Agent invoked a tool toward stage-engine */
export type ActivityToolCall = {
  type: "tool_call";
  tool: string;
  label: string;
  query: string;
  ts: number;
};

/** Stage-engine responded to a tool call */
export type ActivityToolResponse = {
  type: "tool_response";
  tool: string;
  label: string;
  durationMs: number;
  response: string;
  ts: number;
};

/** Stage-engine returned an intent classification */
export type ActivityIntent = {
  type: "intent";
  capability: string;
  confidence: number;
  ts: number;
};

/** Discriminated union of all activity event shapes */
export type BotssonActivityEvent =
  | ActivityConnected
  | ActivityToolCall
  | ActivityToolResponse
  | ActivityIntent;

// ---------------------------------------------------------------------------
// SDK config
// ---------------------------------------------------------------------------

/** Configuration passed to useBotsson() */
export type BotssonAgentConfig = {
  /** Workspace ID — required for chat requests */
  workspaceId: string;
  /**
   * BFF endpoint that returns { token, serverUrl, roomName } for LiveKit.
   * Maps to the livekit-token Edge Function via a Next.js BFF proxy.
   * Default: "/api/botsson/voice/token"
   */
  tokenEndpoint?: string;
  /**
   * BFF endpoint for chat messages (POST /api/emma/chat).
   * Default: "/api/emma/chat"
   */
  chatEndpoint?: string;
  /**
   * Optional mission ID forwarded as context to stage-engine.
   * When absent, stage-engine uses default intent routing.
   */
  missionId?: string;
  /**
   * Page context hint — e.g. "/dashboard/schedule".
   * Sent to stage-engine so the intent-classifier can bias capability selection.
   */
  pageContext?: string;
  /** Called on each status transition — useful for external UI wiring */
  onStatusChange?: (status: BotssonStatus) => void;
};

// ---------------------------------------------------------------------------
// Token endpoint response
// ---------------------------------------------------------------------------

/** Shape returned by /api/botsson/voice/token (and the livekit-token Edge Function) */
export type LiveKitTokenResponse = {
  token: string;
  serverUrl: string;
  roomName: string;
  profileId: string;
  purpose: "ai_voice";
  voiceParticipation: "listen_only" | "interactive";
};
