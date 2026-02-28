"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Users, Shield, UserCheck, Crosshair, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ComposeEmailSheet } from "@/components/platform-admin/compose-email-sheet";
import { DataTable } from "@/components/platform-admin/data-table";
import { StatusBadge } from "@/components/platform-admin/status-badge";
import type { AudienceFilter } from "@/components/platform-admin/audience-selector";

type CommunicationEntry = {
  id: string;
  subject: string;
  template: string;
  classification: string;
  audienceFilter: Record<string, unknown> | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
};

type CommunicationsClientProps = {
  history: CommunicationEntry[];
};

function formatAudienceSummary(filter: Record<string, unknown> | null): string {
  if (!filter) return "Unknown";
  const type = filter.type as string;
  switch (type) {
    case "all_users":
      return "All Users";
    case "super_admins":
      return "Super Admins";
    case "workspace":
      return "Workspace";
    case "role":
      return `Role: ${String(filter.role ?? "")}`;
    case "status":
      return `Status: ${String(filter.status ?? "")}`;
    case "user_ids":
      return `${(filter.userIds as string[] | undefined)?.length ?? 0} users`;
    default:
      return type;
  }
}

function formatTemplate(template: string): string {
  return template
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const columns: ColumnDef<CommunicationEntry, unknown>[] = [
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString("no-NO", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
  },
  {
    accessorKey: "subject",
    header: "Subject",
    cell: ({ row }) => <span className="font-medium">{row.original.subject}</span>,
  },
  {
    accessorKey: "template",
    header: "Template",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">{formatTemplate(row.original.template)}</span>
    ),
  },
  {
    accessorKey: "classification",
    header: "Type",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs capitalize">
        {row.original.classification}
      </span>
    ),
  },
  {
    id: "audience",
    header: "Audience",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {formatAudienceSummary(row.original.audienceFilter)}
      </span>
    ),
  },
  {
    accessorKey: "recipientCount",
    header: "Recipients",
    cell: ({ row }) => row.original.recipientCount,
  },
  {
    id: "delivery",
    header: "Sent / Failed",
    cell: ({ row }) => (
      <span className="text-xs">
        <span className="text-emerald-500">{row.original.sentCount}</span>
        {row.original.failedCount > 0 && (
          <>
            {" / "}
            <span className="text-destructive">{row.original.failedCount}</span>
          </>
        )}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
  },
];

export function CommunicationsClient({ history }: CommunicationsClientProps) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [defaultAudience, setDefaultAudience] = useState<AudienceFilter | undefined>(undefined);

  function openCompose(audience?: AudienceFilter) {
    setDefaultAudience(audience);
    setComposeOpen(true);
  }

  return (
    <>
      {/* Quick Send */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Send</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => openCompose({ type: "all_users" })}
            >
              <Users className="h-5 w-5" />
              <span className="text-xs">All Users</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => openCompose({ type: "role", role: "owner" })}
            >
              <Shield className="h-5 w-5" />
              <span className="text-xs">All Workspace Owners</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => openCompose({ type: "role", role: "admin" })}
            >
              <UserCheck className="h-5 w-5" />
              <span className="text-xs">All Admins</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => openCompose()}
            >
              <Crosshair className="h-5 w-5" />
              <span className="text-xs">Custom Audience</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Communication History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium">Communication History</CardTitle>
          <Button size="sm" onClick={() => openCompose()}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Compose
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={history} />
        </CardContent>
      </Card>

      <ComposeEmailSheet
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultAudience={defaultAudience}
      />
    </>
  );
}
