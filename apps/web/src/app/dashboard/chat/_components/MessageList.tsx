"use client";

import { useEffect, useRef, useCallback } from "react";
import { MessageBubble } from "./MessageBubble";
import type { MessageWithSender } from "../_hooks/chat-types";

type Props = {
  pages: MessageWithSender[][];
  profileId: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onReply: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
};

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "I dag";
  if (diffDays === 1) return "I g\u00e5r";
  return date.toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function groupByDate(messages: MessageWithSender[]): Map<string, MessageWithSender[]> {
  const groups = new Map<string, MessageWithSender[]>();
  for (const msg of messages) {
    const dateKey = new Date(msg.created_at).toDateString();
    const group = groups.get(dateKey) ?? [];
    group.push(msg);
    groups.set(dateKey, group);
  }
  return groups;
}

export function MessageList({
  pages,
  profileId,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onReply,
  onReaction,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // All messages flattened and reversed (newest last for display)
  const allMessages = pages.flat().reverse();
  const dateGroups = groupByDate(allMessages);

  // Auto-scroll to bottom on new messages (if already at bottom)
  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages.length]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // At bottom?
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    isAtBottomRef.current = atBottom;

    // At top? Load more
    if (el.scrollTop < 100 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4" onScroll={handleScroll}>
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <span className="text-muted-foreground text-xs">Laster eldre meldinger...</span>
        </div>
      )}

      {Array.from(dateGroups.entries()).map(([dateKey, messages]) => (
        <div key={dateKey}>
          {/* Date separator */}
          <div className="flex items-center justify-center py-4">
            <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs">
              {formatDateHeader(messages[0].created_at)}
            </span>
          </div>

          {/* Messages */}
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isMe={msg.sender_id === profileId}
                profileId={profileId}
                onReply={onReply}
                onReaction={onReaction}
              />
            ))}
          </div>
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
