// ============================================
// session-detail.tsx
// Sheet (slide-over panel) showing full session details, visitor info,
// session summary stats, and a chronological event timeline.
// Opens when a session row is clicked in the sessions table.
//
// Connected to: sessions-tab.tsx (parent, provides selectedSession)
//               session-columns.tsx (row PostHog action shares bridge resolver)
//               api/admin/session-events/route.ts (event timeline data)
//               visitor-tag-dialog.tsx (tag anonymous visitors)
//               platform-admin/landing/page.tsx (SessionRow type)
// ============================================

"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Monitor,
  Smartphone,
  Tablet,
  Tag,
  Eye,
  MousePointerClick,
  ArrowDownToLine,
  Activity,
  Clock,
  Globe,
  Loader2,
  User,
  ExternalLink,
} from "lucide-react";
import type { SessionRow } from "../page";
import { VisitorTagDialog } from "./visitor-tag-dialog";
import { getPostHogSessionBridgeHref } from "@/lib/posthog-links";

// ── Types ─────────────────────────────────────────────────────

type SessionEvent = {
  id: string;
  event_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type SessionDetailProps = {
  session: SessionRow | null;
  onClose: () => void;
};

// ── Event type mappings ───────────────────────────────────────

const EVENT_ICONS: Record<string, typeof Eye> = {
  page_view: Eye,
  click: MousePointerClick,
  cta_click: MousePointerClick,
  scroll_depth: ArrowDownToLine,
  session_heartbeat: Activity,
  session_end: Clock,
  voice_session_started: Globe,
};

const EVENT_BADGE_COLORS: Record<string, string> = {
  page_view: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  click: "bg-muted text-muted-foreground border-border",
  cta_click: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  scroll_depth: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  session_heartbeat: "bg-muted text-muted-foreground border-border",
  session_end: "bg-red-500/10 text-red-400 border-red-500/20",
  voice_session_started: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

const EVENT_LABELS: Record<string, string> = {
  page_view: "Page View",
  click: "Click",
  cta_click: "CTA Click",
  scroll_depth: "Scroll",
  session_heartbeat: "Heartbeat",
  session_end: "Session End",
  voice_session_started: "Voice Session",
};

// ── Helpers ───────────────────────────────────────────────────

/** Formats seconds into "M:SS" duration string. */
function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Formats a timestamp into HH:MM:SS time string. */
function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("no-NO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Capitalizes the first letter of a string. */
function capitalize(str: string | null): string {
  if (!str) return "Unknown";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Formats event detail text based on event type. */
function formatEventDetail(event: SessionEvent): string {
  const d = event.details;
  if (!d || typeof d !== "object") return "";

  switch (event.event_type) {
    case "click": {
      const text = typeof d.text === "string" ? d.text : null;
      const href = typeof d.href === "string" ? d.href : null;
      const selector = typeof d.selector === "string" ? d.selector : null;
      return text || href || selector || "";
    }
    case "cta_click": {
      return typeof d.label === "string" ? d.label : "";
    }
    case "scroll_depth": {
      const percent = typeof d.percent === "number" ? d.percent : null;
      return percent !== null ? `${percent}%` : "";
    }
    case "session_heartbeat": {
      const timeOnPage = typeof d.timeOnPage === "number" ? d.timeOnPage : null;
      return timeOnPage !== null ? `${timeOnPage}s on page` : "";
    }
    case "session_end": {
      const parts: string[] = [];
      if (typeof d.timeOnPage === "number") parts.push(`${Math.round(d.timeOnPage)}s total`);
      if (typeof d.maxScroll === "number") parts.push(`${d.maxScroll}% scroll`);
      if (typeof d.clickCount === "number") parts.push(`${d.clickCount} clicks`);
      return parts.join(" / ");
    }
    case "page_view": {
      return typeof d.pathname === "string" ? d.pathname : "";
    }
    case "voice_session_started": {
      return typeof d.mission === "string" ? d.mission : "";
    }
    default:
      return "";
  }
}

/** Returns the device icon component. */
function DeviceIcon({ deviceType }: { deviceType: string | null }) {
  switch (deviceType) {
    case "mobile":
      return <Smartphone className="h-5 w-5" />;
    case "tablet":
      return <Tablet className="h-5 w-5" />;
    default:
      return <Monitor className="h-5 w-5" />;
  }
}

// ── Component ─────────────────────────────────────────────────

export function SessionDetail({ session, onClose }: SessionDetailProps) {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);

  // Fetch events when a session is selected
  useEffect(() => {
    if (!session) {
      setEvents([]);
      return;
    }

    let cancelled = false;
    setLoadingEvents(true);

    fetch(`/api/admin/session-events?session_id=${encodeURIComponent(session.session_id)}`)
      .then((res) => res.json())
      .then((data: { events: SessionEvent[] }) => {
        if (!cancelled) {
          setEvents(data.events ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingEvents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.session_id, session]);

  const visitor = session?.visitor;
  const isIdentified = !!visitor?.user_identity_id && !!visitor?.user_identity;
  const isTagged = !!visitor?.manual_label;
  const canTag = visitor && !visitor.user_identity_id;
  const postHogUrl = session ? getPostHogSessionBridgeHref(session) : undefined;

  return (
    <>
      <Sheet open={!!session} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[480px]">
          {session && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <DeviceIcon deviceType={session.device_type} />
                  <SheetTitle>Session Detail</SheetTitle>
                </div>
                <SheetDescription>
                  {new Date(session.started_at).toLocaleString("no-NO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* ── Visitor Info ────────────────────────── */}
                <div className="bg-muted/50 rounded-lg border p-4">
                  <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
                    Visitor Info
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID</span>
                      <span className="font-mono text-xs">
                        {session.visitor_id.slice(0, 12)}...
                      </span>
                    </div>

                    {isIdentified && visitor?.user_identity && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Identity</span>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-sm font-medium">
                            {visitor.user_identity.full_name ||
                              visitor.user_identity.email ||
                              "Identified"}
                          </span>
                        </div>
                      </div>
                    )}

                    {isTagged && visitor?.manual_label && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tag</span>
                        <div className="flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5 text-amber-400" />
                          <span className="text-sm font-medium">{visitor.manual_label}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Visits</span>
                      <span className="tabular-nums">{visitor?.visit_count ?? 1}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Device</span>
                      <span>{capitalize(session.device_type)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IP</span>
                      <span className="font-mono text-xs">{session.ip_address ?? "Unknown"}</span>
                    </div>
                  </div>
                </div>

                {/* ── Tag Button ──────────────────────────── */}
                {canTag && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setTagDialogOpen(true)}
                  >
                    <Tag className="mr-2 h-4 w-4" />
                    {isTagged ? "Edit Tag" : "Tag Visitor"}
                  </Button>
                )}

                {/* ── PostHog Bridge ─────────────────────── */}
                {postHogUrl && (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={postHogUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in PostHog
                    </Link>
                  </Button>
                )}

                {/* ── Session Summary ─────────────────────── */}
                <div>
                  <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
                    Session Summary
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/50 rounded-lg border p-3 text-center">
                      <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                        Duration
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {formatDuration(session.duration_seconds)}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg border p-3 text-center">
                      <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                        Scroll
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {session.max_scroll_depth}%
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg border p-3 text-center">
                      <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                        Clicks
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {session.click_count}
                      </p>
                    </div>
                  </div>

                  {/* Scroll progress bar */}
                  <div className="mt-3">
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-foreground/60 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(session.max_scroll_depth, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-muted-foreground mt-1 text-right text-[10px]">
                      {session.max_scroll_depth}% scrolled
                    </p>
                  </div>
                </div>

                {/* ── Event Timeline ──────────────────────── */}
                <div>
                  <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
                    Event Timeline
                  </h3>

                  {loadingEvents ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                    </div>
                  ) : events.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-sm">
                      No events recorded for this session.
                    </p>
                  ) : (
                    <div className="relative space-y-0">
                      {/* Vertical timeline line */}
                      <div className="border-border absolute top-2 bottom-2 left-4 w-px border-l" />

                      {events.map((event) => {
                        const Icon = EVENT_ICONS[event.event_type] ?? Activity;
                        const badgeColor =
                          EVENT_BADGE_COLORS[event.event_type] ??
                          "bg-muted text-muted-foreground border-border";
                        const label = EVENT_LABELS[event.event_type] ?? event.event_type;
                        const detail = formatEventDetail(event);

                        return (
                          <div key={event.id} className="relative flex items-start gap-3 py-2 pl-8">
                            {/* Timeline dot */}
                            <div className="bg-background absolute top-3 left-2.5 flex h-3 w-3 items-center justify-center rounded-full border">
                              <div className="bg-foreground/40 h-1.5 w-1.5 rounded-full" />
                            </div>

                            {/* Event content */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                                <Badge variant="outline" className={`text-[10px] ${badgeColor}`}>
                                  {label}
                                </Badge>
                                <span className="text-muted-foreground ml-auto text-[10px] tabular-nums">
                                  {formatTime(event.created_at)}
                                </span>
                              </div>
                              {detail && (
                                <p className="text-muted-foreground mt-0.5 truncate pl-5.5 text-xs">
                                  {detail}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Tag dialog rendered outside sheet to avoid z-index issues */}
      {visitor && canTag && (
        <VisitorTagDialog
          open={tagDialogOpen}
          onOpenChange={setTagDialogOpen}
          visitorId={visitor.id}
          currentLabel={visitor.manual_label}
          currentNotes={null}
        />
      )}
    </>
  );
}
