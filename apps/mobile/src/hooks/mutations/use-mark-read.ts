/**
 * use-mark-read — Batch-mark channel messages as read.
 *
 * Receiver side: called from ConversationBody.onViewableItemsChanged when
 * messages scroll into view. Upserts rows to `channel_message_read` using
 * UNIQUE(message_id, profile_id) conflict resolution — idempotent, safe to
 * call repeatedly as the viewport changes.
 *
 * Telemetry: emits `chat.message_read` per message on success (ADR-0134).
 * getProfileContext() throws fail-fast on missing/empty identity — no
 * empty-string fallbacks here or on the caller side.
 *
 * Phase 1 note: optimistic update intentionally omitted. This mutation
 * affects the SENDER's ReadReceipt state (via Realtime), not the receiver's
 * view. No local cache to update on the receiver side.
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { emit } from "@smartout/telemetry";
import { getProfileContext } from "@/lib/profile-context";

type MarkReadInput = {
  messageIds: string[];
};

async function markMessagesRead({ messageIds }: MarkReadInput): Promise<void> {
  if (messageIds.length === 0) return;

  // Fail-fast per ADR-0134 — throws on missing/empty identity.
  const { profileId, workspaceId } = await getProfileContext();

  const now = new Date().toISOString();

  const rows = messageIds.map((messageId) => ({
    message_id: messageId,
    profile_id: profileId as string,
    workspace_id: workspaceId as string,
    read_at: now,
  }));

  const { error } = await supabase
    .from("channel_message_read")
    .upsert(rows, { onConflict: "message_id,profile_id", ignoreDuplicates: true });

  if (error) throw error;

  // Emit telemetry per message — profile_id and workspace_id guaranteed
  // non-empty by getProfileContext() above.
  for (const messageId of messageIds) {
    await emit({
      event: "chat message_read",
      workspace_id: workspaceId,
      actor_id: profileId,
      properties: {
        data: {
          channel_message_id: messageId,
          profile_id: profileId as string,
          read_at: now,
        },
      },
    });
  }
}

/**
 * Batch mark-read mutation for ConversationBody.
 *
 * Returns { markRead, isPending }.
 * Call markRead(ids) from onViewableItemsChanged — it debounces at the
 * call site (ConversationBody uses a 500ms debounce ref).
 */
export function useMarkRead() {
  const mutation = useMutation({
    mutationFn: markMessagesRead,
  });

  return {
    markRead: (ids: string[]) => mutation.mutate({ messageIds: ids }),
    isPending: mutation.isPending,
  };
}
