/**
 * SwapStatusBadge — Colored pill showing the swap request status.
 *
 * Maps swap status strings to semantic colors:
 * pending_recipient → amber, pending_manager → blue,
 * approved → green, rejected → red, cancelled → gray.
 */

import React from "react";
import { View, Text } from "react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";

type SwapStatus = "pending_recipient" | "pending_manager" | "approved" | "rejected" | "cancelled" | "executed";

type SwapStatusBadgeProps = {
  status: SwapStatus;
};

const STATUS_CONFIG: Record<SwapStatus, { label: string; colorKey: "amber" | "blue" | "green" | "red" | "gray" }> = {
  pending_recipient: { label: "Venter på svar", colorKey: "amber" },
  pending_manager: { label: "Venter på leder", colorKey: "blue" },
  approved: { label: "Godkjent", colorKey: "green" },
  rejected: { label: "Avslått", colorKey: "red" },
  cancelled: { label: "Kansellert", colorKey: "gray" },
  executed: { label: "Utført", colorKey: "green" },
};

const COLOR_MAP = {
  amber: { bg: "rgba(245, 158, 11, 0.12)", dot: "#f59e0b", text: "#d97706" },
  blue: { bg: "rgba(59, 130, 246, 0.12)", dot: "#3b82f6", text: "#2563eb" },
  green: { bg: "rgba(34, 197, 94, 0.12)", dot: "#22c55e", text: "#16a34a" },
  red: { bg: "rgba(239, 68, 68, 0.12)", dot: "#ef4444", text: "#dc2626" },
  gray: { bg: "rgba(156, 163, 175, 0.12)", dot: "#9ca3af", text: "#6b7280" },
};

export function SwapStatusBadge({ status }: SwapStatusBadgeProps) {
  const styles = useStyles();
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.cancelled;
  const colors = COLOR_MAP[config.colorKey];

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
