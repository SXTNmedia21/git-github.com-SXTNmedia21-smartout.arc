"use client";

/**
 * MessageTimeline — Channel message stream with Nordic Split ambient styling.
 *
 * Redesign (2026-04-29):
 *   - Subtle ambient glow at top of timeline (radial gradient)
 *   - font-heading day-dividers with mono date sub-label
 *   - Pinned/system messages rendered as dashed-border ambient cards
 *   - All existing logic (infinite scroll, mark-as-read, grouping) preserved
 *
 * Nordic Split: no hardcoded colors, CSS variables only.
 */

import { useRef, useEffect, useCallback, useMemo } from "react";
import { useChannelMessages } from "../_hooks/use-channel-messages";
import type { MessageWithSender } from "../_hooks/channel-types";
import { useMarkAsRead } from "../_hooks/use-mark-as-read";
import { MessageBubble } from "./MessageBubble";
import { SystemMessage } from "./SystemMessage";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@smartout/i18n";

// Types that warrant the "pinned system message" card treatment
const SYSTEM_TYPES = new Set(["system", "brief", "handoff", "announcement", "reminder", "summary"]);

type Props = {
  channelId: string;
  profileId: string;
  onReply: (messageId: string) => void;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a date as "I dag · 29. apr" — dual-line heading + mono date.
 * The heading label (I dag / I går / weekday) is the large part;
 * the ISO date is the small mono part.
 */
function formatDayLabel(dateStr: string): { heading: string; mono: string } {
  const date = new Date(dateStr);
  const now = new Date();

  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const heading = isSameDay
    ? "I dag"
    : isYesterday
      ? "I går"
      : date.toLocaleDateString("nb-NO", { weekday: "long" });

  const mono = date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });

  return { heading, mono };
}

// ── Day divider ─────────────────────────────────────────────────────────────

function DayDivider({ dateStr }: { dateStr: string }) {
  const { heading, mono } = formatDayLabel(dateStr);
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="bg-border/50 h-px flex-1" />
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-heading text-foreground/80 text-[16px] leading-tight tracking-tight">
          {heading}
        </span>
        <span className="text-muted-foreground font-mono text-[11px] tracking-[0.05em]">
          {mono}
        </span>
      </div>
      <div className="bg-border/50 h-px flex-1" />
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function MessageTimeline({ channelId, profileId, onReply }: Props) {
  const { t } = useTranslation("komm");
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useChannelMessages(channelId);
  const markAsRead = useMarkAsRead(channelId, profileId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Flatten pages and reverse for chronological order (RPC returns DESC)
  const messages = useMemo(() => [...(data?.pages.flat() ?? [])].reverse(), [data]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark latest message as read when channel opens or new messages arrive
  const latestMessageId = messages.length > 0 ? messages[messages.length - 1]!.message_id : null;
  const markAsReadMutate = markAsRead.mutate;
  useEffect(() => {
    if (!latestMessageId) return;
    markAsReadMutate({ messageId: latestMessageId });
  }, [channelId, latestMessageId, markAsReadMutate]);

  // Infinite scroll: load older messages on scroll to top
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    if (el.scrollTop < 100) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Group messages by calendar date (YYYY-MM-DD key for stable grouping)
  const groupedByDate = useMemo(() => {
    const groups: { dateKey: string; messages: typeof messages }[] = [];
    let currentKey = "";
    for (const msg of messages) {
      const key = new Date(msg.created_at).toISOString().split("T")[0]!;
      if (key !== currentKey) {
        currentKey = key;
        groups.push({ dateKey: key, messages: [] });
      }
      groups[groups.length - 1]!.messages.push(msg);
    }
    return groups;
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto">
      {/* Ambient top glow — Nordic Split warmth */}
      <div
        aria-hidden="true"
        className="from-muted/40 pointer-events-none absolute top-0 right-0 left-0 z-10 h-20 bg-gradient-to-b to-transparent"
      />

      {/* Loading older messages indicator */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-2 pt-4">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        </div>
      )}

      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground text-sm">{t("message.empty_state")}</p>
        </div>
      ) : (
        groupedByDate.map((group) => (
          <div key={group.dateKey}>
            {/* Nordic Split day divider — font-heading + mono date */}
            <DayDivider dateStr={group.dateKey} />

            {group.messages.map((msg: MessageWithSender) =>
              SYSTEM_TYPES.has(msg.message_type) ? (
                <SystemMessage key={msg.message_id} message={msg} />
              ) : (
                <MessageBubble
                  key={msg.message_id}
                  message={msg}
                  channelId={channelId}
                  profileId={profileId}
                  isOwn={msg.sender_id === profileId}
                  onReply={onReply}
                />
              ),
            )}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}
