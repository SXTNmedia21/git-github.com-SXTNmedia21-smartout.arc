// ============================================
// lead-columns.tsx
// TanStack Table column definitions for the landing leads table.
// Displays visitors who have been identified (linked to user_identity)
// or manually tagged by an admin.
//
// Connected to: leads-tab.tsx (table render)
//               platform-admin/landing/page.tsx (LeadRow type)
//               @/lib/posthog-links (PostHog visitor bridge for row quick action)
// ============================================

"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { getPostHogVisitorBridgeHref } from "@/lib/posthog-links";
import type { LeadRow } from "../page";

// ── Helpers ───────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getEngagementColor(score: number): string {
  if (score >= 70) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (score >= 40) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return "bg-muted text-muted-foreground border-border";
}

function getEngagementLabel(score: number): string {
  if (score >= 70) return "Hot";
  if (score >= 40) return "Warm";
  return "Cold";
}

// ── Column definitions ────────────────────────────────────────

export const leadColumns: ColumnDef<LeadRow>[] = [
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => {
      const lead = row.original;
      const name =
        lead.user_identity?.full_name ||
        lead.user_identity?.email ||
        lead.manual_label ||
        "Unknown";
      const isIdentified = !!lead.user_identity_id && !!lead.user_identity;

      return (
        <div className="flex items-center gap-2">
          <span className="max-w-[160px] truncate text-sm font-medium">{name}</span>
          <Badge
            variant="outline"
            className={`text-[10px] ${
              isIdentified
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/20 bg-amber-500/10 text-amber-400"
            }`}
          >
            {isIdentified ? "identified" : "tagged"}
          </Badge>
        </div>
      );
    },
  },
  {
    id: "email",
    header: "Email",
    cell: ({ row }) => {
      const email = row.original.user_identity?.email;
      return email ? (
        <span className="text-muted-foreground text-sm">{email}</span>
      ) : (
        <span className="text-muted-foreground">--</span>
      );
    },
  },
  {
    accessorKey: "visit_count",
    header: "Visits",
    cell: ({ getValue }) => {
      const count = getValue() as number;
      return <span className="text-sm tabular-nums">{count}</span>;
    },
  },
  {
    accessorKey: "total_sessions",
    header: "Sessions",
    cell: ({ getValue }) => {
      const count = getValue() as number;
      return <span className="text-sm tabular-nums">{count}</span>;
    },
  },
  {
    accessorKey: "engagement_score",
    header: "Engagement",
    cell: ({ getValue }) => {
      const score = getValue() as number;
      const color = getEngagementColor(score);
      const label = getEngagementLabel(score);

      return (
        <div className="flex items-center gap-2">
          <div className="bg-muted h-2 w-12 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-current transition-all"
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>
          <Badge variant="outline" className={`text-[10px] ${color}`}>
            {label} {score}
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "first_seen",
    header: "First seen",
    cell: ({ getValue }) => {
      const ts = getValue() as string;
      return (
        <span className="text-muted-foreground text-xs tabular-nums">{formatRelativeTime(ts)}</span>
      );
    },
  },
  {
    accessorKey: "last_seen",
    header: "Last seen",
    cell: ({ getValue }) => {
      const ts = getValue() as string;
      return (
        <span className="text-muted-foreground text-xs tabular-nums">{formatRelativeTime(ts)}</span>
      );
    },
  },
  {
    id: "posthog",
    header: "",
    cell: ({ row }) => {
      const href = getPostHogVisitorBridgeHref(row.original);
      if (!href) return <span className="text-muted-foreground text-xs">--</span>;

      return (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          asChild
          onClick={(event) => event.stopPropagation()}
          aria-label="Open visitor in PostHog"
        >
          <Link href={href} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      );
    },
  },
];
