"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import { Paperclip, Smile, Send, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReplyPreview } from "./ReplyPreview";

type Props = {
  conversationName: string;
  replyTo: { id: string; senderName: string } | null;
  onCancelReply: () => void;
  onSend: (content: string, replyToId?: string) => void;
  isSending: boolean;
};

export function MessageInput({
  conversationName,
  replyTo,
  onCancelReply,
  onSend,
  isSending,
}: Props) {
  const [text, setText] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, replyTo?.id);
    setText("");
    onCancelReply();
  }, [text, replyTo, onSend, onCancelReply]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const hasText = text.trim().length > 0;

  return (
    <div className="border-border bg-background border-t">
      {replyTo && <ReplyPreview senderName={replyTo.senderName} onCancel={onCancelReply} />}

      <div className="flex items-center gap-2 px-4 py-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Paperclip className="text-muted-foreground h-4 w-4" />
        </Button>

        <Input
          placeholder={replyTo ? "Ditt svar..." : `Skriv til ${conversationName}...`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          className="flex-1"
        />

        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Smile className="text-muted-foreground h-4 w-4" />
        </Button>

        <Button
          variant={hasText ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleSend}
          disabled={isSending || !hasText}
        >
          {hasText ? (
            <Send className="h-4 w-4" />
          ) : (
            <Mic className="text-muted-foreground h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
