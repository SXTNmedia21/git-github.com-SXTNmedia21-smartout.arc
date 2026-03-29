/**
 * Min Side — Personal hub.
 *
 * Nordic Split layout with Digest topbar pattern:
 * 1. TopBar — burger menu | "Smartout" | notification bell
 * 2. Welcome — greeting + subtitle
 * 3. Stats grid — Lønn, Timebank, Fraværssøknad (CTA), Saldo
 * 4. Recent payslips — last 3 with amounts
 * 5. Quick access — Arbeidskontrakt, Personvern
 */

import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  Menu,
  Banknote,
  Clock,
  CalendarOff,
  BarChart3,
  FileText,
  Shield,
  ChevronRight,
  ArrowRight,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ActionBar } from "@/components/navigation/ActionBar";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { strings } from "@/constants/strings";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return strings.home.goodMorning;
  if (h >= 12 && h < 17) return strings.home.goodAfternoon;
  if (h >= 17 && h < 22) return strings.home.goodEvening;
  return strings.home.goodNight;
}

const PAYSLIPS = [
  { id: "1", month: "Februar 2026", date: "Utbetalt 12.02.2026", amount: "32 450" },
  { id: "2", month: "Januar 2026", date: "Utbetalt 12.01.2026", amount: "28 100" },
  { id: "3", month: "Desember 2025", date: "Utbetalt 12.12.2025", amount: "35 200" },
];

export default function MeScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useMyProfile();

  const displayName = profile?.display_name ?? "";
  const firstName = displayName.split(" ")[0] || "";
  const role = profile?.role ?? "employee";
  const _jobTitle = profile?.job_title ?? role;
  const greeting = getGreeting();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* TopBar — Digest pattern: burger | brand | bell */}
      <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.topBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/(app)/(home)/settings");
          }}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Meny"
        >
          <Menu size={22} color={withOpacity(theme.colors.foreground, 0.45)} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.brandName}>Min Side</Text>
        <NotificationBell profileId={profile?.profile_id} />
      </Animated.View>

      <ActionBar />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Welcome */}
        <Animated.View entering={FadeIn.delay(50).duration(400)} style={styles.welcome}>
          <Text style={styles.welcomeTitle}>
            {greeting}, {firstName}
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Her er din oversikt for mars og kommende perioder.
          </Text>
        </Animated.View>

        {/* Stats Grid — Row 1: Lønn | Timebank, Row 2: Saldo | Nytt fravær */}
        <View style={styles.statsGrid}>
          {/* Lønn */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/(app)/(payroll)");
            }}
            style={({ pressed }) => [styles.statCard, pressed && styles.cardPressed]}
          >
            <View style={styles.statHeader}>
              <Banknote size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={styles.statLabel}>LØNN MAR</Text>
            </View>
            <View style={styles.statBottom}>
              <Text style={styles.statValue}>24</Text>
              <Text style={styles.statUnit}>timer</Text>
            </View>
          </Pressable>

          {/* Timebank */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/(app)/(payroll)/timebank");
            }}
            style={({ pressed }) => [styles.statCard, pressed && styles.cardPressed]}
          >
            <View style={styles.statHeader}>
              <Clock size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={styles.statLabel}>TIMEBANK</Text>
            </View>
            <View style={styles.statBottom}>
              <Text style={[styles.statValue, styles.statValueAccent]}>+12.5</Text>
              <Text style={styles.statUnit}>t</Text>
            </View>
          </Pressable>

          {/* Fraværsaldo */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/(app)/(payroll)/absence-balance");
            }}
            style={({ pressed }) => [styles.statCard, pressed && styles.cardPressed]}
          >
            <View style={styles.statHeader}>
              <BarChart3 size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={styles.statLabel}>SALDO</Text>
            </View>
            <View style={styles.statBottom}>
              <Text style={styles.statValue}>18</Text>
              <Text style={styles.statUnit}>dager igjen</Text>
            </View>
          </Pressable>

          {/* Fraværssøknad CTA */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/(app)/(payroll)/absence-request");
            }}
            style={({ pressed }) => [styles.statCardCta, pressed && styles.cardPressed]}
          >
            <View style={styles.statHeader}>
              <CalendarOff size={20} color="#ffffff" strokeWidth={1.5} />
              <Text style={styles.statLabelLight}>SØKNAD</Text>
            </View>
            <View style={styles.statCtaBottom}>
              <Text style={styles.statCtaText}>Nytt fravær</Text>
              <ArrowRight size={18} color="#ffffff" strokeWidth={2} />
            </View>
          </Pressable>
        </View>

        {/* Recent Payslips */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Siste lønnsslipper</Text>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/(app)/(payroll)/payslip");
              }}
            >
              <Text style={styles.seeAll}>Se alle</Text>
            </Pressable>
          </View>
          {PAYSLIPS.map((slip) => (
            <Pressable
              key={slip.id}
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/(app)/(payroll)/payslip");
              }}
              style={({ pressed }) => [styles.payslipRow, pressed && styles.cardPressed]}
            >
              <View style={styles.payslipLeft}>
                <View style={styles.payslipIcon}>
                  <FileText size={18} color={theme.colors.mutedForeground} strokeWidth={1.5} />
                </View>
                <View>
                  <Text style={styles.payslipMonth}>{slip.month}</Text>
                  <Text style={styles.payslipDate}>{slip.date}</Text>
                </View>
              </View>
              <View style={styles.payslipRight}>
                <Text style={styles.payslipAmount}>{slip.amount}</Text>
                <Text style={styles.payslipCurrency}>kr</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Quick Access */}
        <View style={styles.section}>
          <Pressable
            onPress={() => Haptics.selectionAsync()}
            style={({ pressed }) => [styles.quickLink, pressed && styles.cardPressed]}
          >
            <View style={styles.quickLinkLeft}>
              <FileText size={20} color={theme.colors.mutedForeground} strokeWidth={1.5} />
              <Text style={styles.quickLinkText}>Arbeidskontrakt</Text>
            </View>
            <ChevronRight
              size={18}
              color={withOpacity(theme.colors.mutedForeground, 0.4)}
              strokeWidth={1.5}
            />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/(app)/(home)/settings");
            }}
            style={({ pressed }) => [styles.quickLink, pressed && styles.cardPressed]}
          >
            <View style={styles.quickLinkLeft}>
              <Shield size={20} color={theme.colors.mutedForeground} strokeWidth={1.5} />
              <Text style={styles.quickLinkText}>Personvern og sikkerhet</Text>
            </View>
            <ChevronRight
              size={18}
              color={withOpacity(theme.colors.mutedForeground, 0.4)}
              strokeWidth={1.5}
            />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },

  /* TopBar — Digest pattern */
  topBar: {
    height: 50,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 22,
  },
  brandName: {
    fontSize: 22,
    fontStyle: "italic" as const,
    fontWeight: "300" as const,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },

  scrollContent: { paddingHorizontal: theme.spacing.section, paddingBottom: 160 },

  /* Welcome */
  welcome: { gap: 8, marginBottom: theme.spacing.page },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "300" as const,
    letterSpacing: -1,
    color: theme.colors.foreground,
  },
  welcomeSubtitle: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    maxWidth: "80%" as unknown as number,
  },

  /* Stats Grid */
  statsGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.page,
  },
  statCard: {
    flexBasis: "47%" as unknown as number,
    flexGrow: 1,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.03)" : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    justifyContent: "space-between" as const,
    minHeight: 140,
  },
  statCardCta: {
    flexBasis: "47%" as unknown as number,
    flexGrow: 1,
    backgroundColor: theme.colors.brandOrange,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    justifyContent: "space-between" as const,
    minHeight: 140,
    ...theme.shadows.lg,
  },
  cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  statHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500" as const,
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase" as const,
  },
  statLabelLight: {
    fontSize: 12,
    fontWeight: "500" as const,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase" as const,
  },
  statBottom: { flexDirection: "row" as const, alignItems: "baseline" as const, gap: 4 },
  statValue: { fontSize: 24, fontWeight: "700" as const, color: theme.colors.foreground },
  statValueAccent: { color: theme.colors.brandOrange },
  statUnit: { ...theme.typography.subheadline, color: theme.colors.mutedForeground },
  statCtaBottom: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  statCtaText: { fontSize: 18, fontWeight: "500" as const, color: "#ffffff" },

  /* Section */
  section: { marginBottom: theme.spacing.page, gap: theme.spacing.element },
  sectionHeader: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
    justifyContent: "space-between" as const,
  },
  sectionTitle: { ...theme.typography.title, color: theme.colors.foreground },
  seeAll: {
    ...theme.typography.subheadline,
    fontWeight: "500" as const,
    color: theme.colors.brandOrange,
  },

  /* Payslip rows */
  payslipRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: theme.spacing.card,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.4)",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
  },
  payslipLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
  },
  payslipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  payslipMonth: {
    ...theme.typography.body,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },
  payslipDate: { ...theme.typography.caption, color: theme.colors.mutedForeground },
  payslipRight: { flexDirection: "row" as const, alignItems: "baseline" as const, gap: 4 },
  payslipAmount: { fontSize: 18, fontWeight: "700" as const, color: theme.colors.foreground },
  payslipCurrency: { ...theme.typography.caption, color: theme.colors.mutedForeground },

  /* Quick links */
  quickLink: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: theme.spacing.md,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.02)" : withOpacity(theme.colors.muted, 0.3),
    borderRadius: theme.radius.lg,
  },
  quickLinkLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
  },
  quickLinkText: {
    ...theme.typography.body,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },
}));
