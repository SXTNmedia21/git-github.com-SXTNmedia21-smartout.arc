/**
 * Deviation Report Screen — Mobile port of landing FeatureDeviation.
 *
 * Step-by-step form for reporting an incident/deviation:
 * 1. What happened (text input)
 * 2. Where (location picker)
 * 3. Severity (low/medium/high)
 * 4. Submit → summary card
 *
 * For now uses local state — will connect to deviation table + enqueue in V2.
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
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  AlertTriangle,
  MapPin,
  Clock,
  User,
  CheckCircle2,
  Send,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useReportDeviation } from "@/hooks/mutations/use-report-deviation";

type Severity = "Lav" | "Middels" | "Hoy";

const SEVERITY_COLOR_KEYS: Record<Severity, string> = {
  Lav: "success",
  Middels: "warning",
  Hoy: "destructive",
};

/** Maps Norwegian UI labels to deviation_severity enum values */
const SEVERITY_API_MAP: Record<Severity, "low" | "medium" | "high"> = {
  Lav: "low",
  Middels: "medium",
  Hoy: "high",
};

const LOCATIONS = ["Hovedkjokken", "Sal", "Bar", "Lager", "Garderobe", "Utendors"];

export default function DeviationScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { data: profile } = useMyProfile();

  const { reportDeviation } = useReportDeviation();
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<string | null>(null);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = description.trim().length > 5 && location && severity;

  const handleSubmit = useCallback(() => {
    if (!canSubmit || !severity || !profile) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    void reportDeviation({
      title: description.trim().slice(0, 80),
      description: description.trim(),
      severity: SEVERITY_API_MAP[severity],
      domain: "procedure",
      reported_by: profile.profile_id,
      workspace_id: profile.workspace_id,
    });

    setSubmitted(true);
  }, [canSubmit, severity, profile, description, reportDeviation]);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            hitSlop={12}
            style={styles.backButton}
          >
            <ChevronLeft size={28} color={styles.foregroundColor.color} strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle}>Avviksmeldning</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Success banner */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.successBanner}>
            <CheckCircle2 size={20} color={colors.success} strokeWidth={2} />
            <View style={styles.bannerText}>
              <Text style={styles.successTitle}>Avviksmeldning registrert</Text>
              <Text style={styles.bannerSubtitle}>Sendt til avdelingsleder kl. {timeStr}</Text>
            </View>
          </Animated.View>

          {/* Summary card */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Oppsummering</Text>
              <Text style={styles.summaryId}>
                AV-{now.getFullYear()}-{String(Math.floor(Math.random() * 999)).padStart(4, "0")}
              </Text>
            </View>

            <SummaryRow
              icon={<AlertTriangle size={14} color={colors.mutedForeground} strokeWidth={2} />}
              label="Hendelse"
              value={description}
            />
            <SummaryRow
              icon={<MapPin size={14} color={colors.mutedForeground} strokeWidth={2} />}
              label="Sted"
              value={location ?? "—"}
            />
            <SummaryRow
              icon={<Clock size={14} color={colors.mutedForeground} strokeWidth={2} />}
              label="Tidspunkt"
              value={`${now.toLocaleDateString("nb-NO")} kl. ${timeStr}`}
            />
            <SummaryRow
              icon={<User size={14} color={colors.mutedForeground} strokeWidth={2} />}
              label="Meldt av"
              value={profile?.display_name ?? "—"}
            />

            <View style={styles.summaryFooter}>
              <View
                style={[
                  styles.severityBadge,
                  severity && {
                    backgroundColor: withOpacity(
                      (colors as Record<string, string>)[SEVERITY_COLOR_KEYS[severity]],
                      0.08,
                    ),
                    borderColor: withOpacity(
                      (colors as Record<string, string>)[SEVERITY_COLOR_KEYS[severity]],
                      0.3,
                    ),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.severityBadgeText,
                    severity && {
                      color: (colors as Record<string, string>)[SEVERITY_COLOR_KEYS[severity]],
                    },
                  ]}
                >
                  {severity}
                </Text>
              </View>
              <View style={styles.sentRow}>
                <Send size={12} color={colors.mutedForeground} strokeWidth={2} />
                <Text style={styles.sentText}>Varslet avdelingsleder</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={styles.backButton}
        >
          <ChevronLeft size={28} color={styles.foregroundColor.color} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Ny avviksmeldning</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Step 1: Description */}
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.field}>
            <View style={styles.fieldLabel}>
              <AlertTriangle size={14} color={styles.foregroundColor.color} strokeWidth={2} />
              <Text style={styles.fieldLabelText}>Hva skjedde?</Text>
            </View>
            <TextInput
              style={styles.textArea}
              placeholder="Beskriv hendelsen..."
              placeholderTextColor={styles.placeholderColor.color}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Animated.View>

          {/* Step 2: Location */}
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.field}>
            <View style={styles.fieldLabel}>
              <MapPin size={14} color={styles.foregroundColor.color} strokeWidth={2} />
              <Text style={styles.fieldLabelText}>Hvor skjedde det?</Text>
            </View>
            <View style={styles.chipRow}>
              {LOCATIONS.map((loc) => (
                <Pressable
                  key={loc}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setLocation(loc);
                  }}
                  style={[styles.chip, location === loc && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, location === loc && styles.chipTextSelected]}>
                    {loc}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Step 3: Severity */}
          <Animated.View entering={FadeInDown.delay(300).duration(300)} style={styles.field}>
            <View style={styles.fieldLabel}>
              <AlertTriangle size={14} color={styles.foregroundColor.color} strokeWidth={2} />
              <Text style={styles.fieldLabelText}>Alvorlighetsgrad</Text>
            </View>
            <View style={styles.severityRow}>
              {(["Lav", "Middels", "Hoy"] as Severity[]).map((level) => {
                const sevColor = (colors as Record<string, string>)[SEVERITY_COLOR_KEYS[level]];
                const isSelected = severity === level;
                return (
                  <Pressable
                    key={level}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSeverity(level);
                    }}
                    style={[
                      styles.severityOption,
                      {
                        backgroundColor: isSelected ? withOpacity(sevColor, 0.08) : "transparent",
                        borderColor: isSelected
                          ? withOpacity(sevColor, 0.3)
                          : styles.borderColor.borderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.severityText, isSelected && { color: sevColor }]}>
                      {level === "Hoy" ? "Høy" : level}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </ScrollView>

        {/* Submit button */}
        <Animated.View entering={FadeInUp.delay(400).duration(300)} style={styles.submitArea}>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Send avviksmeldning"
          >
            <Send size={18} color={colors.primaryForeground} strokeWidth={2} />
            <Text style={styles.submitLabel}>Send avviksmeldning</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const styles = useSummaryStyles();
  return (
    <View style={styles.row}>
      {icon}
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const useSummaryStyles = createStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  rowValue: {
    ...theme.typography.subheadline,
    color: theme.colors.foreground,
  },
}));

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    gap: theme.spacing.tight,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  foregroundColor: {
    color: theme.colors.foreground,
  },
  placeholderColor: {
    color: theme.colors.mutedForeground,
  },
  borderColor: {
    borderColor: theme.colors.border,
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  content: {
    padding: theme.spacing.card,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.section,
  },

  /* Fields */
  field: {
    gap: theme.spacing.element,
  },
  fieldLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
  },
  fieldLabelText: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  textArea: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    minHeight: 100,
  },

  /* Location chips */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.tight,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "transparent",
  },
  chipSelected: {
    backgroundColor: withOpacity(theme.colors.brandOrange, theme.isDark ? 0.12 : 0.08),
    borderColor: withOpacity(theme.colors.brandOrange, 0.4),
  },
  chipText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  chipTextSelected: {
    color: theme.colors.brandOrange,
    fontWeight: theme.fontWeights.medium,
  },

  /* Severity */
  severityRow: {
    flexDirection: "row",
    gap: theme.spacing.tight,
  },
  severityOption: {
    flex: 1,
    paddingVertical: theme.spacing.element,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    alignItems: "center",
  },
  severityText: {
    ...theme.typography.bodyBold,
    color: theme.colors.mutedForeground,
  },

  /* Submit */
  submitArea: {
    paddingHorizontal: theme.spacing.card,
    paddingBottom: theme.spacing.section,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.tight,
    backgroundColor: theme.colors.brandOrange,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    ...theme.shadows.md,
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitLabel: {
    ...theme.typography.headline,
    color: theme.colors.primaryForeground,
  },

  /* Success state */
  successBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.element,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: withOpacity(theme.colors.success, 0.06),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.success, 0.2),
  },
  bannerText: {
    flex: 1,
    gap: 2,
  },
  successTitle: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.success,
  },
  bannerSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },

  /* Summary card */
  summaryCard: {
    padding: theme.spacing.card,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.element,
  },
  summaryTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  summaryId: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  summaryFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.element,
    paddingTop: theme.spacing.element,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  severityBadge: {
    paddingHorizontal: theme.spacing.element,
    paddingVertical: 4,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  severityBadgeText: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.mutedForeground,
  },
  sentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sentText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
}));
