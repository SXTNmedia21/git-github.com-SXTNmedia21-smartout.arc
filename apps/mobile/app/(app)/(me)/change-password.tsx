/**
 * Change password screen — accessed via Settings → Personlig → Bytt passord.
 *
 * Flow: three inputs (current, new, confirm) → re-auth with current password
 * via signInWithPassword (validates without rotating session) → updateUser
 * with new password. On success, Alert + navigation.goBack().
 *
 * This is the IN-APP rotation flow. The forgot-password flow lives at
 * /m/update-password and is entered via a Supabase recovery email link.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Lock, Eye, EyeOff } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { supabase } from "@/lib/supabase";

const MIN_LENGTH = 8;

export default function ChangePasswordScreen() {
  const s = useStyles();
  const theme = useTheme();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < MIN_LENGTH;
  const sameAsCurrent = newPassword.length > 0 && newPassword === currentPassword;
  const canSubmit =
    !submitting &&
    currentPassword.length > 0 &&
    newPassword.length >= MIN_LENGTH &&
    newPassword === confirmPassword &&
    !sameAsCurrent;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user?.email) {
        Alert.alert("Feil", "Kunne ikke hente brukerdata. Logg inn på nytt.");
        return;
      }

      // Re-auth verifies current password without rotating the session.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      });
      if (reauthErr) {
        Alert.alert("Feil nåværende passord", "Sjekk og prøv igjen.");
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) {
        Alert.alert("Kunne ikke oppdatere passord", updateErr.message);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Passord oppdatert", "Du kan nå bruke det nye passordet.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Uventet feil", err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, currentPassword, newPassword, router]);

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backButton}>
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.6} />
        </Pressable>
        <Text style={s.headerTitle}>Bytt passord</Text>
        <View style={s.backButton} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.description}>
            Bekreft nåværende passord før du kan velge et nytt. Minimum {MIN_LENGTH} tegn.
          </Text>

          <View style={s.field}>
            <Text style={s.label}>Nåværende passord</Text>
            <TextInput
              style={s.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              editable={!submitting}
              placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.5)}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Nytt passord</Text>
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, s.inputFlex]}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!submitting}
                placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.5)}
              />
              <Pressable onPress={() => setShowNew((v) => !v)} hitSlop={8} style={s.eyeButton}>
                {showNew ? (
                  <EyeOff size={18} color={theme.colors.mutedForeground} strokeWidth={1.6} />
                ) : (
                  <Eye size={18} color={theme.colors.mutedForeground} strokeWidth={1.6} />
                )}
              </Pressable>
            </View>
            {tooShort && <Text style={s.errorText}>Minimum {MIN_LENGTH} tegn</Text>}
            {sameAsCurrent && (
              <Text style={s.errorText}>Nytt passord må være forskjellig fra nåværende</Text>
            )}
          </View>

          <View style={s.field}>
            <Text style={s.label}>Bekreft nytt passord</Text>
            <TextInput
              style={s.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!submitting}
              placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.5)}
            />
            {mismatch && <Text style={s.errorText}>Passordene matcher ikke</Text>}
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              s.submitButton,
              !canSubmit && s.submitButtonDisabled,
              pressed && canSubmit && s.submitButtonPressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={"#ffffff"} />
            ) : (
              <>
                <Lock size={18} color={"#ffffff"} strokeWidth={1.6} />
                <Text style={s.submitButtonText}>Lagre nytt passord</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(theme.colors.border, 0.5),
  },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.foreground,
  },
  scrollContent: { padding: 20, paddingBottom: 60 },
  description: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    marginBottom: 24,
    lineHeight: 20,
  },
  field: { marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.foreground,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.foreground,
  },
  inputRow: { flexDirection: "row", alignItems: "center" },
  inputFlex: { flex: 1 },
  eyeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -44,
  },
  errorText: { fontSize: 12, color: theme.colors.destructive, marginTop: 6 },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.brandOrange,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonPressed: { opacity: 0.85 },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
}));
