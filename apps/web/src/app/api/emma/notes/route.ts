import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

/**
 * GET /api/emma/notes — load active notes for the current user.
 * POST /api/emma/notes — create a new note.
 * PATCH /api/emma/notes — update an existing note.
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
  if (!user) return NextResponse.json({ notes: [] }, { status: 401 });

  const profileId = await getProfileId(supabase, user.id);
  if (!profileId) return NextResponse.json({ notes: [] });

  const { data: notes, error } = await supabase
    .from("emma_note")
    .select("id, topic, content, tags, screen, context, status, created_at, updated_at")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notes: notes ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    workspace_id: string;
    topic: string;
    content: string;
    tags?: string[];
    screen?: string;
    context?: string;
  };

  if (!body.workspace_id || !body.topic) {
    return NextResponse.json({ error: "workspace_id and topic required" }, { status: 400 });
  }

  const profileId = await getProfileId(supabase, user.id, body.workspace_id);
  if (!profileId) return NextResponse.json({ error: "No profile found" }, { status: 400 });

  const { data, error } = await supabase
    .from("emma_note")
    .insert({
      workspace_id: body.workspace_id,
      profile_id: profileId,
      topic: body.topic,
      content: body.content ?? "",
      tags: body.tags ?? [],
      screen: body.screen ?? "Botsson",
      context: body.context ?? "",
    })
    .select("id, topic, content, tags, screen, context, status, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ note: data });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await getProfileId(supabase, user.id);
  if (!profileId) return NextResponse.json({ error: "No profile found" }, { status: 400 });

  const body = (await req.json()) as {
    note_id: string;
    topic?: string;
    content?: string;
    tags?: string[];
    status?: string;
  };

  if (!body.note_id) {
    return NextResponse.json({ error: "note_id required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.topic !== undefined) updates.topic = body.topic;
  if (body.content !== undefined) updates.content = body.content;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.status !== undefined) updates.status = body.status;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("emma_note")
    .update(updates)
    .eq("id", body.note_id)
    .eq("profile_id", profileId)
    .select("id, topic, content, tags, status, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ note: data });
}
