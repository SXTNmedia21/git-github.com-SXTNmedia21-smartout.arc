/**
 * GroupCallBanner — Banner shown in channel view when a group call is active.
 * Displays participant count with a "Bli med" (Join) button.
 */
import React from "react";
import { View, Text, Pressable } from "react-native";
import { Phone } from "lucide-react-native";
import { createStyles } from "@/theme";

type Props = {
  participantCount: number;
  initiatorName: string;
  onJoin: () => void;
};

export function GroupCallBanner({ participantCount, initiatorName, onJoin }: Props) {
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <View style={styles.dot} />
        <Text style={styles.text} numberOfLines={1}>
          {initiatorName} startet samtale ({participantCount})
        </Text>
      </View>

      <Pressable
        onPress={onJoin}
        style={({ pressed }) => [styles.joinButton, pressed && styles.joinPressed]}
        accessibilityRole="button"
        accessibilityLabel="Bli med i samtale"
      >
        <Phone size={14} color="#fff" />
        <Text style={styles.joinText}>Bli med</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    marginHorizontal: theme.spacing.card,
    marginVertical: theme.spacing.xs,
  },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    flex: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4ade80",
  },
  text: {
    ...theme.typography.caption,
    color: "#fff",
    fontWeight: theme.fontWeights.medium,
    flex: 1,
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: theme.spacing.element,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  joinPressed: {
    opacity: 0.7,
  },
  joinText: {
    ...theme.typography.caption,
    color: "#fff",
    fontWeight: theme.fontWeights.bold,
  },
}));
