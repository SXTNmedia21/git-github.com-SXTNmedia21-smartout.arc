/**
 * Punch Clock — Premium full-screen time registration.
 *
 * Animations:
 * - Continuous breathing glow on the punch button (idle pulse)
 * - Three concentric ripple rings on punch (staggered, expanding, fading)
 * - Icon rotation on punch (360° spin)
 * - Success checkmark slides up with spring
 * - Clock digits scale-bounce on second tick
 * - Location badge + shift label fade in with stagger
 * - Elapsed time counter pulses gently
 * - Back button has a press scale
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  interpolate,
  SlideInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, MapPin, Clock, CheckCircle2, Fingerprint } from "lucide-react-native";

import { createStyles } from "@/theme";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useActiveTimeEntry } from "@/hooks/queries/use-active-time-entry";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { usePunch } from "@/hooks/mutations/use-punch";
import { strings } from "@/constants/strings";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatShiftTime(iso: string | null): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatElapsed(punchIn: string): string {
  const start = new Date(punchIn).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - start);
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((diffMs % 60000) / 1000);
  if (hours > 0)
    return `${hours}t ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

const PRESS_SPRING = { damping: 12, stiffness: 250, mass: 0.8 };

/** Animated idle glow ring that breathes continuously */
function BreathingRing({
  color,
  size,
  delay: ringDelay,
}: {
  color: string;
  size: number;
  delay: number;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withDelay(
      ringDelay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [pulse, ringDelay]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.08, 0.25]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.08]) }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: color,
        },
        animStyle,
      ]}
    />
  );
}

export default function PunchClockScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { phase, activeShift, nextShift, activeTimeEntry: phaseTimeEntry } = useShiftPhase();
  const { data: queryTimeEntry } = useActiveTimeEntry();
  const { data: profile } = useMyProfile();
  const { punchIn, punchOut } = usePunch();

  const currentTimeEntry = phaseTimeEntry ?? queryTimeEntry;
  const isClockedIn = currentTimeEntry?.status === "clocked_in";
  const shiftForPunch = activeShift ?? nextShift;

  // Live clock — update every second
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Punch button animations
  const scale = useSharedValue(1);
  const iconRotation = useSharedValue(0);
  const [justPunched, setJustPunched] = useState(false);

  // Three ripple rings
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0);
  const ring3Scale = useSharedValue(1);
  const ring3Opacity = useSharedValue(0);

  const animatedButton = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedIcon = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconRotation.value}deg` }],
  }));

  const animatedRing1 = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));
  const animatedRing2 = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));
  const animatedRing3 = useAnimatedStyle(() => ({
    transform: [{ scale: ring3Scale.value }],
    opacity: ring3Opacity.value,
  }));

  // Clock digit bounce on tick
  const clockScale = useSharedValue(1);
  useEffect(() => {
    clockScale.value = withSequence(
      withTiming(1.02, { duration: 80 }),
      withSpring(1, { damping: 14, stiffness: 300 }),
    );
  }, [now, clockScale]);

  const animatedClock = useAnimatedStyle(() => ({
    transform: [{ scale: clockScale.value }],
  }));

  // Elapsed pulse
  const elapsedPulse = useSharedValue(0);
  useEffect(() => {
    if (isClockedIn) {
      elapsedPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }
  }, [isClockedIn, elapsedPulse]);

  const animatedElapsed = useAnimatedStyle(() => ({
    opacity: interpolate(elapsedPulse.value, [0, 1], [0.85, 1]),
  }));

  const fireRipple = useCallback(
    (
      rScale: Animated.SharedValue<number>,
      rOpacity: Animated.SharedValue<number>,
      delay: number,
    ) => {
      rScale.value = 1;
      rOpacity.value = 0;
      rScale.value = withDelay(
        delay,
        withTiming(2.5, { duration: 800, easing: Easing.out(Easing.cubic) }),
      );
      rOpacity.value = withDelay(
        delay,
        withSequence(
          withTiming(0.5, { duration: 100 }),
          withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }),
        ),
      );
    },
    [],
  );

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.9, PRESS_SPRING);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, PRESS_SPRING);
  }, [scale]);

  const handlePunch = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Triple ripple — staggered
    fireRipple(ring1Scale, ring1Opacity, 0);
    fireRipple(ring2Scale, ring2Opacity, 120);
    fireRipple(ring3Scale, ring3Opacity, 240);

    // Icon spin
    iconRotation.value = 0;
    iconRotation.value = withTiming(360, { duration: 500, easing: Easing.out(Easing.cubic) });

    // Button bounce
    scale.value = withSequence(
      withSpring(1.12, { damping: 6, stiffness: 400 }),
      withSpring(0.95, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 15, stiffness: 200 }),
    );

    if (isClockedIn && currentTimeEntry) {
      await punchOut(currentTimeEntry.time_entry_id);
    } else if (shiftForPunch) {
      await punchIn(shiftForPunch.schedule_shift_id);
    }

    setJustPunched(true);
    setTimeout(() => setJustPunched(false), 4000);
  }, [
    isClockedIn,
    currentTimeEntry,
    shiftForPunch,
    punchIn,
    punchOut,
    scale,
    iconRotation,
    ring1Scale,
    ring1Opacity,
    ring2Scale,
    ring2Opacity,
    ring3Scale,
    ring3Opacity,
    fireRipple,
  ]);

  const buttonColor = isClockedIn ? "#ef4444" : "#e85c0d";

  const shiftLabel =
    isClockedIn && currentTimeEntry?.punch_in
      ? `${strings.home.onShift} \u2022 ${formatElapsed(currentTimeEntry.punch_in)}`
      : shiftForPunch
        ? `Vakt ${formatShiftTime(shiftForPunch.start_time)} \u2013 ${formatShiftTime(shiftForPunch.end_time)}`
        : "Ingen vakt";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Back button */}
      <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={28} color={styles.iconColor.color} strokeWidth={2} />
        </Pressable>
      </Animated.View>

      <View style={styles.content}>
        {/* Location badge */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(500).springify()}
          style={styles.locationBadge}
        >
          <MapPin size={14} color={styles.mutedColor.color} strokeWidth={1.8} />
          <Text style={styles.locationText}>
            {profile?.workspace_id ? "STRØM MAT & BAR" : "Arbeidsplass"}
          </Text>
        </Animated.View>

        {/* Live clock with bounce */}
        <Animated.View entering={FadeInDown.delay(300).duration(500).springify()}>
          <Animated.Text style={[styles.clock, animatedClock]}>{formatTime(now)}</Animated.Text>
        </Animated.View>

        {/* Shift info */}
        <Animated.View entering={FadeInDown.delay(400).duration(500).springify()}>
          <Text style={styles.shiftLabel}>{shiftLabel}</Text>
        </Animated.View>

        {/* Punch button with concentric rings */}
        <Animated.View entering={FadeIn.delay(500).duration(600)} style={styles.punchContainer}>
          {/* Breathing idle rings */}
          <BreathingRing color={buttonColor} size={180} delay={0} />
          <BreathingRing color={buttonColor} size={210} delay={700} />
          <BreathingRing color={buttonColor} size={240} delay={1400} />

          {/* Punch ripple rings */}
          <Animated.View style={[styles.rippleRing, { borderColor: buttonColor }, animatedRing1]} />
          <Animated.View style={[styles.rippleRing, { borderColor: buttonColor }, animatedRing2]} />
          <Animated.View style={[styles.rippleRing, { borderColor: buttonColor }, animatedRing3]} />

          {/* Main button */}
          <Animated.View style={animatedButton}>
            <Pressable
              onPress={handlePunch}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={[styles.punchButton, { backgroundColor: buttonColor }]}
              accessibilityRole="button"
              accessibilityLabel={isClockedIn ? strings.shift.punchOut : strings.shift.punchIn}
            >
              <Animated.View style={animatedIcon}>
                {isClockedIn ? (
                  <Clock size={44} color="#ffffff" strokeWidth={1.6} />
                ) : (
                  <Fingerprint size={44} color="#ffffff" strokeWidth={1.6} />
                )}
              </Animated.View>
            </Pressable>
          </Animated.View>
        </Animated.View>

        {/* Punch label */}
        <Animated.View entering={FadeInUp.delay(600).duration(500).springify()}>
          <Text style={[styles.punchLabel, { color: buttonColor }]}>
            {isClockedIn
              ? strings.shift.punchOut.toUpperCase()
              : strings.shift.punchIn.toUpperCase()}
          </Text>
        </Animated.View>

        {/* Elapsed time when clocked in — with gentle pulse */}
        {isClockedIn && currentTimeEntry?.punch_in && (
          <Animated.View
            entering={FadeInUp.delay(200).duration(400).springify()}
            style={styles.elapsedContainer}
          >
            <Text style={styles.elapsedLabel}>Tid pa jobb</Text>
            <Animated.Text style={[styles.elapsedValue, animatedElapsed]}>
              {formatElapsed(currentTimeEntry.punch_in)}
            </Animated.Text>
          </Animated.View>
        )}

        {/* Confirmation badge — slides in from bottom */}
        {justPunched && (
          <Animated.View
            entering={SlideInDown.delay(100).duration(400).springify()}
            exiting={FadeOut.duration(300)}
            style={styles.confirmBadge}
          >
            <CheckCircle2 size={18} color="#22c55e" strokeWidth={2} />
            <Text style={styles.confirmText}>
              {isClockedIn ? "Innstemplet" : "Utstemplet"} {formatTime(now)}
            </Text>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  iconColor: {
    color: theme.colors.foreground,
  },
  mutedColor: {
    color: theme.colors.mutedForeground,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.card,
    paddingBottom: theme.spacing.xl,
  },

  /* Location badge */
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.section,
  },
  locationText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },

  /* Clock display */
  clock: {
    fontSize: 56,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.foreground,
    letterSpacing: 3,
    fontVariant: ["tabular-nums" as const],
    marginBottom: theme.spacing.tight,
  },
  shiftLabel: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.lg,
    letterSpacing: 0.3,
  },

  /* Punch button */
  punchContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 260,
    height: 260,
    marginBottom: theme.spacing.card,
  },
  rippleRing: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
  },
  punchButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.lg,
  },

  /* Labels */
  punchLabel: {
    fontSize: 16,
    letterSpacing: 4,
    fontWeight: theme.fontWeights.bold,
    marginBottom: theme.spacing.section,
  },

  /* Elapsed time */
  elapsedContainer: {
    alignItems: "center",
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    minWidth: 200,
  },
  elapsedLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.xs,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  elapsedValue: {
    fontSize: 32,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums" as const],
    letterSpacing: 1,
  },

  /* Confirmation */
  confirmBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.08)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
  },
  confirmText: {
    ...theme.typography.body,
    color: "#22c55e",
    fontWeight: theme.fontWeights.semibold,
  },
}));
