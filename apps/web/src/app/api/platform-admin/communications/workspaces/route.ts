/**
 * GET /api/platform-admin/communications/workspaces
 *
 * Search workspaces for the audience selector autocomplete.
 * Returns workspace_id, name, slug, and department count.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGodmode } from "@/lib/platform-admin";

const QuerySchema = z.object({
  q: z.string().optional().default(""),
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

  const { q, limit } = params.data;

  // Build workspace query — active only, with optional name/slug search
  let query = admin
    .from("workspace")
    .select("workspace_id, name, slug")
    .eq("is_active", true)
    .order("name")
    .limit(limit);

  if (q.length > 0) {
    query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);
  }

  const { data: workspaces, error: wsError } = await query;

  if (wsError) {
    return NextResponse.json({ error: wsError.message }, { status: 500 });
  }

  if (!workspaces || workspaces.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Fetch department counts for the returned workspaces
  const workspaceIds = workspaces.map((w) => w.workspace_id);
  const { data: deptCounts, error: deptError } = await admin
    .from("department")
    .select("workspace_id")
    .in("workspace_id", workspaceIds);

  if (deptError) {
    return NextResponse.json({ error: deptError.message }, { status: 500 });
  }

  // Count departments per workspace
  const countMap = new Map<string, number>();
  for (const d of deptCounts ?? []) {
    countMap.set(d.workspace_id, (countMap.get(d.workspace_id) ?? 0) + 1);
  }

  const data = workspaces.map((w) => ({
    workspace_id: w.workspace_id,
    name: w.name,
    slug: w.slug,
    department_count: countMap.get(w.workspace_id) ?? 0,
  }));

  return NextResponse.json({ data });
}
