// livekit-voice.ts — Real LiveKit voice provider for Botsson.
//
// Replaces the stub in packages/agent-sdk/src/providers/livekit.ts.
// This provider owns the full Room lifecycle:
//   connect → mic publish → audio attach → status inference → activity ingestion
//
// Status inference uses RoomEvent.ActiveSpeakersChanged because
// LiveKit does not expose a dedicated "agent thinking" event. We infer:
//   - Room connected, no one speaking       → "listening"
//   - Remote participant is speaking        → "speaking"
//   - tool_call received on data channel    → "thinking" until tool_response
//
// ADR-0135 note: this provider is the web-side counterpart to the
// LiveKit voice-agent worker (services/voice-agent). The worker
// auto-joins rooms; we only need to mint a token and connect.

import type {
  Participant,
  RemoteTrackPublication,
  RemoteTrack,
  DataPacket_Kind,
  Encryption_Type,
  LocalTrack,
} from "livekit-client";
import { Room, RoomEvent, Track, RemoteParticipant } from "livekit-client";
import type { BotssonStatus, BotssonActivityEvent } from "../types";

// ---------------------------------------------------------------------------
// Status inference helpers
// ---------------------------------------------------------------------------

/**
 * Infer Botsson status from active speakers list.
 * LiveKit fires RoomEvent.ActiveSpeakersChanged with ALL active speakers
 * (Participant[] — includes local). We care only about remote speakers
 * (the AI agent side).
 */
function inferStatus(activeSpeakers: Participant[], pendingThinking: boolean): BotssonStatus {
  const remoteActive = activeSpeakers.some((s) => s instanceof RemoteParticipant);
  if (remoteActive) return "speaking";
  if (pendingThinking) return "thinking";
  return "listening";
}

// ---------------------------------------------------------------------------
// LiveKitVoiceSession
// ---------------------------------------------------------------------------

export type LiveKitVoiceSessionEvents = {
  onStatus: (status: BotssonStatus) => void;
  onActivity: (event: BotssonActivityEvent) => void;
  onMicStateChange: (muted: boolean) => void;
  onDisconnect: () => void;
};

/**
 * A single LiveKit voice session for Botsson.
 *
 * Lifecycle:
 *   const session = new LiveKitVoiceSession(handlers);
 *   await session.connect(token, serverUrl);
 *   // ... session.mute() / session.unmute() / session.disconnect()
 */
export class LiveKitVoiceSession {
  private room: Room;
  private handlers: LiveKitVoiceSessionEvents;
  private micTrack: LocalTrack | null = null;
  private micMuted = false;
  /** True while waiting for the agent to respond after a tool_call */
  private pendingThinking = false;

  constructor(handlers: LiveKitVoiceSessionEvents) {
    this.handlers = handlers;
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true },
    });

    this.wireRoomEvents();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  get isConnected(): boolean {
    return this.room.state === "connected";
  }

  get isMicMuted(): boolean {
    return this.micMuted;
  }

  async connect(token: string, serverUrl: string): Promise<void> {
    await this.room.connect(serverUrl, token);
    await this.publishMic();
    // Attach any already-present remote audio tracks (agent may have joined first)
    this.attachExistingRemoteTracks();
    this.handlers.onStatus("listening");
  }

  disconnect(): void {
    this.room.disconnect();
  }

  mute(): void {
    this.micMuted = true;
    void this.room.localParticipant?.setMicrophoneEnabled(false);
    this.handlers.onMicStateChange(true);
  }

  unmute(): void {
    this.micMuted = false;
    void this.room.localParticipant?.setMicrophoneEnabled(true);
    this.handlers.onMicStateChange(false);
  }

  // -------------------------------------------------------------------------
  // Mic
  // -------------------------------------------------------------------------

  private async publishMic(): Promise<void> {
    try {
      const tracks = await this.room.localParticipant?.createTracks({
        audio: true,
        video: false,
      });
      if (tracks?.length) {
        this.micTrack = tracks[0] ?? null;
        await this.room.localParticipant?.publishTrack(tracks[0]!);
      }
    } catch (err) {
      // Non-fatal — agent can still receive voice from the worker side.
      console.warn("[botsson-sdk/livekit] mic publish failed:", err);
    }
  }

  // -------------------------------------------------------------------------
  // Room event wiring
  // -------------------------------------------------------------------------

  private wireRoomEvents(): void {
    // Room fully connected
    this.room.on(RoomEvent.Connected, () => {
      this.handlers.onStatus("connecting");
    });

    // Room disconnected — reset all state
    this.room.on(RoomEvent.Disconnected, () => {
      this.micTrack = null;
      this.micMuted = false;
      this.pendingThinking = false;
      this.handlers.onStatus("disconnected");
      this.handlers.onDisconnect();
    });

    // Remote audio track published — subscribe and attach so user hears the agent
    this.room.on(
      RoomEvent.TrackSubscribed,
      (
        track: RemoteTrack,
        _publication: RemoteTrackPublication,
        _participant: RemoteParticipant,
      ) => {
        if (track.kind === Track.Kind.Audio) {
          const audioEl = track.attach();
          audioEl.autoplay = true;
          // Appending to body is not required — livekit-client routes audio
          // via the AudioElement sink without DOM insertion.
        }
      },
    );

    this.room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        track.detach();
      }
    });

    // Active speakers changed — infer status from remote speakers
    this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      const newStatus = inferStatus(speakers, this.pendingThinking);
      this.handlers.onStatus(newStatus);
    });

    // Data channel — receive botsson-activity events from voice-agent adapter
    this.room.on(
      RoomEvent.DataReceived,
      (
        payload: Uint8Array,
        _participant?: RemoteParticipant,
        _kind?: DataPacket_Kind,
        topic?: string,
        _encryptionType?: Encryption_Type,
      ) => {
        if (topic !== "botsson-activity") return;
        try {
          const event = JSON.parse(new TextDecoder().decode(payload)) as BotssonActivityEvent;

          // Flip into thinking state when the agent calls a tool
          if (event.type === "tool_call") {
            this.pendingThinking = true;
            this.handlers.onStatus("thinking");
          } else if (event.type === "tool_response") {
            this.pendingThinking = false;
            // Status will naturally correct on next ActiveSpeakersChanged event
          }

          this.handlers.onActivity(event);
        } catch (err) {
          console.warn("[botsson-sdk/livekit] failed to parse activity event:", err);
        }
      },
    );

    // Connection quality — debug log only
    this.room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (participant === this.room.localParticipant) {
        console.debug("[botsson-sdk/livekit] local quality:", quality);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /** Attach audio tracks from any participants already in the room */
  private attachExistingRemoteTracks(): void {
    for (const participant of this.room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        const track = publication.track;
        if (track?.kind === Track.Kind.Audio && publication.isSubscribed) {
          const audioEl = track.attach();
          audioEl.autoplay = true;
        }
      }
    }
  }
}
