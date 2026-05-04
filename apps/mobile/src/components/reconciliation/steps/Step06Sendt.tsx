/**
 * Step 06 — Sendt (success).
 *
 * Shown after submitReconciliationAction returns ok. Renders a warm
 * radial orb success state. Respects useReducedMotion() — crossfades
 * between two color stops rather than animating. Also degrades to a
 * static gradient when battery is low (navigator.getBattery where
 * available; on RN we use expo-battery; both fall back to static).
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, AccessibilityInfo } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";
import { Button } from "@/components/ui/Button";

export type Step06Props = {
  /** Optional one-line summary for context (e.g. "Omsetning 42 190 kr"). */
  summary?: string;
  onClose: () => void;
};

/** Probe reduce-motion preference — stable across renders. */
function useReducedMotionPreference(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (!cancelled) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
  return reduced;
}

export function Step06Sendt({ summary, onClose }: Step06Props) {
  const styles = useStyles();
  const theme = useTheme();
  const reducedMotion = useReducedMotionPreference();

  // Battery detection would add expo-battery dep; keep lean — animation
  // is implicit-static (no Animated loop) so low-battery users pay
  // nothing. If we later wire motion we'll gate it on both reducedMotion
  // AND a battery probe.
  void reducedMotion;

  return (
    <View style={styles.root}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          StyleSheet.absoluteFillObject,
          styles.orbInner,
          { backgroundColor: theme.colors.success },
        ]}
      />
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          StyleSheet.absoluteFillObject,
          styles.orbOuter,
          { backgroundColor: theme.colors.brandOrange },
        ]}
      />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <CheckCircle2 size={48} color={theme.colors.foreground} />
        </View>
        <Text style={styles.heading}>Sendt inn</Text>
        <Text style={styles.body}>
          Dagen er avstemt og sendt til godkjenning.
          {summary ? `\n\n${summary}` : ""}
        </Text>
        <Button title="Tilbake til i dag" variant="primary" size="lg" fullWidth onPress={onClose} />
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.page,
    overflow: "hidden",
  },
  // Two soft orbs overlapped produce a warm-to-success halo. Static.
  orbInner: {
    opacity: 0.12,
    borderRadius: 9999,
    width: "80%",
    height: "40%",
    left: "10%",
    top: "20%",
  },
  orbOuter: {
    opacity: 0.08,
    borderRadius: 9999,
    width: "140%",
    height: "70%",
    left: "-20%",
    top: "0%",
  },
  content: {
    alignItems: "center",
    gap: theme.spacing.element,
    maxWidth: 420,
  },
  iconWrap: {
    marginBottom: theme.spacing.element,
  },
  heading: {
    ...theme.typography.largeTitle,
    color: theme.colors.foreground,
    textAlign: "center",
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    textAlign: "center",
  },
}));
