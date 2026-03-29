/**
 * ActiveNowRow — Horizontal avatar strip showing online colleagues.
 *
 * Placed below the channel header. Each avatar has a green online dot
 * and the person's first name. Tapping opens/creates a DM.
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
  const truncated = firstName.length > 8 ? firstName.slice(0, 7) + "\u2026" : firstName;

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

  if (profiles.length === 0) return null;

  return (
    <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.container}>
      <Text style={styles.label}>AKTIVE NÅ</Text>
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
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: withOpacity(theme.colors.border, 0.08),
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
    paddingHorizontal: theme.spacing.section,
    marginBottom: theme.spacing.element,
  },
  list: {
    paddingHorizontal: theme.spacing.section,
    gap: 16,
  },
  item: {
    alignItems: "center",
    gap: 4,
    width: 56,
  },
  itemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  avatarWrapper: {
    position: "relative",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  name: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
    textAlign: "center",
  },
}));
