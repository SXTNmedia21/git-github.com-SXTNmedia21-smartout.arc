"use client";

/**
 * use-notification-realtime.ts — Subscribes to Postgres realtime changes
 * on the notification table for a given profile. When a new notification
 * arrives, it invalidates the relevant React Query caches, optionally
 * fires a browser notification if the tab is hidden, and sets a transient
 * "glow" flag that components can use for visual feedback.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

/** Short notification chime via Web Audio API */
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Gentle two-note chime (C5 → E5)
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);

    // Cleanup after sound finishes
    setTimeout(() => void ctx.close(), 500);
  } catch {
    // Audio not available
  }
}

type NotificationRealtimeResult = {
  /** True for a short pulse after a new notification arrives */
  isGlowing: boolean;
};

export function useNotificationRealtime(profileId: string | undefined): NotificationRealtimeResult {
  const queryClient = useQueryClient();
  const [isGlowing, setIsGlowing] = useState(false);
  const glowTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const triggerGlow = useCallback(() => {
    setIsGlowing(true);
    if (glowTimeout.current) clearTimeout(glowTimeout.current);
    glowTimeout.current = setTimeout(() => setIsGlowing(false), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (glowTimeout.current) clearTimeout(glowTimeout.current);
    };
  }, []);

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

          triggerGlow();
          playNotificationSound();

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
  }, [profileId, queryClient, triggerGlow]);

  return { isGlowing };
}
