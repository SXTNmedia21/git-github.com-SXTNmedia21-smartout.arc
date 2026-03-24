/**
 * IncomingCallScreen — Full-screen overlay for incoming call invites.
 * Shows caller info with accept/reject buttons.
 * Triggers haptic feedback on incoming call.
 */
import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Phone, PhoneOff } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles, shadows } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import type { IncomingCall } from "@smartout/walkie-talkie";

type Props = {
  call: IncomingCall;
  onAccept: () => void;
  onReject: () => void;
};

export function IncomingCallScreen({ call, onAccept, onReject }: Props) {
  const styles = useStyles();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Avatar name={call.callerName} imageUrl={call.callerAvatar} size="lg" />
        <Text style={styles.callerName}>{call.callerName}</Text>
        <Text style={styles.subtitle}>Innkommende samtale</Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onReject}
            style={({ pressed }) => [styles.rejectButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Avvis"
          >
            <PhoneOff size={24} color="#fff" />
            <Text style={styles.buttonLabel}>Avvis</Text>
          </Pressable>

          <Pressable
            onPress={onAccept}
            style={({ pressed }) => [styles.acceptButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Svar"
          >
            <Phone size={24} color="#fff" />
            <Text style={styles.buttonLabel}>Svar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  overlay: {
    ...({ position: "absolute" } as const),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    alignItems: "center",
    gap: theme.spacing.element,
    width: "85%",
    ...shadows.lg,
  },
  callerName: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    fontWeight: theme.fontWeights.bold,
    textAlign: "center",
  },
  subtitle: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.card,
    marginTop: theme.spacing.element,
  },
  rejectButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  acceptButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonLabel: {
    ...theme.typography.caption,
    color: "#fff",
    fontWeight: theme.fontWeights.medium,
  },
}));
