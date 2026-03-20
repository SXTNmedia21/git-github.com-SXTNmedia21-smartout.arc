import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

/**
 * POST /api/agent/memory — Save an agent memory
 * GET  /api/agent/memory — Load memories for the current user
 *
 * Memories are stored in engine_memory (Supabase).
 * Requires authentication — returns 401 if not logged in.
 */

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { content, memoryType, expiresAt } = body as {
    content?: string;
    memoryType?: string;
    expiresAt?: string;
  };

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  // Get user's profile to find workspace
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No profile found" }, { status: 404 });
  }

  // Map to valid memory_type values (CHECK constraint: preference/fact/summary/general/constant)
  const validTypes = new Set(["preference", "fact", "summary", "general", "constant"]);
  const validMemoryType = validTypes.has(memoryType ?? "") ? memoryType! : "fact";

  const { error } = await supabase.from("engine_memory").insert({
    content,
    memory_type: validMemoryType,
    expires_at: expiresAt ?? null,
    profile_id: profile.profile_id,
    workspace_id: profile.workspace_id,
    importance: 0.5,
    scope: "onboarding",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get user's profile
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!profile) {
    return NextResponse.json({ memories: [] });
  }

  // Load non-expired memories
  const { data: memories } = await supabase
    .from("engine_memory")
    .select("id, content, memory_type, expires_at, created_at")
    .eq("profile_id", profile.profile_id)
    .eq("workspace_id", profile.workspace_id)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ memories: memories ?? [] });
}
