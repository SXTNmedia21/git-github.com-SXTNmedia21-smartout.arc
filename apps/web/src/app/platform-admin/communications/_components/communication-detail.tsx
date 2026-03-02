"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Recipient = {
  recipientId: string;
  email: string;
  name: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  openCount: number;
  clickCount: number;
  errorMessage: string | null;
};

type CommunicationDetailProps = {
  communicationId: string;
};

export function CommunicationDetail({ communicationId }: CommunicationDetailProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecipients() {
      try {
        const res = await fetch(`/api/platform-admin/communications/${communicationId}/recipients`);
        if (!res.ok) {
          setError("Failed to load recipients");
          return;
        }
        const data = await res.json();
        setRecipients(data.recipients ?? []);
      } catch {
        setError("Failed to load recipients");
      } finally {
        setLoading(false);
      }
    }
    fetchRecipients();
  }, [communicationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">Loading recipients...</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive py-4 text-center text-sm">{error}</p>;
  }

  if (recipients.length === 0) {
    return <p className="text-muted-foreground py-4 text-center text-sm">No recipients found.</p>;
  }

  const delivered = recipients.filter((r) => r.status === "delivered").length;
  const opened = recipients.filter((r) => r.openedAt).length;
  const clicked = recipients.filter((r) => r.clickedAt).length;
  const bounced = recipients.filter((r) => r.status === "bounced").length;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex gap-4 text-xs">
        <span>
          <span className="text-muted-foreground">Total:</span>{" "}
          <span className="font-medium">{recipients.length}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Delivered:</span>{" "}
          <span className="font-medium text-emerald-500">{delivered}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Opened:</span>{" "}
          <span className="font-medium text-blue-500">{opened}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Clicked:</span>{" "}
          <span className="font-medium text-purple-500">{clicked}</span>
        </span>
        {bounced > 0 && (
          <span>
            <span className="text-muted-foreground">Bounced:</span>{" "}
            <span className="text-destructive font-medium">{bounced}</span>
          </span>
        )}
      </div>

      {/* Recipients table */}
      <div className="border-border rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Sent</TableHead>
              <TableHead className="text-xs">Delivered</TableHead>
              <TableHead className="text-xs">Opened</TableHead>
              <TableHead className="text-xs">Clicked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.map((r) => (
              <TableRow key={r.recipientId}>
                <TableCell className="text-xs">{r.email}</TableCell>
                <TableCell className="text-xs">{r.name}</TableCell>
                <TableCell className="text-xs">
                  <StatusDot status={r.status} />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {r.sentAt ? formatTime(r.sentAt) : "\u2014"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {r.deliveredAt ? formatTime(r.deliveredAt) : "\u2014"}
                </TableCell>
                <TableCell className="text-xs">
                  {r.openedAt ? (
                    <span className="text-blue-500">
                      {formatTime(r.openedAt)}
                      {r.openCount > 1 && (
                        <span className="text-muted-foreground ml-1">({r.openCount}x)</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {r.clickedAt ? (
                    <span className="text-purple-500">
                      {formatTime(r.clickedAt)}
                      {r.clickCount > 1 && (
                        <span className="text-muted-foreground ml-1">({r.clickCount}x)</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    sent: "bg-amber-500",
    delivered: "bg-emerald-500",
    bounced: "bg-destructive",
    failed: "bg-destructive",
  };

  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${colors[status] ?? "bg-muted-foreground"}`}
      />
      <span className="capitalize">{status}</span>
    </span>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("no-NO", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
