import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { CommunicationsClient } from "./_components/communications-client";

export default async function CommunicationsPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  // Fetch communication history and suppression count in parallel
  const [{ data: communications }, { count: suppressionCount }] = await Promise.all([
    admin
      .from("platform_communication_log")
      .select(
        "communication_id, subject, template, classification, audience_filter, recipient_count, sent_count, failed_count, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("platform_email_suppression").select("*", { count: "exact", head: true }),
  ]);

  const history = (communications ?? []).map((c) => ({
    id: c.communication_id,
    subject: c.subject,
    template: c.template,
    classification: c.classification,
    audienceFilter: c.audience_filter as Record<string, unknown> | null,
    recipientCount: c.recipient_count,
    sentCount: c.sent_count,
    failedCount: c.failed_count,
    status: c.status,
    createdAt: c.created_at ?? "",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Communications</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Send platform emails and view communication history
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
