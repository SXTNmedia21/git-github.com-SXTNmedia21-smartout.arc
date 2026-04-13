/**
 * GET /api/platform-admin/communications/departments
 *
 * Returns departments for a given workspace.
 * Used by the audience selector to pick specific departments.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGodmode } from "@/lib/platform-admin";

const QuerySchema = z.object({
  workspace_id: z.string().uuid("workspace_id is required and must be a valid UUID"),
});

export async function GET(request: NextRequest) {
  const godmode = await requireGodmode();
  if (godmode.error) return godmode.error;

  const { admin } = godmode;
  const params = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!params.success) {
    return NextResponse.json({ error: params.error.flatten().fieldErrors }, { status: 400 });
  }

  const { workspace_id } = params.data;

  const { data: departments, error } = await admin
    .from("department")
    .select("department_id, name, workspace_id")
    .eq("workspace_id", workspace_id)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: departments ?? [] });
}
