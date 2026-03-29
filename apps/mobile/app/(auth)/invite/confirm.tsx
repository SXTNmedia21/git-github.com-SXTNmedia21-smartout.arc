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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, withOpacity } from "@/theme";

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
  const { colors } = useTheme();

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
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: 24,
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 24,
      }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableOpacity
        style={{ alignSelf: "flex-start", marginBottom: 16, padding: 4 }}
        onPress={() => router.back()}
      >
        <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Tilbake</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: colors.brandOrange,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {params.workspaceName}
        </Text>
        <Text
          style={{ fontSize: 24, fontWeight: "700", color: colors.foreground, textAlign: "center" }}
        >
          Bekreft dine opplysninger
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: colors.mutedForeground,
            textAlign: "center",
            marginTop: 8,
            marginBottom: 32,
            paddingHorizontal: 16,
            lineHeight: 22,
          }}
        >
          Sjekk at informasjonen stemmer for du fortsetter.
        </Text>

        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.mutedForeground,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 6,
                }}
              >
                Fornavn
              </Text>
              <TextInput
                style={{
                  width: "100%",
                  height: 52,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  fontSize: 16,
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                }}
                value={firstName}
                onChangeText={(t) => {
                  setFirstName(t);
                  setErrors([]);
                }}
                placeholder="Kari"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.mutedForeground,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 6,
                }}
              >
                Etternavn
              </Text>
              <TextInput
                style={{
                  width: "100%",
                  height: 52,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  fontSize: 16,
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                }}
                value={lastName}
                onChangeText={(t) => {
                  setLastName(t);
                  setErrors([]);
                }}
                placeholder="Nordmann"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          <View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.mutedForeground,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              E-post
            </Text>
            <TextInput
              style={{
                width: "100%",
                height: 52,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                fontSize: 16,
                backgroundColor: colors.muted,
                color: colors.foreground,
              }}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setErrors([]);
              }}
              placeholder="kari@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.mutedForeground,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              Telefon
            </Text>
            <TextInput
              style={{
                width: "100%",
                height: 52,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                fontSize: 16,
                backgroundColor: colors.muted,
                color: colors.foreground,
              }}
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setErrors([]);
              }}
              placeholder="+47 900 00 000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
            />
          </View>

          {errors.length > 0 && (
            <View
              style={{
                backgroundColor: withOpacity(colors.destructive, 0.08),
                borderRadius: 12,
                padding: 12,
                gap: 4,
              }}
            >
              {errors.map((e, i) => (
                <Text key={i} style={{ color: colors.destructive, fontSize: 14 }}>
                  {e}
                </Text>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={{
          width: "100%",
          height: 52,
          backgroundColor: colors.brandOrange,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 16,
        }}
        onPress={handleContinue}
      >
        <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "600" }}>
          Fortsett til verifisering
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
