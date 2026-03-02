// ============================================
// route.ts — Journey Test Run History
// GET: Returns test run history for a journey
// Connected to: journey_test_run table
// Connected to: apps/web/src/lib/platform-admin.ts (getSuperAdminId)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

const uuidSchema = z.string().uuid();

type Props = { params: Promise<{ id: string }> };

/**
 * Returns test run history for a journey, ordered by most recent first.
 * Accepts optional `limit` query parameter (default 20, max 100).
 * Requires godmode access.
 */
export async function GET(request: NextRequest, { params }: Props) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid journey ID" }, { status: 400 });
  }

  const superAdminId = await getSuperAdminId();
  if (!superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse optional limit from query params
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);

  const admin = createAdminClient();

  // Verify journey exists
  const { data: journey, error: journeyError } = await admin
    .from("journey")
    .select("journey_id")
    .eq("journey_id", id)
    .single();

  if (journeyError || !journey) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  const { data: testRuns, error: testRunsError } = await admin
    .from("journey_test_run")
    .select("*")
    .eq("journey_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (testRunsError) {
    return NextResponse.json({ error: "Failed to fetch test runs" }, { status: 500 });
  }

  return NextResponse.json({ test_runs: testRuns ?? [] });
}
