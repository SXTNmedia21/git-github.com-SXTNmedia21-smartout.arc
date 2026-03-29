"use client";

import { useMemo } from "react";
import { useTranslation } from "@smartout/i18n";
import { useChannelMessages } from "../_hooks/use-channel-messages";
import type { ChannelWithPreview, MessageWithSender } from "../_hooks/channel-types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Props = {
  channels: ChannelWithPreview[];
  profileId: string;
};

function useFormatRelativeTime() {
  const { t } = useTranslation("komm");
  return (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 1) return t("time.just_now");
    if (diffHours < 24) return t("time.hours_ago", { count: diffHours });
    if (diffDays === 1) return t("time.yesterday");
    if (diffDays < 7) return t("time.days_ago", { count: diffDays });
    return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  };
}

function NewsCard({
  message,
  formatRelativeTime,
}: {
  message: MessageWithSender;
  formatRelativeTime: (dateStr: string) => string;
}) {
  const reactions = message.reactions ?? [];
  const groupedReactions = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="border-border mx-3 my-2 overflow-hidden rounded-lg border">
      {/* Author header */}
      <div className="flex items-center gap-2.5 p-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {(message.sender_name ?? "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold">{message.sender_name}</p>
          <p className="text-muted-foreground text-[11px]">
            {formatRelativeTime(message.created_at)}
          </p>
        </div>
      </div>
      {/* Body */}
      <div className="px-3 pb-3 text-sm leading-relaxed">{message.content}</div>
      {/* Footer: reactions */}
      {Object.keys(groupedReactions).length > 0 && (
        <div className="text-muted-foreground flex gap-3 border-t px-3 py-2 text-xs">
          {Object.entries(groupedReactions).map(([emoji, count]) => (
            <span key={emoji}>
              {emoji} {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function NewsFeed({ channels, profileId }: Props) {
  const { t } = useTranslation("komm");
  const formatRelativeTime = useFormatRelativeTime();
  // Find news channels
  const newsChannel = useMemo(() => channels.find((ch) => ch.channel_type === "news"), [channels]);

  const { data, isLoading } = useChannelMessages(newsChannel?.channel_id ?? null);

  const messages = useMemo(() => [...(data?.pages.flat() ?? [])].reverse(), [data]);

  if (!newsChannel) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-muted-foreground text-xs">{t("news.empty_no_channel")}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-muted h-24 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-muted-foreground text-xs">{t("news.empty_no_messages")}</p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {messages.map((msg: MessageWithSender) => (
        <NewsCard key={msg.message_id} message={msg} formatRelativeTime={formatRelativeTime} />
      ))}
    </div>
  );
}
