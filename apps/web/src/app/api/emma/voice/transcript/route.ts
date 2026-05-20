/**
 * POST /api/emma/voice/transcript
 *
 * Phase C1 mobile-voice control plane. The browser/mobile LiveKit client
 * publishes audio to the LiveKit media plane; ASR-derived transcripts
 * arrive here, get pinned to `channel='voice'` server-side, and are
 * proxied to stage-engine `/agent/chat`. The agent's text response is
 * returned for client-side TTS (Expo Speech on mobile).
 *
 * Architectural rules honoured here (see ADR-0078, ADR-0132, ADR-0135):
 *
 *   1. Channel is forced to "voice" SERVER-SIDE. The request schema does
 *      not accept a `channel` field — clients cannot escalate to chat
 *      (which would unlock PII tools). Mirrors the inverse pattern in
 *      `/api/emma/chat` which forces "chat".
 *
 *   2. Auth is dual-mode (Bearer for mobile, cookie for web). Bearer is
 *      validated through the admin client per ADR-0132; the raw token
 *      forwards to stage-engine for RLS-enforced PII writes inside tools.
 *      Voice is normally PII-redacted (ADR-0078) but the JWT is still
 *      forwarded for tools that may need user-scoped reads.
 *
 *   3. `voice_participation` policy is enforced at LiveKit-token
 *      issuance (`supabase/functions/livekit-token`). When the policy is
 *      `listen_only`, the LiveKit token has `canPublish=false`. By the
 *      time transcripts reach this route, the policy has already gated
 *      whether the user could speak. We additionally re-check policy
 *      here for defence-in-depth: if the channel's policy flips to
 *      `disabled` mid-session, transcripts stop being processed.
 *
 *   4. Voice telemetry — `voice.transcript_in` (entry) and
 *      `voice.response_out` (exit). Both fan to all four destinations
 *      via `EVENT_ROUTING`. PII-redacted: only character counts and
 *      latency, never transcript text, hit telemetry storage.
 *
 *   5. ADR-0297 Workforce Snapshot Bootstrap:
 *      - Cold start (sessionId absent): assemble snapshot via
 *        `botsson-context-snapshot.ts`, compute version + hash, include
 *        `snapshot` in response. Mobile caches it and publishes on the
 *        `botsson-context` data channel so voice-agent sees workforce facts.
 *      - Warm turn with matching version: omit `snapshot` field entirely.
 *      - Warm turn with stale version: include refreshed snapshot.
 *      - Size guard: if payload JSON > 14 KB, return version+hash only plus
 *        a `payload_url` pointing to GET /api/emma/voice/snapshot/:version.
 *      - PII whitelist enforced via column projection in assembler (names,
 *        roles, departments, phones, absence types allowed; bank/tax/
 *        personnummer/contract details never included).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { env } from "@/env";
import {
  assembleBotssonContext,
  computeSnapshotHash,
  computeSnapshotVersion,
  isBotssonContextError,
} from "@/lib/botsson-context-snapshot";
import type { BotssonContextSnapshot } from "@/lib/botsson-context-snapshot";

/**
 * LiveKit data-channel practical cap for a single message (conservative).
 * Payloads over this limit trigger the size guard: the snapshot payload is
 * omitted from the response body and a `payload_url` is returned instead.
 * Mobile fetches the full payload via GET /api/emma/voice/snapshot/:version.
 */
const SNAPSHOT_SIZE_GUARD_BYTES = 14 * 1024; // 14 KB

const STAGE_ENGINE_URL = env.STAGE_ENGINE_URL ?? "http://localhost:5010";
const STAGE_ENGINE_API_KEY = env.STAGE_ENGINE_API_KEY;

// ── Request schema ──────────────────────────────────────────────────────────
// Notable absences:
//   - `channel`     : server forces "voice".
//   - `profile_id`  : derived server-side from JWT (ADR-0151 mobile thin client).
const RequestSchema = z.object({
  workspaceId: z.string().uuid(),
  /** Final or stable transcript for one user utterance. */
  transcript: z.string().min(1).max(10000),
  /** LiveKit room id — the audio plane is bound to this room. */
  livekitRoomId: z.string().min(1).max(200),
  /** Stage-engine session id (optional on first turn). */
  sessionId: z.string().uuid().optional(),
  /** Channel id whose voice policy gates this session, when applicable. */
  channelId: z.string().uuid().optional(),
  /** ASR provider tag for telemetry — defaults to LiveKit's built-in Whisper. */
  asrProvider: z.string().min(1).max(50).default("livekit_whisper"),
  /** ASR latency in ms (audio-segment-end → transcript availability). */
  asrLatencyMs: z.number().int().min(0).max(60_000).default(0),
  /** Optional page context (e.g. "(app)/(home)") for the prompt builder. */
  pageContext: z.string().optional(),
  /**
   * ADR-0297 snapshot version token cached by the client from a previous turn.
   * Absent = cold start (assemble + return snapshot).
   * Present = warm turn: compare with freshly-assembled version prefix; if
   * drift detected, return refreshed snapshot; if matching, omit snapshot.
   *
   * Format: `${workspaceId}:${profileId}:${unix_ms}` — opaque to the client.
   * Never derived from request body on the server (ADR-0151).
   */
  snapshotVersion: z.string().optional(),
});

type AuthResult = {
  user: { id: string };
  accessToken: string | undefined;
  authMethod: "bearer" | "cookie";
};

async function resolveAuth(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (bearerToken) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;
    return { user: data.user, accessToken: bearerToken, authMethod: "bearer" };
  }

  const supabase = await createClient();
  const [{ data: userData, error: userErr }, { data: sessionData, error: sessionErr }] =
    await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
  if (userErr || sessionErr || !userData.user) return null;
  return {
    user: userData.user,
    accessToken: sessionData.session?.access_token,
    authMethod: "cookie",
  };
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  // 1. Auth — dual mode (Bearer for mobile, cookie for web).
  const auth = await resolveAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, accessToken } = auth;

  // 2. Parse + validate body.
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        : "Invalid request body";
    return NextResponse.json({ error: "BAD_REQUEST", message }, { status: 400 });
  }

  // 3. Resolve profile (any role — voice is employee-facing).
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profile")
    .select("profile_id, role, status")
    .eq("user_id", user.id)
    .eq("workspace_id", body.workspaceId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found in workspace" }, { status: 403 });
  }

  // 4. Defence-in-depth voice_participation re-check.
  //    The LiveKit token already enforced this at issuance, but if the
  //    channel policy was flipped to 'disabled' between token issuance
  //    and this transcript arriving, we refuse to forward to stage-engine.
  if (body.channelId) {
    const { data: aiPolicy } = await admin
      .from("channel_ai_policy")
      .select("voice_participation")
      .eq("channel_id", body.channelId)
      .maybeSingle();
    const voicePolicy = aiPolicy?.voice_participation ?? "disabled";
    if (voicePolicy === "disabled") {
      return NextResponse.json(
        {
          error: "VOICE_PARTICIPATION_DISABLED",
          message: "AI voice has been disabled for this channel.",
        },
        { status: 403 },
      );
    }
    // listen_only: AI ingests transcripts but does not produce a response.
    // We still emit transcript_in for observability, then short-circuit.
    if (voicePolicy === "listen_only") {
      await emit({
        event: "voice.transcript_in",
        workspace_id: nonEmpty(body.workspaceId, "workspace_id"),
        actor_id: nonEmpty(profile.profile_id, "actor_id"),
        properties: {
          entity: {
            entity_type: "agent_session",
            entity_id: body.sessionId ?? body.livekitRoomId,
          },
          data: {
            session_id: body.sessionId ?? "",
            livekit_room_id: body.livekitRoomId,
            transcript_length: body.transcript.length,
            asr_provider: body.asrProvider,
            asr_latency_ms: body.asrLatencyMs,
          },
        },
      });
      return NextResponse.json({
        listenOnly: true,
        message: "Listen-only policy — transcript captured, no response generated.",
      });
    }
  }

  // 5. Emit voice.transcript_in (PII-redacted: length only).
  await emit({
    event: "voice.transcript_in",
    workspace_id: nonEmpty(body.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profile_id, "actor_id"),
    properties: {
      entity: {
        entity_type: "agent_session",
        entity_id: body.sessionId ?? body.livekitRoomId,
      },
      data: {
        session_id: body.sessionId ?? "",
        livekit_room_id: body.livekitRoomId,
        transcript_length: body.transcript.length,
        asr_provider: body.asrProvider,
        asr_latency_ms: body.asrLatencyMs,
      },
    },
  });

  // 6. Proxy to stage-engine /agent/chat with channel='voice' PINNED.
  //    Mobile cannot override — the field is absent from RequestSchema.
  let res: Response;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (STAGE_ENGINE_API_KEY) {
      headers["x-api-key"] = STAGE_ENGINE_API_KEY;
    }
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    res = await fetch(`${STAGE_ENGINE_URL}/agent/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: body.transcript,
        session_id: body.sessionId,
        channel: "voice", // SERVER-PINNED. ADR-0078 channel-guard fires downstream.
        page_context: body.pageContext,
        user_jwt: accessToken,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Voice transcript proxy failed";
    console.error("[/api/emma/voice/transcript] stage-engine fetch error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }

  // Preserve stage-engine status codes (401/403/404/409) so mobile can
  // distinguish session-expired from policy-deny from internal-error.
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    const passthroughStatuses = new Set([401, 403, 404, 409]);
    const status = passthroughStatuses.has(res.status) ? res.status : 500;
    console.error(
      `[/api/emma/voice/transcript] stage-engine error ${res.status}:`,
      errBody.error ?? errBody.message,
    );
    return NextResponse.json(
      {
        error: errBody.error ?? "STAGE_ENGINE_ERROR",
        message: errBody.message ?? `Stage engine returned ${res.status}`,
      },
      { status },
    );
  }

  const data = (await res.json()) as {
    session_id: string;
    response: string;
    intent?: { capability: string; confidence: number };
  };

  const pipelineLatencyMs = Date.now() - t0;

  // 7. Emit voice.response_out (PII-redacted: length + intent only).
  await emit({
    event: "voice.response_out",
    workspace_id: nonEmpty(body.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profile_id, "actor_id"),
    properties: {
      entity: { entity_type: "agent_session", entity_id: data.session_id },
      data: {
        session_id: data.session_id,
        livekit_room_id: body.livekitRoomId,
        response_length: data.response.length,
        pipeline_latency_ms: pipelineLatencyMs,
        has_tool_call: Boolean(data.intent && data.intent.capability !== "general"),
      },
    },
  });

  // 8. ADR-0297 Workforce Snapshot Bootstrap.
  //
  //    Determine whether a snapshot should be included in this response:
  //      - Cold start: sessionId absent → always assemble + return.
  //      - Warm turn with stale version: snapshotVersion present but refers to
  //        a different workspace/profile pair → assemble + return refreshed.
  //      - Warm turn with matching workspace+profile prefix: omit snapshot entirely.
  //
  //    Version format: `${workspaceId}:${profileId}:${unix_ms}`
  //    Drift detection: compare the `workspaceId:profileId` prefix (first two
  //    segments). The unix_ms tail changes every call, so we cannot compare full
  //    tokens — we only need to know if the identity context changed, not the
  //    exact assembly timestamp.
  //
  //    This section is placed AFTER stage-engine proxy so the P99 voice latency
  //    (transcript → response text) is not affected by snapshot assembly on warm
  //    turns that skip assembly entirely.
  //
  //    L-0177: fail-fast — workspace_id + profile_id are already validated above
  //    (profile query would have returned 403). No silent fallback needed here.
  const isColdStart = !body.sessionId;
  const versionPrefix = `${body.workspaceId}:${profile.profile_id}`;
  const isStale =
    body.snapshotVersion !== undefined && !body.snapshotVersion.startsWith(versionPrefix);
  const shouldAssemble = isColdStart || isStale;

  type SnapshotResponseField =
    | {
        version: string;
        hash: string;
        payload: BotssonContextSnapshot;
        payload_bytes: number;
      }
    | {
        version: string;
        hash: string;
        payload_url: string;
        payload_bytes: number;
      }
    | null;

  let snapshotField: SnapshotResponseField = null;

  if (shouldAssemble) {
    const ctxResult = await assembleBotssonContext(admin, user.id, body.workspaceId);

    if (isBotssonContextError(ctxResult)) {
      // Assembly failed — log + emit, but do NOT abort the response. The agent
      // response text has already been computed; we degrade gracefully (no snapshot).
      console.warn("[/api/emma/voice/transcript] snapshot assembly failed:", ctxResult.error);
      await emit({
        event: "voice.bootstrap.snapshot_assembly_failed",
        workspace_id: nonEmpty(body.workspaceId, "workspace_id"),
        actor_id: nonEmpty(profile.profile_id, "actor_id"),
        properties: {
          entity: { entity_type: "agent_session", entity_id: data.session_id },
          data: {
            session_id: data.session_id,
            livekit_room_id: body.livekitRoomId,
            error_code: ctxResult.error,
          },
        },
      });
    } else {
      const version = computeSnapshotVersion(body.workspaceId, profile.profile_id);
      const hash = computeSnapshotHash(ctxResult);
      const payloadJson = JSON.stringify(ctxResult);
      const payloadBytes = Buffer.byteLength(payloadJson, "utf8");
      const sizeGuardTriggered = payloadBytes > SNAPSHOT_SIZE_GUARD_BYTES;

      // Build the snapshot field. When size guard fires, omit payload and
      // return a URL that mobile can fetch separately. This keeps the BFF
      // response well within LiveKit data-channel limits.
      if (sizeGuardTriggered) {
        snapshotField = {
          version,
          hash,
          payload_url: `/api/emma/voice/snapshot/${encodeURIComponent(version)}`,
          payload_bytes: payloadBytes,
        };
      } else {
        snapshotField = {
          version,
          hash,
          payload: ctxResult,
          payload_bytes: payloadBytes,
        };
      }

      // Emit: snapshot_sent (cold start) or snapshot_refreshed (drift).
      if (isColdStart) {
        await emit({
          event: "voice.bootstrap.snapshot_sent",
          workspace_id: nonEmpty(body.workspaceId, "workspace_id"),
          actor_id: nonEmpty(profile.profile_id, "actor_id"),
          properties: {
            entity: { entity_type: "agent_session", entity_id: data.session_id },
            data: {
              session_id: data.session_id,
              livekit_room_id: body.livekitRoomId,
              snapshot_version: version,
              snapshot_hash: hash,
              payload_bytes: payloadBytes,
              size_guard_triggered: sizeGuardTriggered,
            },
          },
        });
      } else {
        // isStale — warm turn with stale version.
        await emit({
          event: "voice.bootstrap.snapshot_refreshed",
          workspace_id: nonEmpty(body.workspaceId, "workspace_id"),
          actor_id: nonEmpty(profile.profile_id, "actor_id"),
          properties: {
            entity: { entity_type: "agent_session", entity_id: data.session_id },
            data: {
              session_id: data.session_id,
              livekit_room_id: body.livekitRoomId,
              stale_version: body.snapshotVersion ?? "",
              new_version: version,
              snapshot_hash: hash,
              payload_bytes: payloadBytes,
              size_guard_triggered: sizeGuardTriggered,
            },
          },
        });
      }
    }
  }

  return NextResponse.json({
    text: data.response,
    sessionId: data.session_id,
    intent: data.intent,
    pipelineLatencyMs,
    // ADR-0297: present on cold-start + drift; absent on matching version.
    // When size guard fires, payload_url is set instead of payload.
    ...(snapshotField !== null ? { snapshot: snapshotField } : {}),
  });
}
