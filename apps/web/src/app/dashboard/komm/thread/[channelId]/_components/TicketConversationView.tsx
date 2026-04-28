"use client";

/**
 * TicketConversationView — Spec §2 right-panel wrapper, redesigned to the
 * Nordic Split helpdesk prototype.
 *
 * Pixel source: docs/design/smartout-design-helpdesk/project/prototype/web-helpdesk.jsx:139-311
 *
 * The shared MessageTimeline + MessageInput are intentionally NOT used
 * here — the ticket view has its own bubble language:
 *   - System message: muted pill with Sparkles icon (prototype lines 195-209)
 *   - Other message: bg-card bubble, border-radius 14/14/14/4 (lines 211-229)
 *   - Own message:   bg-brand-orange bubble, border-radius 14/14/4/14
 *                    (lines 231-252)
 *   - Composer:      bg-card paperclip+mic+send with trust-line footer
 *                    (lines 275-310)
 *
 * All behavior stays identical to the previous implementation:
 *   - useChannelMessages (infinite pagination)
 *   - useSendMessage (TanStack mutation, same payload)
 *   - useMarkAsRead (latest-message acknowledgement)
 *   - ResolveTicketDialog (gate call preserved)
 *   - is_read_only + audio_policy + canResolve guards preserved
 */

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Paperclip, Mic, Send, Sparkles } from "lucide-react";
import { useChannelMessages } from "../../../_hooks/use-channel-messages";
import { useSendMessage } from "../../../_hooks/use-send-message";
import { useMarkAsRead } from "../../../_hooks/use-mark-as-read";
import type { MessageWithSender } from "../../../_hooks/channel-types";
import { TicketHeader } from "./TicketHeader";
import { ResolveTicketDialog } from "./ResolveTicketDialog";
import { LighthouseAvatar } from "@/components/helpdesk-orb";
import type { OrbStatus } from "@/components/helpdesk-orb";
import { useTranslation } from "@smartout/i18n";
import type { TicketHeaderProfile } from "./TicketHeader";

const SYSTEM_TYPES = new Set<MessageWithSender["message_type"]>([
  "system",
  "brief",
  "handoff",
  "announcement",
  "reminder",
  "summary",
]);

export type TicketInitial = {
  ticket_id: string;
  channel_id: string;
  status: OrbStatus;
  summary: string;
  requester: TicketHeaderProfile | null;
  assignee: TicketHeaderProfile | null;
  resolved_at: string | null;
  resolution_note: string | null;
  is_read_only: boolean;
  audio_policy: string;
  channel_name?: string | null;
  opened_at?: string | null;
};

export type TicketConversationViewProps = {
  ticket: TicketInitial;
  profileId: string;
  currentUserName: string;
  canResolve: boolean;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function TicketConversationView({
  ticket,
  profileId,
  currentUserName,
  canResolve,
}: TicketConversationViewProps) {
  const { t } = useTranslation("helpdesk");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [displayStatus, setDisplayStatus] = useState<OrbStatus>(ticket.status);
  const [resolvedAt, setResolvedAt] = useState<string | null>(ticket.resolved_at);

  const handleResolved = () => {
    setDisplayStatus("complete");
    setResolvedAt(new Date().toISOString());
  };

  const composerLocked = displayStatus === "complete" || ticket.is_read_only;
  const requesterFirstName = ticket.requester?.display_name.split(/\s+/)[0] ?? "";

  return (
    <div className="bg-background flex h-full flex-col">
      <TicketHeader
        status={displayStatus}
        summary={ticket.summary}
        requester={ticket.requester}
        assignee={ticket.assignee}
        resolvedAtIso={resolvedAt}
        channelName={ticket.channel_name}
        openedAtIso={ticket.opened_at}
        onResolveClick={() => {
          if (!canResolve) return;
          setResolveOpen(true);
        }}
      />

      <MessageThread
        channelId={ticket.channel_id}
        profileId={profileId}
        requester={ticket.requester}
        assignee={ticket.assignee}
        openedAtIso={ticket.opened_at}
        openedByBotssonLabel={
          ticket.requester
            ? t("ticket_system.opened_by_botsson", {
                name:
                  ticket.requester.display_name.split(/\s+/)[0] ?? ticket.requester.display_name,
                time: ticket.opened_at ? formatTime(ticket.opened_at) : "",
              })
            : null
        }
      />

      {composerLocked ? (
        <ComposerLockedStrip label={t("ticket_composer.locked")} />
      ) : (
        <TicketComposer
          channelId={ticket.channel_id}
          profileId={profileId}
          requesterFirstName={requesterFirstName}
        />
      )}

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

/* ─────────────────────────────────────────────────────────────────────────
 * MessageThread — prototype bubble rendering with reuse of channel hooks.
 * ───────────────────────────────────────────────────────────────────────── */

function MessageThread({
  channelId,
  profileId,
  requester,
  assignee,
  openedAtIso,
  openedByBotssonLabel,
}: {
  channelId: string;
  profileId: string;
  requester: TicketHeaderProfile | null;
  assignee: TicketHeaderProfile | null;
  openedAtIso?: string | null;
  openedByBotssonLabel: string | null;
}) {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useChannelMessages(channelId);
  const markAsRead = useMarkAsRead(channelId, profileId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => [...(data?.pages.flat() ?? [])].reverse(), [data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const latestMessageId = messages.length > 0 ? messages[messages.length - 1]!.message_id : null;
  const markAsReadMutate = markAsRead.mutate;
  useEffect(() => {
    if (!latestMessageId) return;
    markAsReadMutate({ messageId: latestMessageId });
  }, [channelId, latestMessageId, markAsReadMutate]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    if (el.scrollTop < 100) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Lookup profile-details for bubbles by sender_id.
  const profileLookup = useMemo(() => {
    const map = new Map<string, TicketHeaderProfile>();
    if (requester) map.set(requester.profile_id, requester);
    if (assignee) map.set(assignee.profile_id, assignee);
    return map;
  }, [requester, assignee]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="bg-background flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-7 pt-7 pb-3"
    >
      {isFetchingNextPage ? (
        <div className="flex justify-center py-1">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          {openedByBotssonLabel ? <SystemPill label={openedByBotssonLabel} /> : null}

          {messages.length === 0 && !openedByBotssonLabel ? (
            <SystemPill label="Ingen meldinger ennå." />
          ) : null}

          {messages.map((msg) => {
            if (SYSTEM_TYPES.has(msg.message_type)) {
              return <SystemPill key={msg.message_id} label={msg.content} />;
            }
            const isOwn = msg.sender_id === profileId;
            const senderProfile = profileLookup.get(msg.sender_id);
            return (
              <MessageBubble
                key={msg.message_id}
                content={msg.content}
                time={formatTime(msg.created_at)}
                name={msg.sender_name ?? senderProfile?.display_name ?? "?"}
                avatarUrl={msg.sender_avatar ?? senderProfile?.avatar_url ?? null}
                isOwn={isOwn}
              />
            );
          })}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function SystemPill({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="bg-muted border-border text-muted-foreground self-center rounded-full border px-3.5 py-1.5 font-mono text-[11px]"
      style={{ letterSpacing: "0.04em" }}
    >
      <span className="inline-flex items-center gap-2">
        <Sparkles size={11} aria-hidden="true" />
        {label}
      </span>
    </div>
  );
}

function MessageBubble({
  content,
  time,
  name,
  avatarUrl,
  isOwn,
}: {
  content: string;
  time: string;
  name: string;
  avatarUrl: string | null;
  isOwn: boolean;
}) {
  const bubbleStyle = isOwn
    ? {
        background: "var(--brand-orange)",
        borderRadius: "14px 14px 4px 14px",
      }
    : {
        borderRadius: "14px 14px 14px 4px",
      };

  const bubbleClass = isOwn ? "text-white" : "bg-card border border-border text-foreground";

  return (
    <div
      className={`flex max-w-[640px] items-start gap-3 ${isOwn ? "flex-row-reverse self-end" : ""}`}
    >
      <LighthouseAvatar name={name} src={avatarUrl ?? undefined} size={36} halo="idle" />
      <div className="min-w-0 flex-1">
        <div className={`mb-1 flex items-baseline gap-2 ${isOwn ? "justify-end" : ""}`}>
          {isOwn ? (
            <>
              <span className="text-muted-foreground font-mono text-[11px]">{time}</span>
              <span className="text-foreground text-sm font-semibold">{name}</span>
            </>
          ) : (
            <>
              <span className="text-foreground text-sm font-semibold">{name}</span>
              <span className="text-muted-foreground font-mono text-[11px]">{time}</span>
            </>
          )}
        </div>
        <div
          className={`${bubbleClass} px-4 py-3`}
          style={{ ...bubbleStyle, fontSize: 14.5, lineHeight: 1.55 }}
        >
          <p className="break-words whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Composer — paperclip / input / mic / send, with trust-line footer.
 * ───────────────────────────────────────────────────────────────────────── */

function TicketComposer({
  channelId,
  profileId,
  requesterFirstName,
}: {
  channelId: string;
  profileId: string;
  requesterFirstName: string;
}) {
  const { t } = useTranslation("helpdesk");
  const sendMessage = useSendMessage(channelId, profileId);
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [content]);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    sendMessage.mutate(
      { content: trimmed },
      {
        onSuccess: () => {
          setContent("");
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholder = t("ticket_composer.placeholder", { name: requesterFirstName });
  const canSend = content.trim().length > 0 && !sendMessage.isPending;

  return (
    <div className="border-border bg-background border-t px-7 pt-3.5 pb-5">
      <div className="bg-card border-border flex items-end gap-2.5 rounded-[14px] border px-3.5 py-3">
        <button
          type="button"
          aria-label="Legg ved fil"
          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
        >
          <Paperclip size={18} />
        </button>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder}
          className="placeholder:text-muted-foreground text-foreground min-h-[22px] flex-1 resize-none border-0 bg-transparent pt-0.5 text-[14.5px] focus:ring-0 focus:outline-none"
          aria-label={placeholder}
        />
        <button
          type="button"
          aria-label="Start taleopptak"
          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
        >
          <Mic size={18} />
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label={t("ticket_composer.send")}
          className="inline-flex items-center gap-1 rounded-[10px] px-2.5 py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
          style={{
            background: "var(--brand-orange)",
            boxShadow: "0 2px 12px oklch(0.65 0.22 40 / 0.25)",
          }}
        >
          <Send size={14} />
          {t("ticket_composer.send")}
        </button>
      </div>
      <div className="text-muted-foreground mt-2 font-mono text-[11px]" role="note">
        {t("ticket_composer.trust_line", { requester: requesterFirstName })}
      </div>
    </div>
  );
}

function ComposerLockedStrip({ label }: { label: string }) {
  return (
    <div
      className="border-border text-muted-foreground bg-muted/30 border-t px-6 py-6 text-center text-sm"
      role="status"
    >
      {label}
    </div>
  );
}
