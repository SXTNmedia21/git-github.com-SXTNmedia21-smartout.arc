// ============================================
// session-columns.tsx
// TanStack Table column definitions for the landing_session table.
// Used by the sessions tab to display visitor sessions with
// duration, scroll depth, clicks, and device information.
//
// Connected to: sessions-tab.tsx (table render)
//               platform-admin/landing/page.tsx (data fetch + SessionRow type)
// ============================================

"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import type { SessionRow } from "../page";

// ── Helpers ───────────────────────────────────────────────────

/**
 * Formats duration in seconds to "Xm Ys" or just "Ys".
 */
function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Formats a timestamp into a relative string like "2m ago", "3h ago", "5d ago".
 */
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

/**
 * Returns a device icon component based on device_type string.
 */
function DeviceIcon({ deviceType }: { deviceType: string | null }) {
  switch (deviceType) {
    case "mobile":
      return <Smartphone className="text-muted-foreground h-4 w-4" />;
    case "tablet":
      return <Tablet className="text-muted-foreground h-4 w-4" />;
    default:
      return <Monitor className="text-muted-foreground h-4 w-4" />;
  }
}

// ── Visitor badge logic ───────────────────────────────────────

type VisitorBadgeInfo = {
  label: string;
  badgeText: string;
  badgeClass: string;
};

function getVisitorBadge(row: SessionRow): VisitorBadgeInfo {
  const visitor = row.visitor;

  // Identified user (linked to user_identity)
  if (visitor?.user_identity_id && visitor.user_identity) {
    const name = visitor.user_identity.full_name || visitor.user_identity.email || "Identified";
    return {
      label: name,
      badgeText: "identified",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
  }

  // Manual label set by admin
  if (visitor?.manual_label) {
    return {
      label: visitor.manual_label,
      badgeText: "tagged",
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    };
  }

  // Returning visitor (visit_count > 1)
  if (visitor && visitor.visit_count > 1) {
    return {
      label: row.visitor_id.slice(0, 8) + "...",
      badgeText: "returning",
      badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    };
  }

  // Anonymous / first-time visitor
  return {
    label: row.visitor_id.slice(0, 8) + "...",
    badgeText: "anonymous",
    badgeClass: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
}

// ── Column definitions ────────────────────────────────────────

export const sessionColumns: ColumnDef<SessionRow>[] = [
  {
    id: "visitor",
    header: "Visitor",
    cell: ({ row }) => {
      const { label, badgeText, badgeClass } = getVisitorBadge(row.original);
      return (
        <div className="flex items-center gap-2">
          <span className="max-w-[120px] truncate text-sm font-medium">{label}</span>
          <Badge variant="outline" className={`text-[10px] ${badgeClass}`}>
            {badgeText}
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "variant",
    header: "Variant",
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? (
        <span className="font-mono text-xs font-medium">{v}</span>
      ) : (
        <span className="text-muted-foreground">--</span>
      );
    },
  },
  {
    accessorKey: "duration_seconds",
    header: "Duration",
    cell: ({ getValue }) => {
      const seconds = getValue() as number | null;
      return <span className="text-sm tabular-nums">{formatDuration(seconds)}</span>;
    },
  },
  {
    accessorKey: "max_scroll_depth",
    header: "Scroll",
    cell: ({ getValue }) => {
      const depth = getValue() as number;
      return (
        <div className="flex items-center gap-2">
          <div className="bg-muted h-2 w-16 overflow-hidden rounded-full">
            <div
              className="bg-foreground/60 h-full rounded-full transition-all"
              style={{ width: `${Math.min(depth, 100)}%` }}
            />
          </div>
          <span className="text-muted-foreground text-xs tabular-nums">{depth}%</span>
        </div>
      );
    },
  },
  {
    accessorKey: "click_count",
    header: "Clicks",
    cell: ({ getValue }) => {
      const count = getValue() as number;
      return <span className="text-sm tabular-nums">{count}</span>;
    },
  },
  {
    accessorKey: "page_count",
    header: "Pages",
    cell: ({ getValue }) => {
      const count = getValue() as number;
      return <span className="text-sm tabular-nums">{count}</span>;
    },
  },
  {
    accessorKey: "device_type",
    header: "Device",
    cell: ({ getValue }) => {
      const device = getValue() as string | null;
      return <DeviceIcon deviceType={device} />;
    },
  },
  {
    accessorKey: "started_at",
    header: "Time",
    cell: ({ getValue }) => {
      const ts = getValue() as string;
      return (
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatRelativeTime(ts)}
        </span>
      );
    },
  },
];
