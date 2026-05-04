/**
 * ActiveNowRow — Horizontal "AKTIVE NÅ" avatar strip.
 *
 * Prototype parity: docs/design/smartout-design-helpdesk/project/prototype/chat-screens.jsx:74-97
 *
 * Each tile: 48pt avatar + 10pt green online dot (2pt background-ring) +
 * first name (11pt weight 500, foreground). Section label above the row in
 * the uppercase 1.5px-letter-spaced muted style.
 *
 * Placed below the chat header. Tap opens/creates a DM for the target
 * profile — consumer owns the DM creation hook.
 */

import React from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import { type OnlineProfile } from "@/hooks/realtime/use-online-profiles";

type ActiveNowRowProps = {
  profiles: OnlineProfile[];
  onPress: (profileId: string, displayName: string) => void;
};

function ActiveNowItem({ profile, onPress }: { profile: OnlineProfile; onPress: () => void }) {
  const styles = useStyles();

  const firstName = (profile.displayName ?? "").split(" ")[0] || "?";
  const truncated = firstName.length > 8 ? firstName.slice(0, 7) + "…" : firstName;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Chat med ${profile.displayName}`}
    >
      <View style={styles.avatarWrapper}>
        <Avatar name={profile.displayName} imageUrl={profile.avatarUrl} size="md" />
        <View style={styles.onlineDot} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {truncated}
      </Text>
    </Pressable>
  );
}

export function ActiveNowRow({ profiles, onPress }: ActiveNowRowProps) {
  const styles = useStyles();
  const theme = useTheme();

  if (profiles.length === 0) return null;

  return (
    <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.container}>
      <View style={styles.labelWrap}>
        <Text style={styles.label}>AKTIVE NÅ</Text>
      </View>
      <FlatList
        horizontal
        data={profiles}
        keyExtractor={(item) => item.profileId}
        renderItem={({ item }) => (
          <ActiveNowItem profile={item} onPress={() => onPress(item.profileId, item.displayName)} />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    paddingTop: 10,
    paddingBottom: 16,
  },
  labelWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: withOpacity(theme.colors.mutedForeground, 0.5),
  },
  list: {
    paddingHorizontal: 16,
    gap: 14,
  },
  item: {
    width: 56,
    alignItems: "center",
    gap: 6,
  },
  itemPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
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
  name: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.foreground,
    textAlign: "center",
  },
}));
