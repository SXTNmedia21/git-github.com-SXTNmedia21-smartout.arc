/**
 * QuickActions — Animated menu that appears above the AI FAB on swipe-up.
 *
 * Actions change based on the current shift phase:
 * - during_shift: Punch ut, Oppgaver, Avvik, Ring leder
 * - before_shift: Skiftkort, Day brief, Bekreft vakt
 * - after_shift: Handoff, Bekreft timer
 * - no_shift: Neste vakt, Meldinger
 *
 * Each action is a shortcut to a specific modal or scroll target.
 * The menu is NOT navigation — it triggers actions within the current context.
 */

import React, { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { createStyles, withOpacity } from "@/theme";
import type { ShiftPhase } from "@/lib/shift-phase";

type QuickAction = {
  key: string;
  label: string;
  icon: string;
};

/** Phase-specific action sets as defined in the design spec */
const PHASE_ACTIONS: Record<ShiftPhase, QuickAction[]> = {
  during_shift: [
    { key: "punch_out", label: "Punch ut", icon: "⏹" },
    { key: "tasks", label: "Oppgaver", icon: "📋" },
    { key: "deviation", label: "Avvik", icon: "⚠️" },
    { key: "call_leader", label: "Ring leder", icon: "📞" },
  ],
  before_shift: [
    { key: "shift_card", label: "Skiftkort", icon: "📄" },
    { key: "day_brief", label: "Day brief", icon: "📊" },
    { key: "confirm_shift", label: "Bekreft vakt", icon: "✓" },
  ],
  after_shift: [
    { key: "handoff", label: "Handoff", icon: "📝" },
    { key: "confirm_hours", label: "Bekreft timer", icon: "⏱" },
  ],
  no_shift: [
    { key: "next_shift", label: "Neste vakt", icon: "📅" },
    { key: "messages", label: "Meldinger", icon: "💬" },
  ],
};

type QuickActionsProps = {
  /** Current shift phase — drives which actions are shown */
  phase: ShiftPhase;
  /** Whether the menu is visible */
  visible: boolean;
  /** Called when an action is pressed. Key identifies the action. */
  onAction: (actionKey: string) => void;
  /** Called when the backdrop is tapped to dismiss */
  onDismiss: () => void;
  /** Animated visibility value (0 = hidden, 1 = visible) */
  visibility: SharedValue<number>;
};

export function QuickActions({
  phase,
  visible,
  onAction,
  onDismiss,
  visibility,
}: QuickActionsProps) {
  const styles = useStyles();
  const actions = PHASE_ACTIONS[phase];

  const containerStyle = useAnimatedStyle(() => ({
    opacity: visibility.value,
    transform: [
      { translateY: (1 - visibility.value) * 20 },
      { scale: 0.95 + visibility.value * 0.05 },
    ],
    pointerEvents: visibility.value > 0.5 ? "auto" : "none",
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: visibility.value * 0.3,
    pointerEvents: visibility.value > 0.1 ? "auto" : "none",
  }));

  if (!visible) return null;

  return (
    <>
      {/* Backdrop tap to dismiss */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.backdropPress} onPress={onDismiss} />
      </Animated.View>

      {/* Action buttons */}
      <Animated.View style={[styles.container, containerStyle]}>
        {actions.map((action, index) => (
          <Animated.View key={action.key}>
            <Pressable
              style={styles.actionButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAction(action.key);
              }}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </Animated.View>
    </>
  );
}

const useStyles = createStyles((theme) => ({
  backdrop: {
    ...{
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    backgroundColor: "#000000",
  },
  backdropPress: {
    flex: 1,
  },
  container: {
    position: "absolute",
    bottom: 90,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: theme.spacing.tight,
    paddingHorizontal: theme.spacing.page,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    backgroundColor: theme.colors.card,
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.card,
    borderRadius: theme.radius.lg,
    minWidth: 200,
    ...theme.shadows.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
}));
