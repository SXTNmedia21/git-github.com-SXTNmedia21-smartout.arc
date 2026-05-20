/**
 * SwapStatusBadge — Colored pill showing the swap request status.
 *
 * Maps swap status strings to semantic colors:
 * pending_recipient → amber (warning), pending_manager → blue (info),
 * approved → green (success), rejected → red (destructive), cancelled → gray (muted).
 *
 * All colors come from Nordic Split design tokens via theme.colors.*
 * No hex literals — audit-B HIGH fix (2026-05-20).
 */

import React from "react";
import { View, Text } from "react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";

type SwapStatus =
  | "pending_recipient"
  | "pending_manager"
  | "approved"
  | "rejected"
  | "cancelled"
  | "executed";

type SwapStatusBadgeProps = {
  status: SwapStatus;
};

type ColorKey = "amber" | "blue" | "green" | "red" | "gray";

const STATUS_CONFIG: Record<SwapStatus, { label: string; colorKey: ColorKey }> = {
  pending_recipient: { label: "Venter på svar", colorKey: "amber" },
  pending_manager: { label: "Venter på leder", colorKey: "blue" },
  approved: { label: "Godkjent", colorKey: "green" },
  rejected: { label: "Avslått", colorKey: "red" },
  cancelled: { label: "Kansellert", colorKey: "gray" },
  executed: { label: "Utført", colorKey: "green" },
};

export function SwapStatusBadge({ status }: SwapStatusBadgeProps) {
  const theme = useTheme();
  const styles = useStyles();
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.cancelled;

  // Map colorKey to Nordic Split semantic tokens — no hex literals.
  // warning/info/success/destructive come from nativeTheme.light|dark.
  // Gray ("cancelled") uses muted tokens (no dedicated neutral status token).
  const colorTokens: Record<ColorKey, { bg: string; dot: string; text: string }> = {
    amber: {
      bg: withOpacity(theme.colors.warning, 0.12),
      dot: theme.colors.warning,
      text: theme.colors.warningForeground,
    },
    blue: {
      bg: withOpacity(theme.colors.info, 0.12),
      dot: theme.colors.info,
      text: theme.colors.infoForeground,
    },
    green: {
      bg: withOpacity(theme.colors.success, 0.12),
      dot: theme.colors.success,
      text: theme.colors.successForeground,
    },
    red: {
      bg: withOpacity(theme.colors.destructive, 0.12),
      dot: theme.colors.destructive,
      text: theme.colors.destructiveForeground,
    },
    // "cancelled" has no dedicated swap-status token — muted is the closest neutral.
    // TODO(nordic-split): introduce dedicated token if cancelled state becomes prominent.
    gray: {
      bg: withOpacity(theme.colors.mutedForeground, 0.12),
      dot: theme.colors.mutedForeground,
      text: theme.colors.mutedForeground,
    },
  };

  const colors = colorTokens[config.colorKey];

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <View style={[styles.dot, { backgroundColor: colors.dot }]} />
      <Text style={[styles.label, { color: colors.text }]}>{config.label}</Text>
    </View>
  );
}

const useStyles = createStyles(() => ({
  badge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
}));
