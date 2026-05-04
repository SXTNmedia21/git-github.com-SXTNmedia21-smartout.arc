/**
 * complete-data.tsx — Employee self-service PII intake screen.
 *
 * Shown when a contract status is pending_data. Employee fills in:
 * - Personnummer (identity group)
 * - Adresse, Postnummer, By (address group)
 *
 * Uses submit_own_pii RPC — employee submits their own data without admin role.
 * Mirrors web /my-profile/complete. ADR-0077: PII handling. ADR-0078: voice forbidden.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, CheckCircle, Info } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { supabase } from "@/lib/supabase";
import { emit, nonEmpty } from "@smartout/telemetry";
import { strings } from "@/constants/strings";
import { useMyProfile } from "@/hooks/queries/use-my-profile";

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

export default function CompleteDataScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useMyProfile();

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profileId = profile?.profile_id;
  const workspaceId = profile?.workspace_id;

  function validate(): string | null {
    const pnr = values.personal_number.trim();
    if (pnr && pnr.length !== 11) return strings.contract.validationPersonalNumber;
    const pc = values.postal_code.trim();
    if (pc && pc.length !== 4) return strings.contract.validationPostalCode;
    const hasAny = Object.values(values).some((v) => v.trim().length > 0);
    if (!hasAny) return strings.contract.validationAtLeastOne;
    return null;
  }

  async function handleSubmit() {
    if (!profileId || !workspaceId || submitting) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // Submit identity group (personal_number) if provided
      if (values.personal_number.trim()) {
        const { error: identityError } = await supabase.rpc("submit_own_pii", {
          p_workspace_id: workspaceId,
          p_field_group: "identity",
          p_values: { personal_number: values.personal_number.trim() },
        });

        if (identityError) {
          setError(`${strings.contract.errorPrefix}${identityError.message}`);
          return;
        }
      }

      // Submit address group if any address field is provided
      const addressValues: Record<string, string> = {};
      if (values.address.trim()) addressValues.address_line_1 = values.address.trim();
      if (values.postal_code.trim()) addressValues.postal_code = values.postal_code.trim();
      if (values.city.trim()) addressValues.city = values.city.trim();

      if (Object.keys(addressValues).length > 0) {
        const { error: addressError } = await supabase.rpc("submit_own_pii", {
          p_workspace_id: workspaceId,
          p_field_group: "address",
          p_values: addressValues,
        });

        if (addressError) {
          setError(`${strings.contract.errorPrefix}${addressError.message}`);
          return;
        }
      }

      // Emit telemetry on successful PII submission
      void emit({
        event: "contract intake completed",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "profile", entity_id: profileId },
          data: { contract_id: "", duration_hours: 0 },
        },
      });

      setSubmitted(true);
    } catch {
      setError(strings.contract.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  // Success state
  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={strings.contract.back}
          >
            <ChevronLeft size={22} color={theme.colors.foreground} strokeWidth={1.6} />
          </Pressable>
          <Text style={styles.headerTitle}>{strings.contract.fillInfo}</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <CheckCircle size={40} color="#22c55e" strokeWidth={1.5} />
          </View>
          <Text style={styles.successTitle}>{strings.contract.successTitle}</Text>
          <Text style={styles.successBody}>{strings.contract.successBody}</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.back();
            }}
            style={styles.submitButton}
            accessibilityRole="button"
          >
            <Text style={styles.submitButtonText}>{strings.contract.back}</Text>
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
          accessibilityLabel={strings.contract.back}
        >
          <ChevronLeft size={22} color={theme.colors.foreground} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.headerTitle}>{strings.contract.fillInfo}</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Info size={16} color="#3b82f6" strokeWidth={1.6} />
            <Text style={styles.infoText}>{strings.contract.infoText}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Personnummer */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{strings.contract.fieldPersonalNumber}</Text>
              <TextInput
                style={styles.input}
                placeholder={strings.contract.placeholderPersonalNumber}
                placeholderTextColor={theme.colors.mutedForeground}
                value={values.personal_number}
                onChangeText={(text) => {
                  // Only allow digits
                  const digits = text.replace(/\D/g, "");
                  setValues((v) => ({ ...v, personal_number: digits }));
                  setError(null);
                }}
                keyboardType="number-pad"
                maxLength={11}
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                secureTextEntry={false}
                accessibilityLabel={strings.contract.fieldPersonalNumber}
              />
            </View>

            {/* Adresse */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{strings.contract.fieldAddress}</Text>
              <TextInput
                style={styles.input}
                placeholder={strings.contract.placeholderAddress}
                placeholderTextColor={theme.colors.mutedForeground}
                value={values.address}
                onChangeText={(text) => {
                  setValues((v) => ({ ...v, address: text }));
                  setError(null);
                }}
                autoCorrect={false}
                autoCapitalize="words"
                accessibilityLabel={strings.contract.fieldAddress}
              />
            </View>

            {/* Postnummer + By — side by side */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.rowFieldSmall]}>
                <Text style={styles.fieldLabel}>{strings.contract.fieldPostalCode}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={strings.contract.placeholderPostalCode}
                  placeholderTextColor={theme.colors.mutedForeground}
                  value={values.postal_code}
                  onChangeText={(text) => {
                    const digits = text.replace(/\D/g, "");
                    setValues((v) => ({ ...v, postal_code: digits }));
                    setError(null);
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  autoCorrect={false}
                  accessibilityLabel={strings.contract.fieldPostalCode}
                />
              </View>
              <View style={[styles.fieldGroup, styles.rowFieldLarge]}>
                <Text style={styles.fieldLabel}>{strings.contract.fieldCity}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={strings.contract.placeholderCity}
                  placeholderTextColor={theme.colors.mutedForeground}
                  value={values.city}
                  onChangeText={(text) => {
                    setValues((v) => ({ ...v, city: text }));
                    setError(null);
                  }}
                  autoCorrect={false}
                  autoCapitalize="words"
                  accessibilityLabel={strings.contract.fieldCity}
                />
              </View>
            </View>
          </View>

          {/* Inline error */}
          {error !== null && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleSubmit();
            }}
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={strings.contract.submitButton}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>{strings.contract.submitButton}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  flex: { flex: 1 },
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
    flex: 1,
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
    textAlign: "center" as const,
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.md,
    paddingBottom: 120,
  },

  /* Info banner */
  infoBanner: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 10,
    backgroundColor: withOpacity("#3b82f6", 0.08),
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    marginBottom: theme.spacing.section,
  },
  infoText: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.foreground,
    lineHeight: 20,
  },

  /* Form */
  form: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  fieldGroup: { gap: 6 },
  fieldLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: "500" as const,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    fontSize: 15,
    color: theme.colors.foreground,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : theme.colors.muted,
  },
  row: {
    flexDirection: "row" as const,
    gap: theme.spacing.tight,
  },
  rowFieldSmall: { flex: 2 },
  rowFieldLarge: { flex: 3 },

  /* Error */
  errorBanner: {
    backgroundColor: withOpacity("#ef4444", 0.08),
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.body,
    color: "#ef4444",
  },

  /* Submit */
  submitButton: {
    height: 50,
    backgroundColor: theme.colors.brandOrange,
    borderRadius: theme.radius.lg,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: theme.spacing.tight,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#ffffff",
  },

  /* Success */
  successContainer: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: theme.spacing.section,
    gap: theme.spacing.md,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: withOpacity("#22c55e", 0.1),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: theme.spacing.tight,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: theme.colors.foreground,
  },
  successBody: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
    lineHeight: 22,
  },
}));
