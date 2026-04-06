"use client";

import { useState } from "react";
import type { MessageWithSender } from "../_hooks/channel-types";
import { useToggleReaction } from "../_hooks/use-reactions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Reply, SmilePlus, Pin } from "lucide-react";
import { KnowledgeCard } from "./KnowledgeCard";
import { useTranslation } from "@smartout/i18n";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🙏"];

type Props = {
  message: MessageWithSender;
  channelId: string;
  profileId: string;
  isOwn: boolean;
  onReply: (messageId: string) => void;
};

export function MessageBubble({ message, channelId, profileId, isOwn, onReply }: Props) {
  const { t } = useTranslation("komm");
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const toggleReaction = useToggleReaction(channelId, profileId);

  // Group reactions by emoji
  const reactionGroups = message.reactions.reduce(
    (acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = [];
      acc[r.emoji]!.push(r.profile_id);
      return acc;
    },
    {} as Record<string, string[]>,
  );

  const time = new Date(message.created_at).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (message.deleted_at) {
    return (
      <div className="px-4 py-1">
        <p className="text-muted-foreground text-xs italic">{t("message.deleted")}</p>
      </div>
    );
  }

  return (
    <div
      className="group hover:bg-accent/30 relative px-4 py-1.5"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowEmojiPicker(false);
      }}
    >
      {/* Reply preview */}
      {message.reply_to_id && message.reply_to_content && (
        <div className="text-muted-foreground border-primary/30 mb-1 ml-11 border-l-2 pl-2 text-xs">
          <span className="font-medium">{message.reply_to_sender_name}</span>{" "}
          {message.reply_to_content.slice(0, 80)}
        </div>
      )}

      <div className="flex gap-3">
        {/* Avatar */}
        <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
          {message.sender_avatar ? (
            <img src={message.sender_avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            (message.sender_name ?? "?").charAt(0).toUpperCase()
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-sm font-medium",
                isOwn && "text-primary",
                message.sender_role === "system" && "text-amber-500",
              )}
            >
              {message.sender_name ?? t("message.unknown_sender")}
            </span>
            <span className="text-muted-foreground text-[10px]">{time}</span>
            {message.edited_at && (
              <span className="text-muted-foreground text-[10px]">{t("message.edited")}</span>
            )}
            {message.is_pinned && <Pin className="h-3 w-3 text-amber-500" />}
          </div>
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {message.content}
          </p>

          {/* Knowledge cards for shared content */}
          {message.system_data &&
            (message.system_data as Record<string, unknown>).shared_type != null && (
              <KnowledgeCard
                data={
                  message.system_data as unknown as {
                    // SAFETY: Supabase join returns union type; runtime shape matches the cast
                    shared_type: string;
                    shared_id: string;
                    title: string;
                    description?: string;
                  }
                }
              />
            )}

          {/* Attachments */}
          {message.attachments.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {message.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground bg-muted rounded px-2 py-1 text-xs transition-colors"
                >
                  📎 {att.filename}
                </a>
              ))}
            </div>
          )}

          {/* Reactions */}
          {Object.keys(reactionGroups).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(reactionGroups).map(([emoji, profileIds]) => (
                <button
                  key={emoji}
                  onClick={() =>
                    toggleReaction.mutate({
                      messageId: message.message_id,
                      emoji,
                    })
                  }
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                    profileIds.includes(profileId)
                      ? "border-primary/50 bg-primary/10"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <span>{emoji}</span>
                  <span className="text-muted-foreground">{profileIds.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hover actions */}
      {showActions && (
        <div className="bg-card absolute -top-3 right-4 flex items-center gap-0.5 rounded-md border p-0.5 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onReply(message.message_id)}
          >
            <Reply className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Quick emoji picker */}
      {showEmojiPicker && (
        <div className="bg-card absolute -top-10 right-4 flex gap-0.5 rounded-md border p-1 shadow-sm">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                toggleReaction.mutate({
                  messageId: message.message_id,
                  emoji,
                });
                setShowEmojiPicker(false);
              }}
              className="hover:bg-accent rounded p-1 text-sm"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
