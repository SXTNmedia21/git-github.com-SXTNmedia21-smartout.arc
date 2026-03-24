import React from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Camera, User } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type VideoCallOverlayProps = {
  active: boolean;
  participantName: string;
  onEndCall: () => void;
};

export function VideoCallOverlay({ active, participantName, onEndCall }: VideoCallOverlayProps) {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [micOn, setMicOn] = React.useState(true);
  const [videoOn, setVideoOn] = React.useState(true);

  if (!active) return null;

  return (
    <View style={styles.container}>
      {/* Main Remote Video Placeholder */}
      <View style={styles.remoteVideo}>
        <View style={styles.avatarPlaceholder}>
          <User size={64} color={theme.colors.mutedForeground} />
        </View>
        <View style={[styles.nameBadge, { top: insets.top + 16 }]}>
          <Text style={styles.nameText}>{participantName}</Text>
          <Text style={styles.statusText}>00:14</Text>
        </View>
      </View>

      {/* Local PIP Video Placeholder */}
      {videoOn && (
        <View style={[styles.localVideo, { bottom: insets.bottom + 100 }]}>
          <View style={styles.avatarPlaceholderLocal}>
            <Camera size={24} color={theme.colors.primaryForeground} />
          </View>
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Pressable
          style={[styles.controlButton, !micOn && styles.controlButtonOff]}
          onPress={() => setMicOn(!micOn)}
        >
          {micOn ? (
            <Mic size={24} color={theme.colors.primaryForeground} />
          ) : (
            <MicOff size={24} color={theme.colors.primary} />
          )}
        </Pressable>

        <Pressable
          style={[styles.controlButton, !videoOn && styles.controlButtonOff]}
          onPress={() => setVideoOn(!videoOn)}
        >
          {videoOn ? (
            <Video size={24} color={theme.colors.primaryForeground} />
          ) : (
            <VideoOff size={24} color={theme.colors.primary} />
          )}
        </Pressable>

        <Pressable style={styles.endCallButton} onPress={onEndCall}>
          <PhoneOff size={24} color={theme.colors.primaryForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
    zIndex: 1000,
    elevation: 1000,
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  nameBadge: {
    position: "absolute",
    left: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
  },
  nameText: {
    ...theme.typography.subheadline,
    color: "#ffffff",
    fontWeight: "600",
  },
  statusText: {
    ...theme.typography.caption,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  localVideo: {
    position: "absolute",
    right: 24,
    width: 100,
    height: 150,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  avatarPlaceholderLocal: {
    opacity: 0.5,
  },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingTop: 24,
    backgroundColor: "transparent",
    // simple gradient logic can be done with LinearGradient if we had expo-linear-gradient,
    // but a semi-transparent view works for mock
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtonOff: {
    backgroundColor: theme.colors.secondary,
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.destructive,
    alignItems: "center",
    justifyContent: "center",
  },
}));
