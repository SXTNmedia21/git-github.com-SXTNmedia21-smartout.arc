/**
 * Supplements — Register and track payroll claims.
 *
 * Fetches real data from:
 * - useMySupplementClaims() for the employee's recent claims
 * - useSubmitSupplement() for submitting new claims (offline-first)
 *
 * The manual_supplement table requires a schedule_shift_id, so the form
 * requires the employee to select a shift. If no recent shifts exist,
 * the form shows a note explaining this requirement.
 *
 * Layout:
 * 1. Hero: subtitle
 * 2. Stats bento (2-col): Pending count | Total value (computed from real claims)
 * 3. New Supplement form: type, amount, date, comment, submit
 * 4. Recent Claims list with status badges
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { PlusCircle, Car, UtensilsCrossed, Clock, Send, FileText } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { ActionHeader } from "@/components/navigation/ActionHeader";
import { useMySupplementClaims } from "@/hooks/queries/use-my-supplement-claims";
import { useMyShifts } from "@/hooks/queries/use-my-shifts";
import { useSubmitSupplement } from "@/hooks/mutations/use-submit-supplement";

/* ── Types ── */

type ClaimStatus = "pending" | "approved" | "rejected";

const SUPPLEMENT_TYPES = ["Overtidstillegg", "Reisegodtgj\u00f8relse", "Mattillegg", "Annet"];

const STATUS_CONFIG: Record<
  ClaimStatus,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  pending: {
    label: "Venter",
    color: "#8d7165",
    bgColor: "rgba(229,226,221,0.2)",
    borderColor: "rgba(141,113,101,0.3)",
  },
  approved: {
    label: "Godkjent",
    color: "#11ad32",
    bgColor: "rgba(17,173,50,0.06)",
    borderColor: "rgba(17,173,50,0.3)",
  },
  rejected: {
    label: "Avvist",
    color: "#ba1a1a",
    bgColor: "rgba(186,26,26,0.06)",
    borderColor: "rgba(186,26,26,0.3)",
  },
};

/** Pick an icon based on the supplement description */
function getClaimIcon(description: string): typeof Car {
  const lower = description.toLowerCase();
  if (lower.includes("reise") || lower.includes("transport") || lower.includes("bil")) return Car;
  if (lower.includes("mat") || lower.includes("lunsj") || lower.includes("middag"))
    return UtensilsCrossed;
  if (lower.includes("overtid") || lower.includes("tid")) return Clock;
  return FileText;
}

/** Format ISO date to Norwegian display: "12. OKT 2026" */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAI",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OKT",
    "NOV",
    "DES",
  ];
  return `${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/** Format amount with Norwegian comma separator */
function formatAmount(amount: number): string {
  return amount.toFixed(2).replace(".", ",");
}

/* ── Component ── */

export default function SupplementsScreen() {
  const styles = useStyles();
  const theme = useTheme();

  const { data: claimsData, isLoading: loadingClaims } = useMySupplementClaims();
  const { data: shiftsData } = useMyShifts();
  const { submitSupplement } = useSubmitSupplement();

  const [selectedType, setSelectedType] = useState(0);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const claims = claimsData?.claims ?? [];

  // Compute stats from real claims
  const stats = useMemo(() => {
    const pendingClaims = claims.filter((c) => c.status === "pending");
    const pendingCount = pendingClaims.length;
    const totalValue = pendingClaims.reduce((sum, c) => sum + c.amount, 0);
    return { pendingCount, totalValue };
  }, [claims]);

  // Find the most recent shift to attach the supplement to
  const mostRecentShiftId = useMemo(() => {
    const shifts = shiftsData ?? [];
    return shifts.length > 0 ? shifts[0].schedule_shift_id : null;
  }, [shiftsData]);

  const handleSubmit = useCallback(async () => {
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Ugyldig bel\u00f8p", "Vennligst skriv inn et gyldig bel\u00f8p.");
      return;
    }
    if (!comment.trim()) {
      Alert.alert("Mangler kommentar", "Vennligst begrunn tillegget.");
      return;
    }
    if (!mostRecentShiftId) {
      Alert.alert(
        "Ingen vakt funnet",
        "Du m\u00e5 ha minst \u00e9n registrert vakt for \u00e5 sende inn tillegg.",
      );
      return;
    }

    // Use provided date or today
    const claimDate = date.trim() || new Date().toISOString().slice(0, 10);

    setIsSubmitting(true);
    try {
      await submitSupplement({
        description: SUPPLEMENT_TYPES[selectedType],
        amount: parsedAmount,
        date: claimDate,
        comment: comment.trim(),
        scheduleShiftId: mostRecentShiftId,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Sendt", "Tillegget ditt er registrert.");
      setAmount("");
      setDate("");
      setComment("");
    } catch {
      Alert.alert("Feil", "Kunne ikke sende kravet. Pr\u00f8v igjen.");
    } finally {
      setIsSubmitting(false);
    }
  }, [amount, comment, date, selectedType, mostRecentShiftId, submitSupplement]);

  return (
    <View style={styles.container}>
      <ActionHeader title="Tillegg" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Subtitle */}
        <Text style={styles.heroSubtitle}>Registrer og spor tillegg og utlegg.</Text>

        {/* Stats Bento — computed from real claims */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Ventende</Text>
            <Text style={styles.statValue}>
              {loadingClaims ? "\u2014" : stats.pendingCount}{" "}
              <Text style={styles.statUnit}>krav</Text>
            </Text>
          </View>
          <View style={[styles.statCard, styles.statCardHighlight]}>
            <Text style={styles.statLabel}>Total verdi</Text>
            <Text style={[styles.statValue, { color: theme.colors.brandOrange }]}>
              {loadingClaims ? "\u2014" : formatAmount(stats.totalValue)}
              <Text style={styles.statUnit}> kr</Text>
            </Text>
          </View>
        </View>

        {/* New Supplement Form */}
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Nytt tillegg</Text>
            <PlusCircle size={22} color={theme.colors.brandOrange} strokeWidth={1.5} />
          </View>

          {/* Type picker */}
          <Text style={styles.fieldLabel}>Type tillegg</Text>
          <View style={styles.typeRow}>
            {SUPPLEMENT_TYPES.map((type, i) => (
              <Pressable
                key={type}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedType(i);
                }}
                style={[styles.typePill, selectedType === i && styles.typePillActive]}
              >
                <Text
                  style={[styles.typePillText, selectedType === i && styles.typePillTextActive]}
                >
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Amount + Date row */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Bel\u00f8p</Text>
              <TextInput
                style={styles.input}
                placeholder="0,00"
                placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Dato</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
                value={date}
                onChangeText={setDate}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
          </View>

          {/* Comment */}
          <Text style={styles.fieldLabel}>Kommentar (p\u00e5krevd)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Begrunn tillegget..."
            placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitPressed,
              isSubmitting && { opacity: 0.6 },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Send size={18} color="#ffffff" strokeWidth={2} />
                <Text style={styles.submitText}>Send inn krav</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Recent Claims */}
        <View style={styles.claimsSection}>
          <View style={styles.claimsHeader}>
            <Text style={styles.claimsTitle}>Siste krav</Text>
            <Text style={styles.claimsViewAll}>VIS ALLE</Text>
          </View>

          {loadingClaims && (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
            </View>
          )}

          {!loadingClaims && claims.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Ingen krav enn\u00e5</Text>
            </View>
          )}

          {claims.map((claim) => {
            const IconComponent = getClaimIcon(claim.description);
            const claimStatus = (claim.status ?? "pending") as ClaimStatus;
            const status = STATUS_CONFIG[claimStatus];
            const isRejected = claimStatus === "rejected";

            return (
              <View key={claim.id} style={styles.claimRow}>
                <View style={styles.claimLeft}>
                  <View
                    style={[
                      styles.claimIcon,
                      { backgroundColor: withOpacity(theme.colors.brandOrange, 0.05) },
                    ]}
                  >
                    <IconComponent
                      size={20}
                      color={isRejected ? theme.colors.destructive : theme.colors.brandOrange}
                      strokeWidth={1.5}
                    />
                  </View>
                  <View>
                    <Text style={styles.claimTitle}>{claim.description}</Text>
                    <Text style={styles.claimDate}>{formatDate(claim.created_at)}</Text>
                  </View>
                </View>
                <View style={styles.claimRight}>
                  <Text style={[styles.claimAmount, isRejected && styles.claimAmountRejected]}>
                    {formatAmount(claim.amount)}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: status.bgColor, borderColor: status.borderColor },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.md,
    paddingBottom: 160,
  },

  /* Hero */
  heroSubtitle: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.page,
  },

  /* Stats */
  statsRow: {
    flexDirection: "row" as const,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.page,
  },
  statCard: {
    flexBasis: "47%" as unknown as number,
    flexGrow: 1,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    justifyContent: "space-between" as const,
    height: 120,
  },
  statCardHighlight: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.muted,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: theme.colors.mutedForeground,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  statUnit: {
    fontSize: 14,
    fontWeight: "400" as const,
    fontStyle: "normal" as const,
    color: theme.colors.mutedForeground,
  },

  /* Form Card */
  formCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.page,
    marginBottom: theme.spacing.page,
    gap: theme.spacing.element,
    borderWidth: 0.5,
    borderColor: withOpacity(theme.colors.border, 0.15),
    ...theme.shadows.lg,
  },
  formHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: theme.spacing.xs,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: theme.colors.mutedForeground,
  },
  typeRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: theme.spacing.tight,
  },
  typePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : theme.colors.background,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
  },
  typePillActive: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.1),
    borderColor: theme.colors.brandOrange,
  },
  typePillText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
  },
  typePillTextActive: {
    color: theme.colors.brandOrange,
    fontWeight: "600" as const,
  },
  fieldRow: {
    flexDirection: "row" as const,
    gap: theme.spacing.md,
  },
  fieldHalf: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.foreground,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top" as const,
  },
  submitButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: theme.spacing.tight,
    height: 52,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.brandOrange,
    marginTop: theme.spacing.xs,
    ...theme.shadows.lg,
  },
  submitPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  submitText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#ffffff",
  },

  /* Claims */
  claimsSection: {
    gap: theme.spacing.element,
  },
  claimsHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  claimsTitle: {
    fontSize: 24,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  claimsViewAll: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    color: theme.colors.mutedForeground,
  },
  claimRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: theme.isDark ? theme.colors.card : "#ffffff",
    borderRadius: theme.radius.md,
    padding: theme.spacing.card,
  },
  claimLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
    flex: 1,
  },
  claimIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  claimTitle: {
    ...theme.typography.body,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },
  claimDate: {
    fontSize: 11,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  claimRight: {
    alignItems: "flex-end" as const,
    gap: 6,
  },
  claimAmount: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: theme.colors.brandOrange,
    fontVariant: ["tabular-nums" as const],
  },
  claimAmountRejected: {
    color: withOpacity(theme.colors.foreground, 0.4),
    textDecorationLine: "line-through" as const,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },

  /* Empty / Loading states */
  emptyState: {
    paddingVertical: theme.spacing.page,
    alignItems: "center" as const,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    fontStyle: "italic" as const,
  },
}));
