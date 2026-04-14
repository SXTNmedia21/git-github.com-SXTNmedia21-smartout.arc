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
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  BookOpen,
  BadgeCheck,
  ChevronRight,
  ChevronLeft,
  Download,
  FileText,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { useTrainingData } from "@/hooks/queries/use-training-data";
import type {
  TrainingCourse,
  TrainingProcedure,
  TrainingCertificate,
} from "@/hooks/queries/use-training-data";

// ── Types ──

type CourseStatus = "not_started" | "in_progress" | "completed" | "expired" | "waived";

type StatusColorKey = "not_started" | "in_progress" | "completed" | "expired" | "waived";

/** Map assignment status to a display label (Norwegian) */
function getStatusDisplay(status: CourseStatus): { label: string; colorKey: StatusColorKey } {
  switch (status) {
    case "not_started":
      return { label: "Ikke startet", colorKey: "not_started" };
    case "in_progress":
      return { label: "Pågående", colorKey: "in_progress" };
    case "completed":
      return { label: "Fullført", colorKey: "completed" };
    case "expired":
      return { label: "Utløpt", colorKey: "expired" };
    case "waived":
      return { label: "Fritatt", colorKey: "waived" };
  }
}

/** Norwegian labels for assignment_source enum values */
const SOURCE_LABELS: Record<string, string> = {
  workspace: "Bedrift",
  department: "Avdeling",
  team: "Team",
  location: "Lokasjon",
  position: "Stilling",
  manual: "Manuell",
  season: "Sesong",
};

/** Format date to "MMM YYYY" for certificate display */
function formatCertDate(dateStr: string): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mai",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  const d = new Date(dateStr);
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Components ──

/** Readiness progress card with gradient bar and completion counts */
function ReadinessCard({
  percent,
  completed,
  total,
}: {
  percent: number;
  completed?: number;
  total?: number;
}) {
  const styles = useReadinessStyles();

  const subtitle =
    percent === 0
      ? "Du har ingen aktive kurs ennå."
      : percent >= 100
        ? "Gratulerer! Du er fullsertifisert."
        : "Du er godt på vei til å bli fullsertifisert for sesongen.";

  const countText =
    completed !== undefined && total !== undefined ? `${completed} av ${total} fullført` : null;

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(500).springify()} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Din beredskap: {percent}%</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {countText && <Text style={styles.countText}>{countText}</Text>}
        </View>
        <Text style={styles.decorNumber}>01</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${percent}%` }]} />
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
  countText: {
    ...theme.typography.caption,
    color: theme.colors.brandOrange,
    fontWeight: "500",
    marginTop: 2,
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

/** Single course card with real progress bar, status badge, and source badge */
function CourseCard({ course, index }: { course: TrainingCourse; index: number }) {
  const styles = useCourseStyles();
  const theme = useTheme();
  const router = useRouter();

  const { label, colorKey } = getStatusDisplay(course.status);
  const progress = course.progress.percent;

  const tagColors: Record<StatusColorKey, { bg: string; border: string; text: string }> = {
    not_started: {
      bg: withOpacity(theme.colors.mutedForeground, 0.06),
      border: withOpacity(theme.colors.mutedForeground, 0.2),
      text: theme.colors.mutedForeground,
    },
    in_progress: {
      bg: withOpacity(theme.colors.info, 0.06),
      border: withOpacity(theme.colors.info, 0.2),
      text: theme.colors.info,
    },
    completed: {
      bg: withOpacity(theme.colors.success, 0.06),
      border: withOpacity(theme.colors.success, 0.2),
      text: theme.colors.success,
    },
    expired: {
      bg: withOpacity(theme.colors.destructive, 0.06),
      border: withOpacity(theme.colors.destructive, 0.2),
      text: theme.colors.destructive,
    },
    waived: {
      bg: withOpacity(theme.colors.warning, 0.06),
      border: withOpacity(theme.colors.warning, 0.2),
      text: theme.colors.warning,
    },
  };

  const tag = tagColors[colorKey];
  const title = course.protocol?.name ?? "Ukjent kurs";
  const subtitle = course.protocol?.description ?? "";
  const sourceLabel = course.assigned_via ? SOURCE_LABELS[course.assigned_via] : null;

  return (
    <Animated.View
      entering={FadeInDown.delay(200 + index * 100)
        .duration(400)
        .springify()}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({
            pathname: "/(app)/(home)/course-detail",
            params: { protocolId: course.protocol_id },
          });
        }}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {/* Top row: icon + badges */}
        <View style={styles.topRow}>
          <View style={styles.iconBox}>
            <BookOpen size={20} color={theme.colors.brandOrange} strokeWidth={1.6} />
          </View>
          <View style={styles.badgeRow}>
            {sourceLabel && (
              <View style={styles.sourceBadge}>
                <Text style={styles.sourceBadgeText}>{sourceLabel}</Text>
              </View>
            )}
            <View style={[styles.tag, { backgroundColor: tag.bg, borderColor: tag.border }]}>
              <Text style={[styles.tagText, { color: tag.text }]}>{label}</Text>
            </View>
          </View>
        </View>

        {/* Title + subtitle + version */}
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
          {course.protocol_version && (
            <Text style={styles.versionText}>v{course.protocol_version}</Text>
          )}
        </View>

        {/* Progress bar — now uses real progress from shared hook */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{progress}%</Text>
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
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.muted, 0.5)
      : withOpacity(theme.colors.muted, 0.8),
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 0.5,
    color: theme.colors.mutedForeground,
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
  versionText: {
    fontSize: 10,
    fontWeight: "400",
    color: withOpacity(theme.colors.mutedForeground, 0.5),
    fontStyle: "italic",
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
function ProcedureRow({ procedure, index }: { procedure: TrainingProcedure; index: number }) {
  const styles = useProcedureStyles();
  const theme = useTheme();
  const router = useRouter();

  // Procedures created within the last 7 days are considered "new"
  const isNew = Date.now() - new Date(procedure.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;

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
        accessibilityLabel={procedure.name}
      >
        <View style={styles.rowLeft}>
          <View style={styles.iconCircle}>
            <FileText size={18} color={theme.colors.mutedForeground} strokeWidth={1.6} />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {procedure.name}
            </Text>
            {isNew && <Text style={styles.newBadge}>NY</Text>}
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
function CertificateRow({ cert, index }: { cert: TrainingCertificate; index: number }) {
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
            <Text style={styles.title}>{cert.confirmation_name}</Text>
            <Text style={styles.date}>FULLFØRT {formatCertDate(cert.signed_at).toUpperCase()}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Last ned ${cert.confirmation_name}`}
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
  const { data, isLoading, isError } = useTrainingData();

  const courses = data?.courses ?? [];
  const procedures = data?.procedures ?? [];
  const certificates = data?.certificates ?? [];
  const readinessPercent = data?.readinessPercent ?? 0;

  const completedCount = courses.filter((c) => c.status === "completed").length;
  const totalCount = courses.length;

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

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.brandOrange} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Kunne ikke laste opplæringsdata.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Readiness Progress ── */}
          <View style={styles.section}>
            <ReadinessCard
              percent={readinessPercent}
              completed={completedCount}
              total={totalCount}
            />
          </View>

          {/* ── Active Courses ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Aktive kurs</Text>
              <Pressable onPress={() => Haptics.selectionAsync()} hitSlop={8}>
                <Text style={styles.seeAll}>Se alle</Text>
              </Pressable>
            </View>
            {courses.length > 0 ? (
              <View style={styles.courseGrid}>
                {courses.map((course, i) => (
                  <CourseCard key={course.assignment_id} course={course} index={i} />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>Ingen kurs tilgjengelig</Text>
            )}
          </View>

          {/* ── Procedures ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prosedyrer</Text>
            {procedures.length > 0 ? (
              procedures.map((proc, i) => (
                <ProcedureRow key={proc.procedure_id} procedure={proc} index={i} />
              ))
            ) : (
              <Text style={styles.emptyText}>Ingen prosedyrer tilgjengelig</Text>
            )}
          </View>

          {/* ── Certificates ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mine sertifikater</Text>
            {certificates.length > 0 ? (
              <View style={styles.certCard}>
                {certificates.map((cert, i) => (
                  <CertificateRow key={cert.id} cert={cert} index={i} />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>Ingen sertifikater ennå</Text>
            )}
          </View>
        </ScrollView>
      )}
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

  /* Centered loading / error state */
  centered: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
    paddingVertical: theme.spacing.md,
  },

  /* Certificates card */
  certCard: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.6) : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
}));
