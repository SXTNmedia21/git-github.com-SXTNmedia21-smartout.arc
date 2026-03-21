import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import type { Json } from "@smartout/supabase";

/**
 * GET /api/emma/tasks — returns triggered tasks for the current user.
 * Called on page load to check if Emma has pending missions.
 *
 * POST /api/emma/tasks — creates a new task (from client).
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

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ tasks: [] }, { status: 401 });

  const profileId = await getProfileId(supabase, user.id);
  if (!profileId) return NextResponse.json({ tasks: [] });

  // Support ?status=pending to load user-created tasks, default to triggered for backwards compat
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") ?? "triggered";
  const validStatuses = ["pending", "triggered", "done"];
  const statuses = statusFilter.split(",").filter((s) => validStatuses.includes(s));
  if (statuses.length === 0) statuses.push("triggered");

  const { data: tasks, error } = await supabase
    .from("emma_task")
    .select(
      "id, title, description, context, mission, due_at, triggered_at, priority, position, status, created_at",
    )
    .eq("profile_id", profileId)
    .in("status", statuses)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(20);

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

  const body = (await req.json()) as {
    workspace_id: string;
    title: string;
    description?: string;
    due_at?: string | null;
    priority?: string;
    position?: number;
    context?: Record<string, Json | undefined>;
    mission?: string;
  };

  if (!body.workspace_id || !body.title) {
    return NextResponse.json({ error: "workspace_id and title required" }, { status: 400 });
  }

  const profileId = await getProfileId(supabase, user.id, body.workspace_id);
  if (!profileId) return NextResponse.json({ error: "No profile found" }, { status: 400 });

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
      priority: body.priority ?? "medium",
      position: body.position ?? 0,
      context: body.context ?? {},
      mission: body.mission ?? null,
    })
    .select("id, title, due_at, status, priority, position")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    task_id: string;
    priority?: string;
    due_at?: string | null;
    position?: number;
  };

  if (!body.task_id) {
    return NextResponse.json({ error: "task_id required" }, { status: 400 });
  }

  const profileId = await getProfileId(supabase, user.id);
  if (!profileId) return NextResponse.json({ error: "No profile found" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.due_at !== undefined) updates.due_at = body.due_at;
  if (body.position !== undefined) updates.position = body.position;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("emma_task")
    .update(updates)
    .eq("id", body.task_id)
    .eq("profile_id", profileId)
    .select("id, title, priority, position, due_at, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}
