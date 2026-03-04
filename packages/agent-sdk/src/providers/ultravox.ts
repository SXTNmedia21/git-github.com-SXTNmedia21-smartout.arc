import { UltravoxSession, UltravoxSessionStatus, Role } from "ultravox-client";
import type {
  VoiceProvider,
  VoiceSession,
  VoiceSessionEvent,
  VoiceSessionEventHandler,
  ClientToolImplementation,
  AgentStatus,
  TranscriptEntry,
} from "../types";

// ---------------------------------------------------------------------------
// Status mapping — Ultravox status strings → AgentStatus
// ---------------------------------------------------------------------------

function toAgentStatusFromEnum(s: UltravoxSessionStatus): AgentStatus {
  switch (s) {
    case UltravoxSessionStatus.IDLE:
      return "idle";
    case UltravoxSessionStatus.CONNECTING:
      return "connecting";
    case UltravoxSessionStatus.LISTENING:
      return "listening";
    case UltravoxSessionStatus.THINKING:
      return "thinking";
    case UltravoxSessionStatus.SPEAKING:
      return "speaking";
    case UltravoxSessionStatus.DISCONNECTING:
      return "disconnecting";
    case UltravoxSessionStatus.DISCONNECTED:
      return "disconnected";
    default:
      return "idle";
  }
}

function toAgentStatus(ultravoxStatus: string): AgentStatus {
  return toAgentStatusFromEnum(ultravoxStatus as UltravoxSessionStatus);
}

// ---------------------------------------------------------------------------
// UltravoxVoiceSession — wraps @ultravox/client UltravoxSession
// ---------------------------------------------------------------------------

class UltravoxVoiceSession implements VoiceSession {
  private session: UltravoxSession;
  private listeners = new Map<VoiceSessionEvent, Set<VoiceSessionEventHandler>>();

  constructor() {
    this.session = new UltravoxSession();
    this.setupEventForwarding();
  }

  get isMicMuted(): boolean {
    return this.session.isMicMuted;
  }

  join(url: string): void {
    this.session.joinCall(url);
  }

  leave(): void {
    this.session.leaveCall();
  }

  muteMic(): void {
    this.session.muteMic();
  }

  unmuteMic(): void {
    this.session.unmuteMic();
  }

  sendText(text: string): void {
    this.session.sendText(text);
  }

  registerTool(name: string, impl: ClientToolImplementation): void {
    this.session.registerToolImplementation(name, (params) => {
      return impl(params as Record<string, unknown>);
    });
  }

  on(event: VoiceSessionEvent, handler: VoiceSessionEventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: VoiceSessionEvent, handler: VoiceSessionEventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  // -------------------------------------------------------------------------
  // Internal event forwarding
  // -------------------------------------------------------------------------

  private emit(event: VoiceSessionEvent, data: unknown): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  private setupEventForwarding(): void {
    // Status changes
    this.session.addEventListener("status", () => {
      const status = toAgentStatus(String(this.session.status ?? "idle"));
      this.emit("status", status);
    });

    // Transcript updates
    this.session.addEventListener("transcripts", () => {
      const transcripts = this.session.transcripts;
      if (transcripts) {
        const formatted: TranscriptEntry[] = transcripts.map((t) => ({
          role: t.speaker === Role.USER ? ("user" as const) : ("agent" as const),
          text: t.text,
        }));
        this.emit("transcript", formatted);
      }
    });

    // Mic state changes
    this.session.addEventListener("mic", () => {
      this.emit("mic", { muted: this.session.isMicMuted });
    });

    // Raw data messages (tool calls, events, etc.)
    this.session.addEventListener("data_message", ((e: Event) => {
      const evt = e as CustomEvent & { message?: Record<string, unknown> };
      const msg = evt.message ?? (evt as unknown as { detail?: Record<string, unknown> }).detail;
      if (msg) {
        this.emit("data", msg);
      }
    }) as EventListener);
  }
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

export function createUltravoxProvider(): VoiceProvider {
  return {
    name: "ultravox",
    createSession(): VoiceSession {
      return new UltravoxVoiceSession();
    },
  };
}
