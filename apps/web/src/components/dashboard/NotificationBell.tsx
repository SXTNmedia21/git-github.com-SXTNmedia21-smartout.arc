"use client";

/**
 * NotificationBell.tsx — Bell icon with popover showing recent notifications.
 *
 * Displays an animated unread badge, the last 8 notifications with icons and
 * relative timestamps, and provides mark-as-read and navigation actions.
 * Subscribes to realtime changes via useNotificationRealtime and requests
 * browser notification permission on first interaction.
 */

import { useState, useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Calendar,
  MessageCircle,
  CheckSquare,
  AlertTriangle,
  ThumbsUp,
  GraduationCap,
  Info,
  CheckCheck,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  useUnreadCount,
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
} from "@smartout/notifications/client";
import { useNotificationRealtime } from "@/hooks/use-notification-realtime";
import { useTranslation } from "@smartout/i18n";
import { ChatPanelContext } from "./ChatPanel";

/* ------------------------------------------------------------------ */
/*  Icon mapping — one icon per notification icon_type                */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Info,
  shift: Calendar,
  chat: MessageCircle,
  task: CheckSquare,
  deviation: AlertTriangle,
  approval: ThumbsUp,
  training: GraduationCap,
};

/* ------------------------------------------------------------------ */
/*  Relative time helper (Norwegian, inline — no external library)    */
/* ------------------------------------------------------------------ */

function createTimeAgo(t: (key: string, params?: Record<string, string | number>) => string) {
  return function timeAgo(date: string): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return t("time.now");
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t("time.minutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("time.hoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    return t("time.daysAgo", { count: days });
  };
}

/* ------------------------------------------------------------------ */
/*  Spring animation constants (design system: Ren og Varm)           */
/* ------------------------------------------------------------------ */

const SPRING = { type: "spring" as const, stiffness: 35, damping: 22, mass: 2 };

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

interface NotificationBellProps {
  profileId: string | undefined;
}

export function NotificationBell({ profileId }: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("notifications");
  const timeAgo = createTimeAgo(t);

  // Data hooks
  const { data: unreadCount = 0 } = useUnreadCount(profileId);
  const { data: notificationsData } = useNotifications(profileId);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead(profileId);

  // Realtime subscription — invalidates queries + glow on new INSERT
  const { isGlowing } = useNotificationRealtime(profileId);

  // Flatten infinite query pages and take first 8
  const notifications = (notificationsData?.pages ?? [])
    .flatMap((p: { data: unknown[] }) => p.data)
    .slice(0, 8) as Array<{
    id: string;
    title: string;
    body: string | null;
    icon_type: string;
    action_url: string | null;
    is_read: boolean;
    created_at: string;
  }>;

  /**
   * Request browser notification permission on first bell click.
   * We only ask once — the browser remembers the user's choice.
   */
  const handleBellClick = useCallback(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const { openChat } = useContext(ChatPanelContext);

  /**
   * Click a notification row: mark as read, then open chat panel for chat
   * notifications or navigate to action_url for everything else.
   */
  const handleRowClick = useCallback(
    (id: string, actionUrl: string | null, isRead: boolean, iconType: string) => {
      if (!isRead) {
        markAsRead.mutate(id);
      }
      // Chat notifications open the side panel instead of navigating
      if (iconType === "chat" && actionUrl) {
        const channelId = actionUrl.split("/").pop();
        if (channelId) {
          openChat(channelId);
        }
      } else if (actionUrl) {
        router.push(actionUrl);
      }
      setOpen(false);
    },
    [markAsRead, router, openChat],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          type="button"
          onClick={handleBellClick}
          animate={
            isGlowing
              ? {
                  boxShadow: [
                    "0 0 0 0 rgba(255, 107, 53, 0)",
                    "0 0 16px 4px rgba(255, 107, 53, 0.4)",
                    "0 0 0 0 rgba(255, 107, 53, 0)",
                  ],
                }
              : { boxShadow: "0 0 0 0 rgba(255, 107, 53, 0)" }
          }
          transition={
            isGlowing ? { duration: 1.5, repeat: 1, ease: "easeInOut" } : { duration: 0.3 }
          }
          className="hover:bg-muted relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          aria-label={t("bell.label")}
        >
          <motion.div
            animate={isGlowing ? { rotate: [0, -12, 12, -8, 8, 0] } : { rotate: 0 }}
            transition={isGlowing ? { duration: 0.6, ease: "easeInOut" } : { duration: 0.2 }}
          >
            <Bell
              className={isGlowing ? "h-5 w-5 text-[#FF6B35]" : "text-muted-foreground h-5 w-5"}
            />
          </motion.div>

          {/* Animated unread badge */}
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={SPRING}
                className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[360px] p-0">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-foreground text-sm font-semibold">{t("bell.title")}</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t("bell.markAllRead")}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-10">
                <Bell className="mb-2 h-8 w-8 opacity-30" />
                <p className="text-sm">{t("bell.empty")}</p>
              </div>
            ) : (
              <ul className="divide-y">
                {notifications.map((n) => {
                  const IconComponent = ICON_MAP[n.icon_type] ?? Bell;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleRowClick(n.id, n.action_url, n.is_read, n.icon_type)}
                        className="hover:bg-muted/50 flex w-full items-start gap-3 px-4 py-3 text-left transition-colors"
                      >
                        {/* Icon */}
                        <div className="bg-muted mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                          <IconComponent className="text-muted-foreground h-4 w-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-hidden">
                          <p className="text-foreground truncate text-sm font-medium">{n.title}</p>
                          {n.body && (
                            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                              {n.body}
                            </p>
                          )}
                          <p className="text-muted-foreground/70 mt-1 text-[11px]">
                            {timeAgo(n.created_at)}
                          </p>
                        </div>

                        {/* Unread dot */}
                        {!n.is_read && (
                          <span className="bg-primary mt-2 h-2 w-2 shrink-0 rounded-full" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-2.5">
            <button
              type="button"
              onClick={() => {
                router.push("/dashboard/notifications");
                setOpen(false);
              }}
              className="text-primary hover:text-primary/80 w-full text-center text-xs font-medium transition-colors"
            >
              {t("bell.seeAll")}
            </button>
          </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}
