/**
 * LeaderOnlyEmptyState — full-route screen for non-leader hitting the
 * clockout wizard URL (deep-link or stale bookmark).
 *
 * Not a redirect-with-toast — we show a deliberate screen so the user
 * understands their role rather than bouncing silently. Includes:
 *   - ambient radial orb (Nordic Split)
 *   - Lock icon + Instrument Serif heading
 *   - differentiated body text (open session vs. closed)
 *   - primary CTA: "Tilbake til i dag"
 *   - secondary CTA: "Be om lederrettighet" (stub — logs + no-op)
 *
 * Accessibility: orb is `accessibilityElementsHidden`; text hierarchy
 * is linear for VO.
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Lock } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { createStyles, useTheme } from "@/theme";

export type LeaderOnlyEmptyStateProps = {
  /** If true, the underlying session is still open (active). */
  sessionOpen: boolean;
  onBack: () => void;
  onRequestLeaderRights?: () => void;
};

export function LeaderOnlyEmptyState({
  sessionOpen,
  onBack,
  onRequestLeaderRights,
}: LeaderOnlyEmptyStateProps) {
  const styles = useStyles();
  const theme = useTheme();

  const body = sessionOpen
    ? "Økten er fortsatt åpen — vaktleder må fullføre avstemmingen. Du kan fortsette dagen din som vanlig."
    : "Økten er stengt for denne dagen. Vaktleder har avsluttet eller venter på å avslutte avstemmingen.";

  return (
    <View style={styles.root}>
      {/* Ambient orb — decorative, never interactive. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          StyleSheet.absoluteFillObject,
          styles.orb,
          // Inline radial via layered Views — keeps us on the Nordic Split
          // gradient-composition pattern without pulling in a gradient lib
          // just for this one screen.
          { backgroundColor: theme.colors.warnSoft },
        ]}
      />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Lock size={28} color={theme.colors.foreground} />
        </View>
        <Text style={styles.heading}>Kun vaktleder kan avstemme dagen</Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.actions}>
          <Button
            title="Tilbake til i dag"
            variant="primary"
            size="lg"
            fullWidth
            onPress={onBack}
          />
          <Button
            title="Be om lederrettighet"
            variant="ghost"
            size="md"
            fullWidth
            onPress={onRequestLeaderRights ?? (() => undefined)}
            disabled={!onRequestLeaderRights}
          />
        </View>
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
  },
  orb: {
    opacity: 0.18,
    borderRadius: 9999,
    width: "140%",
    height: "70%",
    left: "-20%",
    top: "15%",
  },
  content: {
    alignItems: "center",
    gap: theme.spacing.element,
    maxWidth: 420,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
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
  actions: {
    marginTop: theme.spacing.card,
    width: "100%",
    gap: theme.spacing.element,
  },
}));
