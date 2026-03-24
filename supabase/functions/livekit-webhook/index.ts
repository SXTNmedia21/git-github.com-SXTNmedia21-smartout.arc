// @ts-nocheck — Deno Edge Function, typechecked by Supabase CLI at deploy
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

      // Insert participant (partial unique index prevents duplicates for active participants)
      const sessionId = await getActiveSessionId(supabase, channelId);
      if (!sessionId) {
        console.error("[livekit-webhook] No active session for channel:", channelId);
        break;
      }

      const { error: insertError } = await supabase.from("channel_call_participant").insert({
        call_session_id: sessionId,
        workspace_id: workspaceId,
        profile_id: identity,
        is_ai: identity.startsWith("botsson:"),
        mic_enabled: false,
        device_type: getDeviceType(event.participant?.metadata),
      });

      if (insertError) {
        console.error("[livekit-webhook] Failed to insert participant:", insertError.message);
        break;
      }

      // Telemetry: D6 Production — participant joined
      await emitCallEvent(supabase, "channel.call.participant_joined", workspaceId, {
        call_session_id: sessionId,
        channel_id: channelId,
        profile_id: identity,
        device_type: getDeviceType(event.participant?.metadata),
      });

      // Update max_participants
      {
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

        // Telemetry: D6 Production — participant left
        await emitCallEvent(supabase, "channel.call.participant_left", workspaceId, {
          call_session_id: sessionId,
          channel_id: channelId,
          profile_id: identity,
        });
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

        // Telemetry: C1 Observability — call ended
        await emitCallEvent(supabase, "channel.call.ended", workspaceId, {
          call_session_id: session.id,
          channel_id: channelId,
          duration_seconds: durationSeconds,
          max_participants: session.max_participants,
          total_participants: new Set(participantSummary.map((p) => p.profile_id)).size,
        });

        // Detect missed 1:1 call
        if (session.call_type === "direct" && session.max_participants <= 1) {
          await emitCallEvent(supabase, "channel.call.invite_missed", workspaceId, {
            call_session_id: session.id,
            channel_id: channelId,
          });
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

/** Insert telemetry event — maps to D6 Production + C1 Observability */
async function emitCallEvent(
  supabase: ReturnType<typeof createClient>,
  eventType: string,
  workspaceId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("engine_event").insert({
      event_type: eventType,
      workspace_id: workspaceId,
      payload,
      idempotency_key: `${eventType}:${payload.call_session_id ?? ""}:${payload.profile_id ?? ""}:${Date.now()}`,
    });
  } catch (err) {
    console.error("[livekit-webhook] Telemetry insert failed:", err);
  }
}
