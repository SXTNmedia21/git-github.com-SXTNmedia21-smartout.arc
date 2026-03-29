import type { SupabaseClient } from "@supabase/supabase-js";
import type { CallSession, CallLogEntry } from "./call-types";

export async function getActiveCallSession(
  supabase: SupabaseClient,
  channelId: string,
): Promise<CallSession | null> {
  const { data, error } = await supabase
    .from("channel_call_session")
    .select("*")
    .eq("channel_id", channelId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    channelId: data.channel_id,
    workspaceId: data.workspace_id,
    callType: data.call_type,
    livekitRoomName: data.livekit_room_name,
    status: data.status,
    audioPolicy: data.audio_policy,
    startedBy: data.started_by,
    maxParticipants: data.max_participants,
    startedAt: data.started_at,
    endedAt: data.ended_at,
    videoPolicy: data.video_policy ?? "disabled",
  };
}

export async function getCallHistory(
  supabase: SupabaseClient,
  channelId: string,
  limit = 20,
  offset = 0,
): Promise<CallLogEntry[]> {
  const { data, error } = await supabase
    .from("call_log")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return [];

  return data.map((d) => ({
    id: d.id,
    channelId: d.channel_id,
    callSessionId: d.call_session_id,
    livekitRoomName: d.livekit_room_name,
    startedAt: d.started_at,
    endedAt: d.ended_at,
    durationSeconds: d.duration_seconds,
    maxParticipants: d.max_participants,
    totalParticipants: d.total_participants,
    participantSummary: d.participant_summary as CallLogEntry["participantSummary"],
    createdAt: d.created_at,
  }));
}
