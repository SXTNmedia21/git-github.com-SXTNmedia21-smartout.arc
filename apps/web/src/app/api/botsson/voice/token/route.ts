/**
 * POST /api/botsson/voice/token
 *
 * Mints a LiveKit access token for a direct Botsson voice room.
 * Unlike /api/channels/[id]/call/token, this route does NOT go through
 * the livekit-token Edge Function because that function validates channel
 * membership — a concept that does not apply to the per-user Botsson Orb room.
 *
 * Room naming: `botsson-orb:<profileId>`
 * The voice-agent worker is configured as automatic-dispatch (no agentName),
 * so it autojoins any new room — including Botsson Orb rooms.
 *
 * Auth: cookie session (web). Derives workspace + profileId server-side.
 * The profile MUST be active or trainee — no service-role bypass.
 *
 * Env vars used:
 *   LIVEKIT_API_KEY       — already declared in env.ts
 *   LIVEKIT_API_SECRET    — already declared in env.ts
 *   NEXT_PUBLIC_LIVEKIT_URL — server URL forwarded to client
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@smartout/supabase/server";
import { env } from "@/env";

const RequestSchema = z.object({
  workspaceId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  // 1. Auth — must be logged in
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body — workspaceId required to scope the profile lookup
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 3. Resolve profile — server-side, not from body (ADR-0151)
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("profile_id, display_name, avatar_url")
    .eq("user_id", user.id)
    .eq("workspace_id", body.workspaceId)
    .in("status", ["active", "trainee"])
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "No active profile in workspace" }, { status: 403 });
  }

  // 4. LiveKit env vars — must be configured or we return a clear error
  const apiKey = env.LIVEKIT_API_KEY;
  const apiSecret = env.LIVEKIT_API_SECRET;
  const serverUrl = env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret) {
    console.error("[/api/botsson/voice/token] LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set");
    return NextResponse.json({ error: "Voice not configured" }, { status: 503 });
  }

  if (!serverUrl) {
    console.error("[/api/botsson/voice/token] NEXT_PUBLIC_LIVEKIT_URL not set");
    return NextResponse.json({ error: "Voice not configured" }, { status: 503 });
  }

  // 5. Mint token for a per-user Botsson Orb room
  // Room name: botsson-orb:<profileId> — scoped to the profile, not a channel.
  // The voice-agent worker autojoins any new room, so no explicit room pre-creation needed.
  const roomName = `botsson-orb:${profile.profile_id}`;

  const at = new AccessToken(apiKey, apiSecret, {
    identity: profile.profile_id,
    name: profile.display_name ?? "User",
    ttl: "2h",
    metadata: JSON.stringify({
      device_type: "web",
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      is_ai: false,
      source: "botsson-orb",
    }),
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });

  const token = await at.toJwt();

  return NextResponse.json({
    token,
    serverUrl,
    roomName,
    profileId: profile.profile_id,
  });
}
