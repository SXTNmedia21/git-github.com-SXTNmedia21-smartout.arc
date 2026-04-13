import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";

/**
 * GET — List scheduled (queued) communications
 * DELETE — Cancel a scheduled communication
 */

export async function GET(request: NextRequest) {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { admin } = result;

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");

  const { data, error } = await admin
    .from("platform_communication_log")
    .select(
      "communication_id, subject, template, classification, audience_filter, recipient_count, status, channel, campaign_id, scheduled_for, created_at",
    )
    .eq("status", "queued")
    .not("scheduled_for", "is", null)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

const CancelSchema = z.object({
  communicationId: z.string().uuid(),
});

export async function DELETE(request: NextRequest) {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { adminId, admin } = result;

  const parsed = CancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { communicationId } = parsed.data;

  // Only cancel queued communications
  const { data: existing } = await admin
    .from("platform_communication_log")
    .select("communication_id, status, campaign_id")
    .eq("communication_id", communicationId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Communication not found" }, { status: 404 });
  }

  const comm = existing as { communication_id: string; status: string; campaign_id: string | null };

  if (comm.status !== "queued") {
    return NextResponse.json(
      { error: `Cannot cancel communication with status "${comm.status}"` },
      { status: 400 },
    );
  }

  // If part of a campaign, cancel all queued entries in the campaign
  if (comm.campaign_id) {
    await admin
      .from("platform_communication_log")
      .update({ status: "cancelled", updated_at: new Date().toISOString() } as never)
      .eq("campaign_id", comm.campaign_id)
      .eq("status", "queued");
  } else {
    await admin
      .from("platform_communication_log")
      .update({ status: "cancelled", updated_at: new Date().toISOString() } as never)
      .eq("communication_id", communicationId);
  }

  await logPlatformAction(
    adminId,
    "cancel_scheduled_communication",
    "communication",
    communicationId,
    {
      campaignId: comm.campaign_id,
    },
  );

  return NextResponse.json({ cancelled: true, communicationId });
}
