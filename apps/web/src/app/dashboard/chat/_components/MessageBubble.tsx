"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Reply, ThumbsUp, Heart, Laugh } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MessageWithSender, ReactionMap } from "../_hooks/chat-types";

type Props = {
  message: MessageWithSender;
  isMe: boolean;
  profileId: string;
  onReply: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
};

const QUICK_REACTIONS = [
  { emoji: "\ud83d\udc4d", icon: ThumbsUp },
  { emoji: "\u2764\ufe0f", icon: Heart },
  { emoji: "\ud83d\ude02", icon: Laugh },
];

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({ message, isMe, profileId, onReply, onReaction }: Props) {
  const [showActions, setShowActions] = useState(false);
  const reactions = (message.reactions ?? {}) as ReactionMap;
  const hasReactions = Object.keys(reactions).length > 0;

  if (message.is_system) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-muted-foreground text-xs italic">{message.content}</span>
      </div>
    );
  }

  return (
    <div
      className={cn("group flex flex-col gap-1", isMe ? "items-end" : "items-start")}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Reply reference */}
      {message.reply_to && (
        <div
          className={cn(
            "border-border/50 bg-muted/50 rounded-md border px-3 py-1.5 text-xs",
            isMe ? "mr-2" : "ml-2",
          )}
        >
          <span className="text-primary font-medium">{message.reply_to.sender.full_name}</span>
          <p className="text-muted-foreground truncate">{message.reply_to.content}</p>
        </div>
      )}

      {/* Sender name (not for own messages) */}
      {!isMe && (
        <span className="text-muted-foreground ml-2 text-xs">{message.sender.full_name}</span>
      )}

      {/* Message bubble */}
      <div className="relative">
        <div
          className={cn(
            "max-w-md rounded-2xl px-4 py-2 text-sm",
            isMe ? "bg-primary/10 text-foreground" : "bg-muted text-foreground",
          )}
        >
          <p className="break-words whitespace-pre-wrap">{message.content}</p>
          <span
            className={cn(
              "mt-1 block text-[10px]",
              isMe ? "text-muted-foreground text-right" : "text-muted-foreground",
            )}
          >
            {formatTime(message.created_at)}
          </span>
        </div>

        {/* Hover actions */}
        {showActions && (
          <div
            className={cn(
              "border-border bg-popover absolute -top-8 flex items-center gap-0.5 rounded-lg border p-0.5 shadow-sm",
              isMe ? "right-0" : "left-0",
            )}
          >
            {QUICK_REACTIONS.map(({ emoji, icon: Icon }) => (
              <Button
                key={emoji}
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onReaction(message.id, emoji)}
              >
                <Icon className="h-3 w-3" />
              </Button>
            ))}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onReply(message.id)}
            >
              <Reply className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Reactions */}
      {hasReactions && (
        <div className={cn("flex gap-1", isMe ? "mr-2" : "ml-2")}>
          {Object.entries(reactions).map(([emoji, ids]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReaction(message.id, emoji)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                ids.includes(profileId)
                  ? "border-primary/50 bg-primary/10"
                  : "border-border bg-muted hover:bg-accent",
              )}
            >
              <span>{emoji}</span>
              <span className="text-muted-foreground">{ids.length}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
