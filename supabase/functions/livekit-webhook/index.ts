import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { WebhookReceiver } from "npm:livekit-server-sdk@2.15.0";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const receiver = new WebhookReceiver(
    Deno.env.get("LIVEKIT_API_KEY")!,
    Deno.env.get("LIVEKIT_API_SECRET")!,
  );

  const rawBody = await req.text();
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return new Response("Missing Authorization header", { status: 401 });
  }

  let event;
  try {
    event = await receiver.receive(rawBody, authHeader);
  } catch {
    return new Response("Invalid webhook signature", { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Room name format: {workspace_id}:{channel_id}
  const roomName = event.room?.name ?? "";
  const [workspaceId, channelId] = roomName.split(":");

  if (!workspaceId || !channelId) {
    console.error("[livekit-webhook] Invalid room name format:", roomName);
    return new Response("ok");
  }

  switch (event.event) {
    case "participant_joined": {
      const identity = event.participant?.identity;
      if (!identity) break;

      // Upsert participant
      await supabase.from("channel_call_participant").upsert(
        {
          call_session_id: await getActiveSessionId(supabase, channelId),
          workspace_id: workspaceId,
          profile_id: identity,
          is_ai: identity.startsWith("botsson:"),
          mic_enabled: false,
          device_type: getDeviceType(event.participant?.metadata),
        },
        { onConflict: "call_session_id,profile_id", ignoreDuplicates: false },
      );

      // Update max_participants
      const sessionId = await getActiveSessionId(supabase, channelId);
      if (sessionId) {
        const { count } = await supabase
          .from("channel_call_participant")
          .select("id", { count: "exact", head: true })
          .eq("call_session_id", sessionId)
          .is("left_at", null);

        await supabase
          .from("channel_call_session")
          .update({ max_participants: Math.max(count ?? 0, 0) })
          .eq("id", sessionId);
      }
      break;
    }

    case "participant_left": {
      const identity = event.participant?.identity;
      if (!identity) break;

      const sessionId = await getActiveSessionId(supabase, channelId);
      if (sessionId) {
        await supabase
          .from("channel_call_participant")
          .update({ left_at: new Date().toISOString() })
          .eq("call_session_id", sessionId)
          .eq("profile_id", identity)
          .is("left_at", null);
      }
      break;
    }

    case "room_finished": {
      // Finalize the call session
      const { data: session } = await supabase
        .from("channel_call_session")
        .select("id, call_type, max_participants, started_at")
        .eq("channel_id", channelId)
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      if (session) {
        const endedAt = new Date().toISOString();
        const durationSeconds = Math.round(
          (new Date(endedAt).getTime() - new Date(session.started_at).getTime()) / 1000,
        );

        // Update session
        await supabase
          .from("channel_call_session")
          .update({ status: "ended", ended_at: endedAt })
          .eq("id", session.id);

        // Mark all remaining participants as left
        await supabase
          .from("channel_call_participant")
          .update({ left_at: endedAt })
          .eq("call_session_id", session.id)
          .is("left_at", null);

        // Get participant summary
        const { data: participants } = await supabase
          .from("channel_call_participant")
          .select("profile_id, joined_at, left_at, speaking_seconds")
          .eq("call_session_id", session.id);

        const participantSummary = (participants ?? []).map((p) => ({
          profile_id: p.profile_id,
          joined: p.joined_at,
          left: p.left_at,
          spoke_seconds: p.speaking_seconds,
        }));

        // Create call_log
        await supabase.from("call_log").insert({
          channel_id: channelId,
          workspace_id: workspaceId,
          call_session_id: session.id,
          livekit_room_name: roomName,
          started_at: session.started_at,
          ended_at: endedAt,
          duration_seconds: durationSeconds,
          max_participants: session.max_participants,
          total_participants: new Set(participantSummary.map((p) => p.profile_id)).size,
          participant_summary: participantSummary,
        });

        // Detect missed 1:1 call
        if (session.call_type === "direct" && session.max_participants <= 1) {
          console.log("[livekit-webhook] Missed call detected:", session.id);
          // Telemetry: channel.call.invite_missed will be emitted here
        }
      }
      break;
    }
  }

  return new Response("ok");
});

async function getActiveSessionId(
  supabase: ReturnType<typeof createClient>,
  channelId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("channel_call_session")
    .select("id")
    .eq("channel_id", channelId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .single();
  return data?.id ?? null;
}

function getDeviceType(metadata?: string | null): string {
  if (!metadata) return "unknown";
  try {
    const parsed = JSON.parse(metadata);
    return parsed.device_type ?? "unknown";
  } catch {
    return "unknown";
  }
}
