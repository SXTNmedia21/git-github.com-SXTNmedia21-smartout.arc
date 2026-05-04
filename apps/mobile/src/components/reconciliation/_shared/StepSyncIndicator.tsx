/**
 * StepSyncIndicator — per-step save state.
 *
 * States: idle | saving | saved | queued | error.
 * `saved` fades in a Check icon over 400ms; all other states show a
 * small text label. Non-blocking — this is an ambient signal, not a
 * modal.
 */
import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
import { Check, WifiOff, AlertTriangle, Loader2 } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";

export type SyncState = "idle" | "saving" | "saved" | "queued" | "error";

export type StepSyncIndicatorProps = {
  state: SyncState;
};

export function StepSyncIndicator({ state }: StepSyncIndicatorProps) {
  const styles = useStyles();
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(state === "saved" ? 0 : 1)).current;

  useEffect(() => {
    if (state === "saved") {
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      opacity.setValue(1);
    }
  }, [state, opacity]);

  if (state === "idle") return null;

  const iconFor = (): React.ReactNode => {
    const size = 14;
    switch (state) {
      case "saving":
        return <Loader2 size={size} color={theme.colors.mutedForeground} />;
      case "saved":
        return <Check size={size} color={theme.colors.success} />;
      case "queued":
        return <WifiOff size={size} color={theme.colors.warnSoftForeground} />;
      case "error":
        return <AlertTriangle size={size} color={theme.colors.destructive} />;
    }
  };

  const label: Record<SyncState, string> = {
    idle: "",
    saving: "Lagrer…",
    saved: "Lagret",
    queued: "Venter på nett",
    error: "Feilet — prøv igjen",
  };

  return (
    <Animated.View style={[styles.container, { opacity }]} accessibilityLiveRegion="polite">
      {iconFor()}
      <Text style={[styles.label, styles[`label_${state}`]]}>{label[state]}</Text>
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  label_idle: { color: theme.colors.mutedForeground },
  label_saving: { color: theme.colors.mutedForeground },
  label_saved: { color: theme.colors.success },
  label_queued: { color: theme.colors.warnSoftForeground },
  label_error: { color: theme.colors.destructive },
}));
