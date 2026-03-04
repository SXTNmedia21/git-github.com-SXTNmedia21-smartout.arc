"use client";

import { MoreHorizontal, Phone, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ConversationWithPreview } from "../_hooks/chat-types";

type Props = {
  conversation: ConversationWithPreview;
  onToggleMembers: () => void;
};

export function ChatHeader({ conversation, onToggleMembers }: Props) {
  const displayName =
    conversation.name ??
    conversation.participants
      .map((p) => p.profile.display_name)
      .filter(Boolean)
      .join(", ") ??
    "Uten navn";

  const participantCount = conversation.participants.length;

  return (
    <div className="border-border flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-foreground text-sm font-medium">{displayName}</h3>
          <p className="text-muted-foreground text-xs">
            {participantCount} deltaker{participantCount !== 1 && "e"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
              <Phone className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Kommer snart</TooltipContent>
        </Tooltip>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleMembers}>
          <Users className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
