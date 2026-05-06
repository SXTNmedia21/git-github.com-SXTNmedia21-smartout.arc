"use client";

/**
 * ChatClient — Standalone 2-panel DM page for /dashboard/komm/chat.
 *
 * Left panel: search + active DM conversations + all workspace members directory.
 * Right panel: message timeline + input for the selected conversation, or empty state.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "@smartout/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useChannels } from "../_hooks/use-channels";
import { useChannelRealtime } from "../_hooks/use-channel-realtime";
import { useCallSignaling } from "../_hooks/use-call-signaling";
import { useCallRealtime } from "../_hooks/use-call-realtime";
import { useCallInvite } from "../_hooks/use-call-invite";
import { useCallState } from "../_hooks/use-call-state";
import { useStartCall } from "../_hooks/use-start-call";
import { channelKeys } from "../_hooks/channel-keys";
import { getLiveKitToken } from "@smartout/walkie-talkie";
import { MessageTimeline } from "./MessageTimeline";
import { MessageInput } from "./MessageInput";
import { IncomingCallOverlay } from "./IncomingCallOverlay";
import { useActiveCall } from "@/components/dashboard/ActiveCallProvider";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageCircle, Phone, Video, Send, MoreHorizontal, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { ChannelWithPreview } from "../_hooks/channel-types";
import { KommToolsBridge } from "../_tools/komm-tools-bridge";

/* ─── Types ─── */

type WorkspaceMember = {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  department_name: string | null;
};

/* ─── Hooks ─── */

/**
 * Returns the set of channel_ids where BOTH the signed-in user AND the
 * target are active members. Used by the three-dots menu "Se samtaler"
 * action to list every channel (DM or group) the two share — ordered
 * chronologically by last activity at the render site.
 */
function useSharedChannelIds(selfProfileId: string, otherProfileId: string | null) {
  return useQuery({
    queryKey: ["komm", "shared-channels", selfProfileId, otherProfileId],
    enabled: !!otherProfileId,
    staleTime: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      if (!otherProfileId) return new Set();
      const supabase = createClient();
      const { data, error } = await supabase
        .from("channel_member")
        .select("channel_id")
        .eq("profile_id", otherProfileId)
        .is("left_at", null);
      if (error) return new Set();
      return new Set((data ?? []).map((r) => r.channel_id));
    },
  });
}

/** Fetches all active workspace members except self and system accounts. */
function useWorkspaceMembers(profileId: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["workspace-members", workspace.workspace_id],
    staleTime: 60_000,
    queryFn: async (): Promise<WorkspaceMember[]> => {
      const supabase = createClient();
      // Disambiguate the department join — profile has TWO FKs to
      // department (its own department_id and department.manager_profile_id
      // pointing back). Without !fk_profile_department PostgREST errors
      // PGRST201 and the whole member list comes back empty.
      const { data, error } = await supabase
        .from("profile")
        .select(
          "profile_id, display_name, avatar_url, role, department:department!fk_profile_department(name)",
        )
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .neq("profile_id", profileId)
        .neq("role", "system")
        .order("display_name");
      if (error) throw error;
      return (data ?? []).map((p: Record<string, unknown>) => ({
        profile_id: p.profile_id as string,
        display_name: p.display_name as string | null,
        avatar_url: p.avatar_url as string | null,
        role: p.role as string,
        department_name: (p.department as { name: string } | null)?.name ?? null,
      }));
    },
  });
}

/* ─── Avatar color palette ─── */

const INITIALS_COLORS = [
  "bg-komm-brief/15 text-komm-brief",
  "bg-komm-handoff/15 text-komm-handoff",
  "bg-komm-summary/15 text-komm-summary",
  "bg-komm-quiz/15 text-komm-quiz",
  "bg-komm-training/15 text-komm-training",
  "bg-komm-announcement/15 text-komm-announcement",
  "bg-komm-problem/15 text-komm-problem",
];

function getColorClass(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return INITIALS_COLORS[hash % INITIALS_COLORS.length]!;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* ─── Relative timestamp ─── */

function relativeTime(
  iso: string | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("time.just_now");
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hours_ago", { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t("time.yesterday");
  return t("time.days_ago", { count: days });
}

/* ─── Stagger animation variants ─── */

const listContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const listItem = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

/* ─── Component ─── */

export function ChatClient({ profileId }: { profileId: string }) {
  const { t } = useTranslation("komm");
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  // Draft mode: a member is selected but no channel exists/selected yet.
  // Opens the chat pane in place; create_channel only fires when the user
  // actually sends a message — matches how standard chat apps behave.
  const [draftMember, setDraftMember] = useState<WorkspaceMember | null>(null);

  const { joinCall } = useActiveCall();
  const queryClient = useQueryClient();

  // All channels — filter down to direct messages
  const { data: channelGroups } = useChannels();
  const dmChannels = useMemo(
    () =>
      (
        channelGroups?.flatMap((g) => g.channels).filter((ch) => ch.channel_type === "direct") ?? []
      ).sort((a, b) => {
        const aTime = a.last_message_at ?? "";
        const bTime = b.last_message_at ?? "";
        return bTime.localeCompare(aTime);
      }),
    [channelGroups],
  );

  // Workspace member directory
  const { data: members } = useWorkspaceMembers(profileId);

  // Realtime subscription for active channel
  useChannelRealtime(workspaceId, activeChannelId);

  // Voice/video call hooks — mirror KanalerClient
  const { incomingCall, dismissIncoming } = useCallSignaling(profileId, activeChannelId);
  useCallRealtime(activeChannelId);
  const callInvite = useCallInvite();
  const startCall = useStartCall();
  const { data: callSession } = useCallState(activeChannelId);

  // Derive active channel object
  const activeChannel = dmChannels.find((ch) => ch.channel_id === activeChannelId);

  const handleJoinCall = useCallback(
    async (opts?: { withVideo?: boolean }) => {
      if (!activeChannelId || !activeChannel) return;
      try {
        const supabase = createClient();
        const { token, serverUrl } = await getLiveKitToken(supabase, {
          channelId: activeChannelId,
          workspaceId,
        });
        joinCall({
          channelId: activeChannelId,
          channelName: activeChannel.other_member_name ?? "",
          serverUrl,
          token,
          audioPolicy: activeChannel.audio_policy,
          startWithVideo: opts?.withVideo ?? false,
        });
      } catch {
        toast.error(t("shell.connection_error"));
      }
    },
    [activeChannelId, activeChannel, workspaceId, joinCall, t],
  );

  const handleStartCall = useCallback(
    (withVideo: boolean) => {
      if (!activeChannel || !activeChannelId) return;
      if (callSession) {
        void handleJoinCall({ withVideo });
        return;
      }
      startCall.mutate(
        {
          channelId: activeChannelId,
          callType: "direct",
          profileId,
          calleeProfileId: activeChannel.other_member_profile_id ?? undefined,
        },
        {
          onSuccess: () => handleJoinCall({ withVideo }),
        },
      );
    },
    [activeChannel, activeChannelId, callSession, startCall, profileId, handleJoinCall],
  );

  const handleAcceptCall = useCallback(async () => {
    if (!incomingCall) return;
    callInvite.mutate({
      callSessionId: incomingCall.callSessionId,
      channelId: incomingCall.channelId,
      responseAction: "accept",
      profileId,
    });
    dismissIncoming();
    try {
      const supabase = createClient();
      const { token, serverUrl } = await getLiveKitToken(supabase, {
        channelId: incomingCall.channelId,
        workspaceId,
      });
      const incomingChannel = dmChannels.find((c) => c.channel_id === incomingCall.channelId);
      joinCall({
        channelId: incomingCall.channelId,
        channelName: incomingChannel?.other_member_name ?? incomingCall.callerName ?? "",
        serverUrl,
        token,
        audioPolicy: incomingChannel?.audio_policy ?? "open_mic",
        startWithVideo: false,
      });
    } catch {
      toast.error(t("shell.connection_error"));
    }
  }, [incomingCall, callInvite, profileId, dismissIncoming, workspaceId, dmChannels, joinCall, t]);

  const handleRejectCall = useCallback(() => {
    if (!incomingCall) return;
    callInvite.mutate({
      callSessionId: incomingCall.callSessionId,
      channelId: incomingCall.channelId,
      responseAction: "reject",
      profileId,
    });
    dismissIncoming();
  }, [incomingCall, callInvite, profileId, dismissIncoming]);

  // Unified conversation list — every workspace member gets one row. If we
  // already have a DM with them the row shows last-message preview + unread;
  // otherwise it shows role + department and starts a new DM on click.
  // Sort: existing DMs by last-message desc, then the rest alphabetically.
  const lowerFilter = filter.toLowerCase();

  const conversationList = useMemo<ConversationEntry[]>(() => {
    if (!members) return [];

    const dmByMember = new Map<string, ChannelWithPreview>();
    for (const ch of dmChannels) {
      if (ch.other_member_profile_id) {
        dmByMember.set(ch.other_member_profile_id, ch);
      }
    }

    const entries: ConversationEntry[] = members.map((member) => {
      const ch = dmByMember.get(member.profile_id) ?? null;
      return {
        key: ch?.channel_id ?? `member:${member.profile_id}`,
        name: member.display_name ?? t("chat_list.unknown"),
        avatarUrl: ch?.other_member_avatar ?? member.avatar_url,
        role: member.role,
        departmentName: member.department_name,
        profileId: member.profile_id,
        channel: ch,
      };
    });

    entries.sort((a, b) => {
      const aActive = !!a.channel;
      const bActive = !!b.channel;
      if (aActive !== bActive) return aActive ? -1 : 1;
      if (aActive && bActive) {
        return (b.channel?.last_message_at ?? "").localeCompare(a.channel?.last_message_at ?? "");
      }
      return a.name.localeCompare(b.name);
    });

    if (!lowerFilter) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(lowerFilter));
  }, [members, dmChannels, lowerFilter, t]);

  // When a draft materializes into a real channel, useChannels picks it
  // up via realtime/invalidation and we transparently promote the draft
  // into the active channel so the user stays in the same conversation.
  useEffect(() => {
    if (!draftMember) return;
    const match = dmChannels.find((ch) => ch.other_member_profile_id === draftMember.profile_id);
    if (match) {
      setActiveChannelId(match.channel_id);
      setDraftMember(null);
    }
  }, [dmChannels, draftMember]);

  // Select an existing channel — clears any pending draft
  const handleSelectChannel = useCallback((channelId: string) => {
    setActiveChannelId(channelId);
    setDraftMember(null);
    setReplyToId(null);
  }, []);

  // Select a member — always opens the chat pane. If an existing DM exists
  // we open it; otherwise we enter draft mode (no channel created yet).
  const handleSelectMember = useCallback(
    (member: WorkspaceMember) => {
      const existing = dmChannels.find((ch) => ch.other_member_profile_id === member.profile_id);
      if (existing) {
        handleSelectChannel(existing.channel_id);
        return;
      }
      setActiveChannelId(null);
      setReplyToId(null);
      setDraftMember(member);
    },
    [dmChannels, handleSelectChannel],
  );

  // "Ny samtale" in the three-dots menu — clears the current pane so the
  // user can pick another person from the left list. Backend is idempotent
  // for DMs (create_channel reuses the same pair hash), so "new DM with
  // the same person" doesn't actually produce a second channel — the
  // useful exit is to go back to the list.
  const handleClearSelection = useCallback(() => {
    setActiveChannelId(null);
    setDraftMember(null);
    setReplyToId(null);
  }, []);

  // Create a DM channel on demand and send the first message through it.
  // Called by the draft input below when the user actually hits send.
  const materializeDraft = useCallback(
    async (memberProfileId: string): Promise<string | null> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_channel", {
        p_workspace_id: workspaceId,
        p_channel_type: "direct",
        p_name: undefined,
        p_created_by: profileId,
        p_member_profile_ids: [profileId, memberProfileId],
      });
      if (error) {
        toast.error(t("message.send_error"));
        return null;
      }
      const result = data as { channel_id: string; created: boolean };
      // Make sure the new channel shows up in useChannels immediately
      queryClient.invalidateQueries({ queryKey: channelKeys.list(workspaceId) });
      return result.channel_id;
    },
    [workspaceId, profileId, queryClient, t],
  );

  // Resolve the display name for the chat header from the active channel
  const otherName = activeChannel?.other_member_name ?? t("chat_list.unknown");
  const otherAvatar = activeChannel?.other_member_avatar ?? null;

  // Find the member record for the other person (for role/department in header)
  const otherMember = useMemo(() => {
    if (!activeChannel?.other_member_profile_id || !members) return null;
    return members.find((m) => m.profile_id === activeChannel.other_member_profile_id) ?? null;
  }, [activeChannel, members]);

  return (
    <>
      <KommToolsBridge profileId={profileId} surface="chat" activeChannelId={activeChannelId} />
      <div className="bg-background/80 border-border/50 flex h-full overflow-hidden rounded-lg border backdrop-blur-xl">
        {/* Left sidebar: DM conversations + member directory */}
        <div className="border-border/50 flex w-72 flex-shrink-0 flex-col border-r">
          {/* Search */}
          <div className="border-border/50 border-b p-3">
            <div className="relative">
              <Search className="text-muted-foreground/60 absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("chat_list.filter_placeholder")}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Single unified list — active DMs on top, then the rest of
             *  the workspace sorted alphabetically. One row style so the
             *  surface feels like a standard chat app. */}
            {conversationList.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 py-8">
                <p className="text-muted-foreground text-xs">{t("chat_list.empty")}</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  variants={listContainer}
                  initial="hidden"
                  animate="visible"
                  key="unified-list"
                  className="py-1"
                >
                  {conversationList.map((entry) => (
                    <motion.div key={entry.key} variants={listItem}>
                      <ConversationRow
                        entry={entry}
                        isActive={
                          (entry.channel !== null &&
                            entry.channel.channel_id === activeChannelId) ||
                          (entry.channel === null && draftMember?.profile_id === entry.profileId)
                        }
                        onClick={() => {
                          if (entry.channel) {
                            handleSelectChannel(entry.channel.channel_id);
                          } else {
                            const member = members?.find((m) => m.profile_id === entry.profileId);
                            if (member) handleSelectMember(member);
                          }
                        }}
                        t={t}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* ── Right message pane ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {activeChannel || draftMember ? (
            <ChatPane
              key={activeChannel?.channel_id ?? `draft:${draftMember?.profile_id}`}
              activeChannel={activeChannel}
              draftMember={draftMember}
              otherMember={otherMember}
              profileId={profileId}
              replyToId={replyToId}
              setReplyToId={setReplyToId}
              startCall={startCall}
              callSession={callSession}
              handleStartCall={handleStartCall}
              handleJoinCall={handleJoinCall}
              allChannels={channelGroups?.flatMap((g) => g.channels) ?? []}
              onSelectChannel={handleSelectChannel}
              onClearSelection={handleClearSelection}
              materializeDraft={materializeDraft}
              t={t}
            />
          ) : (
            /* Empty state */
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <MessageCircle className="text-muted-foreground/40 h-12 w-12" />
              <p className="text-muted-foreground text-sm">{t("chat.empty_state")}</p>
            </div>
          )}
        </div>

        {/* Incoming call overlay */}
        {incomingCall && (
          <IncomingCallOverlay
            call={incomingCall}
            onAccept={handleAcceptCall}
            onReject={handleRejectCall}
          />
        )}
      </div>
    </>
  );
}

/* ─── Sub-components ─── */

type ConversationEntry = {
  key: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  departmentName: string | null;
  profileId: string;
  channel: ChannelWithPreview | null;
};

/**
 * One row for every workspace member. If the entry has an existing DM
 * (`channel !== null`) it shows last-message preview + unread count, else
 * falls back to role + department — the row still opens/starts a DM on
 * click, so interaction is identical across both states.
 */
function ConversationRow({
  entry,
  isActive,
  onClick,
  t,
}: {
  entry: ConversationEntry;
  isActive: boolean;
  onClick: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const { name, channel } = entry;
  const hasUnread = channel ? channel.unread_count > 0 : false;
  const isProspective = channel === null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
        isActive ? "bg-accent/50" : "hover:bg-accent/30",
        isProspective && "opacity-70 hover:opacity-100",
      )}
    >
      <Avatar className="h-8 w-8 flex-shrink-0">
        {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} />}
        <AvatarFallback className={cn("text-[10px] font-semibold", getColorClass(name))}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-sm", hasUnread ? "font-semibold" : "font-medium")}>
            {name}
          </p>
          {channel?.last_message_at && (
            <span className="text-muted-foreground flex-shrink-0 text-[10px]">
              {relativeTime(channel.last_message_at, t)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {channel?.last_message_content
              ? channel.last_message_content
              : [entry.departmentName, entry.role].filter(Boolean).join(" · ")}
          </p>
          {hasUnread && channel && (
            <span className="bg-komm-accent text-komm-accent-foreground ml-1 flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold">
              {channel.unread_count > 99 ? "99+" : channel.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Right-pane renderer that handles both modes (existing channel + draft).
 * Owns the header (with three-dots menu), timeline, and input/draft input.
 */
type StartCallHandler = (withVideo: boolean) => void;
type JoinCallHandler = (opts?: { withVideo?: boolean }) => void;

function ChatPane({
  activeChannel,
  draftMember,
  otherMember,
  profileId,
  replyToId,
  setReplyToId,
  startCall,
  callSession,
  handleStartCall,
  handleJoinCall,
  allChannels,
  onSelectChannel,
  onClearSelection,
  materializeDraft,
  t,
}: {
  activeChannel: ChannelWithPreview | undefined;
  draftMember: WorkspaceMember | null;
  otherMember: WorkspaceMember | null;
  profileId: string;
  replyToId: string | null;
  setReplyToId: (id: string | null) => void;
  startCall: { isPending: boolean };
  callSession: unknown;
  handleStartCall: StartCallHandler;
  handleJoinCall: JoinCallHandler;
  allChannels: ChannelWithPreview[];
  onSelectChannel: (id: string) => void;
  onClearSelection: () => void;
  materializeDraft: (memberProfileId: string) => Promise<string | null>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const otherProfileId = activeChannel?.other_member_profile_id ?? draftMember?.profile_id ?? null;
  const otherName =
    activeChannel?.other_member_name ?? draftMember?.display_name ?? t("chat_list.unknown");
  const otherAvatar = activeChannel?.other_member_avatar ?? draftMember?.avatar_url ?? null;
  const isDraft = !activeChannel && !!draftMember;

  // Channels the other person and I both belong to, for the "Se samtaler" menu
  const { data: otherChannelIds } = useSharedChannelIds(profileId, otherProfileId);
  const sharedChannels = useMemo<ChannelWithPreview[]>(() => {
    if (!otherChannelIds) return [];
    return allChannels
      .filter((ch) => otherChannelIds.has(ch.channel_id))
      .sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
  }, [allChannels, otherChannelIds]);

  return (
    <>
      {/* Chat header */}
      <div className="border-border/50 flex items-center gap-3 border-b px-4 py-2.5">
        <Avatar className="h-10 w-10">
          {otherAvatar && <AvatarImage src={otherAvatar} />}
          <AvatarFallback className={cn("text-sm font-semibold", getColorClass(otherName))}>
            {getInitials(otherName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-heading truncate text-sm">{otherName}</p>
          {otherMember && (
            <p className="text-muted-foreground truncate text-xs">
              {otherMember.department_name ? `${otherMember.department_name} · ` : ""}
              {otherMember.role}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeChannel && activeChannel.audio_policy !== "disabled" && (
            <>
              <Button
                size="icon"
                className="bg-komm-call-active hover:bg-komm-call-active/90 h-8 w-8 rounded-full text-white"
                onClick={() => (callSession ? handleJoinCall() : handleStartCall(false))}
                disabled={startCall.isPending}
                title={callSession ? t("call.join_call") : t("call.start_call")}
              >
                <Phone className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() =>
                  callSession ? handleJoinCall({ withVideo: true }) : handleStartCall(true)
                }
                disabled={startCall.isPending}
                title={callSession ? t("call.join_video_call") : t("call.start_video_call")}
              >
                <Video className="h-4 w-4" />
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("chat.menu")}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={onClearSelection}>
                <Plus className="mr-2 h-4 w-4" />
                {t("chat.new_dm")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-[10px] tracking-wider uppercase">
                {t("chat.shared_conversations")}
              </DropdownMenuLabel>
              {sharedChannels.length === 0 ? (
                <div className="text-muted-foreground px-2 py-2 text-xs">{t("chat.no_shared")}</div>
              ) : (
                sharedChannels.map((ch) => {
                  const label =
                    ch.channel_type === "direct"
                      ? (ch.other_member_name ?? t("chat_list.unknown"))
                      : (ch.name ?? t("channel.direct_message"));
                  const timestamp = ch.last_message_at ? relativeTime(ch.last_message_at, t) : "";
                  return (
                    <DropdownMenuItem
                      key={ch.channel_id}
                      onClick={() => onSelectChannel(ch.channel_id)}
                    >
                      <MessageCircle className="mr-2 h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {timestamp && (
                        <span className="text-muted-foreground ml-2 shrink-0 text-[10px]">
                          {timestamp}
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      {activeChannel ? (
        <MessageTimeline
          channelId={activeChannel.channel_id}
          profileId={profileId}
          onReply={setReplyToId}
        />
      ) : (
        <DraftEmptyState name={otherName} t={t} />
      )}

      {/* Input */}
      {activeChannel && !activeChannel.is_read_only && (
        <MessageInput
          channelId={activeChannel.channel_id}
          profileId={profileId}
          replyToId={replyToId}
          onCancelReply={() => setReplyToId(null)}
          audioPolicy={activeChannel.audio_policy}
          pttProps={undefined}
        />
      )}
      {isDraft && draftMember && (
        <DraftMessageInput
          profileId={profileId}
          memberProfileId={draftMember.profile_id}
          materializeDraft={materializeDraft}
          t={t}
        />
      )}
    </>
  );
}

function DraftEmptyState({
  name,
  t,
}: {
  name: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <MessageCircle className="text-muted-foreground/40 h-10 w-10" />
      <p className="text-muted-foreground text-sm">{t("chat.draft_prompt", { name })}</p>
    </div>
  );
}

/**
 * DraftMessageInput — lazy-creates the channel on first send so we don't
 * spawn empty DM rooms every time the user opens a profile. Reuses the
 * same look as MessageInput; full-feature input takes over after the
 * channel materializes.
 */
function DraftMessageInput({
  profileId,
  memberProfileId,
  materializeDraft,
  t,
}: {
  profileId: string;
  memberProfileId: string;
  materializeDraft: (memberProfileId: string) => Promise<string | null>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [memberProfileId]);

  const handleSend = useCallback(async () => {
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    const newChannelId = await materializeDraft(memberProfileId);
    if (!newChannelId) {
      setSending(false);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("channel_message").insert({
      channel_id: newChannelId,
      workspace_id: workspaceId,
      sender_id: profileId,
      content: text,
      client_message_id: crypto.randomUUID(),
    });
    if (error) {
      toast.error(t("message.send_error"));
      setSending(false);
      return;
    }
    setContent("");
    setSending(false);
    // Parent picks up the new channel via useChannels invalidation and
    // auto-selects it on next render — no manual switch needed here.
  }, [content, sending, memberProfileId, materializeDraft, profileId, workspaceId, t]);

  return (
    <div className="border-border/50 flex items-end gap-2 border-t px-3 py-2">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
          }
        }}
        placeholder={t("message.draft_placeholder")}
        rows={1}
        className="bg-background/60 placeholder:text-muted-foreground/60 min-h-[36px] flex-1 resize-none rounded-md border px-3 py-2 text-sm focus:outline-none"
      />
      <Button
        size="icon"
        onClick={() => void handleSend()}
        disabled={!content.trim() || sending}
        className="h-9 w-9 shrink-0"
        aria-label={t("message.send")}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
