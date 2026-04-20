"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Users,
  Shield,
  UserCheck,
  Crosshair,
  Send,
  PenLine,
  ChevronDown,
  FileText,
  Mail,
  MessageSquare,
  Bell,
  BellRing,
  Hash,
  Clock,
  ShieldX,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ComposeEmailSheet } from "@/components/platform-admin/compose-email-sheet";
import { DataTable } from "@/components/platform-admin/data-table";
import { StatusBadge } from "@/components/platform-admin/status-badge";
import { CommunicationDetail } from "./communication-detail";
import { EngagementReport } from "./engagement-report";
import type { AudienceFilter } from "@/components/platform-admin/audience-selector";

type CommunicationEntry = {
  id: string;
  subject: string;
  template: string;
  classification: string;
  channel: string;
  campaignId: string | null;
  audienceFilter: Record<string, unknown> | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  openedCount: number;
  clickedCount: number;
  status: string;
  createdAt: string;
};

type CommunicationsClientProps = {
  history: CommunicationEntry[];
};

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
  in_app: BellRing,
  channel_message: Hash,
};

const channelLabels: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  in_app: "In-App",
  channel_message: "Channel",
};

function ChannelIcon({ channel }: { channel: string }) {
  const Icon = channelIcons[channel] ?? Mail;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs"
      title={channelLabels[channel] ?? channel}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-muted-foreground">{channelLabels[channel] ?? channel}</span>
    </span>
  );
}

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
    case "department":
      return "Department";
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
    accessorKey: "channel",
    header: "Channel",
    cell: ({ row }) => <ChannelIcon channel={row.original.channel} />,
  },
  {
    accessorKey: "subject",
    header: "Subject",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{row.original.subject}</span>
        {row.original.campaignId && (
          <span
            className="bg-muted text-muted-foreground rounded px-1 py-0.5 text-[9px]"
            title="Part of multi-channel campaign"
          >
            multi
          </span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "template",
    header: "Template",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">{formatTemplate(row.original.template)}</span>
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
    id: "engagement",
    header: "Opened / Clicked",
    cell: ({ row }) => {
      const total = row.original.recipientCount;
      const opened = row.original.openedCount;
      const clicked = row.original.clickedCount;

      // Only email has engagement tracking
      if (row.original.channel !== "email" || total === 0 || (opened === 0 && clicked === 0)) {
        return <span className="text-muted-foreground text-xs">&mdash;</span>;
      }

      return (
        <span className="text-xs">
          <span className="text-blue-500" title={`${opened} opened`}>
            {opened}
          </span>
          {" / "}
          <span className="text-purple-500" title={`${clicked} clicked`}>
            {clicked}
          </span>
          <span className="text-muted-foreground ml-1">
            ({Math.round((opened / total) * 100)}%)
          </span>
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
  },
];

type ChannelTab = "all" | "email" | "sms" | "push" | "in_app";

export function CommunicationsClient({ history }: CommunicationsClientProps) {
  const router = useRouter();
  const [composeOpen, setComposeOpen] = useState(false);
  const [defaultAudience, setDefaultAudience] = useState<AudienceFilter | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<ChannelTab>("all");

  const filteredHistory =
    channelFilter === "all" ? history : history.filter((h) => h.channel === channelFilter);

  // Channel counts for tabs
  const channelCounts = history.reduce<Record<string, number>>((acc, h) => {
    acc[h.channel] = (acc[h.channel] ?? 0) + 1;
    return acc;
  }, {});

  function openQuickSend(audience?: AudienceFilter) {
    setDefaultAudience(audience);
    setComposeOpen(true);
  }

  function handleRowClick(entry: CommunicationEntry) {
    setExpandedId((prev) => (prev === entry.id ? null : entry.id));
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
              onClick={() => openQuickSend({ type: "all_users" })}
            >
              <Users className="h-5 w-5" />
              <span className="text-xs">All Users</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => openQuickSend({ type: "role", role: "owner" })}
            >
              <Shield className="h-5 w-5" />
              <span className="text-xs">All Workspace Owners</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => openQuickSend({ type: "role", role: "admin" })}
            >
              <UserCheck className="h-5 w-5" />
              <span className="text-xs">All Admins</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => openQuickSend()}
            >
              <Crosshair className="h-5 w-5" />
              <span className="text-xs">Custom Audience</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="history">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="history">Historikk</TabsTrigger>
            <TabsTrigger value="reports">Rapporter</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/platform-admin/communications/suppressions")}
            >
              <ShieldX className="mr-1.5 h-3.5 w-3.5" />
              Suppressions
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/platform-admin/communications/scheduled")}
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Scheduled
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/platform-admin/communications/templates")}
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Templates
            </Button>
            <Button variant="outline" size="sm" onClick={() => openQuickSend()}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Quick Send
            </Button>
            <Button size="sm" onClick={() => router.push("/platform-admin/communications/compose")}>
              <PenLine className="mr-1.5 h-3.5 w-3.5" />
              Compose
            </Button>
          </div>
        </div>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-6">
              {/* Channel filter tabs */}
              <div className="mb-4 flex gap-1">
                {(["all", "email", "sms", "push", "in_app"] as const).map((ch) => {
                  const Icon = ch === "all" ? undefined : channelIcons[ch];
                  const count = ch === "all" ? history.length : (channelCounts[ch] ?? 0);
                  return (
                    <Button
                      key={ch}
                      variant={channelFilter === ch ? "default" : "ghost"}
                      size="sm"
                      className="h-7 gap-1.5 px-2.5 text-xs"
                      onClick={() => setChannelFilter(ch)}
                    >
                      {Icon && <Icon className="h-3 w-3" />}
                      {ch === "all" ? "All" : channelLabels[ch]}
                      <span className="text-muted-foreground ml-0.5 text-[10px]">({count})</span>
                    </Button>
                  );
                })}
              </div>

              <DataTable columns={columns} data={filteredHistory} onRowClick={handleRowClick} />
              {expandedId && (
                <div className="border-border bg-muted/30 rounded-b-md border-x border-b p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-medium">Recipient Details</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => setExpandedId(null)}
                    >
                      <ChevronDown className="h-3 w-3 rotate-180" />
                    </Button>
                  </div>
                  <CommunicationDetail communicationId={expandedId} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardContent className="pt-6">
              <EngagementReport communications={filteredHistory} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ComposeEmailSheet
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultAudience={defaultAudience}
      />
    </>
  );
}
