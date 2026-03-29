/**
 * Supplements — Register and track payroll claims.
 *
 * Layout:
 * 1. Hero: "Supplements" serif title + subtitle
 * 2. Stats bento (2-col): Pending count | Total value
 * 3. New Supplement form: type, amount, date, comment, submit
 * 4. Recent Claims list with status badges
 */

import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Alert } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { PlusCircle, Car, UtensilsCrossed, Clock, Send } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { ActionHeader } from "@/components/navigation/ActionHeader";

/* ── Types ── */

type ClaimStatus = "pending" | "approved" | "rejected";

type ClaimItem = {
  id: string;
  icon: typeof Car;
  title: string;
  date: string;
  amount: string;
  status: ClaimStatus;
};

const SUPPLEMENT_TYPES = ["Overtidstillegg", "Reisegodtgjørelse", "Mattillegg", "Annet"];

const MOCK_CLAIMS: ClaimItem[] = [
  {
    id: "1",
    icon: Car,
    title: "Reiseutlegg",
    date: "12. OKT 2026",
    amount: "450,00",
    status: "pending",
  },
  {
    id: "2",
    icon: UtensilsCrossed,
    title: "Kundelunsj",
    date: "08. OKT 2026",
    amount: "85,20",
    status: "approved",
  },
  {
    id: "3",
    icon: Clock,
    title: "Helg overtid",
    date: "01. OKT 2026",
    amount: "700,00",
    status: "rejected",
  },
];

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

/* ── Component ── */

export default function SupplementsScreen() {
  const styles = useStyles();
  const theme = useTheme();

  const [selectedType, setSelectedType] = useState(0);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [comment, setComment] = useState("");

  const handleSubmit = useCallback(() => {
    if (!amount || !comment) {
      Alert.alert("Mangler felt", "Fyll inn beløp og kommentar.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Sendt", "Tillegget er registrert.");
    setAmount("");
    setDate("");
    setComment("");
  }, [amount, comment]);

  return (
    <View style={styles.container}>
      <ActionHeader title="Tillegg" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Subtitle */}
        <Text style={styles.heroSubtitle}>Registrer og spor tillegg og utlegg.</Text>

        {/* Stats Bento */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Ventende</Text>
            <Text style={styles.statValue}>
              3 <Text style={styles.statUnit}>krav</Text>
            </Text>
          </View>
          <View style={[styles.statCard, styles.statCardHighlight]}>
            <Text style={styles.statLabel}>Total verdi</Text>
            <Text style={[styles.statValue, { color: theme.colors.brandOrange }]}>
              1 240<Text style={styles.statUnit}>,00</Text>
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
              <Text style={styles.fieldLabel}>Beløp</Text>
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
          <Text style={styles.fieldLabel}>Kommentar (påkrevd)</Text>
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
            style={({ pressed }) => [styles.submitButton, pressed && styles.submitPressed]}
          >
            <Send size={18} color="#ffffff" strokeWidth={2} />
            <Text style={styles.submitText}>Send inn krav</Text>
          </Pressable>
        </View>

        {/* Recent Claims */}
        <View style={styles.claimsSection}>
          <View style={styles.claimsHeader}>
            <Text style={styles.claimsTitle}>Siste krav</Text>
            <Text style={styles.claimsViewAll}>VIS ALLE</Text>
          </View>

          {MOCK_CLAIMS.map((claim) => {
            const IconComponent = claim.icon;
            const status = STATUS_CONFIG[claim.status];
            const isRejected = claim.status === "rejected";

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
                    <Text style={styles.claimTitle}>{claim.title}</Text>
                    <Text style={styles.claimDate}>{claim.date}</Text>
                  </View>
                </View>
                <View style={styles.claimRight}>
                  <Text style={[styles.claimAmount, isRejected && styles.claimAmountRejected]}>
                    {claim.amount}
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
  heroTitle: {
    fontSize: 40,
    fontWeight: "400" as const,
    fontStyle: "italic" as const,
    color: theme.colors.brandOrange,
    letterSpacing: -1,
    marginBottom: 4,
  },
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
}));
