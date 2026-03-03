"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConversationItem } from "./ConversationItem";
import type { ConversationWithPreview } from "../_hooks/chat-types";

type Props = {
  conversations: ConversationWithPreview[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  isLoading: boolean;
};

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreateNew,
  isLoading,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? conversations.filter((c) => (c.name ?? "").toLowerCase().includes(search.toLowerCase()))
    : conversations;

  return (
    <div className="border-border bg-background flex h-full w-72 flex-col border-r">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-foreground text-sm font-semibold">Meldinger</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCreateNew}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-3.5 w-3.5" />
          <Input
            placeholder="S\u00f8k i samtaler..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-muted-foreground text-xs">Laster...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <span className="text-muted-foreground text-xs">
              {search ? "Ingen treff" : "Ingen samtaler enn\u00e5"}
            </span>
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
              onClick={() => onSelect(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
