/**
 * ActiveSessionCard — Card for an active shift channel in the "AKTIVE VAKTER" strip.
 *
 * Prototype parity: docs/design/smartout-design-helpdesk/project/prototype/chat-screens.jsx:156-197
 *
 * Layout: dept-tinted 38×38 circle (10% opacity brand-orange) with dept icon
 * 18 in brand-orange → channel name + timestamp row → sender + preview
 * truncated → unread (7×7 orange dot with glow + count 10 weight 700).
 *
 * The card is a thin presentational component — channel/icon/dept resolution
 * is the caller's concern so the same card can render a session, a hot
 * channel, or any other "live right now" list entry.
 */

import React, { useCallback } from "react";
import { View, Text, Pressable, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import type { LucideIcon } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";

export type ActiveSessionCardProps = {
  icon: LucideIcon;
  channel: string;
  time: string;
  sender: string;
  preview: string;
  unread?: number;
  onPress?: () => void;
  style?: ViewStyle;
};

export function ActiveSessionCard({
  icon: Icon,
  channel,
  time,
  sender,
  preview,
  unread = 0,
  onPress,
  style,
}: ActiveSessionCardProps) {
  const styles = useStyles();
  const theme = useTheme();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
      accessibilityRole="button"
      accessibilityLabel={`${channel}, ${unread} uleste`}
    >
      <View style={styles.iconCircle}>
        <Icon size={18} color={theme.colors.brandOrange} strokeWidth={1.6} />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.channel} numberOfLines={1}>
            {channel}
          </Text>
          <Text style={styles.timestamp}>{time}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {sender}: {preview}
        </Text>
      </View>

      {unread > 0 && (
        <View style={styles.unreadCol}>
          <View style={styles.glowDot} />
          <Text style={styles.unreadCount}>{unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.8) : theme.colors.background,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.5),
    borderRadius: 10,
    ...theme.shadows.sm,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  channel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "600",
    color: theme.colors.foreground,
    letterSpacing: -0.15,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.5,
    color: theme.colors.mutedForeground,
  },
  preview: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
  },
  unreadCol: {
    alignItems: "center",
    gap: 3,
  },
  glowDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: theme.colors.brandOrange,
    // Simulates prototype's box-shadow glow. shadowOffset 0/0 radiates outward.
    shadowColor: theme.colors.brandOrange,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  unreadCount: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.brandOrange,
  },
}));
