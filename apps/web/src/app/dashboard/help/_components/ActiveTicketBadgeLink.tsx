"use client";

/**
 * ActiveTicketBadgeLink.tsx — Client wrapper for ActiveTicketBadge nav links.
 *
 * Emits `help.active_ticket_badge_clicked` on every click so PostHog +
 * activity_trail record which ticket (or list) the user navigated to.
 * This is the ONLY write path from the badge — no mutations here.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { emit, nonEmpty } from "@smartout/telemetry";

export type ActiveTicketBadgeLinkProps = {
  /** engine_state.entity_id (channel.id) for thread links; null for list link. */
  channelId: string | null;
  workspaceId: string;
  actorId: string;
  role: "employee" | "admin" | "manager" | "owner";
  /** Where the link navigates — 'thread' for single-ticket, 'list' for "Se alle". */
  target?: "thread" | "list";
  /** Resolved href — caller is responsible for building the URL. */
  href: string;
  children: ReactNode;
  className?: string;
};

export function ActiveTicketBadgeLink({
  channelId,
  workspaceId,
  actorId,
  role,
  target = "thread",
  href,
  children,
  className,
}: ActiveTicketBadgeLinkProps) {
  // Telemetry: map 'owner' → 'admin' because the event schema uses a 3-value
  // union (employee | admin | manager) and owner has admin-level visibility.
  const telemetryRole: "employee" | "admin" | "manager" = role === "owner" ? "admin" : role;

  function handleClick() {
    void emit({
      event: "help.active_ticket_badge_clicked",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorId, "actor_id"),
      properties: {
        // channel_id is NonEmptyString branded — nonEmpty asserts non-null/empty
        ...(channelId != null && channelId !== ""
          ? { channel_id: nonEmpty(channelId, "channel_id") }
          : {}),
        role: telemetryRole,
        target,
      },
    });
  }

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
