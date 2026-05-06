/**
 * Create Task — "Ny oppgave" full-screen form following Nordic Split style.
 *
 * Layout:
 * 1. Header — ← back | "Ny oppgave" (serif) | spacer
 * 2. Intro — italic guidance text
 * 3. Title input (required)
 * 4. Description textarea (optional)
 * 5. Assign to picker (optional — shows department colleagues)
 * 6. Compliance toggle (Switch)
 * 7. CTA — "Opprett oppgave" gradient pill
 *
 * Requires an active department_session for today. If none exists,
 * shows an informational message and disables submit.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, CheckCircle2, Send, AlertCircle, User, Check } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useCreateTask } from "@/hooks/mutations/use-create-task";
import { supabase } from "@/lib/supabase";

type TeamMember = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
};

/** Fetches today's active department_session for the user's department */
function useActiveSession(
  departmentId: string | null | undefined,
  workspaceId: string | undefined,
) {
  return useQuery({
    queryKey: ["active-session", departmentId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("department_session")
        .select("department_session_id")
        .eq("department_id", departmentId!)
        .eq("session_date", today)
        .eq("workspace_id", workspaceId!)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: Boolean(departmentId && workspaceId),
  });
}

/** Fetches profiles in the same department for the assignment picker */
function useDepartmentMembers(
  departmentId: string | null | undefined,
  workspaceId: string | undefined,
) {
  return useQuery<TeamMember[]>({
    queryKey: ["department-members", departmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url")
        .eq("department_id", departmentId!)
        .eq("workspace_id", workspaceId!)
        .eq("is_active", true)
        .order("display_name");

      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
    enabled: Boolean(departmentId && workspaceId),
    staleTime: 5 * 60 * 1000,
  });
}

export default function CreateTaskScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const { createTask, isSubmitting } = useCreateTask();

  const { data: activeSession, isLoading: sessionLoading } = useActiveSession(
    profile?.department_id,
    profile?.workspace_id,
  );
  const { data: members = [] } = useDepartmentMembers(
    profile?.department_id,
    profile?.workspace_id,
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [isCompliance, setIsCompliance] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const hasSession = Boolean(activeSession?.department_session_id);
  const canSubmit = title.trim().length >= 2 && hasSession && !isSubmitting;

  const handleSubmit = useCallback(() => {
    if (!canSubmit || !profile || !activeSession) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    void createTask({
      title: title.trim(),
      description: description.trim() || null,
      assigned_to: assignedTo,
      is_compliance_required: isCompliance,
      department_session_id: activeSession.department_session_id,
      // workspace_id and created_by are resolved server-side via getProfileContext()
      // inside useCreateTask — ADR-0134, not supplied by caller
    });

    setSubmitted(true);
  }, [canSubmit, profile, activeSession, title, description, assignedTo, isCompliance, createTask]);

  const selectedMember = members.find((m) => m.profile_id === assignedTo);

  // ── Success State ──
  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.successContent}>
          <Animated.View entering={FadeIn.delay(100).duration(500)} style={styles.successHero}>
            <CheckCircle2 size={64} color={theme.colors.success} strokeWidth={1.2} />
            <Text style={styles.successTitle}>Oppgave opprettet</Text>
            <Text style={styles.successSubtitle}>
              {assignedTo ? "Tildelt og synlig i dag" : "Lagt til i dagens økt"}
            </Text>
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
        <Text style={styles.headerTitle}>Ny oppgave</Text>
        <View style={{ width: 40 }} />
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
              Opprett en oppgave for dagens økt. Tildel til et teammedlem eller la den stå åpen.
            </Text>
            <View style={styles.introLine} />
          </Animated.View>

          {/* No session warning */}
          {!sessionLoading && !hasSession && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.warningCard}>
              <AlertCircle size={20} color={theme.colors.warning} strokeWidth={1.5} />
              <Text style={styles.warningText}>
                Ingen aktiv økt for i dag. Start en økt først for å opprette oppgaver.
              </Text>
            </Animated.View>
          )}

          {sessionLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.brandOrange} />
              <Text style={styles.loadingText}>Sjekker dagens økt...</Text>
            </View>
          )}

          {/* Title */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400).springify()}
            style={styles.section}
          >
            <Text style={styles.sectionLabel}>Tittel</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Hva skal gjøres?"
              placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              returnKeyType="next"
            />
          </Animated.View>

          {/* Description */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(400).springify()}
            style={styles.section}
          >
            <Text style={styles.sectionLabel}>Beskrivelse (valgfritt)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Legg til detaljer..."
              placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </Animated.View>

          {/* Assign to */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(400).springify()}
            style={styles.section}
          >
            <Text style={styles.sectionLabel}>Tildel til (valgfritt)</Text>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setShowPicker(!showPicker);
              }}
              style={styles.pickerButton}
            >
              <User
                size={18}
                color={assignedTo ? theme.colors.brandOrange : theme.colors.mutedForeground}
                strokeWidth={1.5}
              />
              <Text
                style={[styles.pickerButtonText, assignedTo && styles.pickerButtonTextSelected]}
              >
                {selectedMember?.display_name ?? "Ingen tildelt"}
              </Text>
            </Pressable>

            {showPicker && (
              <View style={styles.memberList}>
                {/* Unassign option */}
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setAssignedTo(null);
                    setShowPicker(false);
                  }}
                  style={[styles.memberRow, !assignedTo && styles.memberRowSelected]}
                >
                  <Text style={styles.memberName}>Ingen tildelt</Text>
                  {!assignedTo && (
                    <Check size={16} color={theme.colors.brandOrange} strokeWidth={2} />
                  )}
                </Pressable>

                {members.map((member) => (
                  <Pressable
                    key={member.profile_id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setAssignedTo(member.profile_id);
                      setShowPicker(false);
                    }}
                    style={[
                      styles.memberRow,
                      assignedTo === member.profile_id && styles.memberRowSelected,
                    ]}
                  >
                    <Text style={styles.memberName}>{member.display_name}</Text>
                    {assignedTo === member.profile_id && (
                      <Check size={16} color={theme.colors.brandOrange} strokeWidth={2} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </Animated.View>

          {/* Compliance toggle */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(400).springify()}
            style={styles.toggleSection}
          >
            <View style={styles.toggleInfo}>
              <Text style={styles.sectionLabel}>HMS-krav</Text>
              <Text style={styles.toggleSubtext}>Marker om oppgaven er lovpålagt</Text>
            </View>
            <Switch
              value={isCompliance}
              onValueChange={(val) => {
                Haptics.selectionAsync();
                setIsCompliance(val);
              }}
              trackColor={{
                false: withOpacity(theme.colors.muted, 0.8),
                true: withOpacity(theme.colors.brandOrange, 0.4),
              }}
              thumbColor={isCompliance ? theme.colors.brandOrange : theme.colors.mutedForeground}
            />
          </Animated.View>

          {/* Submit */}
          <Animated.View
            entering={FadeInDown.delay(500).duration(500).springify()}
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
              <Text style={styles.submitText}>Opprett oppgave</Text>
              <Send size={20} color="#ffffff" strokeWidth={2} />
            </Pressable>
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

  /* Warning */
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: withOpacity(theme.colors.warning, 0.08),
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    marginBottom: theme.spacing.page,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.warning, 0.15),
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.warning,
    lineHeight: 20,
  },

  /* Loading */
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    marginBottom: theme.spacing.page,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
  },

  /* Sections */
  section: { gap: theme.spacing.md, marginBottom: theme.spacing.page },
  sectionLabel: { ...theme.typography.title, color: theme.colors.foreground },

  /* Text input */
  textInput: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.md,
    minHeight: 48,
  },

  /* Text area */
  textArea: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    minHeight: 100,
  },

  /* Picker */
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.md,
    minHeight: 48,
  },
  pickerButtonText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
  pickerButtonTextSelected: {
    color: theme.colors.foreground,
    fontWeight: "500",
  },

  /* Member list */
  memberList: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.background,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.2),
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(theme.colors.border, 0.1),
  },
  memberRowSelected: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.04),
  },
  memberName: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },

  /* Toggle */
  toggleSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    marginBottom: theme.spacing.page,
  },
  toggleInfo: { flex: 1, gap: 4 },
  toggleSubtext: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },

  /* Submit */
  submitSection: { paddingTop: theme.spacing.md },
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
