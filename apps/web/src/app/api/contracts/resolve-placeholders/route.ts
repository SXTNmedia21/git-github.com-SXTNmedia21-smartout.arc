/**
 * POST /api/contracts/resolve-placeholders
 *
 * Given a profile_id and workspace_id, returns the resolved placeholder values
 * from profile, employment_contract, department, workspace, and company.
 * Called by the send-drawer review step to pre-fill contract fields.
 */
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { buildEmployeePlaceholderMap } from "@smartout/utils";
import { z } from "zod";

const schema = z.object({
  profile_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const map = await buildEmployeePlaceholderMap(
    supabase,
    parsed.data.profile_id,
    parsed.data.workspace_id,
  );

  return NextResponse.json(map);
}
