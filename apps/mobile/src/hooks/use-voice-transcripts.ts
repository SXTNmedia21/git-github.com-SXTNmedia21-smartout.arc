/**
 * useVoiceTranscripts — Phase C1 mobile-voice control plane bridge.
 *
 * Subscribes to LiveKit `RoomEvent.TranscriptionReceived` events on the
 * provided Room, buffers in-flight segments, and POSTs each FINAL transcript
 * to the web BFF (`/api/emma/voice/transcript`). The agent's text response
 * is returned via the `onResponse` callback for client-side TTS (Expo Speech).
 *
 * Architecture (per ADR-0132 / ADR-0135 — mobile thin client + LiveKit voice):
 *
 *   ┌───────────┐    audio    ┌─────────┐
 *   │ Mobile UI │────────────▶│ LiveKit │  (media plane)
 *   └─────┬─────┘             └────┬────┘
 *         │ transcript (final)      │
 *         ▼                          ▼  TranscriptionReceived
 *   ┌──────────────┐  POST  ┌────────────────┐  proxy   ┌──────────────┐
 *   │  this hook   │───────▶│ /api/emma/voice│─────────▶│ stage-engine │
 *   │              │        │  /transcript   │          │  /agent/chat │
 *   │ onResponse() │◀───────│  (Bearer JWT)  │◀─────────│ channel=voice│
 *   └──────────────┘        └────────────────┘          └──────────────┘
 *
 * Channel pin: the BFF forces `channel='voice'` server-side. This hook
 * cannot escalate to chat. PII tools are filtered out by ADR-0078's
 * channel-guard at the capability layer.
 *
 * Telemetry: voice.session_started fires on hook mount with a live Room;
 * voice.session_ended fires on unmount or Room.Disconnected. Per-transcript
 * voice.transcript_in / voice.response_out fire from the BFF.
 *
 * Why room-agnostic: the hook accepts a `Room | null` so the same plumbing
 * works for (a) a Botsson-dedicated voice room and (b) ambient AI listening
 * inside an existing channel call. Caller decides which room.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room } from "livekit-client";
import {
  RoomEvent,
  type Participant,
  type TranscriptionSegment,
  type TrackPublication,
} from "livekit-client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { supabase } from "@/lib/supabase";
import { getEmmaVoiceTranscriptUrl, getEmmaVoiceSnapshotUrl } from "@/lib/web-api";
import { getProfileContext } from "@/lib/profile-context";

/**
 * Snapshot field returned by the BFF on cold-start or drift-aware warm turns.
 * ADR-0297: version + payload (inline) or version + payload_url (size guard).
 * Mobile resolves payload_url via GET /api/emma/voice/snapshot/:version before
 * lifting to BotssonProvider context.
 */
export type SnapshotField =
  | {
      version: string;
      hash: string;
      payload: Record<string, unknown>;
      payload_bytes: number;
      trigger?: string;
    }
  | {
      version: string;
      hash: string;
      payload_url: string;
      payload_bytes: number;
      trigger?: string;
    };

/**
 * Resolved snapshot — payload is always present (payload_url fetched and
 * resolved before this is passed to `onSnapshot`).
 */
export type ResolvedSnapshot = {
  version: string;
  payload: Record<string, unknown>;
};

type UseVoiceTranscriptsParams = {
  /** Live LiveKit Room (or null when no voice session is active). */
  room: Room | null;
  /** Stable id for the LiveKit room — usually `${workspaceId}:${channelId}`. */
  livekitRoomId: string | null;
  /** Workspace scope — REQUIRED for telemetry per ADR-0134. */
  workspaceId: string | null;
  /** Channel id whose voice policy gates the session. Optional. */
  channelId?: string | null;
  /** Stage-engine session id seed (rare — usually undefined on first turn). */
  initialSessionId?: string;
  /**
   * ADR-0297: version token of the snapshot currently cached by the caller.
   * Sent to BFF on each POST so BFF can detect drift and return a refreshed
   * snapshot only when needed.
   */
  currentSnapshotVersion?: string | null;
  /**
   * Called with the agent's text response. Caller is responsible for TTS
   * (Expo Speech on mobile). Receives the response *after* it has landed
   * on the BFF — partial / streamed responses are not surfaced.
   */
  onResponse?: (response: AgentResponse) => void;
  /** Called when the hook posts a final transcript (for UI feedback). */
  onTranscript?: (transcript: string) => void;
  /**
   * ADR-0297: called when the BFF returns a new or refreshed snapshot.
   * The snapshot is fully resolved (payload_url fetched inline) before
   * this callback fires. Caller dedupes by version.
   */
  onSnapshot?: (snapshot: ResolvedSnapshot) => void;
  /** ASR provider tag — defaults to LiveKit's built-in Whisper. */
  asrProvider?: string;
  /** Disable the hook entirely (e.g. when channel policy is listen_only). */
  disabled?: boolean;
};

export type AgentResponse = {
  /** The agent's text response, ready for TTS. */
  text: string;
  /** Stage-engine session id — caller persists if it implements continuity. */
  sessionId: string;
  /** Server-measured pipeline latency (ASR-end → response). */
  pipelineLatencyMs: number;
  /** Routed intent for analytics. */
  intent?: { capability: string; confidence: number };
};

type VoiceTranscriptError = {
  code: string;
  message: string;
  status: number;
};

type UseVoiceTranscriptsState = {
  /** Most recent agent response — also delivered via onResponse callback. */
  lastResponse: AgentResponse | null;
  /** Stage-engine session id (assigned/refreshed by the BFF). */
  sessionId: string | undefined;
  /** True while a transcript is in flight to the BFF. */
  isProcessing: boolean;
  /** Last error, if any. Cleared on the next successful round-trip. */
  error: VoiceTranscriptError | null;
};

const DEFAULT_ASR_PROVIDER = "livekit_whisper";

export function useVoiceTranscripts({
  room,
  livekitRoomId,
  workspaceId,
  channelId,
  initialSessionId,
  currentSnapshotVersion,
  onResponse,
  onTranscript,
  onSnapshot,
  asrProvider = DEFAULT_ASR_PROVIDER,
  disabled = false,
}: UseVoiceTranscriptsParams): UseVoiceTranscriptsState {
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [lastResponse, setLastResponse] = useState<AgentResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<VoiceTranscriptError | null>(null);

  // Refs allow the RoomEvent listener to read live values without needing
  // to be re-bound on every render — listeners get the latest sessionId,
  // disabled flag, callbacks, etc. without RoomEvent re-subscription churn.
  const sessionIdRef = useRef<string | undefined>(initialSessionId);
  const onResponseRef = useRef(onResponse);
  const onTranscriptRef = useRef(onTranscript);
  const onSnapshotRef = useRef(onSnapshot);
  const currentSnapshotVersionRef = useRef(currentSnapshotVersion);
  const disabledRef = useRef(disabled);
  const sessionStartTsRef = useRef<number | null>(null);
  const seenSegmentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    onResponseRef.current = onResponse;
  }, [onResponse]);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);
  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);
  useEffect(() => {
    currentSnapshotVersionRef.current = currentSnapshotVersion;
  }, [currentSnapshotVersion]);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  /**
   * POST a final transcript to the BFF and dispatch the agent response.
   * Returns nothing — state updates flow through setLastResponse + setError.
   *
   * ADR-0297: sends `snapshotVersion` so BFF can skip re-assembly on warm
   * turns. Parses the returned `snapshot` field and resolves `payload_url`
   * (size-guard path) before calling `onSnapshot`.
   */
  const postTranscript = useCallback(
    async (transcript: string, asrLatencyMs: number) => {
      if (!workspaceId || !livekitRoomId) return;
      setIsProcessing(true);
      setError(null);

      const { data: sess, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !sess.session?.access_token) {
        setIsProcessing(false);
        setError({
          code: "NOT_AUTHENTICATED",
          message: "Voice transcript requires an active session",
          status: 401,
        });
        return;
      }

      const accessToken = sess.session.access_token;

      let res: Response;
      try {
        res = await fetch(getEmmaVoiceTranscriptUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workspaceId,
            livekitRoomId,
            channelId: channelId ?? undefined,
            sessionId: sessionIdRef.current,
            transcript,
            asrProvider,
            asrLatencyMs,
            // ADR-0297: include current version so BFF skips assembly on warm turns.
            snapshotVersion: currentSnapshotVersionRef.current ?? undefined,
          }),
        });
      } catch (networkErr) {
        setIsProcessing(false);
        setError({
          code: "NETWORK",
          message: networkErr instanceof Error ? networkErr.message : "Network failure",
          status: 0,
        });
        return;
      }

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        // Stale session_id (403/404/409) — clear so next transcript starts fresh.
        if (res.status === 403 || res.status === 404 || res.status === 409) {
          setSessionId(undefined);
          sessionIdRef.current = undefined;
        }
        setIsProcessing(false);
        setError({
          code: errBody.error ?? "BFF_ERROR",
          message: errBody.message ?? `Voice BFF returned ${res.status}`,
          status: res.status,
        });
        return;
      }

      const data = (await res.json()) as
        | {
            text: string;
            sessionId: string;
            intent?: { capability: string; confidence: number };
            pipelineLatencyMs: number;
            snapshot?: SnapshotField;
          }
        | {
            // listen_only short-circuit response
            listenOnly: true;
            message: string;
          };

      setIsProcessing(false);

      if ("listenOnly" in data) {
        // Policy = listen_only: transcript captured but no agent response.
        // Caller doesn't need to TTS anything; we don't update lastResponse.
        return;
      }

      setSessionId(data.sessionId);
      sessionIdRef.current = data.sessionId;
      const response: AgentResponse = {
        text: data.text,
        sessionId: data.sessionId,
        pipelineLatencyMs: data.pipelineLatencyMs,
        intent: data.intent,
      };
      setLastResponse(response);
      onResponseRef.current?.(response);

      // ADR-0297: parse and resolve the snapshot field if present.
      // This fires the onSnapshot callback after payload_url resolution (if
      // needed). Voice-agent context update happens in use-botsson-voice-session
      // via the onSnapshot → BotssonProvider → data-channel publish path.
      if (data.snapshot) {
        void resolveAndDispatchSnapshot(data.snapshot, accessToken, onSnapshotRef.current);
      }
    },
    [workspaceId, livekitRoomId, channelId, asrProvider],
  );

  // Subscribe to TranscriptionReceived on the active Room.
  useEffect(() => {
    if (!room || !livekitRoomId || !workspaceId || disabled) return;

    const handleTranscription = (
      segments: TranscriptionSegment[],
      _participant?: Participant,
      _publication?: TrackPublication,
    ) => {
      if (disabledRef.current) return;

      // We only forward FINAL segments. Interim transcripts are noisy and
      // would multiply BFF traffic and stage-engine session turns.
      // Dedupe by segment.id so a final segment that arrives twice (which
      // LiveKit sometimes does for the last interim → final transition)
      // posts exactly once.
      for (const segment of segments) {
        if (!segment.final) continue;
        if (seenSegmentIdsRef.current.has(segment.id)) continue;
        seenSegmentIdsRef.current.add(segment.id);

        const text = segment.text.trim();
        if (!text) continue;

        // ASR latency = lastReceived - firstReceived for this segment.
        // Falls back to 0 if timestamps look unreliable.
        const latency = Math.max(
          0,
          Math.min(60_000, segment.lastReceivedTime - segment.firstReceivedTime),
        );

        onTranscriptRef.current?.(text);
        void postTranscript(text, latency);
      }
    };

    const handleDisconnected = () => {
      void emitVoiceSessionEnded({
        workspaceId,
        livekitRoomId,
        sessionId: sessionIdRef.current,
        startTs: sessionStartTsRef.current,
        reason: "room_disconnected",
      });
      sessionStartTsRef.current = null;
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    room.on(RoomEvent.Disconnected, handleDisconnected);

    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
      room.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [room, livekitRoomId, workspaceId, disabled, postTranscript]);

  // Emit voice.session_started exactly once when the hook becomes active
  // (room + ids resolved + not disabled), and voice.session_ended on cleanup.
  useEffect(() => {
    if (!room || !livekitRoomId || !workspaceId || disabled) return;

    let cancelled = false;
    const emitStart = async () => {
      try {
        const { profileId } = await getProfileContext();
        if (cancelled) return;
        sessionStartTsRef.current = Date.now();
        void emit({
          event: "voice.session_started",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity: {
              entity_type: "agent_session",
              entity_id: sessionIdRef.current ?? livekitRoomId,
            },
            data: {
              // Fall back to the LiveKit room id (also a stable identifier)
              // rather than an empty string — ADR-0134 / L-0083. Same
              // fallback as `entity_id` above; both columns are routed.
              session_id: sessionIdRef.current ?? livekitRoomId,
              livekit_room_id: livekitRoomId,
              channel_id: channelId ?? null,
              // Hook is mounted ⇒ token had to allow at least listen_only;
              // the disabled prop on this hook lets the caller distinguish.
              voice_participation: "interactive",
            },
          },
        });
      } catch {
        // Profile context unavailable — skip telemetry, do not throw
        // (telemetry must never break voice UX).
      }
    };
    void emitStart();

    return () => {
      cancelled = true;
      const startTs = sessionStartTsRef.current;
      const sid = sessionIdRef.current;
      sessionStartTsRef.current = null;
      seenSegmentIdsRef.current = new Set();
      void emitVoiceSessionEnded({
        workspaceId,
        livekitRoomId,
        sessionId: sid,
        startTs,
        reason: "user_ended",
      });
    };
  }, [room, livekitRoomId, workspaceId, channelId, disabled]);

  return useMemo(
    () => ({ lastResponse, sessionId, isProcessing, error }),
    [lastResponse, sessionId, isProcessing, error],
  );
}

/**
 * Internal: resolve the snapshot field from the BFF response and dispatch
 * via the onSnapshot callback.
 *
 * When the BFF returns `payload_url` (size guard triggered), fetches the
 * full payload via GET /api/emma/voice/snapshot/:version with the same
 * Bearer JWT. The URL is already encoded by the BFF (the version token
 * contains colons which must be encoded in path segments).
 *
 * Errors here are swallowed — failure to resolve a snapshot means the
 * voice-agent stays in degraded mode (falls back to query_smartout roundtrip)
 * rather than aborting the session. The publish path will emit
 * voice.bootstrap.publish_failed in that case.
 */
async function resolveAndDispatchSnapshot(
  snapshot: SnapshotField,
  accessToken: string,
  onSnapshot: ((s: ResolvedSnapshot) => void) | undefined,
): Promise<void> {
  if (!onSnapshot) return;

  try {
    let payload: Record<string, unknown>;

    if ("payload" in snapshot) {
      // Inline payload — no fetch needed.
      payload = snapshot.payload;
    } else {
      // Size-guard path: fetch full payload from GET route.
      // BFF already encodes the version token in the URL.
      const url = getEmmaVoiceSnapshotUrl(encodeURIComponent(snapshot.version));
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        console.warn(`[useVoiceTranscripts] snapshot payload_url fetch failed: ${res.status}`);
        return;
      }
      const fetched = (await res.json()) as { payload?: Record<string, unknown> };
      if (!fetched.payload) {
        console.warn("[useVoiceTranscripts] snapshot payload_url response missing payload field");
        return;
      }
      payload = fetched.payload;
    }

    onSnapshot({ version: snapshot.version, payload });
  } catch (err) {
    // Swallow — snapshot failure is non-fatal. Voice session continues in
    // degraded mode per ADR-0297 §Error-paths.
    console.warn("[useVoiceTranscripts] snapshot resolve error:", err);
  }
}

/** Internal: emit voice.session_ended with safe profile resolution. */
async function emitVoiceSessionEnded(params: {
  workspaceId: string;
  livekitRoomId: string;
  sessionId: string | undefined;
  startTs: number | null;
  reason: "user_ended" | "room_disconnected" | "policy_revoked" | "error";
}): Promise<void> {
  try {
    const { profileId } = await getProfileContext();
    const durationMs = params.startTs ? Math.max(0, Date.now() - params.startTs) : 0;
    void emit({
      event: "voice.session_ended",
      workspace_id: nonEmpty(params.workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "agent_session",
          entity_id: params.sessionId ?? params.livekitRoomId,
        },
        data: {
          // Same fallback as `entity_id` above — never empty-string an
          // identifier column (ADR-0134 / L-0083). The LiveKit room id is
          // the stable session anchor when the agent_session id is missing.
          session_id: params.sessionId ?? params.livekitRoomId,
          livekit_room_id: params.livekitRoomId,
          duration_ms: durationMs,
          end_reason: params.reason,
        },
      },
    });
  } catch {
    /* swallow — telemetry must never break voice UX */
  }
}
