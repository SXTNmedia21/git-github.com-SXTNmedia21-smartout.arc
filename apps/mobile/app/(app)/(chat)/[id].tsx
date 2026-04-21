/**
 * Conversation screen — Nordic Split chat detail.
 *
 * Header: back arrow, channel name (serif, orange), member count, call buttons, search
 * Body: reusable ConversationBody (message list + composer + reactions)
 * Call: LiveKit call bar + call sheet overlay when a call is active
 *
 * Channel metadata (name, member count) is loaded once on mount. The
 * actual message list + realtime subscription lives in ConversationBody
 * (Phase 1A.2 extraction) so the ticket detail screen can reuse it.
 */

import { useCallback, useEffect, useState } from "react";
import { View, KeyboardAvoidingView, Platform, Pressable, Text, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function ConversationScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
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
  // 'user' = front / 'environment' = rear. Default to front when video starts.
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
      if (!conversationId || !workspaceId) {
        console.error("[CallStart] Missing:", !conversationId ? "conversationId" : "workspaceId");
        return;
      }
      try {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        const result = await startCall(supabase, {
          channelId: conversationId,
          workspaceId,
          callType: "group",
        });
        const tokenResult = await getLiveKitToken(supabase, {
          channelId: conversationId,
          workspaceId,
        });
        setCallSession({
          id: result.callSessionId,
          channelId: conversationId,
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
    [conversationId, workspaceId, profileId],
  );

  // Auto-connect when token is available
  useEffect(() => {
    if (lkToken && lkServerUrl && !isConnected) {
      connect();
    }
  }, [lkToken, lkServerUrl, isConnected, connect]);

  // Publish camera once the room is connected if the user started with video,
  // and re-publish with the selected facingMode whenever the user flips camera.
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

  // Load current profile, channel name, and member count from channel schema
  useEffect(() => {
    if (!user || !conversationId) return;

    async function loadContext() {
      const { data: profile } = await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url, workspace_id")
        .eq("user_id", user!.id)
        .limit(1)
        .single();

      if (profile) {
        setProfileId(profile.profile_id);
        setProfileName(profile.display_name || "Meg");
        setProfileAvatarUrl(profile.avatar_url);
        setWorkspaceId(profile.workspace_id);
      }

      // Load channel info from the channel table
      const { data: conv } = await supabase
        .from("channel")
        .select("name, channel_type, workspace_id")
        .eq("id", conversationId!)
        .single();

      if (conv) {
        setConversationName(conv.name ?? "Samtale");
      }

      // Get active member count from channel_member
      const { count } = await supabase
        .from("channel_member")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", conversationId!)
        .is("left_at", null);

      setMemberCount(count ?? 0);
    }

    loadContext();
  }, [user, conversationId]);

  const channelPrefix = conversationName.startsWith("#") ? "" : "#";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
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
            {memberCount > 0 && (
              <Text style={styles.headerSubtitle}>
                {memberCount} {memberCount === 1 ? "medlem" : "medlemmer"}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
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
          <Pressable
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Søk"
          >
            <Search size={20} color={theme.colors.foreground} strokeWidth={1.6} />
          </Pressable>
        </View>
      </View>

      {/* Messages + composer (shared body) */}
      <ConversationBody
        channelId={conversationId ?? ""}
        profileId={profileId}
        profileName={profileName}
        profileAvatarUrl={profileAvatarUrl}
        workspaceId={workspaceId}
        composerStyle={{ paddingBottom: isConnected ? 0 : insets.bottom || 8 }}
      />

      {/* Active Call Bar — shown at bottom when in a call */}
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

      {/* Call Sheet — expanded view */}
      {isConnected && isCallSheetOpen && callSession && (
        <CallSheet
          room={room}
          channelName={conversationName}
          channelId={conversationId ?? ""}
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
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.element,
    borderBottomWidth: 0.5,
    borderBottomColor: withOpacity(theme.colors.brandOrange, 0.1),
    backgroundColor: withOpacity(theme.colors.background, 0.88),
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  headerInfo: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.brandOrange,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
}));
