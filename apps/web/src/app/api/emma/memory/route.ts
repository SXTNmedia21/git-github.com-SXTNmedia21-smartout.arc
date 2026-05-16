import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

/**
 * GET /api/emma/memory — load memories for Emma's context.
 * POST /api/emma/memory — save a memory from Emma's conversation.
 * Uses the existing engine_memory table.
 */

async function getProfileId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  workspaceId?: string,
) {
  let query = supabase.from("profile").select("profile_id").eq("user_id", userId);
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  const { data } = await query.limit(1).maybeSingle();
  return data?.profile_id as string | null;
}

// SE02-03: derive workspace_id from profile, not body. Returns both ids so
// the caller can use the profile as the canonical workspace anchor.
async function getProfileContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ profileId: string; workspaceId: string } | null> {
  const { data } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.profile_id || !data?.workspace_id) return null;
  return {
    profileId: data.profile_id as string,
    workspaceId: data.workspace_id as string,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ memories: [] }, { status: 401 });

  const profileId = await getProfileId(supabase, user.id);
  if (!profileId) return NextResponse.json({ memories: [] });

  const { data: memories, error } = await supabase
    .from("engine_memory")
    .select("id, content, memory_type, importance, created_at")
    .eq("profile_id", profileId)
    .in("scope", ["personal", "conversation", "workspace"])
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ memories: memories ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    content: string;
    topic?: string;
  };

  if (!body.content) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  // SE02-02 + SE02-03: server-derive workspace_id from the active profile.
  // Body workspace_id is ignored — ADR-0151 spirit.
  const ctx = await getProfileContext(supabase, user.id);
  if (!ctx) {
    return NextResponse.json({ error: "No active profile found" }, { status: 400 });
  }

  // SE02-03: mandatory C4 authority gate before mutation (ADR-0099 §2).
  // The 'memory' capability is seeded suggest-level for all workspaces
  // (migrations 20260528000000 + 20260530000000). Fail CLOSED on RPC error.
  const admin = createAdminClient();
  const { data: gateRaw, error: gateErr } = await admin.rpc("gate_action", {
    p_workspace_id: ctx.workspaceId,
    p_actor_profile_id: ctx.profileId,
    p_capability: "memory",
    p_action_type: "memory.add",
    p_channel: "chat",
  });
  if (gateErr) {
    return NextResponse.json(
      { error: `gate_action unavailable: ${gateErr.message}` },
      { status: 503 },
    );
  }
  const gate = gateRaw as { allowed: boolean; reason: string | null } | null;
  if (!gate?.allowed) {
    return NextResponse.json(
      { error: "memory write not authorised", reason: gate?.reason ?? "denied" },
      { status: 403 },
    );
  }

  // Map topic to valid memory_type values (CHECK constraint: preference/fact/summary/general/constant)
  const validTypes = ["preference", "fact", "summary", "general", "constant"] as const;
  type MemoryType = (typeof validTypes)[number];
  const memoryType: MemoryType = (validTypes as readonly string[]).includes(body.topic ?? "")
    ? (body.topic as MemoryType)
    : "general";

  const { data, error } = await supabase
    .from("engine_memory")
    .insert({
      workspace_id: ctx.workspaceId,
      profile_id: ctx.profileId,
      content: body.content,
      memory_type: memoryType,
      importance: 0.5,
      scope: "conversation",
    })
    .select("id, content, memory_type")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // SE02-03 Law 4: emit telemetry on successful write. PII-safe — content
  // length only, never the content itself.
  void emit({
    event: "agent.memory.added",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    properties: {
      data: {
        memory_id: data.id as string,
        memory_type: memoryType,
        content_length: body.content.length,
      },
    },
  });

  return NextResponse.json({ memory: data });
}
