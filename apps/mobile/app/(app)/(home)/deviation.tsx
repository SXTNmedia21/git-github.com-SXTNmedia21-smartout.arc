/**
 * Deviation Report — "Meld avvik" Nordic Split form.
 *
 * Layout:
 * 1. Intro — italic guidance text
 * 2. Type selector — 2x2 category grid (Hygiene, Safety, Equipment, Quality)
 * 3. Severity toggle — pill selector (Low, Medium, High, Critical)
 * 4. Description — textarea
 * 5. Photo upload — dashed area
 * 6. Location meta — auto-detected card
 * 7. CTA — "Send rapport" gradient pill
 *
 * Keeps existing submit logic via useReportDeviation.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  Sparkles,
  Shield,
  Wrench,
  BadgeCheck,
  Camera,
  MapPin,
  Send,
  CheckCircle2,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useReportDeviation } from "@/hooks/mutations/use-report-deviation";

type Category = "hygiene" | "safety" | "equipment" | "quality";
type Severity = "low" | "medium" | "high" | "critical";

const CATEGORIES: { key: Category; icon: typeof Sparkles; label: string }[] = [
  { key: "hygiene", icon: Sparkles, label: "Hygiene" },
  { key: "safety", icon: Shield, label: "Safety" },
  { key: "equipment", icon: Wrench, label: "Equipment" },
  { key: "quality", icon: BadgeCheck, label: "Quality" },
];

const SEVERITIES: { key: Severity; label: string; isDestructive?: boolean }[] = [
  { key: "low", label: "LOW" },
  { key: "medium", label: "MEDIUM" },
  { key: "high", label: "HIGH" },
  { key: "critical", label: "CRITICAL", isDestructive: true },
];

export default function DeviationScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const { reportDeviation } = useReportDeviation();

  const [category, setCategory] = useState<Category | null>(null);
  const [severity, setSeverity] = useState<Severity>("medium");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = description.trim().length > 5 && category;

  const handleSubmit = useCallback(() => {
    if (!canSubmit || !profile) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    void reportDeviation({
      title: description.trim().slice(0, 80),
      description: description.trim(),
      severity,
      domain:
        category === "hygiene"
          ? "procedure"
          : category === "safety"
            ? "safety"
            : category === "equipment"
              ? "material"
              : category === "quality"
                ? "procedure"
                : "procedure",
      reported_by: profile.profile_id,
      workspace_id: profile.workspace_id,
    });

    setSubmitted(true);
  }, [canSubmit, profile, description, severity, category, reportDeviation]);

  // ── Success State ──
  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.successContent}>
          <Animated.View entering={FadeIn.delay(100).duration(500)} style={styles.successHero}>
            <CheckCircle2 size={64} color={theme.colors.success} strokeWidth={1.2} />
            <Text style={styles.successTitle}>Avvik meldt</Text>
            <Text style={styles.successSubtitle}>Varslet avdelingsleder automatisk</Text>
          </Animated.View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.successButton}
          >
            <Text style={styles.successButtonText}>Tilbake</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Form ──
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
        >
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>Meld avvik</Text>
        <View style={styles.headerRight}>
          <View style={styles.hseTag}>
            <Text style={styles.hseTagText}>HSE-2024</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <Animated.View entering={FadeIn.delay(50).duration(400)} style={styles.intro}>
            <Text style={styles.introText}>
              Logg hendelsen nøyaktig for å sikre kontinuerlig forbedring.
            </Text>
            <View style={styles.introLine} />
          </Animated.View>

          {/* Type Selector */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400).springify()}
            style={styles.section}
          >
            <Text style={styles.sectionLabel}>Hvilken type avvik er dette?</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.key;
                const IconComponent = cat.icon;
                return (
                  <Pressable
                    key={cat.key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCategory(cat.key);
                    }}
                    style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                  >
                    <IconComponent
                      size={22}
                      color={isSelected ? theme.colors.brandOrange : theme.colors.mutedForeground}
                      strokeWidth={1.5}
                    />
                    <Text
                      style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Severity Toggle */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(400).springify()}
            style={styles.section}
          >
            <Text style={styles.sectionLabel}>Alvorlighetsgrad</Text>
            <View style={styles.severityBar}>
              {SEVERITIES.map((sev) => {
                const isSelected = severity === sev.key;
                return (
                  <Pressable
                    key={sev.key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSeverity(sev.key);
                    }}
                    style={[styles.severityPill, isSelected && styles.severityPillSelected]}
                  >
                    <Text
                      style={[
                        styles.severityText,
                        isSelected && styles.severityTextSelected,
                        sev.isDestructive && isSelected && styles.severityTextCritical,
                      ]}
                    >
                      {sev.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Description */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(400).springify()}
            style={styles.section}
          >
            <Text style={styles.sectionLabel}>Beskrivelse</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Beskriv hva som skjedde..."
              placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Animated.View>

          {/* Photo Upload */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(400).springify()}
            style={styles.section}
          >
            <Text style={styles.sectionLabel}>Dokumentasjon</Text>
            <Pressable onPress={() => Haptics.selectionAsync()} style={styles.photoArea}>
              <View style={styles.photoIconCircle}>
                <Camera size={28} color={theme.colors.brandOrange} strokeWidth={1.5} />
              </View>
              <Text style={styles.photoLabel}>Trykk for å laste opp bilde</Text>
              <Text style={styles.photoMeta}>JPG, PNG OPPTIL 10MB</Text>
            </Pressable>
          </Animated.View>

          {/* Location Meta */}
          <Animated.View
            entering={FadeInDown.delay(500).duration(400).springify()}
            style={styles.locationCard}
          >
            <View style={styles.locationLeft}>
              <View style={styles.locationIcon}>
                <MapPin size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
              </View>
              <View>
                <Text style={styles.locationLabel}>LOKASJON (AUTO)</Text>
                <Text style={styles.locationValue}>Kitchen / Cold Storage A</Text>
              </View>
            </View>
          </Animated.View>

          {/* Submit */}
          <Animated.View
            entering={FadeInDown.delay(600).duration(500).springify()}
            style={styles.submitSection}
          >
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                !canSubmit && styles.submitDisabled,
                pressed && canSubmit && styles.submitPressed,
              ]}
            >
              <Text style={styles.submitText}>Send rapport</Text>
              <Send size={20} color="#ffffff" strokeWidth={2} />
            </Pressable>
            <Text style={styles.systemLabel}>SMARTOUT HSE MANAGEMENT SYSTEM</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },

  /* Header */
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: 22,
    fontStyle: "italic",
    fontWeight: "300",
    color: theme.colors.brandOrange,
    letterSpacing: -0.3,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  hseTag: {
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  hseTagText: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
  },

  scrollContent: { paddingHorizontal: theme.spacing.section, paddingBottom: theme.spacing.xl + 40 },

  /* Intro */
  intro: { gap: theme.spacing.element, marginBottom: theme.spacing.page },
  introText: {
    fontSize: 18,
    fontStyle: "italic",
    color: theme.colors.mutedForeground,
    lineHeight: 26,
  },
  introLine: { width: 48, height: 1, backgroundColor: withOpacity(theme.colors.brandOrange, 0.3) },

  /* Sections */
  section: { gap: theme.spacing.md, marginBottom: theme.spacing.page },
  sectionLabel: { ...theme.typography.title, color: theme.colors.foreground },

  /* Category grid */
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.element },
  categoryCard: {
    width: "47%",
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    gap: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  categoryCardSelected: {
    borderColor: withOpacity(theme.colors.brandOrange, 0.2),
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.04),
  },
  categoryLabel: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
  categoryLabelSelected: { color: theme.colors.brandOrange },

  /* Severity */
  severityBar: {
    flexDirection: "row",
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.full,
    padding: 4,
  },
  severityPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: theme.radius.full,
  },
  severityPillSelected: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.background,
    ...theme.shadows.sm,
  },
  severityText: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
  },
  severityTextSelected: { color: theme.colors.brandOrange, fontWeight: "600" },
  severityTextCritical: { color: theme.colors.destructive },

  /* Text area */
  textArea: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    minHeight: 120,
  },

  /* Photo upload */
  photoArea: {
    aspectRatio: 16 / 9,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: withOpacity(theme.colors.border, 0.2),
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.element,
  },
  photoIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.5) : theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  photoLabel: {
    fontSize: 14,
    fontStyle: "italic",
    fontWeight: "500",
    color: theme.colors.mutedForeground,
  },
  photoMeta: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    color: withOpacity(theme.colors.mutedForeground, 0.4),
    textTransform: "uppercase",
  },

  /* Location */
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.background,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    marginBottom: theme.spacing.page,
    ...theme.shadows.sm,
  },
  locationLeft: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.05),
    alignItems: "center",
    justifyContent: "center",
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
  },
  locationValue: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.foreground,
    marginTop: 2,
  },

  /* Submit */
  submitSection: { paddingTop: theme.spacing.md, gap: theme.spacing.section },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.element,
    height: 64,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
    ...theme.shadows.lg,
  },
  submitDisabled: { opacity: 0.4 },
  submitPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  submitText: { fontSize: 18, fontWeight: "500", color: "#ffffff" },
  systemLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.4),
    textAlign: "center",
    textTransform: "uppercase",
  },

  /* Success */
  successContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xl,
    paddingHorizontal: theme.spacing.page,
  },
  successHero: { alignItems: "center", gap: theme.spacing.md },
  successTitle: { ...theme.typography.largeTitle, color: theme.colors.foreground },
  successSubtitle: { ...theme.typography.subheadline, color: theme.colors.mutedForeground },
  successButton: {
    paddingHorizontal: theme.spacing.page,
    paddingVertical: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
  },
  successButtonText: { ...theme.typography.bodyBold, color: "#ffffff" },
}));
