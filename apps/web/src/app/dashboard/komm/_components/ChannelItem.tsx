"use client";

import type { ChannelWithPreview } from "../_hooks/channel-types";
import type { HelpdeskFlags } from "../_hooks/use-channel-helpdesk-flags";
import { cn } from "@/lib/utils";
import {
  Hash,
  Users,
  MessageCircle,
  Megaphone,
  Lightbulb,
  Building2,
  CalendarDays,
  LifeBuoy,
  Lock,
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
  /** Helpdesk flags for this channel. Absent = regular channel (no indicators). */
  helpdesk?: HelpdeskFlags;
  /** Open tickets assigned to the current user for this desk. Only set when the current user is this channel's responsible rep. */
  openTicketCount?: number;
};

export function ChannelItem({
  channel,
  isActive,
  unreadCount,
  activeCall,
  onClick,
  helpdesk,
  openTicketCount,
}: Props) {
  const { t } = useTranslation("komm");
  const { t: tHelpdesk } = useTranslation("helpdesk");
  const Icon = TYPE_ICONS[channel.channel_type] ?? Hash;
  const hasActiveCall = !!activeCall;
  const isHelpdesk = helpdesk?.helpdesk_enabled === true;
  const isPrivate = helpdesk?.privacy_mode === "private_per_requester";
  const showOpenBadge = isHelpdesk && (openTicketCount ?? 0) > 0;

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
        <div className="flex items-center justify-between gap-1">
          <span
            className={cn(
              "flex min-w-0 items-center gap-1",
              unreadCount > 0 ? "font-semibold" : "font-medium",
            )}
          >
            <span className="truncate text-sm">{channel.name ?? t("channel.direct_message")}</span>
            {isHelpdesk && (
              <LifeBuoy
                className="text-primary h-3 w-3 shrink-0"
                data-testid="channel-badge-lighthouse"
                aria-label={tHelpdesk("skranke_row.helpdesk_badge_label")}
              />
            )}
            {isPrivate && (
              <Lock
                className="text-muted-foreground h-3 w-3 shrink-0"
                aria-label={tHelpdesk("skranke_row.private_badge_label")}
              />
            )}
          </span>
          <span className="text-muted-foreground shrink-0 text-[10px]">
            {formatTime(channel.last_message_at, t("channel.yesterday"))}
          </span>
        </div>
        <div className="flex items-center justify-between">
          {hasActiveCall ? (
            <p className="text-komm-call-active flex items-center gap-1 truncate text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="bg-komm-call-active absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-komm-call-active relative inline-flex h-2 w-2 rounded-full" />
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
          <div className="ml-1 flex shrink-0 items-center gap-1">
            {showOpenBadge && (
              <span
                className="bg-primary/15 text-primary flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold"
                aria-label={
                  openTicketCount === 1
                    ? tHelpdesk("skranke_row.open_tickets_label_one", { count: openTicketCount })
                    : tHelpdesk("skranke_row.open_tickets_label_other", {
                        count: openTicketCount ?? 0,
                      })
                }
              >
                <LifeBuoy className="mr-0.5 h-2.5 w-2.5" aria-hidden="true" />
                {(openTicketCount ?? 0) > 99 ? "99+" : openTicketCount}
              </span>
            )}
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
