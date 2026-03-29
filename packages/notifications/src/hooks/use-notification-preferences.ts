/**
 * use-notification-preferences.ts — React Query hooks for per-user
 * notification preferences stored in notification_preference.
 *
 * Preferences are keyed by user_id (auth user, not profile) so they
 * apply across all workspaces a user belongs to.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

/**
 * Fetches the notification preferences row for a user.
 * Returns null if no preferences have been saved yet (PGRST116 = no row found).
 */
export function useNotificationPreferences(userId: string | undefined) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["notification-preferences", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("notification_preference")
        .select("*")
        .eq("user_id", userId)
        .single();

      // PGRST116 = no row found — treat as null (user has not saved prefs yet)
      if (error && error.code !== "PGRST116") throw error;
      return data ?? null;
    },
    enabled: !!userId,
  });
}

/**
 * Upserts notification preferences for a user.
 * Creates the row on first save, updates it on subsequent saves.
 * The onConflict target is user_id (unique constraint on the table).
 */
export function useUpdateNotificationPreferences(userId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!userId) return;
      const { error } = await supabase
        .from("notification_preference")
        .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });
}
