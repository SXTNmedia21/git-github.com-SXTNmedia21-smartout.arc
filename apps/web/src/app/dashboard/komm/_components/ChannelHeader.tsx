"use client";

import type { ChannelWithPreview } from "../_hooks/channel-types";
import { useCallState } from "../_hooks/use-call-state";
import { useStartCall } from "../_hooks/use-start-call";
import { GroupCallBanner } from "./GroupCallBanner";
import { Button } from "@/components/ui/button";
import {
  Users,
  Phone,
  MoreHorizontal,
  Hash,
  Building2,
  MessageCircle,
  Megaphone,
  Lightbulb,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, typeof Hash> = {
  department: Building2,
  team: Users,
  session: CalendarDays,
  custom: Hash,
  direct: MessageCircle,
  news: Megaphone,
  skill: Lightbulb,
};

const TYPE_COLORS: Record<string, string> = {
  department: "bg-blue-500/15 text-blue-500",
  team: "bg-purple-500/15 text-purple-500",
  session: "bg-amber-500/15 text-amber-500",
  custom: "bg-primary/10 text-primary",
  direct: "bg-green-500/15 text-green-500",
  news: "bg-orange-500/15 text-orange-500",
  skill: "bg-cyan-500/15 text-cyan-500",
};

type Props = {
  channel: ChannelWithPreview;
  profileId: string;
  showMembers: boolean;
  onToggleMembers: () => void;
  onJoinCall: () => void;
  liveParticipantCount?: number;
};

export function ChannelHeader({
  channel,
  profileId,
  showMembers,
  onToggleMembers,
  onJoinCall,
  liveParticipantCount = 0,
}: Props) {
  const Icon = TYPE_ICONS[channel.channel_type] ?? Hash;
  const colorClass = TYPE_COLORS[channel.channel_type] ?? "bg-muted text-muted-foreground";
  const displayName =
    channel.channel_type === "direct"
      ? (channel.other_member_name ?? "Direktemelding")
      : (channel.name ?? "Kanal");

  const voiceEnabled = channel.audio_policy !== "disabled";
  const { data: callSession } = useCallState(voiceEnabled ? channel.channel_id : null);
  const startCall = useStartCall();
  const hasActiveCall = !!callSession;

  const handleStartCall = () => {
    const callType = channel.channel_type === "direct" ? "direct" : "group";
    startCall.mutate(
      {
        channelId: channel.channel_id,
        callType,
        profileId,
        calleeProfileId:
          callType === "direct" ? (channel.other_member_profile_id ?? undefined) : undefined,
      },
      {
        // Auto-join after creating the call session
        onSuccess: () => onJoinCall(),
      },
    );
  };

  return (
    <div>
      <div className="flex items-center gap-3 border-b px-4 py-2.5">
        <div
          className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", colorClass)}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{displayName}</h3>
          <p className="text-muted-foreground text-xs">
            {channel.member_count} {channel.member_count === 1 ? "medlem" : "medlemmer"}
            {channel.description && ` · ${channel.description}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {voiceEnabled && (
            <Button
              size="icon"
              className="h-8 w-8 rounded-full bg-green-500 text-white hover:bg-green-600"
              onClick={hasActiveCall ? onJoinCall : handleStartCall}
              disabled={startCall.isPending}
              title={hasActiveCall ? "Bli med i samtale" : "Start samtale"}
            >
              <Phone className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant={showMembers ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={onToggleMembers}
          >
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {hasActiveCall && callSession && (
        <div className="bg-primary/10 text-primary flex items-center px-4 py-2 text-sm">
          <Users className="mr-1.5 h-3.5 w-3.5" />
          Pågående samtale ({liveParticipantCount || callSession.maxParticipants} deltakere)
          {liveParticipantCount === 0 && (
            <Button size="sm" onClick={onJoinCall} className="ml-4">
              Bli med
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
