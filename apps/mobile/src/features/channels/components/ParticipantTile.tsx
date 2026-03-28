/**
 * ParticipantTile — Renders one call participant as either a video tile or an avatar.
 *
 * Video variant: shows the camera track with a name overlay and a green speaking border.
 * Avatar variant: shows circular initials with a spring-driven amber glow when speaking.
 *
 * Supports small/large sizes, mic-off badge, AI badge, and accessibility labels.
 */
import React from "react";
import { View, Text, Platform } from "react-native";
import { MicOff } from "lucide-react-native";
import { createStyles } from "@/theme";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import type { ParticipantTrackInfo } from "@/hooks/use-call-tracks";
import { strings } from "@/constants/strings";

// VideoView uses native WebRTC — only available on iOS/Android
const VideoView =
  Platform.OS !== "web"
    ? require("@livekit/react-native").VideoView
    : ({ style }: { style?: unknown }) => <View style={style as never} />;

type Props = {
  participant: ParticipantTrackInfo;
  size?: "small" | "large";
};

// Nordic Split spring values — slow, organic motion
const SPRING_CONFIG = { stiffness: 35, damping: 22, mass: 2.2 };

export function ParticipantTile({ participant, size = "large" }: Props) {
  const styles = useStyles();
  const isSmall = size === "small";

  // Spring-driven glow: amber border + subtle scale when speaking
  const glowStyle = useAnimatedStyle(() => {
    const isSpeaking = participant.isSpeaking;
    return {
      borderWidth: withSpring(isSpeaking ? 3 : 0, SPRING_CONFIG),
      // rgba expressed as separate numeric values — Reanimated handles interpolation
      borderColor: isSpeaking ? "rgba(245, 158, 11, 0.9)" : "rgba(245, 158, 11, 0)",
      transform: [{ scale: withSpring(isSpeaking ? 1.04 : 1, SPRING_CONFIG) }],
    };
  }, [participant.isSpeaking]);

  // "(Du)" appended to the local participant's name so others can identify themselves
  const displayName = participant.isLocal
    ? `${participant.name} ${strings.call.youSuffix}`
    : participant.name;

  const speakingState = participant.isSpeaking ? strings.call.speaking : strings.call.silent;
  const accessibilityLabel = `${participant.name}, ${speakingState}`;

  // --- Video variant ---
  if (participant.videoTrack) {
    return (
      <View
        style={[styles.videoContainer, isSmall && styles.smallContainer]}
        accessibilityLabel={accessibilityLabel}
        accessible
      >
        <VideoView
          videoTrack={participant.videoTrack as import("livekit-client").VideoTrack}
          style={styles.videoView}
          mirror={participant.isLocal}
        />

        {/* Gradient-like name overlay at the bottom */}
        <View style={styles.nameOverlay}>
          <Text style={styles.nameText} numberOfLines={1}>
            {displayName}
          </Text>
          {!participant.isMicEnabled && <MicOff size={12} color="#fff" />}
        </View>

        {/* Green speaking border — absolute overlay, pointer-events none */}
        {participant.isSpeaking && <View style={styles.speakingBorder} />}
      </View>
    );
  }

  // --- Avatar variant ---
  return (
    <Animated.View
      style={[styles.avatarContainer, isSmall && styles.smallAvatarContainer, glowStyle]}
      accessibilityLabel={accessibilityLabel}
      accessible
    >
      {/* Circular avatar with initials */}
      <View style={[styles.avatar, isSmall && styles.smallAvatar]}>
        <Text style={[styles.initials, isSmall && styles.smallInitials]}>
          {participant.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Mic-off badge — top-right corner of the avatar */}
      {!participant.isMicEnabled && (
        <View style={styles.micOffBadge}>
          <MicOff size={10} color="#fff" />
        </View>
      )}

      {/* AI badge — top-left, shown for Botsson and other AI participants */}
      {participant.isAi && (
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      )}

      {/* Name below avatar */}
      <Text style={[styles.avatarName, isSmall && styles.smallAvatarName]} numberOfLines={1}>
        {displayName}
      </Text>
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  // --- Video variant ---
  videoContainer: {
    flex: 1,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: "#000",
    minHeight: 120,
  },
  smallContainer: {
    width: 100,
    height: 80,
    flex: 0,
  },
  videoView: {
    flex: 1,
  },
  nameOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    // Semi-transparent scrim so the name is readable over any video content
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  nameText: {
    ...theme.typography.caption,
    color: "#fff",
    flex: 1,
  },
  // Absolute overlay that draws the green speaking border without clipping the video
  speakingBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: "#22c55e",
    borderRadius: theme.radius.lg,
    // pointer-events not needed in RN but matches intent
  },

  // --- Avatar variant ---
  avatarContainer: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    // Default border values; Reanimated overwrites these via glowStyle
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: theme.radius.lg,
  },
  smallAvatarContainer: {
    paddingVertical: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  initials: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    fontWeight: theme.fontWeights.bold,
  },
  smallInitials: {
    ...theme.typography.subheadline,
  },
  // Red badge bottom-right of avatar — minimum 18×18 to stay tappable if needed
  micOffBadge: {
    position: "absolute",
    top: 6,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  // Primary-colored badge top-left for AI participants
  aiBadge: {
    position: "absolute",
    top: 6,
    left: -2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  aiBadgeText: {
    ...theme.typography.micro,
    color: "#fff",
    fontWeight: theme.fontWeights.bold,
  },
  avatarName: {
    ...theme.typography.caption,
    color: theme.colors.foreground,
    textAlign: "center",
    maxWidth: 80,
  },
  smallAvatarName: {
    ...theme.typography.micro,
    maxWidth: 60,
  },
}));
