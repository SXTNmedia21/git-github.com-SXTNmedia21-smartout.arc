/**
 * use-notifications.ts — React Query hooks for notification data.
 *
 * Provides hooks for reading notifications, tracking unread counts,
 * and marking notifications as read. Uses infinite pagination for
 * the notification list to support mobile-style scroll-to-load-more.
 *
 * All hooks create a fresh Supabase browser client per the established
 * codebase pattern (see apps/web/src/hooks/shift-clock/useShiftClock.ts).
 *
 * Telemetry: useMarkAsRead + useMarkAllAsRead emit on success per ADR-0134.
 * workspaceId + actorId are required args (ADR-0151 server-derive pattern).
 * Fail-fast per L-0177: throw when identity missing — never substitute "".
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";

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
 *
 * workspaceId + actorId enable telemetry (ADR-0134 + ADR-0151).
 * When provided, both must be non-empty — L-0177 fail-fast: throw on "" fallback.
 * When undefined, the mutation proceeds but emit() is skipped (e.g. NotificationBell
 * which only receives profileId, not the full workspace context).
 */
export function useMarkAsRead(workspaceId?: string, actorId?: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string | string[]) => {
      // L-0177: reject empty strings — must be non-empty or absent.
      if (workspaceId === "")
        throw new Error("[useMarkAsRead] workspaceId must not be empty string (L-0177)");
      if (actorId === "")
        throw new Error("[useMarkAsRead] actorId must not be empty string (L-0177)");
      const idArray = Array.isArray(ids) ? ids : [ids];
      const { data, error } = await supabase
        .from("notification")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in("id", idArray)
        .select("id, icon_type");
      if (error) throw error;
      return { idArray, rows: data ?? [] };
    },
    onSuccess: ({ idArray, rows }) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      // Emit only when full identity context is available (ADR-0134).
      if (!workspaceId || !actorId) return;
      // One event per marked notification.
      for (const row of rows) {
        void emit({
          event: "notification.marked_read",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(actorId, "actor_id"),
          properties: {
            data: {
              notification_id: row.id as string,
              notification_type: (row.icon_type ?? "unknown") as string,
            },
          },
        }).catch((e: unknown) => console.warn("[notifications] emit failed:", e));
      }
      // Fallback: if DB returned no rows but we had ids, emit for each id.
      if (rows.length === 0 && idArray.length > 0) {
        for (const id of idArray) {
          void emit({
            event: "notification.marked_read",
            workspace_id: nonEmpty(workspaceId, "workspace_id"),
            actor_id: nonEmpty(actorId, "actor_id"),
            properties: {
              data: { notification_id: id, notification_type: "unknown" },
            },
          }).catch((e: unknown) => console.warn("[notifications] emit failed:", e));
        }
      }
    },
  });
}

/**
 * Marks all unread notifications for a profile as read in a single operation.
 * Useful for the "Mark all as read" action in the notification center.
 *
 * workspaceId + actorId enable telemetry (ADR-0134 + ADR-0151).
 * L-0177 fail-fast: throw on empty string — never substitute "".
 * When undefined, the mutation proceeds but emit() is skipped.
 * profileId is used for the DB filter; actorId is the auditable identity.
 */
export function useMarkAllAsRead(
  profileId: string | undefined,
  workspaceId?: string,
  actorId?: string,
) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!profileId) return { markedCount: 0 };
      // L-0177: reject empty strings — must be non-empty or absent.
      if (workspaceId === "")
        throw new Error("[useMarkAllAsRead] workspaceId must not be empty string (L-0177)");
      if (actorId === "")
        throw new Error("[useMarkAllAsRead] actorId must not be empty string (L-0177)");
      // Count before update so we can emit the accurate marked_count.
      const { count } = await supabase
        .from("notification")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", profileId)
        .eq("is_read", false);
      const { error } = await supabase
        .from("notification")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("recipient_id", profileId)
        .eq("is_read", false);
      if (error) throw error;
      return { markedCount: count ?? 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      if (!result || result.markedCount === 0 || !workspaceId || !actorId) return;
      void emit({
        event: "notification.marked_all_read",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: {
          data: { marked_count: result.markedCount },
        },
      }).catch((e: unknown) => console.warn("[notifications] emit failed:", e));
    },
  });
}
