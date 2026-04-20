import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { ScheduledClient } from "./_components/scheduled-client";

export default async function ScheduledPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_communication_log")
    .select(
      "communication_id, subject, channel, campaign_id, recipient_count, scheduled_for, status, created_at",
    )
    .eq("status", "queued")
    .not("scheduled_for", "is", null)
    .order("scheduled_for", { ascending: true })
    .limit(50);

  const scheduled = (data ?? []).map((c) => ({
    id: c.communication_id,
    subject: c.subject,
    channel: c.channel,
    recipientCount: c.recipient_count,
    scheduledFor: c.scheduled_for ?? "",
    campaignId: c.campaign_id,
    status: c.status,
    createdAt: c.created_at ?? "",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Scheduled Communications</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          View and manage scheduled messages waiting to be sent
        </p>
      </div>
      <ScheduledClient scheduled={scheduled} />
    </div>
  );
}
