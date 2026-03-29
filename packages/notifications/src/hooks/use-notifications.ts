/**
 * use-notifications.ts — React Query hooks for notification data.
 *
 * Provides hooks for reading notifications, tracking unread counts,
 * and marking notifications as read. Uses infinite pagination for
 * the notification list to support mobile-style scroll-to-load-more.
 *
 * All hooks create a fresh Supabase browser client per the established
 * codebase pattern (see apps/web/src/hooks/shift-clock/useShiftClock.ts).
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

// How many notifications to load per page
const PAGE_SIZE = 20;

/**
 * Returns the total count of unread notifications for a profile.
 * Used to drive the badge on the NotificationBell component.
 */
export function useUnreadCount(profileId: string | undefined) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["unread-count", profileId],
    queryFn: async () => {
      if (!profileId) return 0;
      const { count } = await supabase
        .from("notification")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", profileId)
        .eq("is_read", false);
      return count ?? 0;
    },
    enabled: !!profileId,
  });
}

/**
 * Returns a paginated, infinite list of notifications for a profile.
 * Supports optional filtering by read status and icon_type.
 *
 * Call fetchNextPage() to load the next page when the user scrolls
 * to the bottom of the notification list.
 */
export function useNotifications(
  profileId: string | undefined,
  filter?: {
    unreadOnly?: boolean;
    iconType?: string;
  },
) {
  const supabase = createClient();
  return useInfiniteQuery({
    queryKey: ["notifications", profileId, filter],
    queryFn: async ({ pageParam = 0 }) => {
      if (!profileId) return { data: [], nextPage: null };

      let query = supabase
        .from("notification")
        .select("*")
        .eq("recipient_id", profileId)
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (filter?.unreadOnly) query = query.eq("is_read", false);
      if (filter?.iconType) query = query.eq("icon_type", filter.iconType);

      const { data, error } = await query;
      if (error) throw error;

      // If we got a full page, there may be more — set the next offset
      return {
        data: data ?? [],
        nextPage: (data?.length ?? 0) === PAGE_SIZE ? pageParam + PAGE_SIZE : null,
      };
    },
    getNextPageParam: (lastPage: { data: unknown[]; nextPage: number | null }) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!profileId,
  });
}

/**
 * Marks one or more notifications as read.
 * Accepts a single id string or an array of ids.
 * Invalidates both the notification list and the unread count on success.
 */
export function useMarkAsRead() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string | string[]) => {
      const idArray = Array.isArray(ids) ? ids : [ids];
      const { error } = await supabase
        .from("notification")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in("id", idArray);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });
}

/**
 * Marks all unread notifications for a profile as read in a single operation.
 * Useful for the "Mark all as read" action in the notification center.
 */
export function useMarkAllAsRead(profileId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!profileId) return;
      const { error } = await supabase
        .from("notification")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("recipient_id", profileId)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });
}
