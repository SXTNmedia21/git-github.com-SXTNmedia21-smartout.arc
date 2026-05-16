/**
 * use-emit-typing — Publish ephemeral typing presence to a channel.
 *
 * Returns a stable `emitTyping()` callback (via useCallback with no deps).
 * Internally debounced: at most ONE broadcast per 2-second window per channel.
 * Each broadcast carries `{ profile_id, expires_at: now + 4000 }` so
 * subscribers know to remove the typer 4s after the last broadcast.
 * The 2s debounce ≤ 4s expiry means continuous typing keeps the indicator alive.
 *
 * Identity: resolved via `getProfileContext()` — fail-fast per ADR-0134.
 * A failed `getProfileContext()` is treated as a silent no-op (typing emit
 * failing should not surface an error to the user).
 *
 * Telemetry: emits `chat typing` (logger-only — high-frequency, no audit trail).
 *
 * No TanStack Query mutation — this is a fire-and-forget broadcast side-effect,
 * not a server mutation with optimistic update semantics.
 */

import { useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { emit } from "@smartout/telemetry";
import { getProfileContext } from "@/lib/profile-context";

/** Debounce window in ms — one broadcast per window per channel. */
const DEBOUNCE_MS = 2000;
/** Typing expiry in ms — subscribers auto-remove after this delay. */
const EXPIRES_IN_MS = 4000;

/**
 * Hook: returns a stable `emitTyping()` callback for `channelId`.
 *
 * @param channelId - The channel to broadcast typing presence to.
 */
export function useEmitTyping(channelId: string): () => void {
  const lastEmitRef = useRef<number>(0);
  // Keep channelId in a ref so the stable callback always uses the latest value
  // without needing it as a dependency (channelId is stable per screen lifetime).
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;

  const emitTyping = useCallback(() => {
    const now = Date.now();
    // Debounce: skip if we already broadcast within the window.
    if (now - lastEmitRef.current < DEBOUNCE_MS) return;
    lastEmitRef.current = now;

    // Fire-and-forget — do not await in the callback so MessageInput stays snappy.
    void (async () => {
      try {
        // Fail-fast per ADR-0134 — throws on missing/empty identity.
        const { profileId, workspaceId } = await getProfileContext();

        const channel = supabase.channel(`chat-typing:${channelIdRef.current}`);
        await channel.send({
          type: "broadcast",
          event: "typing",
          payload: {
            profile_id: profileId as string,
            expires_at: Date.now() + EXPIRES_IN_MS,
          },
        });

        // logger-only — high-frequency event, no audit trail per registry.
        await emit({
          event: "chat typing",
          workspace_id: workspaceId,
          actor_id: profileId,
          properties: {
            data: {
              channel_id: channelIdRef.current,
              profile_id: profileId as string,
            },
          },
        });
      } catch {
        // Typing emit failure is non-fatal — do not surface to user.
        // getProfileContext() throws on missing auth; swallowed here intentionally.
      }
    })();
  }, []); // stable — all state via refs

  return emitTyping;
}
