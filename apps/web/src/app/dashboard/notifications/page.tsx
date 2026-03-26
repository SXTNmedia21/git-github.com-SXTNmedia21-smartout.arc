"use client";

/**
 * page.tsx — Full notifications page at /dashboard/notifications.
 *
 * Shows all notifications for the current profile with filter tabs by type,
 * infinite scroll to load more, and a mark-all-as-read action at the top.
 * Mirrors the icon map and timeAgo helper from NotificationBell for visual consistency.
 */

import { useContext, useCallback, useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from "@smartout/notifications/client";

/* ------------------------------------------------------------------ */
/*  Icon mapping — mirrors NotificationBell for visual consistency     */
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
/*  Filter tab definitions                                             */
/* ------------------------------------------------------------------ */

type FilterId =
  | "all"
  | "unread"
  | "shift"
  | "chat"
  | "task"
  | "deviation"
  | "approval"
  | "training";

type FilterTab = {
  id: FilterId;
  label: string;
};

const FILTER_TABS: FilterTab[] = [
  { id: "all", label: "Alle" },
  { id: "unread", label: "Uleste" },
  { id: "shift", label: "Vakter" },
  { id: "chat", label: "Chat" },
  { id: "task", label: "Oppgaver" },
  { id: "deviation", label: "Avvik" },
  { id: "approval", label: "Godkjenning" },
  { id: "training", label: "Opplæring" },
];

/* ------------------------------------------------------------------ */
/*  Relative time helper (Norwegian, inline — no external library)    */
/* ------------------------------------------------------------------ */

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "nå";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min siden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}t siden`;
  const days = Math.floor(hours / 24);
  return `${days}d siden`;
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function NotificationsPage() {
  const router = useRouter();
  const { profileId } = useContext(DashboardContext);

  const [activeFilter, setActiveFilter] = useState<FilterId>("all");

  // Build filter params for useNotifications based on active tab
  const queryFilter =
    activeFilter === "all"
      ? undefined
      : activeFilter === "unread"
        ? { unreadOnly: true }
        : { iconType: activeFilter };

  // Data hooks
  const { data: unreadCount = 0 } = useUnreadCount(profileId ?? undefined);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotifications(
    profileId ?? undefined,
    queryFilter,
  );
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead(profileId ?? undefined);

  // Flatten all pages into one flat list
  const notifications = (data?.pages ?? []).flatMap((p: { data: unknown[] }) => p.data) as Array<{
    id: string;
    title: string;
    body: string | null;
    icon_type: string;
    action_url: string | null;
    is_read: boolean;
    created_at: string;
  }>;

  // Intersection observer sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // When the sentinel becomes visible and there's more data, load the next page
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  /**
   * Click a notification row: mark it as read and navigate to action_url.
   */
  const handleRowClick = useCallback(
    (id: string, actionUrl: string | null, isRead: boolean) => {
      if (!isRead) {
        markAsRead.mutate(id);
      }
      if (actionUrl) {
        router.push(actionUrl);
      }
    },
    [markAsRead, router],
  );

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-foreground text-2xl font-semibold">Varsler</h1>
          {unreadCount > 0 && (
            <span className="bg-destructive text-destructive-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>

        {/* Mark all as read — only shown when unread notifications exist */}
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
            className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marker alle som lest
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeFilter === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(tab.id)}
            className="rounded-full text-xs"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Notification list */}
      {notifications.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center py-20">
          <Bell className="mb-3 h-10 w-10 opacity-25" />
          <p className="text-sm">Ingen varsler ennå</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const IconComponent = ICON_MAP[n.icon_type] ?? Bell;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleRowClick(n.id, n.action_url, n.is_read)}
                  className="hover:bg-muted/50 flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors"
                >
                  {/* Icon */}
                  <div className="bg-muted mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                    <IconComponent className="text-muted-foreground h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-hidden">
                    <p className="text-foreground text-sm font-medium">{n.title}</p>
                    {n.body && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{n.body}</p>
                    )}
                    <p className="text-muted-foreground/70 mt-1 text-[11px]">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!n.is_read && <span className="bg-primary mt-2 h-2 w-2 shrink-0 rounded-full" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Infinite scroll sentinel — becomes visible when user reaches the bottom */}
      <div ref={sentinelRef} className="py-4 text-center">
        {isFetchingNextPage && (
          <p className="text-muted-foreground text-xs">Laster flere varsler...</p>
        )}
      </div>
    </div>
  );
}
