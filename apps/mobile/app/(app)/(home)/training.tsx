/**
 * Training Hub — "Opplæring" screen.
 *
 * Nordic Split bento layout with:
 * 1. Welcome — "Opplæring" hero title
 * 2. Readiness progress — overall % with gradient bar
 * 3. Active courses — card grid with progress + urgency tags
 * 4. New procedures — list rows with "Ny" badges
 * 5. Certificates — verified items with download action
 *
 * Data is placeholder until training hooks are wired to protocol_assignment
 * and knowledge_test tables. Layout is production-ready.
 */

import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  Wine,
  UtensilsCrossed,
  Flame,
  Star,
  BadgeCheck,
  ChevronRight,
  ChevronLeft,
  Download,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import type { LucideIcon } from "lucide-react-native";

// ── Types ──

type CourseStatus = "expiring" | "high_priority" | "in_progress";

type Course = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  progress: number;
  status: CourseStatus;
  statusLabel: string;
};

type Procedure = {
  id: string;
  title: string;
  icon: LucideIcon;
  isNew: boolean;
};

type Certificate = {
  id: string;
  title: string;
  completedDate: string;
};

// ── Placeholder data — replace with hooks when training tables are wired ──

const COURSES: Course[] = [
  {
    id: "1",
    title: "Skjenkeansvarlig",
    subtitle: "Obligatorisk for alle servitører",
    icon: Wine,
    progress: 80,
    status: "expiring",
    statusLabel: "Utløper om 30 dager",
  },
  {
    id: "2",
    title: "Mattrygghet & HACCP",
    subtitle: "Sikre trygg matopplevelse",
    icon: UtensilsCrossed,
    progress: 20,
    status: "high_priority",
    statusLabel: "Høy prioritet",
  },
];

const PROCEDURES: Procedure[] = [
  { id: "1", title: "Stenging av uteservering", icon: Flame, isNew: true },
  { id: "2", title: "Håndtering av VIP-gjester", icon: Star, isNew: true },
];

const CERTIFICATES: Certificate[] = [{ id: "1", title: "Brannvern", completedDate: "Jan 2024" }];

const READINESS_PERCENT = 62;

// ── Components ──

/** Readiness progress card with gradient bar */
function ReadinessCard() {
  const styles = useReadinessStyles();
  const _theme = useTheme();

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(500).springify()} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Din beredskap: {READINESS_PERCENT}%</Text>
          <Text style={styles.subtitle}>
            Du er godt på vei til å bli fullsertifisert for sesongen.
          </Text>
        </View>
        <Text style={styles.decorNumber}>01</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${READINESS_PERCENT}%` }]} />
      </View>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel}>BEGYNNER</Text>
        <Text style={styles.barLabel}>EKSPERT</Text>
      </View>
    </Animated.View>
  );
}

const useReadinessStyles = createStyles((theme) => ({
  card: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.6) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.page,
    gap: theme.spacing.section,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerText: {
    flex: 1,
    gap: 4,
    maxWidth: "70%",
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  subtitle: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  decorNumber: {
    fontSize: 36,
    fontStyle: "italic",
    fontWeight: "300",
    color: withOpacity(theme.colors.brandOrange, 0.2),
  },
  barTrack: {
    height: 12,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.5) : theme.colors.muted,
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: theme.colors.brandOrange,
    borderRadius: 6,
    shadowColor: theme.colors.brandOrange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  barLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
  },
}));

/** Single course card with progress bar and urgency tag */
function CourseCard({ course, index }: { course: Course; index: number }) {
  const styles = useCourseStyles();
  const theme = useTheme();
  const router = useRouter();

  const tagColors = {
    expiring: {
      bg: withOpacity(theme.colors.destructive, 0.06),
      border: withOpacity(theme.colors.destructive, 0.2),
      text: theme.colors.destructive,
    },
    high_priority: {
      bg: withOpacity(theme.colors.brandOrange, 0.06),
      border: withOpacity(theme.colors.brandOrange, 0.2),
      text: theme.colors.brandOrange,
    },
    in_progress: {
      bg: withOpacity(theme.colors.info, 0.06),
      border: withOpacity(theme.colors.info, 0.2),
      text: theme.colors.info,
    },
  };

  const tag = tagColors[course.status];
  const IconComponent = course.icon;

  return (
    <Animated.View
      entering={FadeInDown.delay(200 + index * 100)
        .duration(400)
        .springify()}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/(app)/(home)/course-detail");
        }}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={course.title}
      >
        {/* Top row: icon + tag */}
        <View style={styles.topRow}>
          <View style={styles.iconBox}>
            <IconComponent size={20} color={theme.colors.brandOrange} strokeWidth={1.6} />
          </View>
          <View style={[styles.tag, { backgroundColor: tag.bg, borderColor: tag.border }]}>
            <Text style={[styles.tagText, { color: tag.text }]}>{course.statusLabel}</Text>
          </View>
        </View>

        {/* Title + subtitle */}
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {course.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {course.subtitle}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${course.progress}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{course.progress}%</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useCourseStyles = createStyles((theme) => ({
  card: {
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.card, 0.4)
      : withOpacity(theme.colors.background, 0.6),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    gap: theme.spacing.md,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.muted, 0.5)
      : withOpacity(theme.colors.brandOrange, 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  textBlock: {
    gap: 4,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  subtitle: {
    ...theme.typography.caption,
    color: withOpacity(theme.colors.mutedForeground, 0.7),
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.5) : theme.colors.muted,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.brandOrange,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.brandOrange,
  },
}));

/** Single procedure row */
function ProcedureRow({ procedure, index }: { procedure: Procedure; index: number }) {
  const styles = useProcedureStyles();
  const theme = useTheme();
  const router = useRouter();
  const IconComponent = procedure.icon;

  return (
    <Animated.View
      entering={FadeInDown.delay(400 + index * 80)
        .duration(400)
        .springify()}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/(app)/(home)/flow-player");
        }}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={procedure.title}
      >
        <View style={styles.rowLeft}>
          <View style={styles.iconCircle}>
            <IconComponent size={18} color={theme.colors.mutedForeground} strokeWidth={1.6} />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {procedure.title}
            </Text>
            {procedure.isNew && <Text style={styles.newBadge}>NY</Text>}
          </View>
        </View>
        <ChevronRight
          size={18}
          color={withOpacity(theme.colors.mutedForeground, 0.4)}
          strokeWidth={1.5}
        />
      </Pressable>
    </Animated.View>
  );
}

const useProcedureStyles = createStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing.card,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.6) : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.element,
  },
  rowPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.5) : theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    gap: 2,
    flex: 1,
  },
  title: {
    ...theme.typography.body,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
  newBadge: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: theme.colors.brandOrange,
    textTransform: "uppercase",
  },
}));

/** Single certificate row */
function CertificateRow({ cert, index }: { cert: Certificate; index: number }) {
  const styles = useCertStyles();
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(500 + index * 80)
        .duration(400)
        .springify()}
    >
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={styles.iconCircle}>
            <BadgeCheck size={20} color={theme.colors.success} strokeWidth={2} />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.title}>{cert.title}</Text>
            <Text style={styles.date}>FULLFØRT {cert.completedDate.toUpperCase()}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Last ned ${cert.title}`}
        >
          <Download size={18} color={theme.colors.brandOrange} strokeWidth={1.8} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const useCertStyles = createStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing.card,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withOpacity(theme.colors.success, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    gap: 2,
  },
  title: {
    ...theme.typography.body,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
  date: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
  },
}));

// ── Main Screen ──

export default function TrainingScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header — same as HMS/Operations */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>Opplæring</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Readiness Progress ── */}
        <View style={styles.section}>
          <ReadinessCard />
        </View>

        {/* ── Active Courses ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aktive kurs</Text>
            <Pressable onPress={() => Haptics.selectionAsync()} hitSlop={8}>
              <Text style={styles.seeAll}>Se alle</Text>
            </Pressable>
          </View>
          <View style={styles.courseGrid}>
            {COURSES.map((course, i) => (
              <CourseCard key={course.id} course={course} index={i} />
            ))}
          </View>
        </View>

        {/* ── New Procedures ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nye prosedyrer</Text>
          {PROCEDURES.map((proc, i) => (
            <ProcedureRow key={proc.id} procedure={proc} index={i} />
          ))}
        </View>

        {/* ── Certificates ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mine sertifikater</Text>
          <View style={styles.certCard}>
            {CERTIFICATES.map((cert, i) => (
              <CertificateRow key={cert.id} cert={cert} index={i} />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  /* Header — consistent action screen pattern */
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

  scrollContent: {
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.element,
    paddingBottom: 160,
  },

  /* Sections */
  section: {
    marginBottom: theme.spacing.page,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    paddingHorizontal: 4,
    marginBottom: theme.spacing.md,
  },
  seeAll: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.brandOrange,
  },

  /* Course grid */
  courseGrid: {
    gap: theme.spacing.md,
  },

  /* Certificates card */
  certCard: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.6) : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
}));
