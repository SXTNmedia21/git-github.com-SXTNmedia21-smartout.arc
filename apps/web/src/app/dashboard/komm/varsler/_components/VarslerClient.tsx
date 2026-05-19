"use client";

/**
 * VarslerClient — full notification feed for /dashboard/komm/varsler (SM-5).
 *
 * Extracted from the original /dashboard/notifications page. Content and behaviour
 * are identical; only the location has changed. The old /dashboard/notifications
 * route now redirects here (307).
 *
 * Retains the NotificationsToolsBridge import from its original location — the
 * bridge file stays at notifications/_tools/ to avoid a breaking rename of
 * Botsson tool references.
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
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from "@smartout/notifications/client";
import { useTranslation } from "@smartout/i18n";
import { NotificationsToolsBridge } from "@/app/dashboard/notifications/_tools/notifications-tools-bridge";

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
  contract: FileText,
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
  | "training"
  | "contract";

const FILTER_IDS: FilterId[] = [
  "all",
  "unread",
  "shift",
  "chat",
  "task",
  "deviation",
  "approval",
  "training",
  "contract",
];

/* ------------------------------------------------------------------ */
/*  Varsler client component                                           */
/* ------------------------------------------------------------------ */

export function VarslerClient() {
  const router = useRouter();
  const { profileId, workspaceData } = useContext(DashboardContext);
  const { t } = useTranslation("notifications");
  // actorId = profileId per system convention (profile_id is the auditable identity).
  // workspaceId resolved from server-derived DashboardContext (ADR-0151 — not body-forged).
  const workspaceId = workspaceData?.workspace_id ?? undefined;
  const actorId = profileId ?? undefined;

  const [activeFilter, setActiveFilter] = useState<FilterId>("all");

  function timeAgo(date: string): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return t("time.now");
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t("time.minutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("time.hoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    return t("time.daysAgo", { count: days });
  }

  // i18n label for each filter tab
  const filterLabel: Record<FilterId, string> = {
    all: t("filter.all"),
    unread: t("filter.unread"),
    shift: t("filter.shift"),
    chat: t("filter.chat"),
    task: t("filter.task"),
    deviation: t("filter.deviation"),
    approval: t("filter.approval"),
    training: t("filter.training"),
    contract: t("filter.contract"),
  };

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
  const markAsRead = useMarkAsRead(workspaceId, actorId);
  const markAllAsRead = useMarkAllAsRead(profileId ?? undefined, workspaceId, actorId);

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
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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
    <div className="relative z-[1] flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-4 pt-3 md:p-6 md:pt-4">
      {/* Harness bridge — registers Botsson tools for this surface */}
      <NotificationsToolsBridge
        notifications={notifications}
        unreadCount={unreadCount}
        activeFilter={activeFilter}
        markAsRead={(id) => markAsRead.mutate(id)}
        markAllAsRead={() => markAllAsRead.mutate()}
        setActiveFilter={setActiveFilter}
      />
      {/* Header — Oversikt design system */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight md:text-4xl">
              {t("page.title")}
            </h1>
            {unreadCount > 0 && (
              <span className="bg-destructive text-destructive-foreground flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
            className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {t("page.markAllRead")}
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTER_IDS.map((id) => (
          <Button
            key={id}
            variant={activeFilter === id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(id)}
            className="rounded-full text-xs"
          >
            {filterLabel[id]}
          </Button>
        ))}
      </div>

      {/* Notification list */}
      {notifications.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center py-20">
          <Bell className="mb-3 h-10 w-10 opacity-25" />
          <p className="text-sm">{t("page.empty")}</p>
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
                  <div className="bg-muted mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                    <IconComponent className="text-muted-foreground h-4 w-4" />
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <p className="text-foreground text-sm font-medium">{n.title}</p>
                    {n.body && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{n.body}</p>
                    )}
                    <p className="text-muted-foreground/70 mt-1 text-[11px]">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>

                  {!n.is_read && <span className="bg-primary mt-2 h-2 w-2 shrink-0 rounded-full" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="py-4 text-center">
        {isFetchingNextPage && (
          <p className="text-muted-foreground text-xs">{t("page.loadingMore")}</p>
        )}
      </div>
    </div>
  );
}
