"use client";

import * as React from "react";
import type { ChannelWithPreview } from "../_hooks/channel-types";
import { useCallState } from "../_hooks/use-call-state";
import { useStartCall } from "../_hooks/use-start-call";
import { GroupCallBanner } from "./GroupCallBanner";
import { ChannelSettingsModal } from "./ChannelSettingsModal";
import { Button } from "@/components/ui/button";
import {
  Users,
  Phone,
  Video,
  Settings,
  Hash,
  Building2,
  MessageCircle,
  Megaphone,
  Lightbulb,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@smartout/i18n";

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
  department: "bg-komm-department/15 text-komm-department",
  team: "bg-komm-team/15 text-komm-team",
  session: "bg-komm-session/15 text-komm-session",
  custom: "bg-primary/10 text-primary",
  direct: "bg-komm-direct/15 text-komm-direct",
  news: "bg-komm-news/15 text-komm-news",
  skill: "bg-komm-skill/15 text-komm-skill",
};

type Props = {
  channel: ChannelWithPreview;
  profileId: string;
  showMembers: boolean;
  onToggleMembers: () => void;
  onJoinCall: (opts?: { withVideo?: boolean }) => void;
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
  const { t } = useTranslation("komm");
  const Icon = TYPE_ICONS[channel.channel_type] ?? Hash;
  const colorClass = TYPE_COLORS[channel.channel_type] ?? "bg-muted text-muted-foreground";
  const displayName =
    channel.channel_type === "direct"
      ? (channel.other_member_name ?? t("channel.direct_message"))
      : (channel.name ?? t("channel.default_name"));

  const voiceEnabled = channel.audio_policy !== "disabled";
  const { data: callSession } = useCallState(voiceEnabled ? channel.channel_id : null);
  const startCall = useStartCall();
  const hasActiveCall = !!callSession;
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // Settings are only available on group channels — DMs have no admin
  // surface. Keep the button visible only where it has something to do.
  const supportsSettings = channel.channel_type !== "direct";

  const handleStartCall = (withVideo: boolean) => {
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
        onSuccess: () => onJoinCall({ withVideo }),
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
            {channel.member_count === 1
              ? t("channel.member_one", { count: channel.member_count })
              : t("channel.member_other", { count: channel.member_count })}
            {channel.description && ` · ${channel.description}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {voiceEnabled && (
            <>
              <Button
                size="icon"
                className="bg-komm-call-active hover:bg-komm-call-active/90 h-8 w-8 rounded-full text-white"
                onClick={() => (hasActiveCall ? onJoinCall() : handleStartCall(false))}
                disabled={startCall.isPending}
                title={hasActiveCall ? t("call.join_call") : t("call.start_call")}
              >
                <Phone className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full"
                onClick={() =>
                  hasActiveCall ? onJoinCall({ withVideo: true }) : handleStartCall(true)
                }
                disabled={startCall.isPending}
                title={hasActiveCall ? t("call.join_video_call") : t("call.start_video_call")}
              >
                <Video className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            variant={showMembers ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={onToggleMembers}
          >
            <Users className="h-4 w-4" />
          </Button>
          {supportsSettings && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSettingsOpen(true)}
              aria-label={displayName}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {hasActiveCall && callSession && (
        <div className="bg-primary/10 text-primary flex items-center px-4 py-2 text-sm">
          <Users className="mr-1.5 h-3.5 w-3.5" />
          {t("call.active_call", { count: liveParticipantCount || callSession.maxParticipants })}
          {liveParticipantCount === 0 && (
            <Button size="sm" onClick={() => onJoinCall()} className="ml-4">
              {t("call.join")}
            </Button>
          )}
        </div>
      )}
      {supportsSettings && (
        <ChannelSettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          channelId={channel.channel_id}
          channelName={displayName}
        />
      )}
    </div>
  );
}
