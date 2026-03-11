import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

/**
 * POST /api/emma/memory — save a memory from Emma's conversation.
 * Uses the existing engine_memory table.
 */

async function getProfileId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  return data?.profile_id as string | null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await getProfileId(supabase, user.id);
  if (!profileId) return NextResponse.json({ error: "No profile found" }, { status: 400 });

  const body = (await req.json()) as {
    workspace_id: string;
    content: string;
    topic?: string;
  };

  if (!body.workspace_id || !body.content) {
    return NextResponse.json({ error: "workspace_id and content required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("engine_memory")
    .insert({
      workspace_id: body.workspace_id,
      profile_id: profileId,
      content: body.content,
      memory_type: body.topic ?? "general",
      importance: 5,
      scope: "conversation",
    })
    .select("id, content, memory_type")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ memory: data });
}
