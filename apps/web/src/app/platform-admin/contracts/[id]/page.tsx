import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect, notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, Bell, XCircle, Clock, Send, Shield } from "lucide-react";
import Link from "next/link";

const statusColor: Record<string, string> = {
  draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  viewed: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  signed: "bg-green-500/10 text-green-400 border-green-500/20",
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  declined: "bg-red-500/10 text-red-400 border-red-500/20",
  terminated: "bg-red-500/10 text-red-400 border-red-500/20",
  voided: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const eventTypeIcon: Record<string, string> = {
  created: "📝",
  sent: "📤",
  viewed: "👁️",
  started: "✏️",
  signed: "✅",
  declined: "❌",
  expired: "⏰",
  cancelled: "🚫",
  amended: "📋",
  terminated: "🔴",
  downloaded: "📥",
  reminder_sent: "🔔",
  voided: "⚫",
};

const reminderStatusColor: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  sent: "bg-green-500/10 text-green-400 border-green-500/20",
  skipped: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
};

function formatDateTime(date: string | null): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleString("no-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDate(date: string | null): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("no-NO", {
    dateStyle: "medium",
  });
}

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  // Fetch contract, events, and reminders in parallel
  const [contractResult, eventsResult, remindersResult] = await Promise.all([
    admin
      .from("contract")
      .select(
        `*,
         template:template_id (name, contract_type),
         workspace:workspace_id (name, slug)`,
      )
      .eq("contract_id", id)
      .single(),
    admin
      .from("contract_event")
      .select("*")
      .eq("contract_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("contract_reminder")
      .select("*")
      .eq("contract_id", id)
      .order("scheduled_at", { ascending: true }),
  ]);

  const contract = contractResult.data;
  if (!contract) notFound();

  const events = eventsResult.data || [];
  const reminders = remindersResult.data || [];

  const workspace = contract.workspace as { name: string; slug: string } | null;
  const template = contract.template as {
    name: string;
    contract_type: string;
  } | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/platform-admin/contracts">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{contract.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {contract.contract_number || `ID: ${contract.contract_id.slice(0, 8)}...`}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`text-sm capitalize ${statusColor[contract.status] || ""}`}
        >
          {contract.status}
        </Badge>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {(contract.status === "sent" || contract.status === "viewed") && (
          <>
            <Button variant="outline" size="sm" disabled title="Requires contract microservice">
              <Bell className="mr-2 h-4 w-4" />
              Send reminder
            </Button>
            <Button variant="outline" size="sm" disabled title="Requires contract microservice">
              <Clock className="mr-2 h-4 w-4" />
              Extend deadline
            </Button>
            <Button variant="outline" size="sm" disabled title="Requires contract microservice">
              <Send className="mr-2 h-4 w-4" />
              Resend
            </Button>
          </>
        )}
        {contract.status !== "cancelled" &&
          contract.status !== "signed" &&
          contract.status !== "active" && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-400 hover:text-red-300"
              disabled
              title="Requires contract microservice"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
        {contract.signed_pdf_url && (
          <a href={contract.signed_pdf_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download signed PDF
            </Button>
          </a>
        )}
        <Button variant="outline" size="sm" disabled title="Requires contract microservice">
          <Shield className="mr-2 h-4 w-4" />
          Override workspace access
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contract Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contract Information</CardTitle>
            <CardDescription>Details and recipient information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Type</span>
                <p className="mt-1 font-medium capitalize">
                  {contract.contract_type?.replace("_", " ") || "\u2014"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Template</span>
                <p className="mt-1 font-medium">{template?.name || "\u2014"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Journey type</span>
                <p className="mt-1 font-medium capitalize">
                  {contract.journey_type?.replace("_", " ") || "\u2014"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Workspace</span>
                <p className="mt-1 font-medium">{workspace?.name || "\u2014"}</p>
              </div>
            </div>

            <Separator />

            <div>
              <span className="text-muted-foreground text-sm">Sender</span>
              <p className="mt-1 text-sm font-medium">{contract.sender_name}</p>
              <p className="text-muted-foreground text-xs">{contract.sender_email}</p>
            </div>

            <div>
              <span className="text-muted-foreground text-sm">Recipient</span>
              <p className="mt-1 text-sm font-medium">{contract.recipient_name}</p>
              <p className="text-muted-foreground text-xs">{contract.recipient_email}</p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Created</span>
                <p className="mt-1">{formatDateTime(contract.created_at)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sent</span>
                <p className="mt-1">{formatDateTime(contract.sent_at)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Viewed</span>
                <p className="mt-1">{formatDateTime(contract.viewed_at)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Signed</span>
                <p className="mt-1">{formatDateTime(contract.signed_at)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Expires</span>
                <p className="mt-1">{formatDate(contract.expires_at)}</p>
              </div>
              {contract.declined_at && (
                <div>
                  <span className="text-muted-foreground">Declined</span>
                  <p className="mt-1">{formatDateTime(contract.declined_at)}</p>
                  {contract.decline_reason && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {contract.decline_reason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {contract.signing_url && (
              <>
                <Separator />
                <div>
                  <span className="text-muted-foreground text-sm">Signing URL</span>
                  <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
                    {contract.signing_url}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Event Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Event Timeline</CardTitle>
            <CardDescription>
              Audit trail of all contract actions ({events.length} events)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-muted-foreground text-sm">No events recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="border-border flex items-start gap-3 border-b pb-3 last:border-0"
                  >
                    <span className="mt-0.5 text-base">
                      {eventTypeIcon[event.event_type] || "📄"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">
                          {event.event_type.replace("_", " ")}
                        </span>
                        <Badge variant="outline" className="text-muted-foreground text-[10px]">
                          {event.actor_type}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {formatDateTime(event.created_at)}
                      </p>
                      {event.actor_id && (
                        <p className="text-muted-foreground font-mono text-[10px]">
                          Actor: {event.actor_id.slice(0, 12)}...
                        </p>
                      )}
                      {event.details &&
                        Object.keys(event.details as Record<string, unknown>).length > 0 && (
                          <pre className="bg-muted mt-1 overflow-x-auto rounded px-2 py-1 text-[10px]">
                            {JSON.stringify(event.details, null, 2)}
                          </pre>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reminder Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Reminder Schedule</CardTitle>
            <CardDescription>
              Scheduled and sent reminders for this contract ({reminders.length} total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reminders.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No reminders scheduled for this contract.
              </p>
            ) : (
              <div className="border-border rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Template</th>
                      <th className="px-4 py-3">Scheduled</th>
                      <th className="px-4 py-3">Sent</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reminders.map((reminder) => (
                      <tr key={reminder.id} className="border-border border-b last:border-0">
                        <td className="px-4 py-3 capitalize">{reminder.reminder_type}</td>
                        <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                          {reminder.template_key}
                        </td>
                        <td className="text-muted-foreground px-4 py-3">
                          {formatDateTime(reminder.scheduled_at)}
                        </td>
                        <td className="text-muted-foreground px-4 py-3">
                          {formatDateTime(reminder.sent_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${
                              (reminder.status && reminderStatusColor[reminder.status]) || ""
                            }`}
                          >
                            {reminder.status ?? "unknown"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
