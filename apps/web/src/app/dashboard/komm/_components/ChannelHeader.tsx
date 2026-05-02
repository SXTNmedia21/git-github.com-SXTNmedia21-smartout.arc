"use client";

/**
 * ChannelHeader — Rich workspace-style header for a channel.
 *
 * Redesign (2026-04-29): Visual enrichment to match Nordic Split ambient density:
 *   - Large font-heading channel name with # chip prefix
 *   - Mono ambient stats strip (members · created · type · last active)
 *   - Helpdesk badge with LifeBuoy icon when helpdesk_enabled
 *   - Archived channel banner (dashed border, read-only label)
 *   - Active call strip preserved from original
 *   - Settings cog + member toggle preserved
 *
 * Nordic Split only — no new tokens, no hardcoded colors.
 */

import * as React from "react";
import type { ChannelWithPreview } from "../_hooks/channel-types";
import { useCallState } from "../_hooks/use-call-state";
import { useStartCall } from "../_hooks/use-start-call";
import { ChannelSettingsModal } from "./ChannelSettingsModal";
import { Button } from "@/components/ui/button";
import {
  Users,
  Phone,
  Video,
  Settings,
  Hash,
  MessageCircle,
  LifeBuoy,
  Archive,
} from "lucide-react";
import { useTranslation } from "@smartout/i18n";

// ── Type label map ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  department: "Avdeling",
  team: "Team",
  session: "Sesjon",
  custom: "Kanal",
  direct: "DM",
  news: "Nyheter",
  skill: "Ferdighet",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format an ISO timestamp as a short relative or calendar label.
 * Used for "created" and "last active" ambient stats.
 */
function formatAmbientDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "i dag";
  if (diffDays === 1) return "i går";
  if (diffDays < 7) return `${diffDays}d siden`;
  return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

// ── Props ───────────────────────────────────────────────────────────────────

type Props = {
  channel: ChannelWithPreview;
  profileId: string;
  showMembers: boolean;
  onToggleMembers: () => void;
  onJoinCall: (opts?: { withVideo?: boolean }) => void;
  liveParticipantCount?: number;
  /** Whether the channel has helpdesk mode enabled (from useChannelHelpdeskFlags) */
  helpdeskEnabled?: boolean;
  /** Created-at ISO string for ambient stats (from channel details if available) */
  createdAt?: string | null;
};

// ── Component ───────────────────────────────────────────────────────────────

export function ChannelHeader({
  channel,
  profileId,
  showMembers,
  onToggleMembers,
  onJoinCall,
  liveParticipantCount = 0,
  helpdeskEnabled = false,
  createdAt = null,
}: Props) {
  const { t } = useTranslation("komm");
  const displayName =
    channel.channel_type === "direct"
      ? (channel.other_member_name ?? t("channel.direct_message"))
      : (channel.name ?? t("channel.default_name"));

  const typeLabel = TYPE_LABELS[channel.channel_type] ?? "Kanal";

  const voiceEnabled = channel.audio_policy !== "disabled";
  const { data: callSession } = useCallState(voiceEnabled ? channel.channel_id : null);
  const startCall = useStartCall();
  const hasActiveCall = !!callSession;
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const supportsSettings = channel.channel_type !== "direct";
  const isArchived = channel.is_archived;

  // Ambient stats: members · type · created · last active
  const statsChunks: string[] = [
    channel.member_count === 1
      ? `${channel.member_count} ${t("channel.member_one", { count: channel.member_count }).replace(/^\d+ /, "")}`
      : `${channel.member_count} ${t("channel.member_other", { count: channel.member_count }).replace(/^\d+ /, "")}`,
    typeLabel,
  ];
  if (createdAt) {
    statsChunks.push(`opprettet ${formatAmbientDate(createdAt)}`);
  }
  if (channel.last_message_at) {
    statsChunks.push(`aktiv ${formatAmbientDate(channel.last_message_at)}`);
  }

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
    <div className="border-border/60 border-b">
      {/* Archived banner — dashed top strip */}
      {isArchived && (
        <div className="border-border/60 border-b border-dashed px-6 py-2.5">
          <div className="flex items-center gap-2">
            <Archive className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="text-muted-foreground font-mono text-[12px] tracking-[0.05em]">
              Arkivert · skrivebeskyttet
            </span>
          </div>
        </div>
      )}

      {/* Main header row */}
      <div className="flex items-start gap-4 px-6 py-4">
        {/* Channel identity */}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {/* # chip prefix — 28×28 */}
          <div
            aria-hidden="true"
            className="bg-muted/80 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          >
            {channel.channel_type === "direct" ? (
              <MessageCircle className="text-muted-foreground h-3.5 w-3.5" />
            ) : (
              <span className="text-muted-foreground font-mono text-[13px] font-semibold">#</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {/* Channel name — large heading */}
            <div className="flex items-center gap-2.5">
              <h3 className="font-heading overflow-hidden text-[28px] leading-tight tracking-tight text-ellipsis whitespace-nowrap">
                {displayName}
              </h3>
              {/* Helpdesk badge */}
              {helpdeskEnabled && (
                <div className="bg-success/10 ring-success/20 flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1">
                  <LifeBuoy className="text-success h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-success font-mono text-[11px] tracking-[0.05em]">
                    Skranke
                  </span>
                </div>
              )}
            </div>

            {/* Ambient stats strip */}
            <p className="text-muted-foreground mt-0.5 truncate font-mono text-[12px] tracking-[0.05em]">
              {statsChunks.join(" · ")}
            </p>
          </div>
        </div>

        {/* Action cluster — right side */}
        <div className="flex shrink-0 items-center gap-1 pt-1">
          {voiceEnabled && !isArchived && (
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
            title="Vis medlemmer"
          >
            <Users className="h-4 w-4" />
          </Button>
          {supportsSettings && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSettingsOpen(true)}
              aria-label={`Innstillinger for ${displayName}`}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Active call strip */}
      {hasActiveCall && callSession && (
        <div className="bg-primary/10 text-primary flex items-center px-6 py-2 text-sm">
          <Users className="mr-1.5 h-3.5 w-3.5" />
          {t("call.active_call", { count: liveParticipantCount || callSession.maxParticipants })}
          {liveParticipantCount === 0 && (
            <Button size="sm" onClick={() => onJoinCall()} className="ml-4">
              {t("call.join")}
            </Button>
          )}
        </div>
      )}

      {/* Settings modal */}
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
