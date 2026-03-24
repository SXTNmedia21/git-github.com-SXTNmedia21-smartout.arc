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
  if (error) throw new Error(error.message);
  return data as StartCallResult;
}

export async function getLiveKitToken(
  supabase: SupabaseClient,
  params: { channelId: string; workspaceId: string },
): Promise<TokenResult> {
  const { data, error } = await supabase.functions.invoke("livekit-token", {
    body: params,
  });
  if (error) throw new Error(error.message);
  return data as TokenResult;
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
