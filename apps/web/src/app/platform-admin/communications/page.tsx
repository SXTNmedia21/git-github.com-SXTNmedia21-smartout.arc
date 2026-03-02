import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { CommunicationsClient } from "./_components/communications-client";

export default async function CommunicationsPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  // Fetch communication history and suppression count in parallel
  // Cast needed: opened_count + clicked_count added by communications_v2 migration
  const [{ data: communications }, { count: suppressionCount }] = await Promise.all([
    admin
      .from("platform_communication_log" as never)
      .select(
        "communication_id, subject, template, classification, audience_filter, recipient_count, sent_count, failed_count, opened_count, clicked_count, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("platform_email_suppression").select("*", { count: "exact", head: true }),
  ]);

  type CommRow = {
    communication_id: string;
    subject: string;
    template: string;
    classification: string;
    audience_filter: Record<string, unknown> | null;
    recipient_count: number;
    sent_count: number;
    failed_count: number;
    opened_count: number | null;
    clicked_count: number | null;
    status: string;
    created_at: string | null;
  };

  const history = ((communications ?? []) as CommRow[]).map((c) => ({
    id: c.communication_id,
    subject: c.subject,
    template: c.template,
    classification: c.classification,
    audienceFilter: c.audience_filter,
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
