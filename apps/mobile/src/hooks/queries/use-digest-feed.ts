/**
 * Fetches digest feed items for the Daily Digest screen.
 *
 * Combines recent notifications and active deviations into a unified
 * feed. Notifications serve as the primary "digest" items, while
 * deviations surface as important alerts. Archive items are older
 * read notifications.
 */

import { useMemo } from "react";
import { useNotifications } from "./use-notifications";
import { useDayInfo } from "./use-day-info";
import { useMyProfile } from "./use-my-profile";
import type { Database } from "@smartout/supabase/database.types";

type Notification = Database["public"]["Tables"]["notification"]["Row"];

export type DigestFeedItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  iconType: string;
  tag?: string;
  featured: boolean;
  actionUrl: string | null;
};

export type ArchiveFeedItem = {
  id: string;
  date: string;
  title: string;
  body: string;
};

export type DigestFeed = {
  items: DigestFeedItem[];
  archive: ArchiveFeedItem[];
  isLoading: boolean;
  isError: boolean;
};

/** Format a date to relative time string like "12:30 · I dag" or "I går" */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0];
  const itemDateStr = date.toISOString().split("T")[0];

  const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  if (itemDateStr === todayStr) return `${timeStr} · I dag`;
  if (itemDateStr === yesterdayStr) return "I går";

  // Older: show DD/MM
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Hook: returns digest feed data combining notifications and deviations.
 * Recent unread notifications become featured/regular digest items.
 * Older read notifications become archive items.
 */
export function useDigestFeed(): DigestFeed {
  const { data: profile } = useMyProfile();
  const profileId = profile?.profile_id;

  const notificationsQuery = useNotifications(profileId);
  const dayInfoQuery = useDayInfo();

  const isLoading = notificationsQuery.isLoading || dayInfoQuery.isLoading;
  const isError = notificationsQuery.isError || dayInfoQuery.isError;

  const { items, archive } = useMemo(() => {
    const allNotifications: Notification[] =
      notificationsQuery.data?.pages?.flatMap((page) => page.data) ?? [];

    // Split into recent (unread or last 3 days) and archive
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const cutoff = threeDaysAgo.toISOString();

    const recent = allNotifications.filter((n) => !n.is_read || n.created_at >= cutoff);
    const older = allNotifications.filter((n) => n.is_read && n.created_at < cutoff);

    // Add deviations as high-priority digest items
    const deviations = dayInfoQuery.data?.deviations ?? [];

    const feedItems: DigestFeedItem[] = [];

    // Deviations first — they're always important
    for (const dev of deviations) {
      feedItems.push({
        id: `dev-${dev.deviation_id}`,
        title: dev.title,
        body: dev.description ?? "Aktivt avvik som krever oppmerksomhet.",
        time: formatRelativeTime(dev.created_at),
        iconType: "alert",
        tag:
          dev.severity === "critical" ? "Kritisk" : dev.severity === "high" ? "Viktig" : undefined,
        featured: dev.severity === "critical" || dev.severity === "high",
        actionUrl: null,
      });
    }

    // Recent notifications
    for (const notif of recent) {
      feedItems.push({
        id: `notif-${notif.id}`,
        title: notif.title,
        body: notif.body ?? "",
        time: formatRelativeTime(notif.created_at),
        iconType: notif.icon_type,
        tag: !notif.is_read ? "Ny" : undefined,
        // First unread notification is featured if no deviation is featured
        featured: false,
        actionUrl: notif.action_url,
      });
    }

    // Mark the first item as featured if none are yet
    if (feedItems.length > 0 && !feedItems.some((i) => i.featured)) {
      feedItems[0]!.featured = true;
    }

    const archiveItems: ArchiveFeedItem[] = older.slice(0, 10).map((n) => ({
      id: `archive-${n.id}`,
      date: formatRelativeTime(n.created_at),
      title: n.title,
      body: n.body ?? "",
    }));

    return { items: feedItems, archive: archiveItems };
  }, [notificationsQuery.data, dayInfoQuery.data]);

  return { items, archive, isLoading, isError };
}
