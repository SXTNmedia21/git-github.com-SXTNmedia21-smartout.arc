import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { CommunicationsClient } from "./_components/communications-client";

const getCommunicationsData = unstable_cache(
  async () => {
    const admin = createAdminClient();

    const [{ data: communications }, { count: suppressionCount }] = await Promise.all([
      admin
        .from("platform_communication_log")
        .select(
          "communication_id, subject, template, classification, channel, campaign_id, audience_filter, recipient_count, sent_count, failed_count, opened_count, clicked_count, status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      admin.from("platform_email_suppression").select("*", { count: "exact", head: true }),
    ]);

    return { communications, suppressionCount };
  },
  ["platform-admin-communications-v3"],
  { revalidate: 60 },
);

export default async function CommunicationsPage() {
  const [adminId, { communications, suppressionCount }] = await Promise.all([
    getSuperAdminId(),
    getCommunicationsData(),
  ]);
  if (!adminId) redirect("/dashboard");

  const history = (communications ?? []).map((c) => ({
    id: c.communication_id,
    subject: c.subject,
    template: c.template,
    classification: c.classification,
    channel: c.channel,
    campaignId: c.campaign_id,
    audienceFilter: c.audience_filter as Record<string, unknown> | null,
    recipientCount: c.recipient_count,
    sentCount: c.sent_count,
    failedCount: c.failed_count,
    openedCount: c.opened_count ?? 0,
    clickedCount: c.clicked_count ?? 0,
    status: c.status,
    createdAt: c.created_at ?? "",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Communications</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Send messages to users and workspaces via email, SMS, push, and in-app notifications
          {suppressionCount ? (
            <span className="ml-2 text-orange-500">
              ({suppressionCount} suppressed email{suppressionCount !== 1 ? "s" : ""})
            </span>
          ) : null}
        </p>
      </div>

      <CommunicationsClient history={history} />
    </div>
  );
}
