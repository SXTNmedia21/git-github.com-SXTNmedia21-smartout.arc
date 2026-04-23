/**
 * OfflineQueuePill — compact pill shown at the top of the wizard when
 * the offline queue holds any unsaved step. Uses the warn-soft token.
 * Auto-dismisses once the queue drains — the parent decides via `visible`.
 */
import React from "react";
import { View, Text } from "react-native";
import { WifiOff } from "lucide-react-native";
import { createStyles } from "@/theme";

export type OfflineQueuePillProps = {
  visible: boolean;
  /** Optional queue depth; shown as " · N" when > 0. */
  queueDepth?: number;
};

export function OfflineQueuePill({ visible, queueDepth }: OfflineQueuePillProps) {
  const styles = useStyles();
  if (!visible) return null;
  const depthSuffix = typeof queueDepth === "number" && queueDepth > 0 ? ` · ${queueDepth}` : "";
  return (
    <View
      style={styles.pill}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Offline — ${queueDepth ?? 0} steg venter på sync`}
    >
      <WifiOff size={14} color={styles.icon.color as string} />
      <Text style={styles.text}>Gjemmes lokalt · synkes når online{depthSuffix}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.element,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.warnSoft,
  },
  icon: {
    color: theme.colors.warnSoftForeground,
  },
  text: {
    ...theme.typography.caption,
    color: theme.colors.warnSoftForeground,
  },
}));
