"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { useChannelMessages } from "../_hooks/use-channel-messages";
import type { MessageWithSender } from "../_hooks/channel-types";
import { useMarkAsRead } from "../_hooks/use-mark-as-read";
import { MessageBubble } from "./MessageBubble";
import { SystemMessage } from "./SystemMessage";
import { Loader2 } from "lucide-react";

const SYSTEM_TYPES = new Set(["system", "brief", "handoff", "announcement", "reminder", "summary"]);

type Props = {
  channelId: string;
  profileId: string;
  onReply: (messageId: string) => void;
};

export function MessageTimeline({ channelId, profileId, onReply }: Props) {
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

  // Group messages by date
  const groupedByDate = useMemo(() => {
    const groups: { date: string; messages: typeof messages }[] = [];
    let currentDate = "";
    for (const msg of messages) {
      const date = new Date(msg.created_at).toLocaleDateString("nb-NO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, messages: [] });
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
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
      {/* Loading older messages */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-2">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        </div>
      )}

      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground text-sm">Ingen meldinger ennå. Start samtalen!</p>
        </div>
      ) : (
        groupedByDate.map((group) => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex items-center gap-4 px-4 py-3">
              <div className="bg-border h-px flex-1" />
              <span className="text-muted-foreground text-[11px] font-medium">{group.date}</span>
              <div className="bg-border h-px flex-1" />
            </div>

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
