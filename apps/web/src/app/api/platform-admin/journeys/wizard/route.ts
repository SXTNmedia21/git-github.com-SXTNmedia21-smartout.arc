// ============================================
// route.ts — Wizard Session Create + List
// POST: Creates a new wizard session for AI-guided journey definition.
// GET: Lists wizard sessions (active + completed) for the workspace.
// Connected to: wizard_session table
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

const CreateSchema = z.object({
  workspaceId: z.string().uuid(),
});

/**
 * POST /api/platform-admin/journeys/wizard
 *
 * Creates a new wizard session. Requires godmode access.
 * The session starts in 'discovery' phase with empty messages and draft.
 *
 * @returns The created wizard session record
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: identity } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();
  if (!identity?.is_godmode) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // created_by references user_identity(user_id) which is auth.uid()
  const { data, error } = await admin
    .from("wizard_session")
    .insert({
      workspace_id: body.workspaceId,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

/**
 * GET /api/platform-admin/journeys/wizard
 *
 * Lists recent wizard sessions ordered by creation date.
 * Used by the wizard launcher page to show active and completed sessions.
 *
 * @returns Array of wizard session summaries
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: identity } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();
  if (!identity?.is_godmode) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await admin
    .from("wizard_session")
    .select("wizard_session_id, status, current_phase, draft_journey, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
