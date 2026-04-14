/**
 * SwapRequestSheet — Full-screen view for selecting a target shift to swap with.
 *
 * Layout:
 * 1. "Din vakt" summary at top (date, time, role)
 * 2. List of eligible colleague shifts on the same date
 * 3. On tap: runs validateSwap(), shows blockers (red) / warnings (amber)
 * 4. Optional reason TextInput
 * 5. "Send forespørsel" button calls useInitiateSwap
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  ArrowLeftRight,
  ChevronLeft,
  Clock,
  User,
  AlertTriangle,
  XCircle,
  Send,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { useEligibleSwapShifts } from "@/hooks/queries/use-eligible-swap-shifts";
import { useInitiateSwap } from "@/hooks/mutations/use-swap";
import { validateSwap } from "@smartout/utils/swap/validate-swap";
import type { EligibleSwapShift } from "@/hooks/queries/use-eligible-swap-shifts";
import type { ShiftForValidation, SwapValidationResult } from "@smartout/utils/swap/types";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type SwapRequestSheetProps = {
  shift: ScheduleShift;
  profileId: string;
};

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatShiftDate(dateStr: string): string {
  const DAYS = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
}

/** Convert a ScheduleShift row to the validation-compatible shape */
function toValidationShift(s: ScheduleShift | EligibleSwapShift): ShiftForValidation {
  return {
    schedule_shift_id: s.schedule_shift_id,
    employee_id: s.employee_id,
    shift_date: s.shift_date,
    start_time: s.start_time,
    end_time: s.end_time,
    work_hours: s.work_hours,
    position_id: s.position_id,
    status: s.status,
  };
}

export function SwapRequestSheet({ shift, profileId }: SwapRequestSheetProps) {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: eligibleShifts = [], isLoading } = useEligibleSwapShifts(shift.shift_date);
  const { initiateSwap, isSubmitting } = useInitiateSwap();

  const [selectedShift, setSelectedShift] = useState<EligibleSwapShift | null>(null);
  const [validationResult, setValidationResult] = useState<SwapValidationResult | null>(null);
  const [reason, setReason] = useState("");

  const handleSelectShift = useCallback(
    (target: EligibleSwapShift) => {
      Haptics.selectionAsync();
      setSelectedShift(target);

      // Run validation
      const result = validateSwap({
        requesterShift: toValidationShift(shift),
        targetShift: toValidationShift(target),
        // Simplified: we don't have all employee shifts here, pass empty arrays
        // The server-side RPC does full validation — this is a client-side pre-check
        targetEmployeeShifts: [],
        requesterEmployeeShifts: [],
        targetHasAbsence: false,
        requesterHasAbsence: false,
        now: new Date(),
      });
      setValidationResult(result);
    },
    [shift],
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedShift || !validationResult?.eligible) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await initiateSwap({
        requester_shift_id: shift.schedule_shift_id,
        target_shift_id: selectedShift.schedule_shift_id,
        reason: reason.trim() || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Noe gikk galt";
      Alert.alert("Kunne ikke sende forespørsel", message);
    }
  }, [selectedShift, validationResult, shift, reason, initiateSwap, router]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
        >
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>Bytt vakt</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Your shift summary */}
        <Animated.View entering={FadeIn.delay(50).duration(400)} style={styles.myShiftCard}>
          <View style={styles.myShiftHeader}>
            <ArrowLeftRight size={18} color={theme.colors.brandOrange} strokeWidth={1.5} />
            <Text style={styles.myShiftLabel}>Din vakt</Text>
          </View>
          <View style={styles.myShiftDetails}>
            <Text style={styles.myShiftDate}>{formatShiftDate(shift.shift_date)}</Text>
            <Text style={styles.myShiftTime}>
              {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
            </Text>
            <Text style={styles.myShiftRole}>{shift.role ?? "Vakt"}</Text>
          </View>
        </Animated.View>

        {/* Eligible shifts */}
        <Text style={styles.sectionTitle}>Velg vakt å bytte med</Text>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.colors.mutedForeground} />
            <Text style={styles.loadingText}>Laster tilgjengelige vakter...</Text>
          </View>
        ) : eligibleShifts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Ingen andre vakter denne dagen</Text>
          </View>
        ) : (
          <View style={styles.shiftList}>
            {eligibleShifts.map((es, index) => {
              const isSelected = selectedShift?.schedule_shift_id === es.schedule_shift_id;
              return (
                <Animated.View
                  key={es.schedule_shift_id}
                  entering={FadeInDown.delay(100 + index * 60).duration(300)}
                >
                  <Pressable
                    onPress={() => handleSelectShift(es)}
                    style={({ pressed }) => [
                      styles.eligibleCard,
                      isSelected && styles.eligibleCardSelected,
                      pressed && styles.eligibleCardPressed,
                    ]}
                  >
                    <View style={styles.eligibleLeft}>
                      <View style={styles.avatarCircle}>
                        <User
                          size={16}
                          color={
                            isSelected ? theme.colors.brandOrange : theme.colors.mutedForeground
                          }
                          strokeWidth={1.5}
                        />
                      </View>
                      <View>
                        <Text style={styles.eligibleName}>{es.display_name}</Text>
                        <Text style={styles.eligibleRole}>{es.role}</Text>
                      </View>
                    </View>
                    <View style={styles.eligibleRight}>
                      <Clock
                        size={12}
                        color={withOpacity(theme.colors.mutedForeground, 0.5)}
                        strokeWidth={1.5}
                      />
                      <Text style={styles.eligibleTime}>
                        {formatTime(es.start_time)} — {formatTime(es.end_time)}
                      </Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        )}

        {/* Validation results */}
        {validationResult && selectedShift && (
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.validationBox}>
            {validationResult.blockers.length > 0 && (
              <View style={styles.blockerSection}>
                {validationResult.blockers.map((b, i) => (
                  <View key={i} style={styles.validationRow}>
                    <XCircle size={14} color="#ef4444" strokeWidth={2} />
                    <Text style={styles.blockerText}>{formatValidationKey(b)}</Text>
                  </View>
                ))}
              </View>
            )}
            {validationResult.warnings.length > 0 && (
              <View style={styles.warningSection}>
                {validationResult.warnings.map((w, i) => (
                  <View key={i} style={styles.validationRow}>
                    <AlertTriangle size={14} color="#f59e0b" strokeWidth={2} />
                    <Text style={styles.warningText}>{formatValidationKey(w)}</Text>
                  </View>
                ))}
              </View>
            )}
            {validationResult.eligible &&
              validationResult.blockers.length === 0 &&
              validationResult.warnings.length === 0 && (
                <Text style={styles.eligibleText}>Ingen problemer funnet</Text>
              )}
          </Animated.View>
        )}

        {/* Reason input */}
        {selectedShift && validationResult?.eligible && (
          <Animated.View entering={FadeInDown.delay(150).duration(300)}>
            <Text style={styles.inputLabel}>Begrunnelse (valgfritt)</Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="F.eks. legetid, familiearrangement..."
              placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
              multiline
              maxLength={200}
            />
          </Animated.View>
        )}
      </ScrollView>

      {/* Submit button */}
      {selectedShift && validationResult?.eligible && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.bottomBar}>
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={({ pressed }) => [styles.submitButton, pressed && styles.submitPressed]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Send size={16} color="#ffffff" strokeWidth={2} />
                <Text style={styles.submitText}>Send forespørsel</Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

/** Maps validation keys to Norwegian labels */
function formatValidationKey(key: string): string {
  const labels: Record<string, string> = {
    "swap.blockerLocked": "Vakten har allerede startet eller passert",
    "swap.blockerOverlap": "Vaktene overlapper med en annen vakt",
    "swap.blockerQualification": "Stillingene matcher ikke",
    "swap.blockerAbsence": "En av partene har registrert fravær",
    "swap.warningHours": "Byttet kan overskride 37,5 timer/uke",
    "swap.warningRest": "Hviletid kan bli under 11 timer",
    "swap.warningSplitShift": "Kan utløse delt dagsverk-tillegg",
  };
  return labels[key] ?? key;
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.tight,
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.page,
    paddingTop: theme.spacing.section,
    paddingBottom: 120,
  },

  /* My shift card */
  myShiftCard: {
    backgroundColor: withOpacity(theme.colors.card, 0.8),
    borderRadius: 14,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.brandOrange, 0.2),
    marginBottom: theme.spacing.page,
  },
  myShiftHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginBottom: 10,
  },
  myShiftLabel: {
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: theme.colors.brandOrange,
  },
  myShiftDetails: {
    gap: 2,
  },
  myShiftDate: {
    ...theme.typography.body,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },
  myShiftTime: {
    fontSize: 20,
    fontWeight: "500" as const,
    letterSpacing: -0.5,
    color: theme.colors.foreground,
  },
  myShiftRole: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },

  /* Section title */
  sectionTitle: {
    ...theme.typography.subheadline,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.element,
  },

  /* Loading / empty */
  loadingWrap: {
    alignItems: "center" as const,
    gap: 8,
    paddingVertical: theme.spacing.xl,
  },
  loadingText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  emptyWrap: {
    alignItems: "center" as const,
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },

  /* Eligible shift cards */
  shiftList: {
    gap: 8,
    marginBottom: theme.spacing.section,
  },
  eligibleCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: withOpacity(theme.colors.card, 0.8),
    borderRadius: 12,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.5),
  },
  eligibleCardSelected: {
    borderColor: withOpacity(theme.colors.brandOrange, 0.4),
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.04),
  },
  eligibleCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  eligibleLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  eligibleName: {
    ...theme.typography.body,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
    fontSize: 13,
  },
  eligibleRole: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  eligibleRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  eligibleTime: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: theme.colors.brandOrange,
  },

  /* Validation */
  validationBox: {
    gap: 8,
    marginBottom: theme.spacing.section,
  },
  blockerSection: {
    gap: 6,
  },
  warningSection: {
    gap: 6,
  },
  validationRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  blockerText: {
    ...theme.typography.caption,
    color: "#ef4444",
    flex: 1,
  },
  warningText: {
    ...theme.typography.caption,
    color: "#d97706",
    flex: 1,
  },
  eligibleText: {
    ...theme.typography.caption,
    color: "#16a34a",
  },

  /* Reason input */
  inputLabel: {
    ...theme.typography.subheadline,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
    marginBottom: 6,
  },
  reasonInput: {
    backgroundColor: withOpacity(theme.colors.card, 0.8),
    borderRadius: 12,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.5),
    color: theme.colors.foreground,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: "top" as const,
  },

  /* Bottom bar */
  bottomBar: {
    paddingHorizontal: theme.spacing.page,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: withOpacity(theme.colors.border, 0.1),
    backgroundColor: theme.colors.background,
  },
  submitButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    paddingVertical: 14,
    backgroundColor: theme.colors.brandOrange,
    borderRadius: 14,
    ...theme.shadows.lg,
  },
  submitPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  submitText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#ffffff",
  },
}));
