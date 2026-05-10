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
