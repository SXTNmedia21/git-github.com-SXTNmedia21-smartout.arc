import type { SupabaseClient } from "@supabase/supabase-js";
import type { CallType } from "./call-types";

type StartCallResult = {
  callSessionId: string;
  roomName: string;
  callType: CallType;
};

type TokenResult = {
  token: string;
  serverUrl: string;
  roomName: string;
  profileId: string;
  /**
   * Phase C1: which policy gate the edge function applied. Defaults to
   * 'human_call' for legacy callers; 'ai_voice' is set when this token
   * was issued for a Botsson voice session.
   */
  purpose?: "human_call" | "ai_voice";
  /**
   * Phase C1: the resolved channel_ai_policy.voice_participation value.
   * Only set when purpose === 'ai_voice'; null otherwise. The mobile UI
   * uses this to lock the mic for 'listen_only'.
   */
  voiceParticipation?: "listen_only" | "interactive" | null;
};

export async function startCall(
  supabase: SupabaseClient,
  params: {
    channelId: string;
    workspaceId: string;
    callType: CallType;
    calleeProfileId?: string;
  },
): Promise<StartCallResult> {
  const { data, error } = await supabase.functions.invoke("call-command", {
    body: { action: "start", ...params },
  });
  if (error) {
    // supabase-js swallows the response body on error — try to extract it
    let detail = error.message;
    if (data && typeof data === "object") {
      detail = JSON.stringify(data);
    } else if (error.context instanceof Response) {
      try {
        const body = await error.context.clone().json();
        detail = JSON.stringify(body);
      } catch {
        try {
          detail = await error.context.clone().text();
        } catch {
          /* ignore */
        }
      }
    }
    throw new Error(`call-command: ${detail}`);
  }
  return data as StartCallResult;
}

export async function getLiveKitToken(
  supabase: SupabaseClient,
  params: {
    channelId: string;
    workspaceId: string;
    /**
     * Phase C1: 'ai_voice' applies the channel_ai_policy.voice_participation
     * gate; 'human_call' (default) keeps the legacy channel.audio_policy gate.
     */
    purpose?: "human_call" | "ai_voice";
  },
): Promise<TokenResult> {
  const { data, error } = await supabase.functions.invoke("livekit-token", {
    body: params,
  });
  if (error) throw new Error(error.message);
  return data as TokenResult;
}

/**
 * Explicitly end a call from the client. Primary cleanup in dev where
 * LiveKit webhooks can't reach localhost; redundant safety net in prod.
 * Marks the caller as left and flips the session to 'ended' when the
 * starter hangs up or no one else is left.
 */
export async function endCall(
  supabase: SupabaseClient,
  params: { channelId: string; workspaceId: string },
): Promise<void> {
  const { error } = await supabase.functions.invoke("call-command", {
    body: { action: "end", ...params },
  });
  if (error) {
    // Don't throw — leaving should feel instant even if the bookkeeping fails
    console.error("[walkie-talkie] endCall failed:", error);
  }
}

export async function muteParticipant(
  supabase: SupabaseClient,
  params: {
    workspaceId: string;
    channelId: string;
    targetIdentity: string;
    trackSid?: string;
    muted?: boolean;
  },
): Promise<{ ok: boolean; muted: boolean }> {
  const { data, error } = await supabase.functions.invoke("call-command", {
    body: { action: "mute_participant", ...params },
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; muted: boolean };
}

export async function respondToInvite(
  supabase: SupabaseClient,
  params: {
    callSessionId: string;
    workspaceId: string;
    channelId: string;
    responseAction: "accept" | "reject" | "cancel";
    targetProfileId?: string;
  },
): Promise<void> {
  const { error } = await supabase.functions.invoke("call-command", {
    body: { action: "respond", ...params },
  });
  if (error) throw new Error(error.message);
}
