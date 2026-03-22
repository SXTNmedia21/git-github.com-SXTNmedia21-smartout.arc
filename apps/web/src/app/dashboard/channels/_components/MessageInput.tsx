"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useSendMessage } from "../_hooks/use-send-message";
import { useChannelMessages } from "../_hooks/use-channel-messages";
import { ReplyPreview } from "./ReplyPreview";
import { Button } from "@/components/ui/button";
import { Send, Paperclip } from "lucide-react";

type Props = {
  channelId: string;
  profileId: string;
  replyToId: string | null;
  onCancelReply: () => void;
};

export function MessageInput({
  channelId,
  profileId,
  replyToId,
  onCancelReply,
}: Props) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useSendMessage(channelId, profileId);
  const { data } = useChannelMessages(channelId);

  // Find reply-to message for preview
  const replyToMessage = useMemo(() => {
    if (!replyToId || !data) return null;
    for (const page of data.pages) {
      const found = page.find((m) => m.message_id === replyToId);
      if (found) return found;
    }
    return null;
  }, [replyToId, data]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [content]);

  // Focus on reply
  useEffect(() => {
    if (replyToId) textareaRef.current?.focus();
  }, [replyToId]);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    sendMessage.mutate(
      { content: trimmed, replyToId: replyToId ?? undefined },
      {
        onSuccess: () => {
          setContent("");
          onCancelReply();
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t">
      {replyToMessage && (
        <ReplyPreview
          senderName={replyToMessage.sender_name ?? "Ukjent"}
          content={replyToMessage.content}
          onCancel={onCancelReply}
        />
      )}
      <div className="flex items-end gap-2 p-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled
          title="Vedlegg (kommer snart)"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Skriv en melding..."
          rows={1}
          className="bg-muted text-foreground placeholder:text-muted-foreground min-h-[36px] flex-1 resize-none rounded-md border-0 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleSend}
          disabled={!content.trim() || sendMessage.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
