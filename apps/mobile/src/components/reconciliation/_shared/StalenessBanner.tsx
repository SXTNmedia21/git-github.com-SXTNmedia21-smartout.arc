/**
 * StalenessBanner — top-of-step card warning the shift leader that
 * data may no longer reflect current reality.
 *
 * Shown when a wizard step's last_touched_at is more than 1 hour old
 * (render site decides the threshold). Copy: "Sist redigert Xt Ymin
 * siden — sjekk at tallene fortsatt stemmer." Color: warn-soft surface
 * + warn-soft foreground (M2 Phase A tokens).
 *
 * Accessibility: `accessibilityRole="alert"` so VO announces it as
 * soon as the step mounts.
 */
import React from "react";
import { View, Text } from "react-native";
import { AlertCircle } from "lucide-react-native";
import { createStyles } from "@/theme";

export type StalenessBannerProps = {
  /** Minutes since the step was last edited. */
  staleMinutes: number;
  /** Optional custom message — defaults to the canonical Norwegian copy. */
  message?: string;
};

function formatStale(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}min siden`;
  const h = Math.floor(m / 60);
  const rest = m - h * 60;
  return rest === 0 ? `${h}t siden` : `${h}t ${rest}min siden`;
}

export function StalenessBanner({ staleMinutes, message }: StalenessBannerProps) {
  const styles = useStyles();
  const text =
    message ?? `Sist redigert ${formatStale(staleMinutes)} — sjekk at tallene fortsatt stemmer.`;
  return (
    <View style={styles.container} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <AlertCircle size={18} color={styles.icon.color as string} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    backgroundColor: theme.colors.warnSoft,
    paddingVertical: theme.spacing.tight,
    paddingHorizontal: theme.spacing.element,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.element,
  },
  icon: {
    color: theme.colors.warnSoftForeground,
  },
  text: {
    flex: 1,
    color: theme.colors.warnSoftForeground,
    ...theme.typography.subheadline,
  },
}));
