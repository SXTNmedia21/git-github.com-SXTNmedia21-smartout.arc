/**
 * Invite confirmation screen — user confirms/edits their name, email, phone
 * before proceeding to OTP verification.
 *
 * Receives pre-filled data from invite/[token] and passes confirmed data to verify.
 */
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function InviteConfirm() {
  const params = useLocalSearchParams<{
    workspaceId: string;
    workspaceName: string;
    token: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState(params.firstName ?? "");
  const [lastName, setLastName] = useState(params.lastName ?? "");
  const [email, setEmail] = useState(params.email ?? "");
  const [phone, setPhone] = useState(params.phone ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  function handleContinue() {
    const newErrors: string[] = [];
    if (!firstName.trim()) newErrors.push("Fornavn er påkrevd");
    if (!lastName.trim()) newErrors.push("Etternavn er påkrevd");
    if (!email.trim() && !phone.trim()) {
      newErrors.push("E-post eller telefonnummer er påkrevd");
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    router.push({
      pathname: "/(auth)/verify",
      params: {
        flow: "invite",
        workspaceId: params.workspaceId,
        workspaceName: params.workspaceName,
        token: params.token,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      },
    });
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
        <Text style={styles.backLinkText}>Tilbake</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.workspaceLabel}>{params.workspaceName}</Text>
        <Text style={styles.heading}>Bekreft dine opplysninger</Text>
        <Text style={styles.subtitle}>Sjekk at informasjonen stemmer for du fortsetter.</Text>

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Fornavn</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={(t) => {
                  setFirstName(t);
                  setErrors([]);
                }}
                placeholder="Kari"
                autoFocus
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Etternavn</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={(t) => {
                  setLastName(t);
                  setErrors([]);
                }}
                placeholder="Nordmann"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>E-post</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setErrors([]);
              }}
              placeholder="kari@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Telefon</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setErrors([]);
              }}
              placeholder="+47 900 00 000"
              keyboardType="phone-pad"
            />
          </View>

          {errors.length > 0 && (
            <View style={styles.errorBox}>
              {errors.map((e, i) => (
                <Text key={i} style={styles.errorText}>
                  {e}
                </Text>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
        <Text style={styles.primaryButtonText}>Fortsett til verifisering</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  scroll: {
    flexGrow: 1,
  },
  backLink: {
    alignSelf: "flex-start",
    marginBottom: 16,
    padding: 4,
  },
  backLinkText: {
    color: "#6B7280",
    fontSize: 15,
  },
  workspaceLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F97316",
    textAlign: "center",
    marginBottom: 8,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 32,
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  form: {
    gap: 16,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  field: {},
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    height: 52,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#F9FAFB",
    color: "#111827",
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
  },
  primaryButton: {
    width: "100%",
    height: 52,
    backgroundColor: "#F97316",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
