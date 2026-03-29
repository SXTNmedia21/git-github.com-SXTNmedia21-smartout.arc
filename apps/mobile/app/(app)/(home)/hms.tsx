/**
 * HMS Oversikt — Health, Safety & Environment dashboard.
 *
 * Layout:
 * 1. Header — ← back | "HMS Oversikt" (serif) | spacer
 * 2. Compliance hero — status text + compact ring (94%)
 * 3. HACCP alert — active now CTA (most urgent, top)
 * 4. Deviations card — count + priority badges
 * 5. Row: Vernerunde | Insight (+12%)
 * 6. Daily tasks checklist
 * 7. FAB — "Meld Avvik"
 */

import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  AlertTriangle,
  CalendarClock,
  Zap,
  TrendingUp,
  CheckCircle2,
  Circle,
  ArrowRight,
  Plus,
  ChevronLeft,
} from "lucide-react-native";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import { createStyles, useTheme, withOpacity } from "@/theme";

const COMPLIANCE = 94;
const RING_R = 44;
const CIRC = 2 * Math.PI * RING_R;
const OFFSET = CIRC * (1 - COMPLIANCE / 100);

/* ── Compact ring ── */

function ComplianceRing() {
  const s = useRingStyles();
  const theme = useTheme();
  return (
    <View style={s.wrap}>
      <View style={{ transform: [{ rotate: "-90deg" }] }}>
        <Svg width={104} height={104} viewBox="0 0 104 104">
          <SvgCircle
            cx={52}
            cy={52}
            r={RING_R}
            fill="transparent"
            stroke={theme.colors.muted}
            strokeWidth={6}
          />
          <SvgCircle
            cx={52}
            cy={52}
            r={RING_R}
            fill="transparent"
            stroke={theme.colors.brandOrange}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${CIRC}`}
            strokeDashoffset={OFFSET}
          />
        </Svg>
      </View>
      <View style={s.center}>
        <Text style={s.pct}>{COMPLIANCE}%</Text>
      </View>
    </View>
  );
}

const useRingStyles = createStyles((theme) => ({
  wrap: {
    width: 104,
    height: 104,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  center: { position: "absolute" as const, alignItems: "center" as const },
  pct: {
    fontSize: 26,
    fontWeight: "700" as const,
    color: theme.colors.foreground,
    letterSpacing: -1,
  },
}));

/* ── Main ── */

export default function HMSScreen() {
  const s = useStyles();
  const theme = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Header */}
      <View style={s.headerBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={s.backBtn}
        >
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={s.headerTitle}>HMS Oversikt</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Hero — compact ── */}
        <Animated.View entering={FadeIn.delay(50).duration(400)} style={s.hero}>
          <View style={s.heroText}>
            <Text style={s.heroTitle}>
              Systemet er{"\n"}
              <Text style={s.heroAccent}>klart for drift.</Text>
            </Text>
            <Text style={s.heroSub}>3 aktive avvik krever oppfølging denne uken.</Text>
          </View>
          <ComplianceRing />
        </Animated.View>

        {/* ── HACCP Alert — top priority ── */}
        <View style={s.haccpCard}>
          <View style={s.haccpTop}>
            <View style={s.haccpBadge}>
              <View style={s.haccpDot} />
              <Text style={s.haccpBadgeText}>AKTIV NÅ</Text>
            </View>
            <Text style={s.haccpDeadline}>Frist: 12:30</Text>
          </View>
          <Text style={s.haccpTitle}>HACCP Temperaturkontroll</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/(app)/(home)/temp-deviation");
            }}
            style={({ pressed }) => [s.haccpCta, pressed && s.ctaPressed]}
          >
            <Zap size={16} color="#ffffff" strokeWidth={2} />
            <Text style={s.haccpCtaText}>Start måling</Text>
          </Pressable>
        </View>

        {/* ── Deviations ── */}
        <View style={s.deviationCard}>
          <View style={s.deviationTop}>
            <View>
              <Text style={s.deviationCount}>3 Aktive Avvik</Text>
              <Text style={s.deviationSub}>Siste 48 timer</Text>
            </View>
            <AlertTriangle size={24} color={theme.colors.brandOrange} strokeWidth={1.5} />
          </View>
          <View style={s.badgeRow}>
            <View style={[s.badge, s.badgeHigh]}>
              <View style={[s.badgeDot, { backgroundColor: theme.colors.destructive }]} />
              <Text style={s.badgeLabel}>1 Høy</Text>
            </View>
            <View style={s.badge}>
              <View style={[s.badgeDot, { backgroundColor: theme.colors.mutedForeground }]} />
              <Text style={s.badgeLabel}>2 Lav</Text>
            </View>
          </View>
          <Pressable onPress={() => Haptics.selectionAsync()} style={s.seeAll}>
            <Text style={s.seeAllText}>Se alle detaljer</Text>
            <ArrowRight size={14} color={theme.colors.brandOrange} strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Row: Vernerunde | Insight ── */}
        <View style={s.bentoRow}>
          {/* Vernerunde */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/(app)/(home)/safety-round");
            }}
            style={({ pressed }) => [s.verneCard, pressed && s.ctaPressed]}
          >
            <View style={s.verneIcon}>
              <CalendarClock size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
            </View>
            <Text style={s.verneOverline}>KOMMENDE</Text>
            <Text style={s.verneTitle}>Vernerunde</Text>
            <Text style={s.verneTime}>Torsdag, 14:00</Text>
          </Pressable>

          {/* Insight */}
          <View style={s.insightCard}>
            <TrendingUp size={22} color={theme.colors.brandOrange} strokeWidth={1.5} />
            <Text style={s.insightValue}>+12%</Text>
            <Text style={s.insightLabel}>Forbedring{"\n"}vs forrige mnd</Text>
          </View>
        </View>

        {/* ── Daily Tasks ── */}
        <View style={s.taskCard}>
          <Text style={s.taskTitle}>DAGENS GJØREMÅL</Text>
          <View style={s.taskList}>
            <View style={s.taskRow}>
              <CheckCircle2 size={18} color={theme.colors.success} strokeWidth={1.8} />
              <Text style={[s.taskText, s.taskDone]}>Brannøvelse info sendt</Text>
            </View>
            <View style={s.taskRow}>
              <Circle size={18} color={theme.colors.mutedForeground} strokeWidth={1.5} />
              <Text style={s.taskText}>Oppdater ansattliste HMS</Text>
            </View>
            <View style={s.taskRow}>
              <Circle size={18} color={theme.colors.mutedForeground} strokeWidth={1.5} />
              <Text style={s.taskText}>Kontroll av førstehjelpsskrin</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* FAB */}
      <View style={s.fabWrap}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/(app)/(home)/deviation");
          }}
          style={({ pressed }) => [s.fab, pressed && { transform: [{ scale: 0.9 }] }]}
        >
          <Plus size={26} color="#ffffff" strokeWidth={2} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },

  /* Header */
  headerBar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerTitle: {
    fontSize: 22,
    fontStyle: "italic" as const,
    fontWeight: "300" as const,
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },

  scroll: { paddingHorizontal: theme.spacing.section, paddingBottom: 160 },

  /* Hero */
  hero: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: theme.spacing.section,
  },
  heroText: { flex: 1, marginRight: theme.spacing.md },
  heroTitle: {
    fontSize: 28,
    fontWeight: "300" as const,
    lineHeight: 34,
    color: theme.colors.foreground,
  },
  heroAccent: { fontStyle: "italic" as const, color: theme.colors.brandOrange },
  heroSub: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    marginTop: 8,
    lineHeight: 20,
  },

  /* HACCP */
  haccpCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.page,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.element,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.brandOrange, 0.1),
  },
  haccpTop: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  haccpBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    backgroundColor: theme.colors.brandOrange,
    borderRadius: theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  haccpDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ffffff" },
  haccpBadgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 1.5,
    color: "#ffffff",
  },
  haccpDeadline: { fontSize: 12, fontWeight: "500" as const, color: theme.colors.mutedForeground },
  haccpTitle: { fontSize: 18, fontWeight: "600" as const, color: theme.colors.foreground },
  haccpCta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    height: 48,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
    ...theme.shadows.md,
  },
  haccpCtaText: { fontSize: 14, fontWeight: "600" as const, color: "#ffffff" },
  ctaPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },

  /* Deviations */
  deviationCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.page,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  deviationTop: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
  },
  deviationCount: { fontSize: 18, fontWeight: "600" as const, color: theme.colors.foreground },
  deviationSub: { fontSize: 12, color: theme.colors.mutedForeground, marginTop: 2 },
  badgeRow: { flexDirection: "row" as const, gap: theme.spacing.element },
  badge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : theme.colors.muted,
    borderRadius: theme.radius.md,
  },
  badgeHigh: { borderWidth: 1, borderColor: withOpacity(theme.colors.destructive, 0.12) },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeLabel: { fontSize: 12, fontWeight: "600" as const, color: theme.colors.foreground },
  seeAll: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "flex-end" as const,
    gap: 6,
    paddingTop: theme.spacing.xs,
  },
  seeAllText: { fontSize: 13, fontWeight: "600" as const, color: theme.colors.brandOrange },

  /* Bento row */
  bentoRow: {
    flexDirection: "row" as const,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },

  /* Vernerunde */
  verneCard: {
    flex: 1,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.muted,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    gap: 6,
  },
  verneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.1),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 4,
  },
  verneOverline: {
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 1.5,
    color: theme.colors.mutedForeground,
  },
  verneTitle: { fontSize: 16, fontWeight: "600" as const, color: theme.colors.foreground },
  verneTime: { fontSize: 14, fontWeight: "500" as const, color: theme.colors.brandOrange },

  /* Insight */
  insightCard: {
    flex: 1,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
  },
  insightValue: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: theme.colors.brandOrange,
    letterSpacing: -1,
  },
  insightLabel: {
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
    textTransform: "uppercase" as const,
  },

  /* Tasks */
  taskCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.muted,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.page,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.section,
  },
  taskTitle: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
  },
  taskList: { gap: theme.spacing.element },
  taskRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: theme.spacing.md },
  taskText: { fontSize: 14, fontWeight: "500" as const, color: theme.colors.foreground },
  taskDone: { textDecorationLine: "line-through" as const, color: theme.colors.mutedForeground },

  /* FAB */
  fabWrap: { position: "absolute" as const, bottom: 100, right: theme.spacing.section },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...theme.shadows.lg,
  },
}));
