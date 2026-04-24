/**
 * DMItem — Direct message row in the DIREKTE section.
 *
 * Prototype parity: docs/design/smartout-design-helpdesk/project/prototype/chat-screens.jsx:234-270
 *
 * Unread variant: card background + hairline border + tiny shadow, preview in
 * brand-orange weight 500. Read variant: muted background, no shadow,
 * preview dimmed at 0.6. Dim (archived) state reduces opacity to 0.7.
 *
 * Avatar renders a small green online dot when `unread` is true.
 */

import React, { useCallback } from "react";
import { View, Text, Pressable, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles, withOpacity } from "@/theme";
import { Avatar } from "@/components/common/Avatar";

export type DMItemProps = {
  name: string;
  time: string;
  preview: string;
  imageUrl?: string | null;
  unread?: boolean;
  read?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
};

export function DMItem({
  name,
  time,
  preview,
  imageUrl,
  unread = false,
  read = false,
  onPress,
  onLongPress,
  style,
}: DMItemProps) {
  const styles = useStyles();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.card,
        unread ? styles.cardUnread : styles.cardRead,
        read && styles.cardDim,
        pressed && styles.cardPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <View style={styles.avatarWrapper}>
        <Avatar name={name} imageUrl={imageUrl} size="md" />
        {unread && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, read && styles.nameRead]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.timestamp}>{time}</Text>
        </View>
        <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
          {preview}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  cardUnread: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.background,
    borderColor: withOpacity(theme.colors.border, 0.5),
    ...theme.shadows.sm,
  },
  cardRead: {
    backgroundColor: theme.colors.muted,
    borderColor: withOpacity(theme.colors.border, 0.3),
  },
  cardDim: {
    opacity: 0.7,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  avatarWrapper: {
    position: "relative",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.background,
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
  name: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "600",
    color: theme.colors.foreground,
    marginRight: 8,
  },
  nameRead: {
    color: theme.colors.mutedForeground,
  },
  timestamp: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.5,
    color: theme.colors.mutedForeground,
  },
  preview: {
    fontSize: 13,
    color: withOpacity(theme.colors.mutedForeground, 0.75),
  },
  previewUnread: {
    color: theme.colors.brandOrange,
    fontWeight: "500",
  },
}));
