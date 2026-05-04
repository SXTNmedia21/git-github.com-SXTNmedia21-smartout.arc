/**
 * SkrankeRow — Skranke queue row.
 *
 * Prototype parity: docs/design/smartout-design-helpdesk/project/prototype/chat-screens.jsx:321-349
 *
 * Layout: 40pt LighthouseAvatar halo=idle → name + time (mono) →
 * 2-line summary (clamped) → desk tag in brand-orange mono. Waiting state
 * gets a pulsing 12pt waiting Orb on the right edge. Dim state reduces
 * opacity to 0.55 for resolved tickets.
 */

import React, { useCallback } from "react";
import { View, Text, Pressable, Platform, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { LighthouseAvatar, Orb } from "@/components/orb";

export type SkrankeRowProps = {
  name: string;
  desk: string;
  summary: string;
  time: string;
  waiting?: boolean;
  dim?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function SkrankeRow({
  name,
  desk,
  summary,
  time,
  waiting = false,
  dim = false,
  onPress,
  style,
}: SkrankeRowProps) {
  const styles = useStyles();
  const theme = useTheme();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        dim && styles.rowDim,
        pressed && styles.rowPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${desk}, ${summary}`}
    >
      <View style={styles.avatarSlot}>
        <LighthouseAvatar name={name} size={40} halo="idle" />
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.time}>{time}</Text>
        </View>

        <Text style={styles.summary} numberOfLines={2}>
          {summary}
        </Text>

        <Text
          style={[styles.desk, { color: withOpacity(theme.colors.brandOrange, 0.8) }]}
          numberOfLines={1}
        >
          {desk}
        </Text>
      </View>

      {waiting && (
        <View style={styles.orbSlot}>
          <Orb size={12} status="waiting" pulse accessibilityLabel="Venter på svar" />
        </View>
      )}
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(theme.colors.border, 0.4),
  },
  rowDim: {
    opacity: 0.55,
  },
  rowPressed: {
    opacity: 0.75,
    backgroundColor: theme.colors.muted,
  },
  avatarSlot: {
    // LighthouseAvatar renders halo at 1.5x size, so clip with a 40pt-sized
    // positioning box to keep the row compact without the halo eating gap.
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 0,
  },
  name: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "600",
    color: theme.colors.foreground,
    marginRight: 8,
  },
  time: {
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 10.5,
    color: theme.colors.mutedForeground,
  },
  summary: {
    fontSize: 13.5,
    lineHeight: 19.5,
    color: theme.colors.mutedForeground,
  },
  desk: {
    marginTop: 2,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 10.5,
  },
  orbSlot: {
    paddingTop: 4,
  },
}));
