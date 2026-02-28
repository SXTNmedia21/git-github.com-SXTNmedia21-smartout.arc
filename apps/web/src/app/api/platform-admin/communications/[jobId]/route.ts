import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { jobId } = await params;
  const admin = createAdminClient();

  const { data: job, error } = await admin
    .from("platform_communication_log" as never)
    .select("*")
    .eq("communication_id", jobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Get recipient summary
  const { data: recipients } = await admin
    .from("platform_communication_recipient" as never)
    .select("status")
    .eq("communication_id", jobId);

  const summary: Record<string, number> = {};
  for (const r of (recipients as Array<{ status: string }>) ?? []) {
    summary[r.status] = (summary[r.status] ?? 0) + 1;
  }

  return NextResponse.json({
    data: { ...(job as Record<string, unknown>), recipientSummary: summary },
  });
}
