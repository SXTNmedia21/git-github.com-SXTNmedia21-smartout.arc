import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

// Types are now available in database.types.ts after migration 20260228230000

// ---------------------------------------------------------------------------
// GET — Usage data for an API key (hourly buckets)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 168, 1), 1000) : 168;

  const admin = createAdminClient();

  // Verify the key exists
  const { data: key, error: keyError } = await admin
    .from("platform_api_key")
    .select("id")
    .eq("id", id)
    .single();

  if (keyError || !key) {
    if (keyError?.code === "PGRST116") {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: keyError?.message ?? "Failed to fetch key" },
      { status: 500 },
    );
  }

  const { data: usage, error: usageError } = await admin
    .from("platform_api_key_usage")
    .select("id, period_start, request_count, error_count, last_endpoint, last_status, created_at")
    .eq("api_key_id", id)
    .order("period_start", { ascending: false })
    .limit(limit);

  if (usageError) {
    return NextResponse.json({ error: usageError.message }, { status: 500 });
  }

  return NextResponse.json({ data: usage ?? [] });
}
