/**
 * Task runner screen — displays a session_task and handles completion.
 *
 * Fetches the task by ID from session_task, shows its title, description,
 * and compliance status. On submit, marks the task as completed with the
 * current user's profile_id and timestamp.
 */

import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ClipboardList, CheckCircle, AlertTriangle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import type { Database } from "@smartout/supabase/database.types";

type SessionTask = Database["public"]["Tables"]["session_task"]["Row"];

/** Fetches a single session_task by its ID */
function useTask(taskId: string | undefined) {
  return useQuery<SessionTask | null>({
    queryKey: ["session-task", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await supabase
        .from("session_task")
        .select("*")
        .eq("id", taskId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });
}

export default function TaskRunnerScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: profile } = useMyProfile();
  const { data: task, isLoading, isError } = useTask(id);

  const [submitted, setSubmitted] = useState(false);

  /** Marks the task as completed in the database */
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!id || !profile) throw new Error("Missing task ID or profile");
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("session_task")
        .update({
          status: "completed" as SessionTask["status"],
          completed_at: now,
          completed_by: profile.profile_id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      /* Refresh the task list so it reflects the completion */
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["session-task", id] });
    },
  });

  /* Loading state */
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.successWrap}>
          <ActivityIndicator size="large" color={theme.colors.foreground} />
        </View>
      </SafeAreaView>
    );
  }

  /* Error or task not found */
  if (isError || !task) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.successWrap}>
          <AlertTriangle size={48} color={theme.colors.warning} strokeWidth={1.4} />
          <Text style={styles.successTitle}>Oppgave ikke funnet</Text>
          <Text style={styles.successDesc}>Oppgaven finnes ikke eller du har ikke tilgang.</Text>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.backLinkText}>Tilbake</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* Already completed (either just now or was already done) */
  if (submitted || task.status === "completed") {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.successWrap}>
          <CheckCircle size={48} color={theme.colors.brandOrange} strokeWidth={1.4} />
          <Text style={styles.successTitle}>Fullfort!</Text>
          <Text style={styles.successDesc}>{task.title} er registrert som fullfort.</Text>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.backLinkText}>Tilbake</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isSubmitting = completeMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={22} color={theme.colors.foreground} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.headerTitle}>Oppgave</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Task header */}
        <View style={styles.taskHeader}>
          <View style={styles.taskIcon}>
            <ClipboardList size={22} color={theme.colors.brandOrange} strokeWidth={1.5} />
          </View>
          <View style={styles.taskTitleWrap}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}
          </View>
        </View>

        {/* Compliance badge */}
        {task.is_compliance_required && (
          <View style={styles.complianceBadge}>
            <AlertTriangle size={14} color={theme.colors.warning} strokeWidth={2} />
            <Text style={styles.complianceText}>Lovpaalagt oppgave</Text>
          </View>
        )}

        {/* Status info */}
        <View style={styles.fieldGroup}>
          <View style={styles.infoRow}>
            <Text style={styles.fieldLabel}>Status</Text>
            <Text style={styles.fieldValue}>
              {task.status === "pending"
                ? "Venter"
                : task.status === "available"
                  ? "Tilgjengelig"
                  : task.status === "in_progress"
                    ? "Paagaar"
                    : task.status}
            </Text>
          </View>
        </View>

        {/* Submit button */}
        <Pressable
          onPress={() => completeMutation.mutate()}
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.submitButton,
            isSubmitting && styles.submitDisabled,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.submitText}>
            {isSubmitting ? "Registrerer..." : "Marker som fullfort"}
          </Text>
        </Pressable>

        {completeMutation.isError && (
          <Text style={styles.errorText}>Noe gikk galt. Proov igjen.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    height: 50,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },

  scrollContent: { paddingHorizontal: theme.spacing.section, paddingBottom: 120 },

  /* Task header */
  taskHeader: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 12,
    marginBottom: theme.spacing.page,
  },
  taskIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.1),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  taskTitleWrap: { flex: 1, gap: 4 },
  taskTitle: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },
  taskDesc: { ...theme.typography.body, color: theme.colors.mutedForeground },

  /* Compliance badge */
  complianceBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    backgroundColor: withOpacity(theme.colors.warning, 0.1),
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: theme.spacing.page,
  },
  complianceText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: theme.colors.warning,
  },

  /* Fields / info */
  fieldGroup: { gap: theme.spacing.md, marginBottom: theme.spacing.page },
  infoRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },

  /* Submit */
  submitButton: {
    backgroundColor: theme.colors.brandOrange,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    alignItems: "center" as const,
    ...theme.shadows.md,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#ffffff",
  },

  /* Error */
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.destructive,
    textAlign: "center" as const,
    marginTop: theme.spacing.element,
  },

  /* Success */
  successWrap: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 12,
    paddingHorizontal: theme.spacing.section,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },
  successDesc: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
  },
  backLink: { marginTop: 8 },
  backLinkText: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: theme.colors.brandOrange,
  },
}));
