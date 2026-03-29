/**
 * Course detail screen — certificate/training item view.
 *
 * Nordic Split layout:
 * 1. Hero — large icon, course title, status badge
 * 2. Description card — italic quote style
 * 3. Requirements checklist — done/pending items with progress
 * 4. Info bento grid — estimated time, location
 * 5. Fixed CTA — "Start verifisering" gradient button
 *
 * Placeholder data until protocol_assignment hooks are wired.
 */

import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  Wine,
  ChevronLeft,
  Check,
  Clock,
  MapPin,
  ChevronRight,
  Zap,
  Loader,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";

type RequirementStatus = "done" | "pending";

type Requirement = {
  id: string;
  title: string;
  subtitle: string;
  status: RequirementStatus;
};

// Placeholder data
const COURSE = {
  title: "Skjenkeansvarlig",
  statusLabel: "VENTER PÅ VERIFISERING",
  description:
    "Denne sertifiseringen bekrefter at du kjenner alkoholloven og interne skjenkerutiner.",
  estimatedTime: "15 Minutter",
  location: "Fysisk ved bar",
};

const REQUIREMENTS: Requirement[] = [
  {
    id: "1",
    title: "Lese gjennom alkoholpolicy",
    subtitle: "Fullført 12. Okt",
    status: "done",
  },
  {
    id: "2",
    title: "Gjennomføre kunnskapstest",
    subtitle: "Score: 94% · Fullført",
    status: "done",
  },
  {
    id: "3",
    title: "Verifisere praktisk forståelse",
    subtitle: "Neste steg",
    status: "pending",
  },
];

function RequirementRow({ item, index }: { item: Requirement; index: number }) {
  const styles = useReqStyles();
  const theme = useTheme();
  const isDone = item.status === "done";

  return (
    <Animated.View
      entering={FadeInDown.delay(300 + index * 80)
        .duration(400)
        .springify()}
    >
      <View style={[styles.row, !isDone && styles.rowPending]}>
        <View style={[styles.iconCircle, isDone ? styles.iconDone : styles.iconPending]}>
          {isDone ? (
            <Check size={16} color={theme.colors.brandOrange} strokeWidth={2.5} />
          ) : (
            <Loader size={16} color={theme.colors.brandOrange} strokeWidth={2} />
          )}
        </View>
        <View style={styles.textBlock}>
          <Text style={[styles.title, !isDone && styles.titlePending]}>{item.title}</Text>
          <Text style={[styles.subtitle, !isDone && styles.subtitlePending]}>{item.subtitle}</Text>
        </View>
        {!isDone && <ChevronRight size={18} color={theme.colors.brandOrange} strokeWidth={1.5} />}
      </View>
    </Animated.View>
  );
}

const useReqStyles = createStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.section,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.background,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
    marginBottom: theme.spacing.element,
  },
  rowPending: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.6) : theme.colors.muted,
    borderColor: withOpacity(theme.colors.brandOrange, 0.15),
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
  },
  iconDone: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.1),
  },
  iconPending: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.8) : theme.colors.background,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.2),
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...theme.typography.body,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
  titlePending: {
    fontWeight: "600",
    fontStyle: "italic",
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.3,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
    textTransform: "uppercase",
  },
  subtitlePending: {
    color: theme.colors.brandOrange,
    fontWeight: "600",
  },
}));

export default function CourseDetailScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.headerBar}>
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
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>{COURSE.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Animated.View entering={FadeIn.delay(50).duration(500)} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Wine size={56} color={theme.colors.brandOrange} strokeWidth={1} />
          </View>
          <Text style={styles.heroTitle}>{COURSE.title}</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{COURSE.statusLabel}</Text>
          </View>
        </Animated.View>

        {/* Description */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(400).springify()}
          style={styles.descCard}
        >
          <Text style={styles.descText}>"{COURSE.description}"</Text>
        </Animated.View>

        {/* Requirements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status på krav</Text>
          {REQUIREMENTS.map((req, i) => (
            <RequirementRow key={req.id} item={req} index={i} />
          ))}
        </View>

        {/* Info grid */}
        <Animated.View
          entering={FadeInDown.delay(550).duration(400).springify()}
          style={styles.infoGrid}
        >
          <View style={styles.infoCard}>
            <Clock size={20} color={withOpacity(theme.colors.brandOrange, 0.6)} strokeWidth={1.5} />
            <Text style={styles.infoLabel}>ESTIMERT TID</Text>
            <Text style={styles.infoValue}>{COURSE.estimatedTime}</Text>
          </View>
          <View style={styles.infoCard}>
            <MapPin
              size={20}
              color={withOpacity(theme.colors.brandOrange, 0.6)}
              strokeWidth={1.5}
            />
            <Text style={styles.infoLabel}>STED</Text>
            <Text style={styles.infoValue}>{COURSE.location}</Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Fixed CTA */}
      <Animated.View
        entering={FadeInDown.delay(600).duration(500).springify()}
        style={styles.ctaWrap}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/(app)/(home)/flow-player");
          }}
          style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Start verifisering"
        >
          <Text style={styles.ctaText}>Start verifisering</Text>
          <Zap size={20} color="#ffffff" strokeWidth={2} />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  /* Header */
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontStyle: "italic",
    fontWeight: "300",
    color: theme.colors.brandOrange,
    letterSpacing: -0.3,
  },

  /* Scroll */
  scrollContent: {
    paddingHorizontal: theme.spacing.section,
    paddingBottom: 120,
  },

  /* Hero */
  hero: {
    alignItems: "center",
    gap: theme.spacing.element,
    marginBottom: theme.spacing.xl,
  },
  heroIcon: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.6) : theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.lg,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: "300",
    letterSpacing: -1,
    color: theme.colors.foreground,
    textAlign: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.6) : theme.colors.muted,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.15),
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.brandOrange,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
  },

  /* Description */
  descCard: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.page,
    marginBottom: theme.spacing.xl,
  },
  descText: {
    fontSize: 18,
    fontStyle: "italic",
    lineHeight: 28,
    color: theme.colors.mutedForeground,
    opacity: 0.9,
  },

  /* Section */
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.section,
  },

  /* Info grid */
  infoGrid: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  infoCard: {
    flex: 1,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    gap: 8,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  infoValue: {
    fontSize: 18,
    fontWeight: "300",
    color: theme.colors.foreground,
  },

  /* CTA */
  ctaWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.section,
    paddingBottom: theme.spacing.xl,
    paddingTop: theme.spacing.section,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.element,
    height: 64,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
    ...theme.shadows.lg,
  },
  ctaPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "500",
    letterSpacing: 0.5,
    color: "#ffffff",
  },
}));
