"use client";

import type { ChannelWithPreview } from "../_hooks/channel-types";
import { Button } from "@/components/ui/button";
import { Users, Phone, Video, Settings } from "lucide-react";

type Props = {
  channel: ChannelWithPreview;
  showMembers: boolean;
  onToggleMembers: () => void;
};

export function ChannelHeader({ channel, showMembers, onToggleMembers }: Props) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold">{channel.name ?? "Direktemelding"}</h3>
        <p className="text-muted-foreground text-xs">
          {channel.member_count} {channel.member_count === 1 ? "medlem" : "medlemmer"}
          {channel.description && ` · ${channel.description}`}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {/* Phase 2 placeholders */}
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled title="Kommer i Phase 2">
          <Phone className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled title="Kommer i Phase 2">
          <Video className="h-4 w-4" />
        </Button>
        <Button
          variant={showMembers ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={onToggleMembers}
        >
          <Users className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
