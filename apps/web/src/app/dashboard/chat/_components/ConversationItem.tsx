"use client";

import { cn } from "@/lib/utils";
import { MessageSquare, Sparkles, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ConversationWithPreview } from "../_hooks/chat-types";

type Props = {
  conversation: ConversationWithPreview;
  isActive: boolean;
  onClick: () => void;
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return date.toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) return "I g\u00e5r";
  if (diffDays < 7) {
    return date.toLocaleDateString("nb-NO", { weekday: "long" });
  }
  return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

const typeIcons: Record<string, typeof MessageSquare> = {
  group: Users,
  dm: MessageSquare,
  ai: Sparkles,
};

export function ConversationItem({ conversation, isActive, onClick }: Props) {
  const Icon = typeIcons[conversation.type] ?? MessageSquare;
  const displayName =
    conversation.name ??
    conversation.participants
      .map((p) => p.profile.full_name)
      .filter(Boolean)
      .join(", ") ??
    "Uten navn";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
        "hover:bg-accent",
        isActive && "bg-accent border-primary border-l-2",
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback
          className={cn("text-xs", conversation.type === "ai" && "bg-primary/20 text-primary")}
        >
          {conversation.type === "ai" ? <Sparkles className="h-4 w-4" /> : getInitials(displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-foreground truncate text-sm font-medium">{displayName}</span>
          {conversation.last_message && (
            <span className="text-muted-foreground ml-2 shrink-0 text-xs">
              {formatTime(conversation.last_message.created_at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground truncate text-xs">
            {conversation.last_message
              ? `${conversation.last_message.sender.full_name}: ${conversation.last_message.content}`
              : "Ingen meldinger enn\u00e5"}
          </p>
          {conversation.unread_count > 0 && (
            <span className="bg-primary text-primary-foreground ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold">
              {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
