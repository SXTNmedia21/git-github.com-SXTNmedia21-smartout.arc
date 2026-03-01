// ============================================
// route.ts — Get Wizard Session
// GET: Returns a specific wizard session with all messages
// and draft state. Used by the chat page to load session data.
// Connected to: wizard_session table
// ============================================

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

type Props = { params: Promise<{ sessionId: string }> };

/**
 * GET /api/platform-admin/journeys/wizard/[sessionId]
 *
 * Fetches a single wizard session by ID.
 * Returns full session data including messages and draft_journey.
 */
export async function GET(_request: Request, { params }: Props) {
  const { sessionId } = await params;
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
    .select("*")
    .eq("wizard_session_id", sessionId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
