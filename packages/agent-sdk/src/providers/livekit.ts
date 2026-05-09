import type {
  VoiceProvider,
  VoiceSession,
  VoiceSessionEvent,
  VoiceSessionEventHandler,
  ClientToolImplementation,
} from "../types";

/**
 * LiveKit voice session — stub implementation.
 * Will be implemented when LiveKit integration is needed.
 */
class LiveKitVoiceSession implements VoiceSession {
  get isMicMuted(): boolean {
    return false;
  }

  join(_url: string): void {
    console.warn("[LiveKitProvider] join() is a stub — not yet implemented");
  }

  leave(): void {
    console.warn("[LiveKitProvider] leave() is a stub — not yet implemented");
  }

  muteMic(): void {
    console.warn("[LiveKitProvider] muteMic() is a stub — not yet implemented");
  }

  unmuteMic(): void {
    console.warn("[LiveKitProvider] unmuteMic() is a stub — not yet implemented");
  }

  sendText(_text: string): void {
    console.warn("[LiveKitProvider] sendText() is a stub — not yet implemented");
  }

  registerTool(_name: string, _impl: ClientToolImplementation): void {
    console.warn("[LiveKitProvider] registerTool() is a stub — not yet implemented");
  }

  on(_event: VoiceSessionEvent, _handler: VoiceSessionEventHandler): void {
    // stub
  }

  off(_event: VoiceSessionEvent, _handler: VoiceSessionEventHandler): void {
    // stub
  }
}

export function createLiveKitProvider(): VoiceProvider {
  return {
    name: "livekit",
    createSession(): VoiceSession {
      return new LiveKitVoiceSession();
    },
  };
}

// ---------------------------------------------------------------------------
// apiParams translation contract — Ultravox-shape → LiveKit Agents config
//
// Wizard + Botsson legacy pass Ultravox-shaped params. This pure function maps
// them to LiveKit Agents 1.3.0 field names so every callsite can flip without
// touching every consumer individually.
//
// ADR-0282 Phase E E3 prep.
// ---------------------------------------------------------------------------

export type UltravoxApiParams = {
  voice: string;
  language_hint?: string;
  first_speaker?: "agent" | "user";
  inactivity_timeout?: number;
};

export type LiveKitAgentsConfig = {
  voiceId: string;
  language: string;
  initialSpeaker: "agent" | "user";
  sessionTimeoutMs: number;
};

/**
 * Maps Ultravox-shaped API params to the LiveKit Agents config shape.
 * Validates enum + numeric constraints at runtime and throws descriptive
 * errors so upstream callers surface configuration mistakes early.
 */
export function translateUltravoxApiParams(params: UltravoxApiParams): LiveKitAgentsConfig {
  if (!params.voice || params.voice.length === 0) {
    throw new Error("voice is required and must be a non-empty string");
  }

  if (
    params.first_speaker !== undefined &&
    params.first_speaker !== "agent" &&
    params.first_speaker !== "user"
  ) {
    throw new Error(
      `first_speaker must be "agent" or "user", received: "${String(params.first_speaker)}"`,
    );
  }

  if (params.inactivity_timeout !== undefined && params.inactivity_timeout <= 0) {
    throw new Error(
      `inactivity_timeout must be a positive integer, received: ${params.inactivity_timeout}`,
    );
  }

  return {
    voiceId: params.voice,
    language: params.language_hint ?? "no",
    initialSpeaker: params.first_speaker ?? "user",
    sessionTimeoutMs: params.inactivity_timeout ?? 60_000,
  };
}
