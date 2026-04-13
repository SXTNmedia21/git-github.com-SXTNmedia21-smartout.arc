/**
 * GET /api/platform-admin/communications/users
 *
 * Search user_identity by email or name for the audience selector.
 * Optionally filtered by workspace (via profile → workspace_id).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGodmode } from "@/lib/platform-admin";

const QuerySchema = z.object({
  q: z.string().min(2, "Search query must be at least 2 characters"),
  workspace_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export async function GET(request: NextRequest) {
  const godmode = await requireGodmode();
  if (godmode.error) return godmode.error;

  const { admin } = godmode;
  const params = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!params.success) {
    return NextResponse.json({ error: params.error.flatten().fieldErrors }, { status: 400 });
  }

  const { q, workspace_id, limit } = params.data;

  // When workspace_id is provided, first resolve profile user_ids for that workspace
  let workspaceUserIds: string[] | null = null;

  if (workspace_id) {
    const { data: profiles, error: profileError } = await admin
      .from("profile")
      .select("user_id")
      .eq("workspace_id", workspace_id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    workspaceUserIds = (profiles ?? [])
      .map((p) => p.user_id)
      .filter((id): id is string => id !== null);

    if (workspaceUserIds.length === 0) {
      return NextResponse.json({ data: [] });
    }
  }

  // Search user_identity by email or first_name/last_name
  let query = admin
    .from("user_identity")
    .select("user_id, email, first_name, last_name")
    .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    .eq("is_active", true)
    .order("first_name")
    .limit(limit);

  if (workspaceUserIds) {
    query = query.in("user_id", workspaceUserIds);
  }

  const { data: users, error: userError } = await query;

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  const data = (users ?? []).map((u) => ({
    user_id: u.user_id,
    email: u.email,
    full_name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
  }));

  return NextResponse.json({ data });
}
