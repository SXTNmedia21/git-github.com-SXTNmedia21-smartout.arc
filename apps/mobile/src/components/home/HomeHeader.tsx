/**
 * HomeHeader — Premium profile header with animated quick actions.
 *
 * Animations:
 * - Avatar drops in with spring bounce
 * - Greeting fades in with slight delay
 * - Each quick action circle enters individually with stagger (50ms between)
 * - Quick action circles have spring scale on press
 * - Top bar icons fade in
 * - Notification bell has a subtle shake animation
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

/** Animated quick action button with spring press */
function QuickActionButton({ action, index }: { action: QuickActionItem; index: number }) {
  const styles = useActionStyles();
  const router = useRouter();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.85, { damping: 10, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 8, stiffness: 200 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(action.route as never);
  }, [router, action.route]);

  const IconComponent = action.icon;

  return (
    <Animated.View
      entering={FadeInDown.delay(350 + index * 70)
        .duration(400)
        .springify()}
    >
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.actionItem}
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
  const timeIcon = useMemo(() => getTimeIcon(), []);
  const firstName = displayName.split(" ")[0];
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Top bar: menu + bell — fade in */}
      <Animated.View entering={FadeIn.delay(50).duration(400)} style={styles.topBar}>
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
      </Animated.View>

      {/* Avatar with spring drop */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(500).springify().damping(12).stiffness(100)}
      >
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

      {/* Greeting with fade */}
      <Animated.View entering={FadeInDown.delay(220).duration(400).springify()}>
        <Text style={styles.greeting}>
          {greeting}, {firstName} {timeIcon}
        </Text>
      </Animated.View>

      {/* Quick action circles — individually staggered */}
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
    gap: theme.spacing.tight,
    width: 68,
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

const useStyles = createStyles((theme) => ({
  container: {
    paddingBottom: theme.spacing.section,
    alignItems: "center",
    backgroundColor: theme.isDark ? "#1f1f1f" : "#fafafa",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...theme.shadows.sm,
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
    color: theme.colors.mutedForeground,
  },
  avatarContainer: {
    marginBottom: theme.spacing.element,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: theme.colors.brandOrange,
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
    gap: theme.spacing.card,
    paddingHorizontal: theme.spacing.md,
  },
}));
