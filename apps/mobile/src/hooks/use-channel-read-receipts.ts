/**
 * useChannelReadReceipts — Realtime read-receipt state for a channel.
 *
 * SENDER SIDE: Used by the sender to know whether the receiver has read their
 * messages. Returns a Map<message_id, ReadReceiptState> derived from
 * `channel_message_read` rows + live Realtime inserts/deletes.
 *
 * Phase 1 state collapse:
 *   delivered-vs-sent distinction requires presence tracking which we lack.
 *   Phase 1 ships with sent/read only. T2's ReadReceipt component already
 *   supports all 4 states (`pending | sent | delivered | read`); the
 *   `delivered` state is simply not reachable until presence is wired (Phase 2).
 *
 * Strategy:
 *   1. On mount, fetch existing `channel_message_read` rows for the channel's
 *      messages by joining through `channel_message`.
 *   2. Subscribe to Realtime `postgres_changes` INSERT and DELETE on
 *      `channel_message_read` filtered by workspace_id. Filter client-side to
 *      only rows whose `message_id` belongs to this channel (tracked via a
 *      Set built from the initial query + incoming messages).
 *   3. On INSERT: mark message as `read`.
 *      On DELETE: remove the (message_id, profile_id) pair; if no other
 *      profile-reads remain for that message_id, `getReceiptState` falls back
 *      to `sent` automatically (Map entry absent → "sent").
 *   4. Return Map<message_id, ReadReceiptState>.
 *
 * Supabase Realtime v2 does not support JOIN filters, so we apply a
 * workspace-scoped filter server-side and a channel-scope filter client-side.
 * This is safe because: (a) RLS restricts to workspace members, and
 * (b) the client-side Set is the authoritative scope gate.
 *
 * Phase 2 T6: DELETE subscription added. Hard-deleted message rows now cause
 * the sender's receipt state to regress from `read` → `sent` automatically.
 */

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";

export type ReadReceiptState = "pending" | "sent" | "delivered" | "read";

/** Map from message_id → read receipt state (for own messages only). */
export type ReadReceiptMap = Map<string, ReadReceiptState>;

export function useChannelReadReceipts(channelId: string): ReadReceiptMap {
  const { data: myProfile } = useMyProfile();
  const [receipts, setReceipts] = useState<ReadReceiptMap>(new Map());

  // Track which message_ids belong to this channel so we can filter
  // incoming Realtime events client-side.
  const channelMessageIds = useRef<Set<string>>(new Set());

  // Internal per-message reader index: message_id → Set of profile_ids that
  // have a channel_message_read row. Required to correctly handle DELETE —
  // removing one reader should only regress the state to `sent` when the Set
  // becomes empty (another reader may still have a row).
  // This is a ref (not state) because it is internal bookkeeping that does not
  // drive rendering directly; rendering is driven by the `receipts` state above.
  const readerIndex = useRef<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    if (!channelId || !myProfile?.workspace_id || !myProfile.profile_id) return;

    // Capture identity values before any async gap — TypeScript loses narrowing
    // inside nested async functions otherwise (myProfile could be re-assigned).
    const workspaceId = myProfile.workspace_id;
    const selfProfileId = myProfile.profile_id;

    // ── Step 1: Initial fetch ─────────────────────────────────────────────
    // Fetch all channel_message_read rows for messages in this channel
    // that were NOT read by ourselves (we want to know if others read our msgs).
    //
    // We query channel_message_read and join via channel_message to scope to
    // this channel. Since Supabase JS doesn't support direct join on .from(),
    // we fetch message_ids for the channel first, then query reads.
    async function bootstrap() {
      // Fetch message ids for this channel (recent 200 sufficient for Phase 1).
      const { data: channelMsgs } = await supabase
        .from("channel_message")
        .select("id")
        .eq("channel_id", channelId)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!channelMsgs || channelMsgs.length === 0) return;

      const msgIds = channelMsgs.map((m) => m.id);
      // Register known message ids for client-side Realtime filtering.
      channelMessageIds.current = new Set(msgIds);

      // Fetch existing reads for these messages from other profiles.
      const { data: reads } = await supabase
        .from("channel_message_read")
        .select("message_id, profile_id, read_at")
        .in("message_id", msgIds)
        .neq("profile_id", selfProfileId);

      if (!reads || reads.length === 0) return;

      // Populate the reader index alongside the receipt state map.
      const nextIndex = new Map<string, Set<string>>();
      for (const row of reads) {
        const readers = nextIndex.get(row.message_id) ?? new Set<string>();
        readers.add(row.profile_id);
        nextIndex.set(row.message_id, readers);
      }
      readerIndex.current = nextIndex;

      setReceipts((prev) => {
        const next = new Map(prev);
        for (const row of reads) {
          // Any read by a non-self profile → mark as "read".
          next.set(row.message_id, "read");
        }
        return next;
      });
    }

    void bootstrap();

    // ── Step 2: Realtime subscription ────────────────────────────────────
    // Subscribe to INSERT and DELETE events on channel_message_read filtered
    // by workspace_id (server-side). Filter to channel scope client-side.
    //
    // Two separate .on() handlers are chained on the same channel object
    // (matches existing INSERT-handler style; avoids a unified eventType branch).
    const realtimeChannel = supabase
      .channel(`receipts:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channel_message_read",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const row = payload.new as {
            message_id: string;
            profile_id: string;
            read_at: string;
          };

          // Ignore reads by ourselves (we already know we read it).
          if (row.profile_id === selfProfileId) return;

          // Only update state if the message belongs to this channel.
          if (!channelMessageIds.current.has(row.message_id)) return;

          // Update reader index.
          const readers = readerIndex.current.get(row.message_id) ?? new Set<string>();
          readers.add(row.profile_id);
          readerIndex.current.set(row.message_id, readers);

          setReceipts((prev) => {
            const next = new Map(prev);
            next.set(row.message_id, "read");
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          // Phase 2 T6: listen for hard-deletes of channel_message_read rows.
          // When a row is deleted the sender's receipt state regresses to `sent`
          // if no other profile-reads remain for that message_id.
          event: "DELETE",
          schema: "public",
          table: "channel_message_read",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          // Supabase Realtime DELETE payloads carry the deleted row in `old`.
          // The shape matches channel_message_read Row (id, message_id,
          // profile_id, read_at, workspace_id). `old` is typed as
          // Partial<Record<string, unknown>> by the generic, so we narrow it
          // explicitly against the DB row shape.
          const old = payload.old as {
            message_id: string;
            profile_id: string;
          };

          // Skip if the deleted row is outside this channel.
          if (!channelMessageIds.current.has(old.message_id)) return;

          // Remove the deleted profile from the reader index.
          const readers = readerIndex.current.get(old.message_id);
          if (readers) {
            readers.delete(old.profile_id);
            if (readers.size === 0) {
              // No readers left — the Map entry is removed so that
              // getReceiptState falls back to `sent` (Map.get → undefined → "sent").
              readerIndex.current.delete(old.message_id);
              setReceipts((prev) => {
                const next = new Map(prev);
                next.delete(old.message_id);
                return next;
              });
            }
            // If other readers remain the receipt state stays `read` —
            // no state update needed.
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [channelId, myProfile?.workspace_id, myProfile?.profile_id]);

  return receipts;
}

/**
 * Derive ReadReceiptState for a single message from the receipts map.
 *
 * Falls back to `sent` when no read row exists (Phase 1 collapses
 * pending/delivered into sent — we have no delivery ack yet).
 * The `pending` state is reserved for optimistic messages (_isPending)
 * and must be set by the caller based on the message's optimistic flag.
 */
export function getReceiptState(
  messageId: string,
  isPending: boolean,
  receipts: ReadReceiptMap,
): ReadReceiptState {
  if (isPending) return "pending";
  const state = receipts.get(messageId);
  return state ?? "sent";
}
