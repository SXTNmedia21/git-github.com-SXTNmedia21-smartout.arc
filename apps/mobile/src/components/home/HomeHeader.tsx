/**
 * HomeHeader — Clean, minimal header with depth.
 *
 * Design principles:
 * - Monochrome base, brand orange only for primary CTA
 * - Subtle shadows for depth instead of colored backgrounds
 * - Clear hierarchy: avatar → greeting → actions (descending importance)
 * - Quick actions are subtle icons, not competing colored circles
 */

import React, { useMemo, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { Menu, Bell, CheckSquare, GraduationCap, AlertTriangle, Clock } from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
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
  route: string;
};

const QUICK_ACTIONS: QuickActionItem[] = [
  { key: "tasks", label: "Oppgaver", icon: CheckSquare, route: "/(app)/(home)/haccp" },
  { key: "training", label: "Opplaering", icon: GraduationCap, route: "/(app)/(me)" },
  { key: "deviation", label: "Avvik", icon: AlertTriangle, route: "/(app)/(home)/deviation" },
  { key: "punch", label: "Stempling", icon: Clock, route: "/(app)/(home)/punch-clock" },
];

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return strings.home.goodMorning;
  if (hour >= 12 && hour < 17) return strings.home.goodAfternoon;
  if (hour >= 17 && hour < 22) return strings.home.goodEvening;
  return strings.home.goodNight;
}

/** Minimal quick action button — monochrome, no colored circles */
function QuickActionButton({ action, index }: { action: QuickActionItem; index: number }) {
  const styles = useActionStyles();
  const router = useRouter();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const IconComponent = action.icon;

  return (
    <Animated.View
      entering={FadeInDown.delay(300 + index * 60)
        .duration(350)
        .springify()}
    >
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(action.route as never);
          }}
          onPressIn={() => {
            scale.value = withSpring(0.88, { damping: 10, stiffness: 300 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 8, stiffness: 200 });
          }}
          style={styles.actionItem}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <View style={styles.actionCircle}>
            <IconComponent size={20} color={styles.iconColor.color} strokeWidth={1.6} />
          </View>
          <Text style={styles.actionLabel} numberOfLines={1}>
            {action.label}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export function HomeHeader({
  displayName,
  avatarUrl,
  onMenuPress,
  onNotificationPress,
}: HomeHeaderProps) {
  const styles = useStyles();
  const greeting = useMemo(() => getTimeGreeting(), []);
  const firstName = displayName.split(" ")[0];
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.topBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onMenuPress?.();
          }}
          style={styles.topBarButton}
          accessibilityRole="button"
          accessibilityLabel="Meny"
        >
          <Menu size={22} color={styles.topBarIconColor.color} strokeWidth={1.6} />
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
          <Bell size={22} color={styles.topBarIconColor.color} strokeWidth={1.6} />
        </Pressable>
      </Animated.View>

      {/* Avatar — the hero element */}
      <Animated.View entering={FadeInDown.delay(80).duration(500).springify().damping(12)}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/(app)/(me)");
          }}
          style={styles.avatarContainer}
          accessibilityRole="button"
          accessibilityLabel="Profil"
        >
          <Avatar name={displayName} imageUrl={avatarUrl} size="xl" style={styles.avatar} />
        </Pressable>
      </Animated.View>

      {/* Greeting — secondary, understated */}
      <Animated.View entering={FadeInDown.delay(180).duration(400).springify()}>
        <Text style={styles.greeting}>
          {greeting}, {firstName}
        </Text>
      </Animated.View>

      {/* Quick actions — subtle, monochrome */}
      <View style={styles.actionsRow}>
        {QUICK_ACTIONS.map((action, i) => (
          <QuickActionButton key={action.key} action={action} index={i} />
        ))}
      </View>
    </View>
  );
}

const useActionStyles = createStyles((theme) => ({
  actionItem: {
    alignItems: "center",
    gap: 6,
    width: 64,
  },
  actionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
  iconColor: {
    color: theme.isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
  },
  actionLabel: {
    ...theme.typography.micro,
    color: theme.colors.mutedForeground,
    textAlign: "center",
  },
}));

const useStyles = createStyles((theme) => ({
  container: {
    paddingBottom: theme.spacing.section,
    alignItems: "center",
  },
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
    color: theme.isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
  },
  avatarContainer: {
    marginBottom: theme.spacing.element,
  },
  avatar: {
    ...theme.shadows.md,
  },
  greeting: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    textAlign: "center",
    marginBottom: theme.spacing.section,
    paddingHorizontal: theme.spacing.card,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: theme.spacing.md,
  },
}));
