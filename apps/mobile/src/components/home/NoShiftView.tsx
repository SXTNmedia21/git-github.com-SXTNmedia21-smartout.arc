/**
 * NoShiftView — Day off / no upcoming shift.
 *
 * Layout:
 * 1. Hero — greeting + "Du har fri i dag!" + quote
 * 2. Community — birthday + event bento cards
 * 3. Latest news — announcement card
 * 4. Growth — training progress, recommended course, badge
 */

import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Cake, PartyPopper, BookOpen, ChevronRight, Award, Clock } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { strings } from "@/constants/strings";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type NoShiftViewProps = {
  firstName: string;
  nextShift?: ScheduleShift | null;
};

/** Format a shift date+time into a human-readable Norwegian label */
function formatNextShift(shift: ScheduleShift): string {
  const dayNames = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
  const shiftDate = new Date(shift.shift_date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const time = shift.start_time.slice(0, 5); // "10:00:00" → "10:00"

  if (shiftDate.getTime() === today.getTime()) return `i dag kl. ${time}`;
  if (shiftDate.getTime() === tomorrow.getTime()) return `i morgen kl. ${time}`;

  const dayName = dayNames[shiftDate.getDay()] ?? "";
  return `${dayName} kl. ${time}`;
}

export function NoShiftView({ firstName, nextShift }: NoShiftViewProps) {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();

  const nextShiftLabel = useMemo(
    () => (nextShift ? formatNextShift(nextShift) : null),
    [nextShift],
  );

  return (
    <View style={styles.content}>
      {/* Hero */}
      <Animated.View entering={FadeIn.delay(50).duration(500)} style={styles.hero}>
        <Text style={styles.heroTitle}>
          {strings.home.goodMorning}, {firstName}.{"\n"}
          <Text style={styles.heroAccent}>
            {nextShift ? "Du har fri nå." : "Du har fri i dag!"}
          </Text>
        </Text>

        {/* Next shift preview — shown when there's an upcoming shift */}
        {nextShift && nextShiftLabel ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/(app)/(shifts)/${nextShift.schedule_shift_id}`);
            }}
            style={styles.nextShiftCard}
          >
            <View style={styles.nextShiftIcon}>
              <Clock size={18} color={theme.colors.brandOrange} strokeWidth={1.5} />
            </View>
            <View style={styles.nextShiftInfo}>
              <Text style={styles.nextShiftLabel}>NESTE VAKT</Text>
              <Text style={styles.nextShiftTime}>{nextShiftLabel}</Text>
              <Text style={styles.nextShiftRole}>
                {nextShift.role} · {nextShift.start_time.slice(0, 5)}–
                {nextShift.end_time.slice(0, 5)}
              </Text>
            </View>
            <ChevronRight
              size={18}
              color={withOpacity(theme.colors.mutedForeground, 0.4)}
              strokeWidth={1.5}
            />
          </Pressable>
        ) : (
          <View style={styles.quoteBlock}>
            <Text style={styles.quoteText}>
              "Stillhet er ikke fravær av lyd, men nærvær av fred."
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Community */}
      <Animated.View
        entering={FadeInDown.delay(150).duration(400).springify()}
        style={styles.section}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Felleskap</Text>
          <Text style={styles.sectionMeta}>I DAG</Text>
        </View>
        <View style={styles.communityGrid}>
          <View style={styles.communityCard}>
            <Cake size={28} color={theme.colors.brandOrange} strokeWidth={1.3} />
            <View>
              <Text style={styles.communityLabel}>BURSDAG</Text>
              <Text style={styles.communityText}>Lars feirer år i dag!</Text>
            </View>
          </View>
          <View style={[styles.communityCard, styles.communityCardAccent]}>
            <PartyPopper size={28} color={theme.colors.brandOrange} strokeWidth={1.3} />
            <View>
              <Text style={styles.communityLabel}>SOSIALT</Text>
              <Text style={styles.communityText}>Summer Party</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* News */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(400).springify()}
        style={styles.section}
      >
        <Text style={styles.sectionTitle}>Siste nytt</Text>
        <View style={styles.newsCard}>
          <View style={styles.newsImage} />
          <View style={styles.newsBody}>
            <Text style={styles.newsTitle}>Ny sesongmeny er her!</Text>
            <Text style={styles.newsDesc}>
              Bli kjent med de nye smakene og allergenene før ditt neste skift.
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Growth */}
      <Animated.View
        entering={FadeInDown.delay(450).duration(400).springify()}
        style={styles.section}
      >
        <Text style={styles.sectionTitle}>Din utvikling</Text>
        <View style={styles.growthCard}>
          <View style={styles.progressRow}>
            <View style={styles.progressLeft}>
              <Text style={styles.progressLabel}>Treningsfremgang</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: "62%" }]} />
              </View>
            </View>
            <View>
              <Text style={styles.progressPercent}>62%</Text>
              <Text style={styles.progressMeta}>READINESS</Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/(app)/(home)/training");
            }}
            style={styles.courseChip}
          >
            <View style={styles.courseIcon}>
              <BookOpen size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
            </View>
            <View style={styles.courseText}>
              <Text style={styles.courseLabel}>ANBEFALT KURS</Text>
              <Text style={styles.courseName}>Allergen safety: Refresher</Text>
            </View>
            <ChevronRight
              size={18}
              color={withOpacity(theme.colors.mutedForeground, 0.4)}
              strokeWidth={1.5}
            />
          </Pressable>
          <View style={styles.badgeRow}>
            <Award size={16} color={theme.colors.brandOrange} strokeWidth={1.5} />
            <Text style={styles.badgeText}>EARLY BIRD BADGE</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  content: { gap: theme.spacing.page },

  hero: { gap: theme.spacing.md },
  heroTitle: {
    fontSize: 36,
    fontWeight: "300",
    letterSpacing: -1,
    lineHeight: 42,
    color: theme.colors.foreground,
  },
  heroAccent: { fontStyle: "italic", color: theme.colors.brandOrange },
  quoteBlock: {
    paddingLeft: theme.spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: withOpacity(theme.colors.brandOrange, 0.2),
  },
  quoteText: {
    fontSize: 18,
    fontStyle: "italic",
    color: theme.colors.mutedForeground,
    lineHeight: 26,
  },

  nextShiftCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.section,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.brandOrange, 0.1),
  },
  nextShiftIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.lg,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  nextShiftInfo: { flex: 1, gap: 2 },
  nextShiftLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1.5,
    color: theme.colors.mutedForeground,
  },
  nextShiftTime: { fontSize: 16, fontWeight: "600", color: theme.colors.foreground },
  nextShiftRole: { fontSize: 13, color: theme.colors.mutedForeground },

  section: { gap: theme.spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { ...theme.typography.title, color: theme.colors.foreground },
  sectionMeta: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },

  communityGrid: { flexDirection: "row", gap: theme.spacing.md },
  communityCard: {
    flex: 1,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    aspectRatio: 1,
    justifyContent: "space-between",
  },
  communityCardAccent: { backgroundColor: withOpacity(theme.colors.brandOrange, 0.05) },
  communityLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    color: theme.colors.mutedForeground,
  },
  communityText: { ...theme.typography.body, fontWeight: "500", color: theme.colors.foreground },

  newsCard: {
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.card, 0.4)
      : withOpacity(theme.colors.muted, 0.4),
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  newsImage: { height: 140, backgroundColor: theme.colors.muted },
  newsBody: { padding: theme.spacing.section, gap: 8 },
  newsTitle: { ...theme.typography.headline, color: theme.colors.foreground },
  newsDesc: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    lineHeight: 20,
  },

  growthCard: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.page,
    gap: theme.spacing.page,
  },
  progressRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.page },
  progressLeft: { flex: 1, gap: 8 },
  progressLabel: { ...theme.typography.body, fontWeight: "500", color: theme.colors.foreground },
  progressTrack: {
    height: 6,
    backgroundColor: theme.colors.muted,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: theme.colors.brandOrange, borderRadius: 3 },
  progressPercent: { fontSize: 24, fontWeight: "700", color: theme.colors.brandOrange },
  progressMeta: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },

  courseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: withOpacity(theme.colors.background, 0.5),
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
  },
  courseIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.lg,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  courseText: { flex: 1, gap: 2 },
  courseLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    color: theme.colors.mutedForeground,
  },
  courseName: { ...theme.typography.body, fontWeight: "500", color: theme.colors.foreground },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: withOpacity(theme.colors.border, 0.1),
  },
  badgeText: { fontSize: 10, fontWeight: "600", letterSpacing: 2, color: theme.colors.brandOrange },
}));
