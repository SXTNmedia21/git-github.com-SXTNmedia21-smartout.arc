/**
 * ConversationScreen — shared chat detail component.
 *
 * Used by both (chat)/[id].tsx (chat tab) and (me)/chat/[id].tsx
 * (notification-driven navigation within the me-stack so back returns
 * to the caller, e.g. the notifications screen).
 *
 * Accepts channelId as a prop so both route files can be thin wrappers.
 */

import { useCallback, useEffect, useState } from "react";
import { View, KeyboardAvoidingView, Platform, Pressable, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Search, Phone, Video } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { strings } from "@/constants/strings";
import { ConversationBody } from "@/components/komm/ConversationBody";
import { CallBar } from "@/features/channels/components/CallBar";
import { CallSheet } from "@/features/channels/components/CallSheet";
import { useLiveKitCall } from "@/hooks/mutations/use-livekit-call";
import { startCall, getLiveKitToken } from "@smartout/walkie-talkie";
import type { CallSession } from "@smartout/walkie-talkie";

interface ConversationScreenProps {
  channelId: string;
}

export function ConversationScreen({ channelId }: ConversationScreenProps) {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [conversationName, setConversationName] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // ─── Call state ─────────────────────────────────────
  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkServerUrl, setLkServerUrl] = useState<string | null>(null);
  const [isCallSheetOpen, setIsCallSheetOpen] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");

  const {
    room,
    isConnected,
    isMicEnabled,
    activeSpeakers,
    participantCount,
    connect,
    disconnect,
    toggleMic,
  } = useLiveKitCall({
    token: lkToken,
    serverUrl: lkServerUrl,
    callSession,
    onDisconnected: () => {
      setCallSession(null);
      setLkToken(null);
      setLkServerUrl(null);
      setIsCallSheetOpen(false);
    },
  });

  const handleStartCall = useCallback(
    async (withVideo = false) => {
      if (!channelId || !workspaceId) {
        console.error("[CallStart] Missing:", !channelId ? "channelId" : "workspaceId");
        return;
      }
      try {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        const result = await startCall(supabase, {
          channelId,
          workspaceId,
          callType: "group",
        });
        const tokenResult = await getLiveKitToken(supabase, {
          channelId,
          workspaceId,
        });
        setCallSession({
          id: result.callSessionId,
          channelId,
          workspaceId,
          callType: result.callType,
          livekitRoomName: result.roomName,
          status: "active",
          audioPolicy: "open_mic",
          videoPolicy: "optional",
          startedBy: profileId,
          maxParticipants: 0,
          startedAt: new Date().toISOString(),
          endedAt: null,
        });
        setLkToken(tokenResult.token);
        setLkServerUrl(tokenResult.serverUrl);
        setIsCameraEnabled(withVideo);
        setIsCallSheetOpen(true);
      } catch (err) {
        console.error("[CallStart] Failed:", err);
        const message = err instanceof Error ? err.message : String(err);
        if (Platform.OS === "web") {
          window.alert(`${strings.call.startCall}: ${message}`);
        } else {
          Alert.alert(strings.call.startCall, message);
        }
      }
    },
    [channelId, workspaceId, profileId],
  );

  useEffect(() => {
    if (lkToken && lkServerUrl && !isConnected) {
      connect();
    }
  }, [lkToken, lkServerUrl, isConnected, connect]);

  useEffect(() => {
    if (!isConnected || !room || !isCameraEnabled) return;
    void room.localParticipant.setCameraEnabled(true, { facingMode: cameraFacing }).catch((err) => {
      console.error("[CallStart] setCameraEnabled failed:", err);
    });
  }, [isConnected, room, isCameraEnabled, cameraFacing]);

  const handleFlipCamera = useCallback(() => {
    setCameraFacing((prev) => (prev === "user" ? "environment" : "user"));
  }, []);

  const handleEndCall = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const handleToggleCamera = useCallback(async () => {
    if (!room) return;
    const next = !isCameraEnabled;
    await room.localParticipant.setCameraEnabled(
      next,
      next ? { facingMode: cameraFacing } : undefined,
    );
    setIsCameraEnabled(next);
  }, [room, isCameraEnabled, cameraFacing]);

  useEffect(() => {
    if (!user || !channelId) return;

    async function loadContext() {
      // Resolve channel first — its workspace_id scopes profile lookup so
      // multi-workspace users land in the correct profile (matches the
      // workspace that owns the channel, not a random "first" profile).
      const { data: conv } = await supabase
        .from("channel")
        .select("name, channel_type, workspace_id")
        .eq("id", channelId)
        .single();

      if (!conv) return;

      setConversationName(conv.name ?? "Samtale");
      setWorkspaceId(conv.workspace_id);

      const { data: profile } = await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url, workspace_id")
        .eq("user_id", user!.id)
        .eq("workspace_id", conv.workspace_id)
        .in("status", ["active", "trainee"])
        .limit(1)
        .maybeSingle();

      if (profile) {
        setProfileId(profile.profile_id);
        setProfileName(profile.display_name || "Meg");
        setProfileAvatarUrl(profile.avatar_url);
      }

      const { count } = await supabase
        .from("channel_member")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", channelId)
        .is("left_at", null);

      setMemberCount(count ?? 0);
    }

    loadContext();
  }, [user, channelId]);

  const channelPrefix = conversationName.startsWith("#") ? "" : "#";
  const memberLabel =
    memberCount === 1 ? "1 MEDLEM" : memberCount > 0 ? `${memberCount} MEDLEMMER` : "";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header — prototype ConvoHeader: #channel brand-orange 20/700, meta
          10 mono uppercase letter-spaced 2, icon buttons 40pt. */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ArrowLeft size={22} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {channelPrefix}
            {conversationName.toLowerCase()}
          </Text>
          {memberLabel ? <Text style={styles.headerMeta}>{memberLabel}</Text> : null}
        </View>
        <Pressable
          onPress={isConnected ? undefined : () => handleStartCall(false)}
          style={[styles.headerButton, isConnected && { opacity: 0.4 }]}
          accessibilityRole="button"
          accessibilityLabel={strings.call.startCall}
        >
          <Phone size={20} color={theme.colors.brandOrange} strokeWidth={1.6} />
        </Pressable>
        <Pressable
          onPress={isConnected ? undefined : () => handleStartCall(true)}
          style={[styles.headerButton, isConnected && { opacity: 0.4 }]}
          accessibilityRole="button"
          accessibilityLabel="Start videosamtale"
        >
          <Video size={20} color={theme.colors.brandOrange} strokeWidth={1.6} />
        </Pressable>
        <Pressable style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Søk">
          <Search size={20} color={theme.colors.foreground} strokeWidth={1.6} />
        </Pressable>
      </View>

      {/* Messages + composer */}
      <ConversationBody
        channelId={channelId}
        profileId={profileId}
        profileName={profileName}
        profileAvatarUrl={profileAvatarUrl}
        workspaceId={workspaceId}
        composerStyle={{ paddingBottom: isConnected ? 0 : insets.bottom || 8 }}
      />

      {isConnected && (
        <CallBar
          participantCount={participantCount}
          isMicEnabled={isMicEnabled}
          activeSpeakers={activeSpeakers}
          onToggleMic={toggleMic}
          onEndCall={handleEndCall}
          onPress={() => setIsCallSheetOpen(true)}
        />
      )}

      {isConnected && isCallSheetOpen && callSession && (
        <CallSheet
          room={room}
          channelName={conversationName}
          channelId={channelId}
          audioPolicy={callSession.audioPolicy}
          videoPolicy={callSession.videoPolicy}
          isMicEnabled={isMicEnabled}
          isCameraEnabled={isCameraEnabled}
          callStartedAt={callSession.startedAt}
          onToggleMic={toggleMic}
          onToggleCamera={handleToggleCamera}
          onFlipCamera={handleFlipCamera}
          onEndCall={handleEndCall}
          onClose={() => setIsCallSheetOpen(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: withOpacity(theme.colors.brandOrange, 0.1),
    backgroundColor: withOpacity(theme.colors.background, 0.88),
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 4,
    gap: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.brandOrange,
    letterSpacing: -0.3,
  },
  headerMeta: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
}));
