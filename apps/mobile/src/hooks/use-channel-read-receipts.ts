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
 * Phase 2 T5 — delivered-state ack via presence-join:
 *   Added `deliveredSet` (Set<message_id>) populated by receiver broadcast.
 *   When the receiver opens the channel, ConversationBody broadcasts a
 *   `presence-join` event carrying the message_ids the receiver has not yet
 *   marked read. The sender picks this up and transitions those messages
 *   from `sent` → `delivered`. Full 4-state progression:
 *     pending → sent → delivered → read
 *
 *   Broadcast channel: `chat-presence:${channelId}` (separate from the
 *   `receipts:${channelId}` postgres_changes channel to keep concerns clean).
 *   The broadcast handler is wired in the same useEffect to share lifecycle.
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
 *   4. Subscribe to broadcast `presence-join` on `chat-presence:${channelId}`.
 *      Payload: { profile_id: string; unread_message_ids: string[] }.
 *      For each message_id in payload.unread_message_ids that is in this
 *      channel and not already `read`, mark as `delivered`.
 *   5. Return { receipts, deliveredSet } — both needed by ConversationBody.
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

/**
 * Shape of the presence-join broadcast payload sent by the receiver
 * when they open the channel (ConversationBody mount).
 */
type PresenceJoinPayload = {
  profile_id: string;
  /** message_ids the receiver has not yet marked read (unread from their POV). */
  unread_message_ids: string[];
};

export type UseChannelReadReceiptsResult = {
  /** Map from message_id → ReadReceiptState (for own outbound messages). */
  receipts: ReadReceiptMap;
  /**
   * Set of message_ids that are confirmed delivered (presence-join ack) but
   * not yet read. Used by getReceiptState to produce the `delivered` state.
   */
  deliveredSet: Set<string>;
};

export function useChannelReadReceipts(channelId: string): UseChannelReadReceiptsResult {
  const { data: myProfile } = useMyProfile();
  const [receipts, setReceipts] = useState<ReadReceiptMap>(new Map());
  const [deliveredSet, setDeliveredSet] = useState<Set<string>>(new Set());

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

    // ── Step 2: Realtime subscriptions ───────────────────────────────────
    //
    // Channel A — `receipts:${channelId}`: postgres_changes for INSERT/DELETE
    //   on channel_message_read. Handles read-state transitions.
    //
    // Channel B — `chat-presence:${channelId}`: broadcast for `presence-join`.
    //   Handles delivered-state transitions. Separate channel so that
    //   broadcast and postgres_changes concerns are kept clean (Supabase
    //   requires broadcast and postgres_changes on the same channel object but
    //   the two logical concerns map to different lifecycles and filters).
    //
    // Both are created and torn down together with this effect.

    // ── Channel A: postgres_changes (read receipts) ───────────────────────
    const receiptsChannel = supabase
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

          // A message that is now `read` no longer needs to sit in deliveredSet.
          // Remove it to keep the two sets consistent (read > delivered priority
          // is enforced in getReceiptState, but cleaning up is hygenic).
          setDeliveredSet((prev) => {
            if (!prev.has(row.message_id)) return prev;
            const next = new Set(prev);
            next.delete(row.message_id);
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

    // ── Channel B: broadcast (presence-join → delivered ack) ─────────────
    //
    // The receiver calls ConversationBody.broadcastPresenceJoin() on mount,
    // which publishes: { profile_id, unread_message_ids: string[] }.
    // The sender (this hook) picks it up and marks those messages as
    // `delivered` — completing the sent → delivered transition.
    //
    // Filter: only process message_ids that (a) belong to this channel and
    // (b) are not already `read` (read always wins over delivered).
    //
    // Separate broadcast channel: `chat-presence:${channelId}`. This avoids
    // mixing concerns with the postgres_changes channel above and matches the
    // naming used in ConversationBody's broadcast emit.
    const presenceChannel = supabase
      .channel(`chat-presence:${channelId}`)
      .on("broadcast", { event: "presence-join" }, (payload) => {
        // Narrow the broadcast payload to our expected shape.
        const data = payload.payload as PresenceJoinPayload | undefined;
        if (!data) return;
        if (!Array.isArray(data.unread_message_ids)) return;
        // Ignore our own presence broadcasts (should not happen, but guard anyway).
        if (data.profile_id === selfProfileId) return;

        const candidateIds = data.unread_message_ids.filter((id) =>
          channelMessageIds.current.has(id),
        );
        if (candidateIds.length === 0) return;

        setDeliveredSet((prev) => {
          // Check if any new ids actually need adding before creating a new Set.
          const needsUpdate = candidateIds.some((id) => !prev.has(id));
          if (!needsUpdate) return prev;
          const next = new Set(prev);
          for (const id of candidateIds) {
            next.add(id);
          }
          return next;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(receiptsChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [channelId, myProfile?.workspace_id, myProfile?.profile_id]);

  return { receipts, deliveredSet };
}

/**
 * Derive ReadReceiptState for a single message.
 *
 * Priority order (highest → lowest):
 *   1. pending   — optimistic message not yet confirmed by server
 *   2. read      — receipts map has an entry (another profile read it)
 *   3. delivered — deliveredSet has the message_id (receiver opened channel)
 *   4. sent      — message confirmed by server (no delivery/read ack yet)
 *
 * The `pending` state is reserved for optimistic messages (_isPending) and
 * must be set by the caller based on the message's optimistic flag.
 */
export function getReceiptState(
  messageId: string,
  isPending: boolean,
  receipts: ReadReceiptMap,
  deliveredSet?: Set<string>,
): ReadReceiptState {
  if (isPending) return "pending";
  const state = receipts.get(messageId);
  if (state === "read") return "read";
  if (deliveredSet?.has(messageId)) return "delivered";
  return state ?? "sent";
}
