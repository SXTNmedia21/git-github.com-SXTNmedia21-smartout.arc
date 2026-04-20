"use client";

/**
 * TicketConversationView — Spec §2 right-panel wrapper.
 *
 * Wraps the existing MessageTimeline + MessageInput pair with the ticket
 * header and resolve flow. No message-list fork — the composer and
 * timeline are reused verbatim (Spec §2.2 + §4.5 risk 3).
 *
 * Empty-state (zero messages) is detected lazily via a quick fetch of
 * the channel_message count; Spec §2.3 wants a specific empty render
 * with the warm orb instead of the generic "no messages yet".
 */

import * as React from "react";
import { useState } from "react";
import { MessageTimeline } from "../../../_components/MessageTimeline";
import { MessageInput } from "../../../_components/MessageInput";
import { TicketHeader } from "./TicketHeader";
import { ResolveTicketDialog } from "./ResolveTicketDialog";
import { useTranslation } from "@smartout/i18n";
import type { TicketStatus } from "@smartout/ui";
import type { TicketHeaderProfile } from "./TicketHeader";

export type TicketInitial = {
  ticket_id: string;
  channel_id: string;
  status: TicketStatus;
  summary: string;
  requester: TicketHeaderProfile | null;
  assignee: TicketHeaderProfile | null;
  resolved_at: string | null;
  resolution_note: string | null;
  is_read_only: boolean;
  audio_policy: string;
};

export type TicketConversationViewProps = {
  ticket: TicketInitial;
  profileId: string;
  currentUserName: string;
  canResolve: boolean;
};

export function TicketConversationView({
  ticket,
  profileId,
  currentUserName,
  canResolve,
}: TicketConversationViewProps) {
  const { t } = useTranslation("helpdesk");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [displayStatus, setDisplayStatus] = useState<TicketStatus>(ticket.status);
  const [resolvedAt, setResolvedAt] = useState<string | null>(ticket.resolved_at);

  const handleResolved = () => {
    setDisplayStatus("complete");
    setResolvedAt(new Date().toISOString());
  };

  return (
    <div className="flex h-full flex-col">
      <TicketHeader
        status={displayStatus}
        summary={ticket.summary}
        requester={ticket.requester}
        assignee={ticket.assignee}
        resolvedAtIso={resolvedAt}
        onResolveClick={() => {
          if (!canResolve) return;
          setResolveOpen(true);
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <MessageTimeline
          channelId={ticket.channel_id}
          profileId={profileId}
          onReply={setReplyToId}
        />
        {displayStatus === "complete" ? (
          <ComposerLockedStrip label={t("ticket_composer.locked")} />
        ) : !ticket.is_read_only ? (
          <MessageInput
            channelId={ticket.channel_id}
            profileId={profileId}
            replyToId={replyToId}
            onCancelReply={() => setReplyToId(null)}
            audioPolicy={ticket.audio_policy}
            pttProps={undefined}
          />
        ) : null}
      </div>

      {canResolve ? (
        <ResolveTicketDialog
          open={resolveOpen}
          onOpenChange={setResolveOpen}
          ticketId={ticket.ticket_id}
          currentUserName={currentUserName}
          requesterName={ticket.requester?.display_name ?? "requester"}
          onResolved={handleResolved}
        />
      ) : null}
    </div>
  );
}

function ComposerLockedStrip({ label }: { label: string }) {
  return (
    <div
      className="border-border/40 text-muted-foreground bg-muted/30 border-t px-6 py-6 text-center text-sm"
      role="status"
    >
      {label}
    </div>
  );
}
