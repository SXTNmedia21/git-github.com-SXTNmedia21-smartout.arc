"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import {
  Megaphone,
  CreditCard,
  Clock,
  FileSignature,
  Activity,
  Building2,
  Users,
  Settings,
  UserPlus,
  Mail,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ComposeEmailSheet } from "@/components/platform-admin/compose-email-sheet";

type SubscriptionDistribution = {
  name: string;
  value: number;
  color: string;
};

type ActivityEntry = {
  id: string;
  action: string;
  entity_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type DashboardClientProps = {
  subscriptionData: SubscriptionDistribution[];
  recentActivity: ActivityEntry[];
};

const ACTION_ICONS: Record<string, typeof Activity> = {
  send_communication: Mail,
  create_workspace: Building2,
  update_workspace: Settings,
  delete_workspace: Building2,
  create_user: UserPlus,
  update_user: Users,
  impersonate: Eye,
  update_settings: Settings,
  create_contract: FileSignature,
  update_contract: FileSignature,
};

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateString).toLocaleDateString("no-NO");
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getActivityDescription(entry: ActivityEntry): string {
  const details = entry.details;
  const action = formatAction(entry.action);
  const entityType = entry.entity_type;

  if (details && typeof details === "object") {
    const name =
      (details as Record<string, unknown>).name ||
      (details as Record<string, unknown>).title ||
      (details as Record<string, unknown>).subject;
    if (name) {
      return `${action} ${entityType}: ${String(name)}`;
    }
  }

  return `${action} ${entityType}`;
}

export function DashboardClient({ subscriptionData, recentActivity }: DashboardClientProps) {
  const [composeOpen, setComposeOpen] = useState(false);

  const filteredSubscriptionData = useMemo(
    () => subscriptionData.filter((d) => d.value > 0),
    [subscriptionData],
  );
  const hasSubscriptionData = filteredSubscriptionData.length > 0;

  return (
    <>
      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => setComposeOpen(true)}
            >
              <Megaphone className="h-5 w-5" />
              <span className="text-xs">Send Announcement</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/platform-admin/billing?filter=past_due">
                <CreditCard className="h-5 w-5 text-orange-500" />
                <span className="text-xs">Payment Failures</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/platform-admin/workspaces?filter=trial">
                <Clock className="h-5 w-5 text-blue-500" />
                <span className="text-xs">Expiring Trials</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/platform-admin/contracts">
                <FileSignature className="h-5 w-5" />
                <span className="text-xs">Pending Contracts</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout: Chart + Activity */}
      <div className="grid grid-cols-2 gap-6">
        {/* Subscription Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Subscription Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {hasSubscriptionData ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={filteredSubscriptionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {filteredSubscriptionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        color: "hsl(var(--popover-foreground))",
                        fontSize: "12px",
                      }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-muted-foreground flex h-[260px] items-center justify-center text-sm">
                No subscription data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-0">
                {recentActivity.map((entry) => {
                  const IconComponent = ACTION_ICONS[entry.action] ?? Activity;
                  return (
                    <div
                      key={entry.id}
                      className="border-border flex items-start gap-3 border-b py-3 last:border-0"
                    >
                      <div className="bg-muted mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                        <IconComponent className="text-muted-foreground h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{getActivityDescription(entry)}</p>
                        <p className="text-muted-foreground text-xs">
                          {formatRelativeTime(entry.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted-foreground flex h-[260px] items-center justify-center text-sm">
                No activity recorded yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ComposeEmailSheet open={composeOpen} onOpenChange={setComposeOpen} />
    </>
  );
}
