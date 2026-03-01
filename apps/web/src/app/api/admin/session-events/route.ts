// ============================================
// api/admin/session-events/route.ts
// GET endpoint: returns landing_event rows for a given session_id.
// Used by the session detail sheet to render the event timeline.
//
// Connected to: platform-admin/landing/_components/session-detail.tsx (consumer)
//               supabase landing_event table (data source)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

export async function GET(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id parameter" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: events, error } = await admin
    .from("landing_event")
    .select("id, event_type, details, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch session events" }, { status: 500 });
  }

  return NextResponse.json({ events: events ?? [] });
}
