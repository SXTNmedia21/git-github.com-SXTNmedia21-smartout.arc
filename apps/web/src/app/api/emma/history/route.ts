import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

/**
 * GET /api/emma/history — load recent conversations with transcripts.
 * POST /api/emma/history — create a new conversation or append transcript entries.
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
  if (!user) return NextResponse.json({ conversations: [] }, { status: 401 });

  const profileId = await getProfileId(supabase, user.id);
  if (!profileId) return NextResponse.json({ conversations: [] });

  const { data: conversations, error } = await supabase
    .from("emma_conversation")
    .select(
      `
      id, started_at, ended_at, summary,
      emma_transcript ( id, role, content, tool_name, created_at )
    `,
    )
    .eq("profile_id", profileId)
    .order("started_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: conversations ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    action: "start" | "end" | "append";
    workspace_id?: string;
    conversation_id?: string;
    summary?: string;
    entries?: Array<{ role: string; content: string; tool_name?: string }>;
  };

  if (body.action === "start") {
    if (!body.workspace_id) {
      return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
    }
    const profileId = await getProfileId(supabase, user.id, body.workspace_id);
    if (!profileId) return NextResponse.json({ error: "No profile found" }, { status: 400 });

    const { data, error } = await supabase
      .from("emma_conversation")
      .insert({
        workspace_id: body.workspace_id,
        profile_id: profileId,
      })
      .select("id, started_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ conversation: data });
  }

  if (body.action === "end") {
    if (!body.conversation_id) {
      return NextResponse.json({ error: "conversation_id required" }, { status: 400 });
    }
    const profileId = await getProfileId(supabase, user.id);
    if (!profileId) return NextResponse.json({ error: "No profile found" }, { status: 400 });

    const { error } = await supabase
      .from("emma_conversation")
      .update({
        ended_at: new Date().toISOString(),
        summary: body.summary ?? null,
      })
      .eq("id", body.conversation_id)
      .eq("profile_id", profileId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "append") {
    if (!body.conversation_id || !body.entries?.length) {
      return NextResponse.json({ error: "conversation_id and entries required" }, { status: 400 });
    }
    const rows = body.entries.map((e) => ({
      conversation_id: body.conversation_id!,
      role: e.role,
      content: e.content,
      tool_name: e.tool_name ?? null,
    }));

    const { error } = await supabase.from("emma_transcript").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: rows.length });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
