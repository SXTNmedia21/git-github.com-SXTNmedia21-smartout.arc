"use client";

/**
 * use-notification-realtime.ts — Subscribes to Postgres realtime changes
 * on the notification table for a given profile. When a new notification
 * arrives, it invalidates the relevant React Query caches and optionally
 * fires a browser notification if the tab is hidden.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export function useNotificationRealtime(profileId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profileId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification",
          filter: `recipient_id=eq.${profileId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["unread-count"] });

          // Browser notification if tab is hidden and permission granted
          if (document.hidden && Notification.permission === "granted") {
            const row = payload.new as { title: string; body?: string };
            new Notification(row.title, {
              body: row.body ?? undefined,
              icon: "/icon-192.png",
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, queryClient]);
}
