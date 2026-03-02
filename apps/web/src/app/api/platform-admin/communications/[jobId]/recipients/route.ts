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

  const { data: recipients, error } = await admin
    .from("platform_communication_recipient")
    .select(
      "recipient_id, email, name, status, sent_at, delivered_at, opened_at, clicked_at, open_count, click_count, error_message",
    )
    .eq("communication_id", jobId)
    .order("sent_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch recipients" }, { status: 500 });
  }

  return NextResponse.json({
    recipients: (recipients ?? []).map((r) => ({
      recipientId: r.recipient_id,
      email: r.email,
      name: r.name,
      status: r.status,
      sentAt: r.sent_at,
      deliveredAt: r.delivered_at,
      openedAt: r.opened_at,
      clickedAt: r.clicked_at,
      openCount: r.open_count ?? 0,
      clickCount: r.click_count ?? 0,
      errorMessage: r.error_message,
    })),
  });
}
