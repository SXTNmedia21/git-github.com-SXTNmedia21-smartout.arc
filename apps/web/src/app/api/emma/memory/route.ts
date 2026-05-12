import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

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
    workspace_id: string;
    content: string;
    topic?: string;
  };

  if (!body.workspace_id || !body.content) {
    return NextResponse.json({ error: "workspace_id and content required" }, { status: 400 });
  }

  const profileId = await getProfileId(supabase, user.id, body.workspace_id);
  if (!profileId) return NextResponse.json({ error: "No profile found" }, { status: 400 });

  // Map topic to valid memory_type values (CHECK constraint: preference/fact/summary/general/constant)
  const validTypes = new Set(["preference", "fact", "summary", "general", "constant"]);
  const memoryType = validTypes.has(body.topic ?? "") ? body.topic! : "general";

  const { data, error } = await supabase
    .from("engine_memory")
    .insert({
      workspace_id: body.workspace_id,
      profile_id: profileId,
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

  return NextResponse.json({ memory: data });
}
