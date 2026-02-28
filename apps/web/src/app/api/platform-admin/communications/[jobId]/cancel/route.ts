import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { jobId } = await params;
  const admin = createAdminClient();

  const { data: job } = await admin
    .from("platform_communication_log" as never)
    .select("communication_id, status")
    .eq("communication_id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const jobData = job as { communication_id: string; status: string };
  if (jobData.status !== "queued" && jobData.status !== "sending") {
    return NextResponse.json(
      { error: `Cannot cancel job with status: ${jobData.status}` },
      { status: 400 },
    );
  }

  await admin
    .from("platform_communication_log" as never)
    .update({ status: "cancelled", updated_at: new Date().toISOString() } as never)
    .eq("communication_id", jobId);

  await admin
    .from("platform_communication_recipient" as never)
    .update({ status: "failed", error_message: "Job cancelled by admin" } as never)
    .eq("communication_id", jobId)
    .eq("status", "pending");

  await logPlatformAction(adminId, "cancel_communication", "communication", jobId, {});

  return NextResponse.json({ jobId, status: "cancelled" });
}
