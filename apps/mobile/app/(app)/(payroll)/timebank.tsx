/**
 * Timebank — Balance overview with hero card and ledger.
 *
 * Layout:
 * 1. Hero card: deep blue gradient, "avspasering" serif, balance 12.5t
 * 2. Stats bento (2-col): Opptjent i år | Brukt i år
 * 3. Siste bevegelser: ledger list with +/- amounts
 */

import React from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LogOut, PlusCircle, Clock, CalendarX } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { ActionHeader } from "@/components/navigation/ActionHeader";

/* ── Mock data ── */

type LedgerEntry = {
  id: string;
  icon: typeof PlusCircle;
  title: string;
  date: string;
  amount: string;
  isCredit: boolean;
  note: string;
};

const MOCK_LEDGER: LedgerEntry[] = [
  {
    id: "1",
    icon: LogOut,
    title: "Uttak avspasering",
    date: "22. MAI 2026 • FREDAG",
    amount: "4.0t",
    isCredit: false,
    note: "Godkjent",
  },
  {
    id: "2",
    icon: PlusCircle,
    title: "Overtid 50%",
    date: "20. MAI 2026 • ONSDAG",
    amount: "2.0t",
    isCredit: true,
    note: "Auto-beregnet",
  },
  {
    id: "3",
    icon: Clock,
    title: "Mersmak Prosjekt",
    date: "18. MAI 2026 • MANDAG",
    amount: "1.5t",
    isCredit: true,
    note: "Manuelt ført",
  },
  {
    id: "4",
    icon: CalendarX,
    title: "Tidlig avgang",
    date: "15. MAI 2026 • FREDAG",
    amount: "2.0t",
    isCredit: false,
    note: "Godkjent",
  },
];

/* ── Component ── */

export default function TimebankScreen() {
  const styles = useStyles();
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ActionHeader title="Timebank" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Demo Banner */}
        <View
          style={{
            backgroundColor: "#fef3cd",
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 8,
            marginHorizontal: 16,
            marginTop: 8,
            marginBottom: 8,
          }}
        >
          <Text
            style={{
              color: "#856404",
              fontSize: 13,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            Demo — denne siden er under utvikling
          </Text>
        </View>

        {/* Hero Card — deep blue */}
        <Animated.View entering={FadeIn.delay(50).duration(400)} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroOverline}>Tilgjengelig tid</Text>
              <Text style={styles.heroTitle}>avspasering</Text>
            </View>
            <View style={styles.heroBadge}>
              <View style={styles.heroBadgeDot} />
              <Text style={styles.heroBadgeText}>Oppdatert nå</Text>
            </View>
          </View>

          <View style={styles.heroBottom}>
            <View style={styles.heroBalanceRow}>
              <Text style={styles.heroBalance}>12.5</Text>
              <Text style={styles.heroBalanceUnit}>timer</Text>
            </View>
            <Text style={styles.heroCaption}>Basert på dine bevegelser frem til 24. mai 2026</Text>
          </View>
        </Animated.View>

        {/* Stats Bento */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Opptjent i år</Text>
            <Text style={[styles.statValue, { color: theme.colors.brandOrange }]}>+24.0t</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Brukt i år</Text>
            <Text style={styles.statValue}>-11.5t</Text>
          </View>
        </View>

        {/* Ledger */}
        <View style={styles.ledgerSection}>
          <View style={styles.ledgerHeader}>
            <Text style={styles.ledgerTitle}>Siste bevegelser</Text>
            <Pressable onPress={() => Haptics.selectionAsync()}>
              <Text style={styles.ledgerViewAll}>SE ALLE</Text>
            </Pressable>
          </View>

          {MOCK_LEDGER.map((entry) => {
            const IconComponent = entry.icon;
            return (
              <View key={entry.id} style={styles.ledgerRow}>
                <View style={styles.ledgerLeft}>
                  <View
                    style={[
                      styles.ledgerIcon,
                      {
                        backgroundColor: entry.isCredit
                          ? withOpacity(theme.colors.brandOrange, 0.08)
                          : withOpacity(theme.colors.destructive, 0.08),
                      },
                    ]}
                  >
                    <IconComponent
                      size={20}
                      color={entry.isCredit ? theme.colors.brandOrange : theme.colors.destructive}
                      strokeWidth={1.5}
                    />
                  </View>
                  <View>
                    <Text style={styles.ledgerName}>{entry.title}</Text>
                    <Text style={styles.ledgerDate}>{entry.date}</Text>
                  </View>
                </View>
                <View style={styles.ledgerRight}>
                  <Text
                    style={[
                      styles.ledgerAmount,
                      {
                        color: entry.isCredit ? theme.colors.brandOrange : theme.colors.foreground,
                      },
                    ]}
                  >
                    {entry.isCredit ? "+" : "-"}
                    {entry.amount}
                  </Text>
                  <Text style={styles.ledgerNote}>{entry.note}</Text>
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

  /* Hero — deep blue card */
  heroCard: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.page,
    marginBottom: theme.spacing.page,
    backgroundColor: "#1c3a5e",
    overflow: "hidden" as const,
    minHeight: 220,
    justifyContent: "space-between" as const,
    ...theme.shadows.lg,
  },
  heroTop: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
  },
  heroOverline: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.6)",
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: "#ffffff",
    marginTop: 4,
  },
  heroBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#93c5fd",
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    color: "#ffffff",
  },
  heroBottom: {
    marginTop: theme.spacing.section,
  },
  heroBalanceRow: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
    gap: 8,
  },
  heroBalance: {
    fontSize: 64,
    fontWeight: "300" as const,
    color: "#ffffff",
    letterSpacing: -2,
    fontVariant: ["tabular-nums" as const],
  },
  heroBalanceUnit: {
    fontSize: 22,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: "rgba(255,255,255,0.7)",
  },
  heroCaption: {
    fontSize: 13,
    fontWeight: "400" as const,
    color: "rgba(255,255,255,0.5)",
    marginTop: 8,
    maxWidth: 240,
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
    justifyContent: "center" as const,
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: theme.colors.mutedForeground,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums" as const],
  },

  /* Ledger */
  ledgerSection: {
    gap: theme.spacing.element,
  },
  ledgerHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: theme.spacing.xs,
  },
  ledgerTitle: {
    fontSize: 24,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  ledgerViewAll: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    color: theme.colors.brandOrange,
  },
  ledgerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: theme.isDark ? theme.colors.card : "#ffffff",
    borderRadius: theme.radius.md,
    padding: theme.spacing.card,
  },
  ledgerLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
    flex: 1,
  },
  ledgerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  ledgerName: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },
  ledgerDate: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  ledgerRight: {
    alignItems: "flex-end" as const,
    gap: 2,
  },
  ledgerAmount: {
    fontSize: 18,
    fontWeight: "500" as const,
    fontVariant: ["tabular-nums" as const],
  },
  ledgerNote: {
    fontSize: 10,
    fontWeight: "400" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
}));
