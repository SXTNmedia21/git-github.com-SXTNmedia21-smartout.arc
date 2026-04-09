/**
 * Generic task runner screen — intake, signing, or any pending task.
 *
 * Simple mobile version: title, description, input fields grouped by
 * task type, and a submit button. Used for contract data intake and
 * similar flows driven by engine_state tasks.
 */

import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ClipboardList, CheckCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme, withOpacity } from "@/theme";

/**
 * In a full implementation the task metadata (title, fields, etc.) would
 * be fetched from engine_state / engine_state_step via the task id.
 * For now we show a static identity-group intake form as a representative
 * example of the mobile TaskRunner pattern.
 */

type FormValues = {
  personal_number: string;
  address: string;
  postal_code: string;
  city: string;
};

const EMPTY_FORM: FormValues = {
  personal_number: "",
  address: "",
  postal_code: "",
  city: "",
};

export default function TaskRunnerScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const hasAnyValue = Object.values(values).some((v) => v.trim().length > 0);

  async function handleSubmit() {
    if (!hasAnyValue || submitting) return;
    setSubmitting(true);

    // TODO: Call supabase.rpc("admin_submit_employee_pii", ...) or the
    // appropriate task-completion RPC once task routing is connected.
    // For now we simulate a short delay.
    await new Promise((resolve) => setTimeout(resolve, 800));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.successWrap}>
          <CheckCircle size={48} color={theme.colors.brandOrange} strokeWidth={1.4} />
          <Text style={styles.successTitle}>Takk!</Text>
          <Text style={styles.successDesc}>Informasjonen er sendt inn. Du kan gaa tilbake.</Text>
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
            <Text style={styles.taskTitle}>Fullfoor profilen din</Text>
            <Text style={styles.taskDesc}>
              Vi trenger litt informasjon for aa kunne lage arbeidskontrakten din.
            </Text>
          </View>
        </View>

        {/* Input fields */}
        <View style={styles.fieldGroup}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Personnummer</Text>
            <TextInput
              style={styles.input}
              placeholder="11 siffer"
              placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.5)}
              value={values.personal_number}
              onChangeText={(t) => setValues((v) => ({ ...v, personal_number: t }))}
              keyboardType="number-pad"
              accessibilityLabel="Personnummer"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Adresse</Text>
            <TextInput
              style={styles.input}
              placeholder="Gateadresse"
              placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.5)}
              value={values.address}
              onChangeText={(t) => setValues((v) => ({ ...v, address: t }))}
              accessibilityLabel="Adresse"
            />
          </View>

          <View style={styles.rowFields}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Postnummer</Text>
              <TextInput
                style={styles.input}
                placeholder="0000"
                placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.5)}
                value={values.postal_code}
                onChangeText={(t) => setValues((v) => ({ ...v, postal_code: t }))}
                keyboardType="number-pad"
                accessibilityLabel="Postnummer"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Poststed</Text>
              <TextInput
                style={styles.input}
                placeholder="By"
                placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.5)}
                value={values.city}
                onChangeText={(t) => setValues((v) => ({ ...v, city: t }))}
                accessibilityLabel="Poststed"
              />
            </View>
          </View>
        </View>

        {/* Submit button */}
        <Pressable
          onPress={handleSubmit}
          disabled={!hasAnyValue || submitting}
          style={({ pressed }) => [
            styles.submitButton,
            (!hasAnyValue || submitting) && styles.submitDisabled,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.submitText}>{submitting ? "Sender..." : "Send inn"}</Text>
        </Pressable>
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

  /* Fields */
  fieldGroup: { gap: theme.spacing.md, marginBottom: theme.spacing.page },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
  },
  input: {
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : theme.colors.muted,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.foreground,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
  },
  rowFields: {
    flexDirection: "row" as const,
    gap: theme.spacing.md,
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
