// ============================================
// landing-columns.tsx
// TanStack Table column definitions for the landing_event table.
// Used by the landing activity page to display visit, voice session,
// and CTA click events from the public landing page.
//
// Connected to: landing-activity-client.tsx (table render)
//               platform-admin/landing/page.tsx (data fetch)
// ============================================

"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

/** Shape of a landing event row as returned from Supabase. */
export type LandingEventRow = {
  id: string;
  event_type: string;
  variant: string | null;
  session_id: string | null;
  referrer: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

/** Badge styling per event type — matches the platform admin color language. */
const eventColors: Record<string, string> = {
  page_view: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  voice_session_started: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  cta_click: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  click: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  scroll_depth: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  session_heartbeat: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  session_end: "bg-red-500/10 text-red-400 border-red-500/20",
};

/** Human-readable label for each event type. */
const eventLabels: Record<string, string> = {
  page_view: "Page View",
  voice_session_started: "Voice Session",
  cta_click: "CTA Click",
  click: "Click",
  scroll_depth: "Scroll",
  session_heartbeat: "Heartbeat",
  session_end: "Session End",
};

/**
 * Extracts a human-readable summary from the details JSONB field.
 * For CTA clicks: shows the button label.
 * For voice sessions: shows the callId (truncated) and mission.
 * For page views: empty (no extra data).
 */
function formatDetails(row: LandingEventRow): string {
  const d = row.details;
  if (!d || typeof d !== "object") return "—";

  switch (row.event_type) {
    case "cta_click":
      return typeof d.label === "string" ? d.label : "—";

    case "voice_session_started": {
      const callId = typeof d.callId === "string" ? d.callId.slice(0, 8) + "…" : null;
      const mission = typeof d.mission === "string" ? d.mission : null;
      return [mission, callId].filter(Boolean).join(" · ") || "—";
    }

    case "click": {
      if (typeof d.text === "string" && typeof d.tagName === "string") {
        return `${d.text} · ${d.tagName}`;
      }
      return typeof d.selector === "string" ? d.selector : "—";
    }

    case "scroll_depth":
      return typeof d.percent === "number" ? `${d.percent}%` : "—";

    case "session_heartbeat":
      return typeof d.timeOnPage === "number" ? `${d.timeOnPage}s on page` : "—";

    case "session_end":
      return typeof d.timeOnPage === "number" ? `${d.timeOnPage}s total` : "—";

    default:
      return "—";
  }
}

export const landingColumns: ColumnDef<LandingEventRow>[] = [
  {
    accessorKey: "created_at",
    header: "Timestamp",
    cell: ({ getValue }) =>
      new Date(getValue() as string).toLocaleString("no-NO", {
        dateStyle: "short",
        timeStyle: "medium",
      }),
  },
  {
    accessorKey: "event_type",
    header: "Event",
    cell: ({ getValue }) => {
      const type = getValue() as string;
      return (
        <Badge variant="outline" className={`text-xs ${eventColors[type] ?? ""}`}>
          {eventLabels[type] ?? type}
        </Badge>
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
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    id: "details",
    header: "Details",
    cell: ({ row }) => {
      const summary = formatDetails(row.original);
      return summary !== "—" ? (
        <span className="text-muted-foreground max-w-[200px] truncate text-xs">{summary}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    accessorKey: "session_id",
    header: "Session",
    cell: ({ getValue }) => {
      const id = getValue() as string | null;
      return id ? (
        <span className="text-muted-foreground font-mono text-xs">{id.slice(0, 8)}…</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    accessorKey: "referrer",
    header: "Referrer",
    cell: ({ getValue }) => {
      const ref = getValue() as string | null;
      if (!ref) return <span className="text-muted-foreground">Direct</span>;
      // Show only the hostname to keep the column readable
      try {
        const host = new URL(ref).hostname;
        return <span className="text-muted-foreground text-xs">{host}</span>;
      } catch {
        return <span className="text-muted-foreground text-xs">{ref.slice(0, 30)}</span>;
      }
    },
  },
  {
    accessorKey: "ip_address",
    header: "IP",
    cell: ({ getValue }) => {
      const ip = getValue() as string | null;
      return ip ? (
        <span className="text-muted-foreground font-mono text-xs">{ip}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
];
