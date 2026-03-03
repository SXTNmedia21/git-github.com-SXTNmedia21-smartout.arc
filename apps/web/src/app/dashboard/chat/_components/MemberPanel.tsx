"use client";

import { X } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ConversationWithPreview } from "../_hooks/chat-types";

type Props = {
  conversation: ConversationWithPreview;
  onClose: () => void;
};

export function MemberPanel({ conversation, onClose }: Props) {
  const participants = conversation.participants;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 280, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="border-border bg-background flex h-full flex-col overflow-hidden border-l"
    >
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-foreground text-sm font-semibold">Medlemmer ({participants.length})</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-1">
          {participants.map((p) => (
            <div
              key={p.profile.profile_id}
              className="hover:bg-accent flex items-center gap-3 rounded-lg px-3 py-2"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {(p.profile.display_name ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="text-foreground truncate text-sm">
                  {p.profile.display_name ?? "Ukjent"}
                </p>
                <p className="text-muted-foreground truncate text-xs capitalize">{p.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
