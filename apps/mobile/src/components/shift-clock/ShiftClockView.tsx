/**
 * ShiftClockView — Main layout component for the mobile ShiftClock screen.
 *
 * Renders different views based on the current shift phase:
 * - idle / before_shift: PunchAnimation (full-screen punch-in flow)
 * - clocked_in: ShiftClockHeader + ShiftClockActions + content area
 * - on_break: Break timer + resume button via ShiftClockActions
 * - summary: ShiftClockSummary with stats
 *
 * Orchestrates all child components and connects them to the shift phase store
 * and mutation hooks.
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeOut, SlideInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, LogOut } from "lucide-react-native";

import { createStyles } from "@/theme";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useActiveTimeEntry } from "@/hooks/queries/use-active-time-entry";
import { usePunch } from "@/hooks/mutations/use-punch";
import { strings } from "@/constants/strings";

import { PunchAnimation } from "./PunchAnimation";
import { ShiftClockHeader } from "./ShiftClockHeader";
import { ShiftClockActions } from "./ShiftClockActions";
import { ShiftClockSummary } from "./ShiftClockSummary";
import { SupplementSheet } from "./SupplementSheet";

type ShiftClockPhase = "idle" | "clocked_in" | "on_break" | "summary";

export function ShiftClockView() {
  const styles = useStyles();
  const router = useRouter();
  const { phase, activeShift, nextShift, activeTimeEntry: phaseTimeEntry } = useShiftPhase();
  const { data: queryTimeEntry } = useActiveTimeEntry();
  const { punchIn, punchOut } = usePunch();

  const currentTimeEntry = phaseTimeEntry ?? queryTimeEntry;
  const isClockedIn = currentTimeEntry?.status === "clocked_in";
  const shiftForPunch = activeShift ?? nextShift;

  // Local view phase — drives which child renders
  const [viewPhase, setViewPhase] = useState<ShiftClockPhase>("idle");
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState<string | null>(null);
  const [showSupplements, setShowSupplements] = useState(false);

  // Sync view phase with shift phase store
  useEffect(() => {
    if (isClockedIn) {
      setViewPhase(isOnBreak ? "on_break" : "clocked_in");
    } else if (phase === "no_shift" || phase === "before_shift") {
      setViewPhase("idle");
    }
  }, [isClockedIn, isOnBreak, phase]);

  /* ---- Punch-in handler for PunchAnimation ---- */
  const handlePunchIn = useCallback(async () => {
    if (!shiftForPunch) return { allowed: false, warnings: [] };
    await punchIn(shiftForPunch.schedule_shift_id);
    return { allowed: true, warnings: [] };
  }, [punchIn, shiftForPunch]);

  /* ---- Called after PunchAnimation success completes ---- */
  const handlePunchComplete = useCallback(() => {
    setViewPhase("clocked_in");
  }, []);

  /* ---- Punch out ---- */
  const handlePunchOut = useCallback(async () => {
    if (!currentTimeEntry) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await punchOut(currentTimeEntry.time_entry_id);
    setViewPhase("summary");
  }, [currentTimeEntry, punchOut]);

  /* ---- Break handlers ---- */
  const handleStartBreak = useCallback(() => {
    setIsOnBreak(true);
    setBreakStartTime(new Date().toISOString());
    setViewPhase("on_break");
  }, []);

  const handleEndBreak = useCallback(() => {
    setIsOnBreak(false);
    setBreakStartTime(null);
    setViewPhase("clocked_in");
  }, []);

  /* ---- Dismiss summary ---- */
  const handleDismissSummary = useCallback(() => {
    setViewPhase("idle");
  }, []);

  /* ---- Build shift info for PunchAnimation ---- */
  const shiftInfo = shiftForPunch
    ? {
        time: `${formatShiftTime(shiftForPunch.start_time)} \u2013 ${formatShiftTime(shiftForPunch.end_time)}`,
        department: "Restaurant",
        zone: "Sal",
      }
    : null;

  /* ---- IDLE: Full-screen punch animation ---- */
  if (viewPhase === "idle") {
    return (
      <View style={styles.fullScreen}>
        {/* Back button overlaid on the animation */}
        <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.backOverlay}>
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
            <ChevronLeft size={28} color="#e8e4df" strokeWidth={2} />
          </Pressable>
        </Animated.View>

        <PunchAnimation
          shiftInfo={shiftInfo}
          onPunchIn={handlePunchIn}
          onComplete={handlePunchComplete}
          disabled={!shiftForPunch}
        />
      </View>
    );
  }

  /* ---- SUMMARY: Post-punch-out stats ---- */
  if (viewPhase === "summary") {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <ShiftClockSummary
          punchInTime={currentTimeEntry?.punch_in ?? new Date().toISOString()}
          punchOutTime={new Date().toISOString()}
          breaks={[]}
          claimedSupplements={[]}
          onDismiss={handleDismissSummary}
        />
      </SafeAreaView>
    );
  }

  /* ---- CLOCKED_IN / ON_BREAK: Active shift view ---- */
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Back button */}
      <View style={styles.header}>
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
      </View>

      {/* Timer + status */}
      <ShiftClockHeader
        punchInTime={currentTimeEntry?.punch_in ?? new Date().toISOString()}
        isOnBreak={isOnBreak}
        department="Restaurant"
        zone="Sal"
      />

      {/* 2x2 action grid */}
      <ShiftClockActions
        isOnBreak={isOnBreak}
        onStartBreak={handleStartBreak}
        onEndBreak={handleEndBreak}
        onOpenNotes={() => {
          /* TODO: navigate to notes */
        }}
        onOpenSupplements={() => setShowSupplements(true)}
        onCallLeader={() => {
          /* TODO: call leader phone */
        }}
        isLoading={false}
      />

      {/* Content area — task feed placeholder */}
      <ScrollView style={styles.feedContainer} contentContainerStyle={styles.feedContent}>
        <View style={styles.feedTabs}>
          <Text style={styles.feedTabActive}>Oppgaver</Text>
          <Text style={styles.feedTab}>Chat</Text>
          <Text style={styles.feedTab}>Notater</Text>
        </View>

        <View style={[styles.feedCard, { borderLeftColor: "#e85c0d" }]}>
          <Text style={styles.feedTitle}>Sjekk temperatur kjoleskap</Text>
          <Text style={styles.feedSub}>Rutine · Forfaller 16:00</Text>
        </View>
        <View style={[styles.feedCard, { borderLeftColor: "#5b9bd5" }]}>
          <Text style={styles.feedTitle}>Dagsbriefing</Text>
          <Text style={styles.feedSub}>VIP-selskap bord 12 kl 19. Allergier: notter.</Text>
        </View>
        <View style={[styles.feedCard, { borderLeftColor: "#6bcb77" }]}>
          <Text style={styles.feedTitle}>Lukking: rydd terassen</Text>
          <Text style={styles.feedSub}>Oppgave · Forfaller 22:30</Text>
        </View>
      </ScrollView>

      {/* Punch out button — fixed at bottom */}
      <Animated.View
        entering={SlideInDown.delay(200).duration(400).springify()}
        style={styles.punchOutBar}
      >
        <Pressable
          onPress={() => void handlePunchOut()}
          disabled={isOnBreak}
          style={({ pressed }) => [
            styles.punchOutButton,
            pressed && styles.punchOutPressed,
            isOnBreak && styles.punchOutDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={strings.shift.punchOut}
        >
          <LogOut size={18} color="#ffffff" strokeWidth={2} />
          <Text style={styles.punchOutText}>{strings.shift.punchOut}</Text>
        </Pressable>
      </Animated.View>

      {/* Supplement bottom sheet */}
      <SupplementSheet
        isOpen={showSupplements}
        onClose={() => setShowSupplements(false)}
        availableSupplements={[]}
        claimedSupplementRuleIds={new Set()}
        onClaim={async () => {}}
      />
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatShiftTime(iso: string | null): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const useStyles = createStyles((theme) => ({
  fullScreen: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },

  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  backOverlay: {
    position: "absolute" as const,
    top: 56,
    left: 16,
    zIndex: 100,
  },

  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 22,
  },

  iconColor: {
    color: theme.colors.foreground,
  },

  /* Feed area */
  feedContainer: {
    flex: 1,
    marginTop: theme.spacing.tight,
  },

  feedContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  feedTabs: {
    flexDirection: "row" as const,
    borderBottomWidth: 1,
    borderBottomColor: theme.isDark ? "#1a1a24" : "#e5e5e8",
    marginBottom: 12,
    gap: 16,
  },

  feedTabActive: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: "#e85c0d",
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#e85c0d",
  },

  feedTab: {
    fontSize: 13,
    color: theme.isDark ? "#555" : "#999",
    paddingVertical: 10,
  },

  feedCard: {
    backgroundColor: theme.isDark ? "#111118" : "#f5f5f7",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
  },

  feedTitle: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },

  feedSub: {
    fontSize: 11,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },

  /* Punch out bar */
  punchOutBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
  },

  punchOutButton: {
    backgroundColor: "#dc2626",
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },

  punchOutPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },

  punchOutDisabled: {
    opacity: 0.5,
  },

  punchOutText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#ffffff",
  },
}));
