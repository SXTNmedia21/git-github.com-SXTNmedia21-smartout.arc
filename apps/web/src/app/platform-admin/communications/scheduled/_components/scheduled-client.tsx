"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { Clock, Trash2, ArrowLeft, Mail, MessageSquare, Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/platform-admin/data-table";
import { ConfirmationDialog } from "@/components/platform-admin/confirmation-dialog";

type ScheduledEntry = {
  id: string;
  subject: string;
  channel: string;
  recipientCount: number;
  scheduledFor: string;
  campaignId: string | null;
  status: string;
  createdAt: string;
};

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
  in_app: BellRing,
};

const channelLabels: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  in_app: "In-App",
};

function formatScheduledTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  const dateStr = d.toLocaleDateString("no-NO", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (diff < 0) return `${dateStr} (overdue)`;
  if (hours > 0) return `${dateStr} (in ${hours}h ${minutes}m)`;
  return `${dateStr} (in ${minutes}m)`;
}

export function ScheduledClient({ scheduled }: { scheduled: ScheduledEntry[] }) {
  const router = useRouter();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [items, setItems] = useState(scheduled);

  const columns: ColumnDef<ScheduledEntry, unknown>[] = [
    {
      accessorKey: "scheduledFor",
      header: "Scheduled For",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Clock className="text-muted-foreground h-3.5 w-3.5" />
          <span className="text-sm">{formatScheduledTime(row.original.scheduledFor)}</span>
        </div>
      ),
    },
    {
      accessorKey: "channel",
      header: "Channel",
      cell: ({ row }) => {
        const Icon = channelIcons[row.original.channel] ?? Mail;
        return (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Icon className="h-3.5 w-3.5" />
            {channelLabels[row.original.channel] ?? row.original.channel}
          </span>
        );
      },
    },
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{row.original.subject}</span>
          {row.original.campaignId && (
            <span className="bg-muted text-muted-foreground rounded px-1 py-0.5 text-[9px]">
              multi
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "recipientCount",
      header: "Recipients",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive h-7 px-2"
          onClick={(e) => {
            e.stopPropagation();
            setCancelId(row.original.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  async function handleCancel() {
    if (!cancelId) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/platform-admin/communications/scheduled", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communicationId: cancelId }),
      });
      if (res.ok) {
        toast.success("Scheduled communication cancelled");
        setItems((prev) => prev.filter((i) => i.id !== cancelId));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to cancel");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setCancelling(false);
      setCancelId(null);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/platform-admin/communications")}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back
        </Button>
        <span className="text-muted-foreground text-sm">
          {items.length} scheduled message{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      <Card>
        <CardContent className="pt-6">
          {items.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center text-sm">
              No scheduled communications
            </div>
          ) : (
            <DataTable columns={columns} data={items} />
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={cancelId !== null}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancel scheduled send?"
        description="This will cancel the scheduled communication. This action cannot be undone."
        confirmLabel={cancelling ? "Cancelling..." : "Cancel Send"}
        onConfirm={handleCancel}
      />
    </>
  );
}
