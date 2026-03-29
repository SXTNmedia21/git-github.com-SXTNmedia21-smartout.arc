/**
 * Mutation hook for sending chat messages with optional attachments.
 *
 * Flow:
 * 1. Optimistic update — message appears immediately with pending indicator
 * 2. Upload attachments to Supabase Storage (chat-media bucket)
 * 3. Insert channel_message row
 * 4. Insert channel_message_attachment rows for each uploaded file
 * 5. On failure — roll back optimistic message
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { supabase } from "@/lib/supabase";
import type { MessageWithSender, MessageAttachment } from "@/hooks/queries/use-messages";

type Attachment = {
  uri: string;
  type: "image" | "video";
  fileName?: string;
};

type SendMessageParams = {
  channelId: string;
  content: string;
  senderProfileId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  replyToId?: string | null;
  workspaceId: string;
  attachments?: Attachment[];
};

/** Upload a single file to Supabase Storage and return the public URL */
async function uploadAttachment(
  workspaceId: string,
  channelId: string,
  messageId: string,
  attachment: Attachment,
): Promise<{
  url: string;
  fileType: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
}> {
  const ext = attachment.uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeType =
    attachment.type === "video"
      ? ext === "mov"
        ? "video/quicktime"
        : "video/mp4"
      : ext === "png"
        ? "image/png"
        : ext === "gif"
          ? "image/gif"
          : "image/jpeg";

  const fileName = attachment.fileName ?? `${randomUUID()}.${ext}`;
  const storagePath = `${workspaceId}/${channelId}/${messageId}/${fileName}`;

  // Fetch the file as blob for upload
  const response = await fetch(attachment.uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from("chat-media")
    .upload(storagePath, blob, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Get the signed URL (1 year expiry for chat media)
  const { data: urlData } = await supabase.storage
    .from("chat-media")
    .createSignedUrl(storagePath, 365 * 24 * 60 * 60);

  const url = urlData?.signedUrl ?? "";

  return {
    url,
    fileType: attachment.type,
    mimeType,
    sizeBytes: blob.size,
    fileName,
  };
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  const sendMessage = useCallback(
    async (params: SendMessageParams) => {
      const {
        channelId,
        content,
        senderProfileId,
        senderName,
        senderAvatarUrl,
        replyToId,
        workspaceId,
        attachments = [],
      } = params;

      const clientMessageId = randomUUID();
      const now = new Date().toISOString();

      // Build optimistic attachments from local URIs
      const optimisticAttachments: MessageAttachment[] = attachments.map((att) => ({
        id: randomUUID(),
        url: att.uri,
        file_type: att.type,
        mime_type: att.type === "video" ? "video/mp4" : "image/jpeg",
        filename: att.fileName ?? "file",
        size_bytes: 0,
        duration_seconds: null,
      }));

      const optimisticMessage: MessageWithSender & { _isPending: boolean } = {
        id: clientMessageId,
        channel_id: channelId,
        content,
        sender_id: senderProfileId,
        senderName,
        senderAvatarUrl: senderAvatarUrl ?? null,
        created_at: now,
        reply_to_id: replyToId ?? null,
        reply_to_content: null,
        reply_to_sender_name: null,
        reactions: [],
        attachments: optimisticAttachments,
        is_pinned: false,
        message_type: attachments.length > 0 ? "media" : "text",
        origin_type: "user",
        visibility_scope: "everyone",
        sender_role: null,
        system_data: null,
        edited_at: null,
        deleted_at: null,
        client_message_id: clientMessageId,
        conversation_id: channelId,
        is_system: false,
        updated_at: now,
        _isPending: true,
      };

      // Optimistic update — prepend to first page
      queryClient.setQueryData(
        ["channel-messages", channelId],
        (old: { pages: MessageWithSender[][]; pageParams: (string | undefined)[] } | undefined) => {
          if (!old) {
            return { pages: [[optimisticMessage]], pageParams: [undefined] };
          }
          const newPages = [...old.pages];
          newPages[0] = [optimisticMessage, ...(newPages[0] ?? [])];
          return { ...old, pages: newPages };
        },
      );

      void queryClient.invalidateQueries({ queryKey: ["channels"] });

      try {
        // Upload attachments to Storage
        const uploadedFiles = await Promise.all(
          attachments.map((att) => uploadAttachment(workspaceId, channelId, clientMessageId, att)),
        );

        // Insert message
        const { data: messageRow, error: msgError } = await supabase
          .from("channel_message")
          .insert({
            channel_id: channelId,
            workspace_id: workspaceId,
            content: content || (attachments.length > 0 ? "" : content),
            sender_id: senderProfileId,
            client_message_id: clientMessageId,
            reply_to_id: replyToId ?? null,
            message_type: attachments.length > 0 ? "image" : "text",
          })
          .select("id")
          .single();

        if (msgError) throw msgError;

        // Insert attachment rows
        if (uploadedFiles.length > 0 && messageRow) {
          const attachmentRows = uploadedFiles.map((file) => ({
            message_id: messageRow.id,
            channel_id: channelId,
            workspace_id: workspaceId,
            url: file.url,
            file_type: file.fileType,
            mime_type: file.mimeType,
            filename: file.fileName,
            size_bytes: file.sizeBytes,
          }));

          const { error: attError } = await supabase
            .from("channel_message_attachment")
            .insert(attachmentRows);

          if (attError) {
            // Attachment insert failed but message was sent — log but don't throw
            console.warn("Failed to insert attachment rows:", attError);
          }
        }

        return clientMessageId;
      } catch (error) {
        // Roll back optimistic message on failure
        queryClient.setQueryData(
          ["channel-messages", channelId],
          (
            old: { pages: MessageWithSender[][]; pageParams: (string | undefined)[] } | undefined,
          ) => {
            if (!old) return old;
            const newPages = old.pages.map((page) =>
              page.filter((msg) => msg.client_message_id !== clientMessageId),
            );
            return { ...old, pages: newPages };
          },
        );
        throw error;
      }
    },
    [queryClient],
  );

  return { sendMessage };
}
