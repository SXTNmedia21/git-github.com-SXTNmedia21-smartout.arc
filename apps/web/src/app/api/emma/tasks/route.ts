import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import type { Json } from "@smartout/supabase";

/**
 * GET /api/emma/tasks — returns triggered tasks for the current user.
 * Called on page load to check if Emma has pending missions.
 *
 * POST /api/emma/tasks — creates a new task (from client).
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

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ tasks: [] }, { status: 401 });

  const profileId = await getProfileId(supabase, user.id);
  if (!profileId) return NextResponse.json({ tasks: [] });

  const { data: tasks, error } = await supabase
    .from("emma_task")
    .select("id, title, description, context, mission, due_at, triggered_at")
    .eq("profile_id", profileId)
    .eq("status", "triggered")
    .order("triggered_at", { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: tasks ?? [] });
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
    title: string;
    description?: string;
    due_at?: string | null;
    context?: Record<string, Json | undefined>;
    mission?: string;
  };

  if (!body.workspace_id || !body.title) {
    return NextResponse.json({ error: "workspace_id and title required" }, { status: 400 });
  }

  // Check active task count (DB trigger enforces too, but this gives a clean error)
  const { count } = await supabase
    .from("emma_task")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .in("status", ["pending", "triggered"]);

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: "Max 3 active tasks. Complete or dismiss existing tasks first." },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("emma_task")
    .insert({
      workspace_id: body.workspace_id,
      profile_id: profileId,
      title: body.title,
      description: body.description ?? "",
      due_at: body.due_at ?? null,
      context: body.context ?? {},
      mission: body.mission ?? null,
    })
    .select("id, title, due_at, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}
