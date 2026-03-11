import type { MissionId } from "@smartout/ai/missions";

// ---------------------------------------------------------------------------
// Agent status — provider-agnostic
// ---------------------------------------------------------------------------

export type AgentStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "disconnecting"
  | "disconnected";

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

export type TranscriptEntry = {
  role: "user" | "agent";
  text: string;
};

// ---------------------------------------------------------------------------
// Debug log
// ---------------------------------------------------------------------------

export type DebugEntryType =
  | "status"
  | "tool_call"
  | "tool_result"
  | "context_push"
  | "inference"
  | "event"
  | "api_request"
  | "api_response"
  | "api_error";

export type DebugEntry = {
  timestamp: number;
  type: DebugEntryType;
  content: string;
};

// ---------------------------------------------------------------------------
// Client tool — the Ultravox "temporaryTool" format
// ---------------------------------------------------------------------------

export type ClientToolParameter = {
  name: string;
  location: "PARAMETER_LOCATION_BODY";
  schema: Record<string, unknown>;
  required?: boolean;
};

export type ClientToolDefinition = {
  temporaryTool: {
    modelToolName: string;
    description: string;
    dynamicParameters: ClientToolParameter[];
    client: Record<string, never>;
  };
};

export type ClientToolImplementation = (
  params: Record<string, unknown>,
) => string | Promise<string>;

/**
 * A client-side tool that the voice agent can invoke.
 * Combines the Ultravox definition with its runtime implementation.
 */
export type ClientTool = {
  /** Unique tool name — must match `modelToolName` in the definition */
  name: string;
  /** Human-readable description for the LLM */
  description: string;
  /** Parameter definitions sent to Ultravox */
  parameters: ClientToolParameter[];
  /** Runtime implementation called when the agent invokes this tool */
  implementation: ClientToolImplementation;
};

/**
 * A set of client tools, ready to be registered with a voice provider.
 */
export type ClientToolKit = {
  definitions: ClientToolDefinition[];
  implementations: Record<string, ClientToolImplementation>;
};

// ---------------------------------------------------------------------------
// Voice provider
// ---------------------------------------------------------------------------

export type VoiceSessionEvent = "status" | "transcript" | "data" | "mic";

export type VoiceSessionEventHandler = (data: unknown) => void;

export type VoiceSession = {
  join(url: string): void;
  leave(): void;
  muteMic(): void;
  unmuteMic(): void;
  isMicMuted: boolean;
  sendText(text: string): void;
  registerTool(name: string, impl: ClientToolImplementation): void;
  on(event: VoiceSessionEvent, handler: VoiceSessionEventHandler): void;
  off(event: VoiceSessionEvent, handler: VoiceSessionEventHandler): void;
};

export type VoiceProvider = {
  name: string;
  createSession(): VoiceSession;
};

// ---------------------------------------------------------------------------
// Agent config — the ONE hook config
// ---------------------------------------------------------------------------

export type AgentChannel = "voice" | "chat" | "phone";

export type AgentConfig = {
  /** Mission ID — loaded from the mission registry */
  missionId: MissionId;
  /** Client-side tools the agent can invoke */
  tools?: ClientToolKit;
  /** Voice provider to use. Default: "ultravox" */
  provider?: "ultravox" | "livekit";
  /** Communication channel. Default: "voice" */
  channel?: AgentChannel;
  /** Auto-start the session on mount */
  autoStart?: boolean;
  /** API endpoint to call for session creation. Default: "/api/wizard/start" */
  apiEndpoint?: string;
  /** Extra body params sent to the session creation API */
  apiParams?: Record<string, unknown>;
  /** Called when a debug event occurs */
  onDebug?: (entry: DebugEntry) => void;
  /** Called when the session status changes */
  onStatusChange?: (status: AgentStatus) => void;
  /** Called when the transcript updates */
  onTranscript?: (transcript: TranscriptEntry[]) => void;
};

// ---------------------------------------------------------------------------
// Agent session — return type of useAgent
// ---------------------------------------------------------------------------

export type AgentSession = {
  status: AgentStatus;
  isConnected: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  currentText: string;
  transcript: TranscriptEntry[];
  debugLog: DebugEntry[];
  startSession: () => Promise<void>;
  endSession: () => void;
  toggleMic: () => void;
  sendContext: (text: string) => void;
};
