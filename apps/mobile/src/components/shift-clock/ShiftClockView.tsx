/**
 * ShiftClockView — Main layout component for the mobile ShiftClock screen.
 *
 * Renders different views based on the current shift phase:
 * - idle / before_shift: PunchAnimation (full-screen punch-in flow)
 * - clocked_in: ShiftClockHeader + ShiftClockActions + content area
 * - on_break: Break timer + resume button via ShiftClockActions
 * - summary: ShiftClockSummary with stats
 * - after_shift: AfterShiftView with handoff form + hours confirmation
 *
 * Orchestrates all child components and connects them to the shift phase store
 * and mutation hooks.
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, LogOut } from "lucide-react-native";

import { createStyles } from "@/theme";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useActiveTimeEntry } from "@/hooks/queries/use-active-time-entry";
import { usePunch } from "@/hooks/mutations/use-punch";
import { useSupplements } from "@/hooks/shift-clock/useSupplements";
import { useSubmitHandoff } from "@/hooks/mutations/use-submit-handoff";
import { useConfirmHours } from "@/hooks/mutations/use-confirm-hours";
import { strings } from "@/constants/strings";

import { TaskFeed } from "@/components/task/TaskFeed";
import { useMyTasks } from "@/hooks/queries/use-my-tasks";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useLeaderPhone } from "@/hooks/queries/use-leader-phone";
import { AfterShiftView } from "@/components/home/AfterShiftView";
import { PunchAnimation } from "./PunchAnimation";
import { ShiftClockHeader } from "./ShiftClockHeader";
import { ShiftClockActions } from "./ShiftClockActions";
import { ShiftClockSummary } from "./ShiftClockSummary";
import { SupplementSheet } from "./SupplementSheet";

type ShiftClockPhase = "idle" | "clocked_in" | "on_break" | "summary" | "after_shift";

export function ShiftClockView() {
  const styles = useStyles();
  const router = useRouter();
  const { phase, activeShift, nextShift, activeTimeEntry: phaseTimeEntry } = useShiftPhase();
  const { data: queryTimeEntry } = useActiveTimeEntry();
  const { punchIn, punchOut } = usePunch();
  const { data: tasks } = useMyTasks();
  const { data: profile } = useMyProfile();
  const { data: leaderPhone } = useLeaderPhone(profile?.profile_id);

  const currentTimeEntry = phaseTimeEntry ?? queryTimeEntry;
  const isClockedIn = currentTimeEntry?.status === "clocked_in";
  const shiftForPunch = activeShift ?? nextShift;

  // Derive break state from the server-side breaks array so it survives app backgrounding.
  // A break is active when the most recent break entry has a start but no end.
  const breaksArray = Array.isArray(currentTimeEntry?.breaks)
    ? (currentTimeEntry.breaks as Array<{ start: string; end: string | null }>)
    : [];
  const isOnBreak = breaksArray.some((b) => b.start && !b.end);

  // Load supplements for the active shift. Pass null when identity is not
  // yet known — useSupplements gates internally via `enabled: !!id`. Empty-
  // string fallback is forbidden by ADR-0134 / L-0083.
  const shiftId = activeShift?.schedule_shift_id ?? null;
  const workspaceId = profile?.workspace_id ?? null;
  const {
    options: supplementOptions,
    claims: supplementClaims,
    claimSupplement,
  } = useSupplements(shiftId, workspaceId);

  // End-of-shift mutation hooks — handoff note + hours confirmation
  const { submitHandoff, isSubmitting: submittingHandoff } = useSubmitHandoff();
  const { confirmHours, isSubmitting: confirmingHours } = useConfirmHours();
  // Track whether handoff was submitted during this after-shift flow
  const [handoffSubmitted, setHandoffSubmitted] = useState(false);

  // Local view phase — drives which child renders
  const [viewPhase, setViewPhase] = useState<ShiftClockPhase>("idle");
  const [showSupplements, setShowSupplements] = useState(false);
  // Captured at the moment of punch-out so the summary timestamp doesn't drift on re-renders
  const [capturedPunchOut, setCapturedPunchOut] = useState<string | null>(null);

  // Sync view phase with shift phase store.
  // Guard: don't override "summary" or "after_shift" — those are driven by user interaction,
  // not by the shift phase store. The store will report no_shift after punch-out, but the
  // employee hasn't finished the post-shift flow yet.
  useEffect(() => {
    if (isClockedIn) {
      setViewPhase(isOnBreak ? "on_break" : "clocked_in");
    } else if (phase === "no_shift" || phase === "before_shift") {
      setViewPhase((prev) => (prev === "summary" || prev === "after_shift" ? prev : "idle"));
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
    // Capture the punch-out timestamp before the async call so the summary
    // shows the actual moment the employee tapped the button, not a later re-render time.
    setCapturedPunchOut(new Date().toISOString());
    await punchOut(currentTimeEntry.time_entry_id);
    setViewPhase("summary");
  }, [currentTimeEntry, punchOut]);

  /* ---- Break handlers ---- */
  // isOnBreak is now derived from server state, so these handlers only trigger
  // the mutation. The useEffect above will update viewPhase when the query refreshes.
  const handleStartBreak = useCallback(() => {
    setViewPhase("on_break");
  }, []);

  const handleEndBreak = useCallback(() => {
    setViewPhase("clocked_in");
  }, []);

  /* ---- Dismiss summary → transition to after-shift flow ---- */
  const handleDismissSummary = useCallback(() => {
    setViewPhase("after_shift");
  }, []);

  /* ---- After-shift callbacks ---- */
  const handleAfterShiftHandoff = useCallback(
    async (text: string) => {
      if (!currentTimeEntry || !profile) return;
      await submitHandoff({
        department_session_id: currentTimeEntry.shift_id,
        content: text,
        // created_by and workspace_id resolved server-side via getProfileContext()
        // inside useSubmitHandoff — ADR-0134, not supplied by caller
      });
      setHandoffSubmitted(true);
    },
    [currentTimeEntry, submitHandoff],
  );

  const handleAfterShiftConfirmHours = useCallback(async () => {
    if (!currentTimeEntry) return;
    await confirmHours({
      approval_id: currentTimeEntry.time_entry_id,
      status: "approved",
    });
    setViewPhase("idle");
    setHandoffSubmitted(false);
  }, [currentTimeEntry, confirmHours]);

  const handleAfterShiftDisputeHours = useCallback(async () => {
    if (!currentTimeEntry) return;
    await confirmHours({
      approval_id: currentTimeEntry.time_entry_id,
      status: "disputed",
      edit_justification: "Bestridt via ShiftClock",
    });
    setViewPhase("idle");
    setHandoffSubmitted(false);
  }, [currentTimeEntry, confirmHours]);

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
            <ChevronLeft size={28} color={styles.mutedFgColor.color} strokeWidth={2} />
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
          punchOutTime={capturedPunchOut ?? new Date().toISOString()}
          breaks={breaksArray}
          claimedSupplements={supplementClaims.map((c) => ({
            id: c.manual_supplement_id,
            description: c.comment ?? "",
            amount: 0,
            status: c._isPending ? "pending" : "confirmed",
          }))}
          onDismiss={handleDismissSummary}
        />
      </SafeAreaView>
    );
  }

  /* ---- AFTER_SHIFT: Handoff + hours confirmation ---- */
  if (viewPhase === "after_shift") {
    // Fail-fast guard: AfterShiftView consumes identity-bearing fields
    // (time_entry_id, profile_id, workspace_id) for handoff submission.
    // Empty-string fallback on those identifiers silently corrupts
    // activity_trail (ADR-0134 Invariant 2 / L-0083 / F-MO-01-OPEN).
    // When the time entry is not yet hydrated, drop back to idle rather
    // than mint forged-looking blanks. The user will be re-routed by the
    // shift-phase store once data lands.
    if (!currentTimeEntry) {
      // useEffect will reset viewPhase once isClockedIn/phase update.
      return (
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <View style={styles.fullScreen} />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <AfterShiftView
          shift={activeShift ?? null}
          timeEntry={{
            time_entry_id: currentTimeEntry.time_entry_id,
            shift_id: currentTimeEntry.shift_id,
            profile_id: currentTimeEntry.profile_id,
            workspace_id: currentTimeEntry.workspace_id,
            punch_in: currentTimeEntry.punch_in ?? new Date().toISOString(),
            punch_out: capturedPunchOut ?? currentTimeEntry.punch_out ?? null,
            breaks: currentTimeEntry.breaks ?? null,
            punch_in_location: currentTimeEntry.punch_in_location ?? null,
            status: currentTimeEntry.status ?? "completed",
            created_at: currentTimeEntry.created_at ?? new Date().toISOString(),
            updated_at: currentTimeEntry.updated_at ?? new Date().toISOString(),
          }}
          onSubmitHandoff={(text) => void handleAfterShiftHandoff(text)}
          submittingHandoff={submittingHandoff}
          onConfirmHours={() => void handleAfterShiftConfirmHours()}
          confirmingHours={confirmingHours}
          onDisputeHours={() => void handleAfterShiftDisputeHours()}
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
          // Notes are captured in the shift chat — navigate to active conversation
          router.push("/(app)/(chat)");
        }}
        onOpenSupplements={() => setShowSupplements(true)}
        onCallLeader={() => {
          if (leaderPhone) {
            void Linking.openURL(`tel:${leaderPhone}`);
          } else {
            Alert.alert("", "Ingen leder tilgjengelig. Bruk chat.");
          }
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

        {/* Gate on profile_id existence — empty-string fallback is forbidden
            (ADR-0134 / L-0083). TaskFeed assigns tasks by profile_id, so a
            forged blank silently shows the wrong set of tasks. */}
        {profile?.profile_id ? (
          <TaskFeed tasks={tasks ?? []} profileId={profile.profile_id} />
        ) : null}
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
          <LogOut size={18} color={styles.primaryFgColor.color} strokeWidth={2} />
          <Text style={styles.punchOutText}>{strings.shift.punchOut}</Text>
        </Pressable>
      </Animated.View>

      {/* Supplement bottom sheet — maps ManualSupplementOption → SupplementOption shape */}
      <SupplementSheet
        isOpen={showSupplements}
        onClose={() => setShowSupplements(false)}
        availableSupplements={supplementOptions.map((opt) => ({
          id: opt.supplement_rule_id,
          name: opt.name,
          description: opt.description ?? "",
          amount: opt.amount,
          rateType: opt.rate_type,
          salaryCode: opt.salary_code,
          commentRequired: opt.comment_required,
        }))}
        claimedSupplementRuleIds={new Set(supplementClaims.map((c) => c.supplement_rule_id))}
        onClaim={async (supplementRuleId, comment) => {
          const profileId = profile?.profile_id;
          const wsId = workspaceId;
          if (!profileId || !wsId) return;
          await claimSupplement({
            supplementRuleId,
            profileId,
            workspaceId: wsId,
            comment,
          });
        }}
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
    backgroundColor: theme.colors.background,
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
    borderBottomColor: theme.colors.border,
    marginBottom: 12,
    gap: 16,
  },

  feedTabActive: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: theme.colors.brandOrange,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.brandOrange,
  },

  feedTab: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
    paddingVertical: 10,
  },

  feedCard: {
    backgroundColor: theme.colors.card,
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
    borderTopColor: theme.colors.border,
  },

  punchOutButton: {
    backgroundColor: theme.colors.destructive,
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
    color: theme.colors.primaryForeground,
  },

  mutedFgColor: {
    color: theme.colors.mutedForeground,
  },

  brandOrangeColor: {
    color: theme.colors.brandOrange,
  },

  infoColor: {
    color: theme.colors.info,
  },

  successColor: {
    color: theme.colors.success,
  },

  primaryFgColor: {
    color: theme.colors.primaryForeground,
  },
}));
