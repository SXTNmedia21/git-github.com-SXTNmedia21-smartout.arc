/**
 * ActiveTicketBadge.tsx — Tier 0.5: active helpdesk ticket surface (T3).
 *
 * Server Component. Renders between PanicBar (Tier 0) and BotssonChatHero
 * (Tier 1) when the profile has one or more open helpdesk tickets.
 *
 * Empty state → returns null (zero DOM nodes, Journey 2).
 * Single ticket OR employee role → single-card variant (Journey 1).
 * Multiple tickets AND admin/manager/owner role → aggregate variant
 *   (Journey 3 + 4): top-1 preview + "Se alle saker" secondary link.
 *
 * Click telemetry is handled in ActiveTicketBadgeLink (Client Component, T5)
 * so no `"use client"` is needed here.
 */

import { MessageCircle } from "lucide-react";
import type { ActiveHelpdeskThread } from "../_data/queries";
import { ActiveTicketBadgeLink } from "./ActiveTicketBadgeLink";

// Max preview length per spec §Single-ticket variant
const PREVIEW_MAX_CHARS = 80;

function truncate(text: string | null, max: number): string {
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function relativeTime(isoString: string | null): string {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Nettopp";
  if (minutes < 60) return `${minutes} min siden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} t siden`;
  const days = Math.floor(hours / 24);
  return `${days} d siden`;
}

export type ActiveTicketBadgeProps = {
  threads: ActiveHelpdeskThread[];
  role: "employee" | "admin" | "manager" | "owner";
  workspaceId: string;
  actorId: string;
};

export function ActiveTicketBadge({ threads, role, workspaceId, actorId }: ActiveTicketBadgeProps) {
  // Journey 2: empty state — zero DOM nodes, no telemetry
  if (threads.length === 0) return null;

  const isAggregate =
    threads.length >= 2 && (role === "admin" || role === "manager" || role === "owner");

  // Most-recent thread is always index 0 (queries order by updated_at DESC).
  // We already guard threads.length === 0 above, so primary is always defined.
  // Explicit guard satisfies TS strict-mode noUncheckedIndexedAccess.
  const primary = threads[0];
  if (!primary) return null;

  if (isAggregate) {
    // Journey 3 + 4: aggregate card for admin / manager / owner with 2+ threads
    return (
      <div data-testid="active-ticket-badge" className="bg-card space-y-3 rounded-lg border p-4">
        <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <MessageCircle size={16} className="text-muted-foreground shrink-0" />
          <span>{threads.length} åpne saker</span>
        </div>

        {/* Top-1 preview — links to most-recent thread */}
        <ActiveTicketBadgeLink
          channelId={primary.channelId}
          workspaceId={workspaceId}
          actorId={actorId}
          role={role}
          target="thread"
          href={`/dashboard/komm/thread/${primary.channelId}`}
          className="hover:bg-muted/50 block rounded-md p-3 transition-colors"
        >
          <p className="text-foreground truncate text-sm font-medium">
            {primary.subject ?? "Uten tittel"}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {truncate(primary.lastMessagePreview, PREVIEW_MAX_CHARS)}
          </p>
          {primary.lastMessageAt && (
            <p className="text-muted-foreground mt-1 text-xs">
              {relativeTime(primary.lastMessageAt)}
            </p>
          )}
        </ActiveTicketBadgeLink>

        {/* Secondary "Se alle" link — navigates to komm list (filter TBD spec Q2) */}
        <ActiveTicketBadgeLink
          channelId={null}
          workspaceId={workspaceId}
          actorId={actorId}
          role={role}
          target="list"
          href="/dashboard/komm"
          className="text-primary text-xs font-medium hover:underline"
        >
          Se alle saker →
        </ActiveTicketBadgeLink>
      </div>
    );
  }

  // Journey 1: single ticket (threads.length === 1 OR role === 'employee')
  return (
    <div data-testid="active-ticket-badge" className="bg-card rounded-lg border p-4">
      <div className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
        <MessageCircle size={16} className="text-muted-foreground shrink-0" />
        <span>Pågående sak</span>
      </div>

      <ActiveTicketBadgeLink
        channelId={primary.channelId}
        workspaceId={workspaceId}
        actorId={actorId}
        role={role}
        target="thread"
        href={`/dashboard/komm/thread/${primary.channelId}`}
        className="hover:bg-muted/50 block rounded-md p-3 transition-colors"
      >
        <p className="text-foreground truncate text-sm font-medium">
          {primary.subject ?? "Uten tittel"}
        </p>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {truncate(primary.lastMessagePreview, PREVIEW_MAX_CHARS)}
        </p>
        {primary.lastMessageAt && (
          <p className="text-muted-foreground mt-1 text-xs">
            {relativeTime(primary.lastMessageAt)}
          </p>
        )}
      </ActiveTicketBadgeLink>
    </div>
  );
}
