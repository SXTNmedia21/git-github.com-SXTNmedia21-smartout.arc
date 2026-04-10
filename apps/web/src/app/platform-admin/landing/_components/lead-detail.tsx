// ============================================
// lead-detail.tsx
// Sheet (slide-over panel) showing full lead details,
// engagement metrics, and session history.
// Opens when a lead row is clicked in the leads table.
//
// Connected to: leads-tab.tsx (parent, provides selectedLead)
//               api/admin/visitor-sessions/route.ts (session history)
//               visitor-tag-dialog.tsx (tag/edit visitor)
//               platform-admin/landing/page.tsx (LeadRow type)
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
  Tag,
  User,
  Mail,
  Calendar,
  Eye,
  MousePointerClick,
  ArrowDownToLine,
  Clock,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  ExternalLink,
} from "lucide-react";
import type { LeadRow } from "../page";
import { VisitorTagDialog } from "./visitor-tag-dialog";
import { getPostHogVisitorBridgeHref } from "@/lib/posthog-links";

// ── Types ─────────────────────────────────────────────────────

type VisitorSession = {
  id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  max_scroll_depth: number;
  page_count: number;
  click_count: number;
  cta_click_count: number;
  variant: string | null;
  device_type: string | null;
};

type LeadDetailProps = {
  lead: LeadRow | null;
  onClose: () => void;
};

// ── Helpers ───────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString("no-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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
  return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
}

function getEngagementLabel(score: number): string {
  if (score >= 70) return "Hot";
  if (score >= 40) return "Warm";
  return "Cold";
}

function DeviceIcon({ deviceType }: { deviceType: string | null }) {
  switch (deviceType) {
    case "mobile":
      return <Smartphone className="h-4 w-4" />;
    case "tablet":
      return <Tablet className="h-4 w-4" />;
    default:
      return <Monitor className="h-4 w-4" />;
  }
}

// ── Component ─────────────────────────────────────────────────

export function LeadDetail({ lead, onClose }: LeadDetailProps) {
  const [sessions, setSessions] = useState<VisitorSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);

  // Fetch sessions when a lead is selected
  useEffect(() => {
    if (!lead) {
      setSessions([]);
      return;
    }

    let cancelled = false;
    setLoadingSessions(true);

    fetch(`/api/admin/visitor-sessions?visitor_id=${encodeURIComponent(lead.id)}`)
      .then((res) => res.json())
      .then((data: { sessions: VisitorSession[] }) => {
        if (!cancelled) {
          setSessions(data.sessions ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSessions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lead?.id, lead]);

  const isIdentified = !!lead?.user_identity_id && !!lead?.user_identity;
  const canTag = lead && !lead.user_identity_id;
  const postHogUrl = lead ? getPostHogVisitorBridgeHref(lead) : undefined;

  return (
    <>
      <Sheet open={!!lead} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[480px]">
          {lead && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  {isIdentified ? (
                    <User className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Tag className="h-5 w-5 text-amber-400" />
                  )}
                  <SheetTitle>
                    {lead.user_identity?.full_name || lead.manual_label || "Lead"}
                  </SheetTitle>
                </div>
                <SheetDescription>
                  {isIdentified ? "Identified visitor" : "Tagged visitor"}
                  {" · "}
                  {lead.visit_count} visit{lead.visit_count !== 1 ? "s" : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* ── Lead Info ─────────────────────────── */}
                <div className="bg-muted/50 rounded-lg border p-4">
                  <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
                    Contact Info
                  </h3>
                  <div className="space-y-2 text-sm">
                    {isIdentified && lead.user_identity && (
                      <>
                        {lead.user_identity.full_name && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" /> Name
                            </span>
                            <span className="font-medium">{lead.user_identity.full_name}</span>
                          </div>
                        )}
                        {lead.user_identity.email && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5" /> Email
                            </span>
                            <span className="font-medium">{lead.user_identity.email}</span>
                          </div>
                        )}
                      </>
                    )}

                    {lead.manual_label && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5" /> Tag
                        </span>
                        <span className="font-medium">{lead.manual_label}</span>
                      </div>
                    )}

                    {lead.manual_notes && (
                      <div className="border-border mt-2 border-t pt-2">
                        <span className="text-muted-foreground text-xs">Notes</span>
                        <p className="mt-1 text-sm">{lead.manual_notes}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> First seen
                      </span>
                      <span className="text-xs">{formatDate(lead.first_seen)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Last seen
                      </span>
                      <span className="text-xs">{formatDate(lead.last_seen)}</span>
                    </div>
                  </div>
                </div>

                {/* ── Tag Button ────────────────────────── */}
                {canTag && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setTagDialogOpen(true)}
                  >
                    <Tag className="mr-2 h-4 w-4" />
                    {lead.manual_label ? "Edit Tag" : "Tag Visitor"}
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

                {/* ── Engagement ────────────────────────── */}
                <div>
                  <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
                    Engagement
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-lg border p-3 text-center">
                      <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                        Score
                      </p>
                      <div className="mt-1 flex items-center justify-center gap-2">
                        <span className="text-lg font-semibold tabular-nums">
                          {lead.engagement_score}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${getEngagementColor(lead.engagement_score)}`}
                        >
                          {getEngagementLabel(lead.engagement_score)}
                        </Badge>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg border p-3 text-center">
                      <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                        Sessions
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {lead.total_sessions}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg border p-3 text-center">
                      <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                        CTA Clicks
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {lead.total_cta_clicks}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg border p-3 text-center">
                      <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                        Avg Scroll
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {lead.avg_scroll_depth}%
                      </p>
                    </div>
                  </div>

                  {/* Engagement progress bar */}
                  <div className="mt-3">
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-foreground/60 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(lead.engagement_score, 100)}%` }}
                      />
                    </div>
                    <p className="text-muted-foreground mt-1 text-right text-[10px]">
                      {lead.engagement_score}/100 engagement
                    </p>
                  </div>
                </div>

                {/* ── Session History ───────────────────── */}
                <div>
                  <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
                    Session History
                  </h3>

                  {loadingSessions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-sm">
                      No sessions recorded for this visitor.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {sessions.map((session) => (
                        <div key={session.id} className="bg-muted/50 rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <DeviceIcon deviceType={session.device_type} />
                              <span className="text-xs font-medium">
                                {formatRelativeTime(session.started_at)}
                              </span>
                              {session.variant && (
                                <Badge variant="outline" className="text-[10px]">
                                  {session.variant}
                                </Badge>
                              )}
                            </div>
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {formatDuration(session.duration_seconds)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {session.page_count} pages
                            </span>
                            <span className="text-muted-foreground flex items-center gap-1">
                              <MousePointerClick className="h-3 w-3" />
                              {session.click_count} clicks
                            </span>
                            <span className="text-muted-foreground flex items-center gap-1">
                              <ArrowDownToLine className="h-3 w-3" />
                              {session.max_scroll_depth}%
                            </span>
                            {session.cta_click_count > 0 && (
                              <span className="flex items-center gap-1 text-orange-400">
                                <MousePointerClick className="h-3 w-3" />
                                {session.cta_click_count} CTA
                              </span>
                            )}
                            <span className="text-muted-foreground ml-auto flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(session.duration_seconds)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Tag dialog rendered outside sheet to avoid z-index issues */}
      {lead && canTag && (
        <VisitorTagDialog
          open={tagDialogOpen}
          onOpenChange={setTagDialogOpen}
          visitorId={lead.id}
          currentLabel={lead.manual_label}
          currentNotes={lead.manual_notes}
        />
      )}
    </>
  );
}
