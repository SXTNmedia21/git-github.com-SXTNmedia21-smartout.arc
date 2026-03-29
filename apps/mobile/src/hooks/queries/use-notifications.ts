/**
 * Mobile notification hooks — local versions using the mobile Supabase client.
 *
 * Why not use @smartout/notifications hooks directly?
 * The shared hooks call createClient() from @smartout/supabase/client which
 * uses browser APIs (localStorage, fetch with cookie options). On React Native
 * those APIs aren't available. These hooks use the mobile-specific supabase
 * instance from @/lib/supabase which is configured for native (SecureStore).
 *
 * API is intentionally identical to the shared hooks so they can be swapped
 * if the shared package ever adds native support.
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type Notification = Database["public"]["Tables"]["notification"]["Row"];

// How many notifications to load per page
const PAGE_SIZE = 20;

/**
 * Returns the total count of unread notifications for a profile.
 * Drives the badge on NotificationBell.
 */
export function useUnreadCount(profileId: string | undefined) {
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
    // Refresh often enough to stay in sync with push delivery
    staleTime: 30_000,
  });
}

/**
 * Infinite-paginated list of notifications for a profile.
 * Supports optional filtering by unread-only and icon_type.
 *
 * Call fetchNextPage() when the user scrolls to the bottom of the list.
 */
export function useNotifications(
  profileId: string | undefined,
  filter?: {
    unreadOnly?: boolean;
    iconType?: string;
  },
) {
  return useInfiniteQuery({
    queryKey: ["notifications", profileId, filter],
    queryFn: async ({ pageParam = 0 }: { pageParam: number }) => {
      if (!profileId) return { data: [] as Notification[], nextPage: null };

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

      return {
        data: data ?? [],
        nextPage: (data?.length ?? 0) === PAGE_SIZE ? pageParam + PAGE_SIZE : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!profileId,
  });
}

/**
 * Marks one or more notifications as read by id.
 * Accepts a single id or an array. Invalidates list + unread count on success.
 */
export function useMarkAsRead() {
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
 * Marks all unread notifications for a profile as read in a single query.
 * Used by the "Marker alle som lest" button in NotificationScreen.
 */
export function useMarkAllAsRead(profileId: string | undefined) {
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
