/**
 * use-typing-indicator — Subscribe to ephemeral typing presence for a channel.
 *
 * Listens on the Supabase Realtime broadcast channel `chat-typing:${channelId}`.
 * Each incoming `typing` event carries `{ profile_id, expires_at }`. The hook:
 *   - Ignores events from the current user (selfProfileId filter).
 *   - Adds the sender to an in-memory Set.
 *   - Schedules an auto-removal timer to fire at `expires_at` (typically 4s).
 *   - Unsubscribes and clears all timers on unmount.
 *
 * No database writes — entirely ephemeral broadcast (G1 decision, PLAN §T4).
 * No channel_presence table touched — that column exists for future durable use.
 *
 * Returns a stable `Set<string>` of profile_ids currently typing
 * (re-created on each state change so React detects the diff).
 */

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Payload shape broadcast by use-emit-typing. */
type TypingPayload = {
  profile_id: string;
  expires_at: number; // Unix ms
};

/**
 * Subscribe to typing presence for `channelId`.
 *
 * @param channelId - The channel to monitor.
 * @param selfProfileId - Current user's profile_id — their events are filtered out.
 * @returns Stable Set of profile_ids currently typing (excluding self).
 */
export function useTypingIndicator(channelId: string, selfProfileId: string | null): Set<string> {
  const [typingSet, setTypingSet] = useState<Set<string>>(new Set());
  // Per-profile auto-removal timers. Cleared on new event for same profile.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!channelId) return;

    const channel = supabase.channel(`chat-typing:${channelId}`);

    channel.on("broadcast", { event: "typing" }, ({ payload }: { payload: TypingPayload }) => {
      const { profile_id, expires_at } = payload;
      // Filter own events — we don't show "you are typing" to yourself.
      if (!profile_id || profile_id === selfProfileId) return;

      // Add to typing set.
      setTypingSet((prev) => {
        const next = new Set(prev);
        next.add(profile_id);
        return next;
      });

      // Clear any existing timer for this profile.
      const existing = timersRef.current.get(profile_id);
      if (existing !== undefined) clearTimeout(existing);

      // Schedule removal when expires_at arrives.
      const delay = Math.max(0, expires_at - Date.now());
      const timer = setTimeout(() => {
        setTypingSet((prev) => {
          const next = new Set(prev);
          next.delete(profile_id);
          return next;
        });
        timersRef.current.delete(profile_id);
      }, delay);

      timersRef.current.set(profile_id, timer);
    });

    channel.subscribe();

    return () => {
      // Clear all timers to avoid stale state updates after unmount.
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
      supabase.removeChannel(channel);
    };
  }, [channelId, selfProfileId]);

  return typingSet;
}
