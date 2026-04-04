// ============================================
// api/admin/visitor-sessions/route.ts
// GET endpoint: returns landing_session rows for a given visitor_id.
// Used by the lead detail sheet to render the visitor's session history.
//
// Connected to: platform-admin/landing/_components/lead-detail.tsx (consumer)
//               supabase landing_session table (data source)
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

  const visitorId = request.nextUrl.searchParams.get("visitor_id");
  if (!visitorId) {
    return NextResponse.json({ error: "Missing visitor_id parameter" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: sessions, error } = await admin
    .from("landing_session")
    .select(
      `id, session_id, started_at, ended_at, duration_seconds,
       max_scroll_depth, page_count, click_count, cta_click_count,
       variant, device_type`,
    )
    .eq("visitor_id", visitorId)
    .order("started_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch visitor sessions" }, { status: 500 });
  }

  return NextResponse.json({ sessions: sessions ?? [] });
}
