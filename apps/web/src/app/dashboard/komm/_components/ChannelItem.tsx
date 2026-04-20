"use client";

import type { ChannelWithPreview } from "../_hooks/channel-types";
import { cn } from "@/lib/utils";
import {
  Hash,
  Users,
  MessageCircle,
  Megaphone,
  Lightbulb,
  Building2,
  CalendarDays,
} from "lucide-react";
import { useTranslation } from "@smartout/i18n";

const TYPE_ICONS: Record<string, typeof Hash> = {
  department: Building2,
  team: Users,
  session: CalendarDays,
  custom: Hash,
  direct: MessageCircle,
  news: Megaphone,
  skill: Lightbulb,
};

function formatTime(dateStr: string | null, yesterday: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return date.toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) return yesterday;
  if (diffDays < 7) {
    return date.toLocaleDateString("nb-NO", { weekday: "short" });
  }
  return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

type Props = {
  channel: ChannelWithPreview;
  isActive: boolean;
  unreadCount: number;
  activeCall?: { callSessionId: string; participantCount: number };
  onClick: () => void;
};

export function ChannelItem({ channel, isActive, unreadCount, activeCall, onClick }: Props) {
  const { t } = useTranslation("komm");
  const Icon = TYPE_ICONS[channel.channel_type] ?? Hash;
  const hasActiveCall = !!activeCall;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
        isActive
          ? "bg-accent border-primary border-l-2"
          : hasActiveCall
            ? "border-l-2 border-red-500/60 bg-red-500/5 hover:bg-red-500/10"
            : "hover:bg-accent/50 border-l-2 border-transparent",
      )}
    >
      <div
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        {hasActiveCall && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-black" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span
            className={cn("truncate text-sm", unreadCount > 0 ? "font-semibold" : "font-medium")}
          >
            {channel.name ?? t("channel.direct_message")}
          </span>
          <span className="text-muted-foreground ml-1 shrink-0 text-[10px]">
            {formatTime(channel.last_message_at, t("channel.yesterday"))}
          </span>
        </div>
        <div className="flex items-center justify-between">
          {hasActiveCall ? (
            <p className="flex items-center gap-1 truncate text-xs font-medium text-red-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              {t("call.active_in_channel")}
            </p>
          ) : (
            <p className="text-muted-foreground truncate text-xs">
              {channel.last_message_content
                ? `${channel.last_message_sender_name ?? ""}: ${channel.last_message_content}`.slice(
                    0,
                    50,
                  )
                : t("channel.no_messages")}
            </p>
          )}
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground ml-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
