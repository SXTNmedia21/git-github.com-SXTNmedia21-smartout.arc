import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

/**
 * POST /api/emma/tasks/dismiss — mark a triggered task as done.
 * Called after Emma has presented the task to the user.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Look up profile_id from user_id
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No profile found" }, { status: 400 });
  }

  const { task_id, status = "done" } = (await req.json()) as {
    task_id: string;
    status?: "done" | "dismissed";
  };

  if (!task_id) {
    return NextResponse.json({ error: "task_id required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("emma_task")
    .update({ status })
    .eq("id", task_id)
    .eq("profile_id", profile.profile_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
