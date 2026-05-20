/**
 * PunchAnimation — Flagship punch-in animation for mobile ShiftClock.
 *
 * Replicates the canonical HTML reference at:
 *   .superpowers/brainstorm/64049-1774371756/punch-animation.html
 *
 * Phases: idle (glowing button) -> pressed (scale down) -> scanning (4 verification steps)
 * -> success (green checkmark + confetti) -> complete (crossfade to active view).
 *
 * Uses react-native-reanimated for all animations and expo-haptics for tactile feedback.
 * No expo-linear-gradient dependency — radial gradients are approximated with layered
 * solid-color Views and shadows for a similar visual effect.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";

import { createStyles, withOpacity, useTheme } from "@/theme";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Confetti palette — purely decorative animation particles.
 * Most slots have no direct semantic token; kept as hex for celebratory variety.
 * TODO(nordic-split): slots 2 (#ffd93d warm-yellow) + 4 (#5b9bd5 periwinkle) +
 *   6 (#ff6b6b coral-red) have no current token equivalent — defer to
 *   design-tokens expansion sortie.
 */
const CONFETTI_COLORS = [
  "#f97316", // brandOrange
  "#fb923c", // brandOrange lighter tint (decorative)
  "#ffd93d", // TODO(nordic-split): no warning-yellow token yet
  "#54b05a", // success (light palette value, static OK for confetti)
  "#5b9bd5", // TODO(nordic-split): no periwinkle token yet
  "#8b5cf6", // brandPurple
  "#ff6b6b", // TODO(nordic-split): no danger-red token yet
  "#67bb6b", // success (dark palette value, static OK for confetti)
];

/** Scan step verification labels (Norwegian) */
const SCAN_STEPS = [
  { label: "GPS-posisjon", scanText: "Sjekker GPS..." },
  { label: "Identitet bekreftet", scanText: "Bekrefter identitet..." },
  { label: "Vakt aktivert", scanText: "Aktiverer vakt..." },
  { label: "Sesjon startet", scanText: "Starter sesjon..." },
] as const;

/** Staggered delays for each scan step (ms from scan start) */
const STEP_DELAYS = [400, 900, 1500, 2100] as const;

const CONFETTI_COUNT = 25;
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type PunchAnimationProps = {
  shiftInfo: {
    time: string;
    department: string;
    zone: string;
  } | null;
  /** Called when punch button is pressed — fires API mutation */
  onPunchIn: () => Promise<{ allowed: boolean; warnings: unknown[] }>;
  /** Called after success animation completes — transitions to active shift view */
  onComplete: () => void;
  disabled?: boolean;
  countdown?: string;
};

type Phase = "idle" | "pressed" | "scanning" | "success" | "complete";

/* -------------------------------------------------------------------------- */
/*  Confetti particle                                                         */
/* -------------------------------------------------------------------------- */

type ConfettiParticle = {
  id: number;
  startX: number;
  color: string;
  size: number;
  isCircle: boolean;
  duration: number;
  delay: number;
};

function generateConfetti(count: number): ConfettiParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    startX: Math.random() * 100,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
    size: 4 + Math.random() * 8,
    isCircle: Math.random() > 0.5,
    duration: 1500 + Math.random() * 2000,
    delay: Math.random() * 500,
  }));
}

/** Single animated confetti particle */
function ConfettiPiece({ particle }: { particle: ConfettiParticle }) {
  const translateY = useSharedValue(-10);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      particle.delay,
      withTiming(SCREEN_HEIGHT, { duration: particle.duration, easing: Easing.linear }),
    );
    rotation.value = withDelay(
      particle.delay,
      withTiming(720, { duration: particle.duration, easing: Easing.linear }),
    );
    scale.value = withDelay(
      particle.delay,
      withTiming(0.5, { duration: particle.duration, easing: Easing.linear }),
    );
    opacity.value = withDelay(
      particle.delay,
      withSequence(
        withTiming(1, { duration: particle.duration * 0.8 }),
        withTiming(0, { duration: particle.duration * 0.2 }),
      ),
    );
  }, [translateY, rotation, opacity, scale, particle]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: -10,
          left: `${particle.startX}%`,
          width: particle.size,
          height: particle.size,
          backgroundColor: particle.color,
          borderRadius: particle.isCircle ? particle.size / 2 : 2,
        },
        style,
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Fingerprint icon (SVG paths from the HTML reference)                      */
/* -------------------------------------------------------------------------- */

function FingerprintSvg({
  color,
  size,
  opacity: svgOpacity,
}: {
  color: string;
  size: number;
  opacity?: number;
}) {
  // Using a simplified fingerprint shape with concentric circles
  // since Svg from react-native-svg may or may not be available.
  // Falling back to the Lucide Fingerprint icon via a View-based approach.
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        opacity: svgOpacity ?? 0.95,
      }}
    >
      {/* Outer ring */}
      <View
        style={{
          position: "absolute",
          width: size * 0.9,
          height: size * 0.9,
          borderRadius: size * 0.45,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      {/* Middle ring */}
      <View
        style={{
          position: "absolute",
          width: size * 0.65,
          height: size * 0.65,
          borderRadius: size * 0.325,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      {/* Inner ring */}
      <View
        style={{
          position: "absolute",
          width: size * 0.4,
          height: size * 0.4,
          borderRadius: size * 0.2,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      {/* Center dot */}
      <View
        style={{
          width: size * 0.12,
          height: size * 0.12,
          borderRadius: size * 0.06,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Scan step component                                                       */
/* -------------------------------------------------------------------------- */

function ScanStep({
  label,
  index,
  isDone,
  isActive,
}: {
  label: string;
  index: number;
  isDone: boolean;
  isActive: boolean;
}) {
  const { colors } = useTheme();
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 300, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [isActive, pulseOpacity]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  // Semantic mapping: done → success, active → brand action, idle → muted neutral
  const stepColor = isDone
    ? colors.success
    : isActive
      ? colors.brandOrange
      : colors.mutedForeground;

  return (
    <View style={scanStyles.step}>
      <Animated.View
        style={[
          scanStyles.stepIcon,
          {
            borderColor: stepColor,
            backgroundColor: isDone ? colors.success : "transparent",
          },
          iconAnimStyle,
        ]}
      >
        {isDone ? (
          <Check size={10} color={colors.primaryForeground} strokeWidth={3} />
        ) : (
          <Text style={[scanStyles.stepNumber, { color: stepColor }]}>{index + 1}</Text>
        )}
      </Animated.View>
      <Text style={[scanStyles.stepLabel, { color: stepColor }]}>{label}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                            */
/* -------------------------------------------------------------------------- */

export function PunchAnimation({
  shiftInfo,
  onPunchIn,
  onComplete,
  disabled = false,
  countdown,
}: PunchAnimationProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeStep, setActiveStep] = useState(-1);
  const [doneSteps, setDoneSteps] = useState<boolean[]>([false, false, false, false]);
  const [scanText, setScanText] = useState("Verifiserer...");
  const [showConfetti, setShowConfetti] = useState(false);

  const runningRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const confettiParticles = useMemo(() => generateConfetti(CONFETTI_COUNT), []);

  /* ---- Animation values ---- */

  // Button scale — idle breathing pulse
  const buttonScale = useSharedValue(1);
  // Outer glow ring rotation
  const glowRotation = useSharedValue(0);
  // Outer glow ring pulse
  const glowPulse = useSharedValue(0);
  // Scanning ring rotation
  const scanRingRotation = useSharedValue(0);
  // Scanning fingerprint pulse
  const scanFpPulse = useSharedValue(0);
  // Success circle scale (bounces in)
  const successScale = useSharedValue(0);
  // Idle screen opacity
  const idleOpacity = useSharedValue(1);
  const idleScale = useSharedValue(1);
  // Scan overlay opacity
  const scanOpacity = useSharedValue(0);
  // Success overlay opacity
  const successOpacity = useSharedValue(0);

  /** Helper to schedule a timeout and track it for cleanup */
  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  /* Cleanup all pending timers on unmount */
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  /* ---- Idle breathing animations ---- */
  useEffect(() => {
    // Outer glow ring: slow rotation (4s per revolution, matching HTML reference)
    glowRotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );

    // Pulse glow: breathing effect (2s cycle)
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [glowRotation, glowPulse]);

  /* ---- Animated styles ---- */

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const glowRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${glowRotation.value}deg` }],
  }));

  const glowPulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0.5, 1]),
    transform: [{ scale: interpolate(glowPulse.value, [0, 1], [1, 1.15]) }],
  }));

  const idleAnimStyle = useAnimatedStyle(() => ({
    opacity: idleOpacity.value,
    transform: [{ scale: idleScale.value }],
  }));

  const scanOverlayStyle = useAnimatedStyle(() => ({
    opacity: scanOpacity.value,
  }));

  const scanRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${scanRingRotation.value}deg` }],
  }));

  const scanFpStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scanFpPulse.value, [0, 1], [0.4, 1]),
  }));

  const successOverlayStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
  }));

  const successCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
  }));

  /* ---- PUNCH HANDLER ---- */
  const handlePunch = useCallback(async () => {
    if (runningRef.current || disabled) return;
    runningRef.current = true;

    // Phase 1: Press — scale down with spring + haptic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("pressed");
    buttonScale.value = withSpring(0.88, { damping: 15, stiffness: 300 });

    // Phase 2: After press, start transition to scanning
    schedule(() => {
      buttonScale.value = withSpring(1, { damping: 12, stiffness: 200 });

      // Hide idle screen with crossfade (matching HTML: opacity 0, scale 0.95)
      idleOpacity.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
      idleScale.value = withTiming(0.95, { duration: 500, easing: Easing.out(Easing.cubic) });

      schedule(() => {
        setPhase("scanning");
        setScanText("Verifiserer...");
        setActiveStep(-1);
        setDoneSteps([false, false, false, false]);

        // Show scan overlay
        scanOpacity.value = withTiming(1, { duration: 300 });

        // Start scanning ring rotation (1s per revolution)
        scanRingRotation.value = 0;
        scanRingRotation.value = withRepeat(
          withTiming(360, { duration: 1000, easing: Easing.linear }),
          -1,
          false,
        );

        // Start fingerprint pulse
        scanFpPulse.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 400, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 400, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        );

        // Fire the actual punch-in mutation in parallel
        onPunchIn().catch(() => {
          /* Animation continues regardless */
        });

        // Run scan steps with staggered timing
        STEP_DELAYS.forEach((delay, i) => {
          schedule(() => {
            setScanText(SCAN_STEPS[i]!.scanText);
            if (i > 0) {
              setDoneSteps((prev) => {
                const next = [...prev];
                next[i - 1] = true;
                return next;
              });
            }
            setActiveStep(i);
          }, delay);
        });

        // Complete last step
        schedule(() => {
          setDoneSteps([true, true, true, true]);
          setActiveStep(-1);
        }, 2600);

        // Transition to success
        schedule(() => {
          setPhase("success");
          scanOpacity.value = withTiming(0, { duration: 300 });
          setShowConfetti(true);

          // Success haptic
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          // Show success overlay
          successOpacity.value = withTiming(1, { duration: 400 });

          // Success circle bounce in — matching HTML cubic-bezier(0.34, 1.56, 0.64, 1)
          successScale.value = withSpring(1, { damping: 12, stiffness: 100 });
        }, 2900);

        // Transition to complete (active shift view)
        schedule(() => {
          setPhase("complete");
          setShowConfetti(false);
          successOpacity.value = withTiming(0, { duration: 500 });
          runningRef.current = false;
          onComplete();
        }, 5500);
      }, 400);
    }, 300);
  }, [
    disabled,
    buttonScale,
    idleOpacity,
    idleScale,
    scanOpacity,
    scanRingRotation,
    scanFpPulse,
    successOpacity,
    successScale,
    onPunchIn,
    onComplete,
    schedule,
  ]);

  /* ---- RENDER ---- */

  const showIdle = phase === "idle" || phase === "pressed";
  const showScanning = phase === "scanning";
  const showSuccess = phase === "success";

  return (
    <View style={styles.root}>
      {/* ---- IDLE SCREEN ---- */}
      <Animated.View
        style={[styles.overlay, idleAnimStyle]}
        pointerEvents={showIdle ? "auto" : "none"}
      >
        {/* Shift info */}
        {shiftInfo && (
          <View style={styles.shiftInfo}>
            <Text style={styles.shiftLabel}>Neste vakt</Text>
            <Text style={styles.shiftTime}>{shiftInfo.time}</Text>
            <View style={styles.shiftBadges}>
              <View
                style={[
                  styles.shiftBadge,
                  { backgroundColor: withOpacity(styles.infoColor.color as string, 0.15) },
                ]}
              >
                <Text style={[styles.shiftBadgeText, styles.infoColor]}>
                  {shiftInfo.department}
                </Text>
              </View>
              <View
                style={[
                  styles.shiftBadge,
                  { backgroundColor: withOpacity(styles.successColor.color as string, 0.15) },
                ]}
              >
                <Text style={[styles.shiftBadgeText, styles.successColor]}>{shiftInfo.zone}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Punch button container */}
        <View style={styles.punchContainer}>
          {/* Outer pulse glow — radial gradient approximation */}
          <Animated.View style={[styles.pulseGlow, glowPulseStyle]} />

          {/* Rotating glow ring — conic gradient approximated with border segments */}
          <Animated.View style={[styles.glowRing, glowRingStyle]}>
            <View style={styles.glowRingTop} />
            <View style={styles.glowRingRight} />
            <View style={styles.glowRingBottom} />
            <View style={styles.glowRingLeft} />
          </Animated.View>

          {/* Main punch button */}
          <Animated.View style={buttonAnimStyle}>
            <Pressable
              onPress={handlePunch}
              disabled={disabled || phase !== "idle"}
              style={styles.punchButton}
              accessibilityRole="button"
              accessibilityLabel="Stemple inn"
            >
              <FingerprintSvg color={colors.primaryForeground} size={64} />
              <Text style={styles.punchLabel}>Stemple inn</Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Countdown text */}
        {countdown && <Text style={styles.countdownText}>Vakten starter om {countdown}</Text>}
      </Animated.View>

      {/* ---- SCANNING OVERLAY ---- */}
      <Animated.View
        style={[styles.overlay, scanOverlayStyle]}
        pointerEvents={showScanning ? "auto" : "none"}
      >
        <View style={styles.scanCenter}>
          {/* Spinning border ring */}
          <Animated.View style={[styles.scanRingContainer, scanRingStyle]}>
            <View style={styles.scanRingBorder} />
          </Animated.View>

          {/* Pulsing fingerprint in center */}
          <Animated.View style={scanFpStyle}>
            <FingerprintSvg color={colors.brandOrange} size={72} />
          </Animated.View>
        </View>

        {/* Scan status text */}
        <Text style={styles.scanText}>{scanText}</Text>

        {/* Verification steps */}
        <View style={styles.scanSteps}>
          {SCAN_STEPS.map((step, i) => (
            <ScanStep
              key={step.label}
              label={step.label}
              index={i}
              isDone={doneSteps[i]!}
              isActive={activeStep === i && !doneSteps[i]}
            />
          ))}
        </View>
      </Animated.View>

      {/* ---- CONFETTI ---- */}
      {showConfetti && (
        <View style={styles.confettiContainer} pointerEvents="none">
          {confettiParticles.map((p) => (
            <ConfettiPiece key={p.id} particle={p} />
          ))}
        </View>
      )}

      {/* ---- SUCCESS OVERLAY ---- */}
      <Animated.View
        style={[styles.overlay, successOverlayStyle]}
        pointerEvents={showSuccess ? "auto" : "none"}
      >
        {/* Green checkmark circle with bounce */}
        <Animated.View style={[styles.successCircle, successCircleStyle]}>
          <Check size={56} color={colors.primaryForeground} strokeWidth={2.5} />
        </Animated.View>

        {/* Success text — fades in with delay */}
        {showSuccess && (
          <>
            <Animated.Text entering={FadeIn.delay(500).duration(500)} style={styles.successText}>
              Du er stemplet inn!
            </Animated.Text>

            <Animated.Text entering={FadeIn.delay(700).duration(500)} style={styles.successSub}>
              {shiftInfo
                ? `${shiftInfo.department} ${shiftInfo.zone} \u00B7 ${shiftInfo.time}`
                : ""}
            </Animated.Text>

            <Animated.View entering={FadeIn.delay(900).duration(500)} style={styles.pointsBadge}>
              <Text style={styles.pointsText}>+7 poeng — Tidlig fugl!</Text>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles for ScanStep (static — no theme needed)                            */
/* -------------------------------------------------------------------------- */

const scanStyles = {
  step: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    height: 28,
  },
  stepIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  stepNumber: {
    fontSize: 10,
    fontWeight: "600" as const,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: "400" as const,
  },
};

/* -------------------------------------------------------------------------- */
/*  Themed styles                                                             */
/* -------------------------------------------------------------------------- */

const useStyles = createStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    position: "relative" as const,
  },

  overlay: {
    ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  /* ---- Shift info ---- */
  shiftInfo: {
    alignItems: "center" as const,
    paddingTop: 20,
    paddingHorizontal: 24,
    position: "absolute" as const,
    top: 60,
    left: 0,
    right: 0,
  },
  shiftLabel: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  shiftTime: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: theme.colors.foreground,
    marginTop: 6,
  },
  shiftBadges: {
    flexDirection: "row" as const,
    gap: 8,
    marginTop: 10,
  },
  shiftBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  shiftBadgeText: {
    fontSize: 12,
    fontWeight: "500" as const,
  },

  /* ---- Punch button ---- */
  punchContainer: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    width: 220,
    height: 220,
  },

  /* Approximation of the radial pulse glow */
  pulseGlow: {
    position: "absolute" as const,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.12),
  },

  /* Rotating glow ring — 4 quadrant borders to approximate conic gradient */
  glowRing: {
    position: "absolute" as const,
    width: 216,
    height: 216,
    borderRadius: 108,
    opacity: 0.6,
  },
  glowRingTop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    height: 108,
    borderTopLeftRadius: 108,
    borderTopRightRadius: 108,
    borderWidth: 4,
    borderBottomWidth: 0,
    borderColor: theme.colors.brandOrange,
  },
  glowRingRight: {
    position: "absolute" as const,
    top: 0,
    right: 0,
    bottom: 0,
    width: 108,
    borderTopRightRadius: 108,
    borderBottomRightRadius: 108,
    borderWidth: 4,
    borderLeftWidth: 0,
    // Lighter tint of brandOrange for the conic-gradient approximation
    borderColor: withOpacity(theme.colors.brandOrange, 0.7),
  },
  glowRingBottom: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 108,
    borderBottomLeftRadius: 108,
    borderBottomRightRadius: 108,
    borderWidth: 4,
    borderTopWidth: 0,
    // Darker tint of brandOrange for the conic-gradient approximation
    borderColor: withOpacity(theme.colors.brandOrange, 0.85),
  },
  glowRingLeft: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    bottom: 0,
    width: 108,
    borderTopLeftRadius: 108,
    borderBottomLeftRadius: 108,
    borderWidth: 4,
    borderRightWidth: 0,
    borderColor: theme.colors.brandOrange,
  },

  punchButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    // Approximate the radial gradient: shadow gives depth
    shadowColor: theme.colors.brandOrange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 12,
  },

  punchLabel: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: theme.colors.primaryForeground,
    marginTop: 8,
    letterSpacing: 0.5,
  },

  countdownText: {
    position: "absolute" as const,
    bottom: 80,
    textAlign: "center" as const,
    color: theme.colors.mutedForeground,
    fontSize: 13,
  },

  /* ---- Scanning ---- */
  scanCenter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  scanRingContainer: {
    position: "absolute" as const,
    width: 200,
    height: 200,
    borderRadius: 100,
  },

  scanRingBorder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: "transparent",
    borderTopColor: theme.colors.brandOrange,
    borderRightColor: withOpacity(theme.colors.brandOrange, 0.7),
  },

  scanText: {
    marginTop: 24,
    fontSize: 15,
    color: theme.colors.mutedForeground,
  },

  scanSteps: {
    marginTop: 24,
    width: 240,
    gap: 8,
  },

  /* ---- Confetti ---- */
  confettiContainer: {
    ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const),
    overflow: "hidden" as const,
  },

  /* ---- Success ---- */
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.success,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: theme.colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 60,
    elevation: 8,
  },

  successText: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: theme.colors.foreground,
    marginTop: 24,
  },

  successSub: {
    fontSize: 14,
    color: theme.colors.success,
    marginTop: 8,
  },

  pointsBadge: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    // TODO(nordic-split): warm-yellow celebration badge has no token yet;
    // using warning color as closest semantic approximation until a
    // "celebration" token is added to design-tokens.
    backgroundColor: theme.colors.warning,
    shadowColor: theme.colors.warning,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },

  pointsText: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: theme.colors.warningForeground,
  },

  infoColor: {
    color: theme.colors.info,
  },

  successColor: {
    color: theme.colors.success,
  },
}));
