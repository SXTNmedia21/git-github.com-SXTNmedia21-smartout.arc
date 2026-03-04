// ============================================
// route.ts — Get Wizard Session
// GET: Returns a specific wizard session with all messages
// and draft state. Used by the chat page to load session data.
// Connected to: wizard_session table
// ============================================

import { NextResponse } from "next/server";
import { requireGodmode } from "@/lib/platform-admin";

type Props = { params: Promise<{ sessionId: string }> };

/**
 * GET /api/platform-admin/journeys/wizard/[sessionId]
 *
 * Fetches a single wizard session by ID.
 * Returns full session data including messages and draft_journey.
 */
export async function GET(_request: Request, { params }: Props) {
  const { sessionId } = await params;

  const result = await requireGodmode();
  if (result.error) return result.error;
  const { admin } = result;

  const { data, error } = await admin
    .from("wizard_session")
    .select("*")
    .eq("wizard_session_id", sessionId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
