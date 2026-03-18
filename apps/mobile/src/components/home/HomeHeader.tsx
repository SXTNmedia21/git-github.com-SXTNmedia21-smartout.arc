/**
 * HomeHeader — Premium profile header with quick actions.
 *
 * Design: Warm gradient-style header (dark → brand warmth) with:
 * - Top bar: hamburger menu (left) + notification bell (right)
 * - Centered large avatar with orange ring
 * - Dynamic greeting with time-of-day emoji
 * - 4 colored circular quick action buttons with labels
 *
 * Sits above the scrollable content on the home screen.
 */

import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { Menu, Bell, CheckSquare, GraduationCap, AlertTriangle, Clock } from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { createStyles } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import { strings } from "@/constants/strings";
import type { LucideIcon } from "lucide-react-native";

type HomeHeaderProps = {
  displayName: string;
  avatarUrl?: string | null;
  onMenuPress?: () => void;
  onNotificationPress?: () => void;
};

type QuickActionItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  route: string;
};

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    key: "tasks",
    label: "Oppgaver",
    icon: CheckSquare,
    color: "#e85c0d",
    route: "/(app)/(home)/haccp",
  },
  {
    key: "training",
    label: "Opplaering",
    icon: GraduationCap,
    color: "#3b82f6",
    route: "/(app)/(me)",
  },
  {
    key: "deviation",
    label: "Avvik",
    icon: AlertTriangle,
    color: "#22c55e",
    route: "/(app)/(home)/deviation",
  },
  {
    key: "punch",
    label: "Stempling",
    icon: Clock,
    color: "#06b6d4",
    route: "/(app)/(home)/punch-clock",
  },
];

function getTimeIcon(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "\u2600\uFE0F";
  if (hour >= 12 && hour < 17) return "\u26C5";
  if (hour >= 17 && hour < 21) return "\uD83C\uDF05";
  return "\uD83C\uDF19";
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return strings.home.goodMorning;
  if (hour >= 12 && hour < 17) return strings.home.goodAfternoon;
  if (hour >= 17 && hour < 22) return strings.home.goodEvening;
  return strings.home.goodNight;
}

export function HomeHeader({
  displayName,
  avatarUrl,
  onMenuPress,
  onNotificationPress,
}: HomeHeaderProps) {
  const styles = useStyles();
  const router = useRouter();
  const greeting = useMemo(() => getTimeGreeting(), []);
  const timeIcon = useMemo(() => getTimeIcon(), []);
  const firstName = displayName.split(" ")[0];

  return (
    <View style={styles.container}>
      {/* Top bar: menu + bell */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onMenuPress?.();
          }}
          style={styles.topBarButton}
          accessibilityRole="button"
          accessibilityLabel="Meny"
        >
          <Menu size={22} color={styles.topBarIconColor.color} strokeWidth={1.8} />
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onNotificationPress?.();
          }}
          style={styles.topBarButton}
          accessibilityRole="button"
          accessibilityLabel="Varsler"
        >
          <Bell size={22} color={styles.topBarIconColor.color} strokeWidth={1.8} />
        </Pressable>
      </View>

      {/* Centered avatar with entrance animation */}
      <Animated.View entering={FadeInDown.delay(100).duration(400).springify()}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/(app)/(me)");
          }}
          style={styles.avatarContainer}
          accessibilityRole="button"
          accessibilityLabel="Profil"
        >
          <View style={styles.avatarRing}>
            <Avatar name={displayName} imageUrl={avatarUrl} size="xl" />
          </View>
        </Pressable>
      </Animated.View>

      {/* Greeting */}
      <Animated.View entering={FadeInDown.delay(200).duration(400).springify()}>
        <Text style={styles.greeting}>
          {greeting}, {firstName} {timeIcon}
        </Text>
      </Animated.View>

      {/* Quick action circles */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(400).springify()}
        style={styles.actionsRow}
      >
        {QUICK_ACTIONS.map((action) => {
          const IconComponent = action.icon;
          return (
            <Pressable
              key={action.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(action.route as never);
              }}
              style={({ pressed }) => [styles.actionItem, pressed && styles.actionPressed]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <View style={[styles.actionCircle, { backgroundColor: action.color + "15" }]}>
                <IconComponent size={24} color={action.color} strokeWidth={1.8} />
              </View>
              <Text style={styles.actionLabel} numberOfLines={1}>
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    paddingBottom: theme.spacing.section,
    alignItems: "center",
    backgroundColor: theme.isDark ? "#1f1f1f" : "#fafafa",
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
    ...theme.shadows.sm,
  },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.tight,
    paddingBottom: theme.spacing.xs,
  },
  topBarButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  topBarIconColor: {
    color: theme.colors.mutedForeground,
  },

  /* Avatar with orange ring */
  avatarContainer: {
    marginBottom: theme.spacing.element,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: theme.colors.brandOrange,
  },

  /* Greeting */
  greeting: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    textAlign: "center",
    marginBottom: theme.spacing.section,
    paddingHorizontal: theme.spacing.card,
  },

  /* Quick actions */
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing.card,
    paddingHorizontal: theme.spacing.md,
  },
  actionItem: {
    alignItems: "center",
    gap: theme.spacing.tight,
    width: 68,
  },
  actionPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.93 }],
  },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    ...theme.typography.micro,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
    textAlign: "center",
  },
}));
