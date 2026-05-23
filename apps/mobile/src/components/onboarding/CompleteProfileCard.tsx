/**
 * CompleteProfileCard — home-screen CTA prompting employees to finish their
 * onboarding wizard.
 *
 * Visibility rules (spec §S5, ADR-0133):
 *   - Hidden when status === "completed" (wizard done, no interrupt needed).
 *   - Hidden while query is loading (avoids layout shift).
 *   - NEVER mounted on DuringShiftView (D6-active context — no interrupts).
 *   - Mounted on NoShiftView, BeforeShiftView, AfterShiftView only.
 *
 * Tapping navigates to /(app)/onboarding to resume the wizard.
 */

import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { createStyles, useTheme } from "@/theme";
import { useOnboardingProgress } from "@/hooks/queries/use-onboarding-progress";

export function CompleteProfileCard() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useStyles();
  const { data } = useOnboardingProgress();

  // Return null while loading or when wizard is complete — silent, no layout shift.
  if (!data || data.status === "completed") return null;

  const remaining = Math.max(0, data.total - data.done);

  return (
    <Pressable
      onPress={() => router.push("/(app)/onboarding")}
      accessibilityRole="button"
      accessibilityLabel="Fullfør profilen din"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
      <View style={styles.text}>
        <Text style={styles.title}>Fullfør profilen din</Text>
        <Text style={styles.sub}>{remaining} steg igjen</Text>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  pressed: { opacity: 0.75 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.foreground,
  },
  sub: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
}));
