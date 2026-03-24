/**
 * Verify screen — SMS OTP or magic link email verification.
 * Receives auth flow context (invite/code/search) + workspace info via route params.
 * Two tabs: phone (SMS OTP) and email (magic link fallback).
 * After successful verification, AuthProvider picks up the session change and routes to (app).
 */
import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

type VerifyTab = "phone" | "email";

const OTP_LENGTH = 6;

export default function Verify() {
  const params = useLocalSearchParams<{
    flow: string;
    workspaceId: string;
    workspaceName: string;
    token?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }>();

  const router = useRouter();
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<VerifyTab>("phone");

  // Phone flow state
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const otpInputRef = useRef<TextInput>(null);

  // Email flow state
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  // Shared state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Phone OTP flow ---

  async function sendOtp() {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("Skriv inn et gyldig norsk mobilnummer (8 siffer)");
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: normalized,
    });

    setIsLoading(false);

    if (otpError) {
      setError("Kunne ikke sende kode. Prov igjen.");
      return;
    }

    setOtpSent(true);
  }

  async function verifyOtp() {
    if (otp.length !== OTP_LENGTH) {
      setError("Koden ma vaere 6 siffer");
      return;
    }

    const normalized = normalizePhone(phone);
    if (!normalized) return;

    setIsLoading(true);
    setError(null);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: otp,
      type: "sms",
    });

    setIsLoading(false);

    if (verifyError) {
      setError("Feil kode. Sjekk SMS-en og prov igjen.");
      return;
    }

    // Auth successful — handle post-auth flow based on the entry path
    await handlePostAuth();
  }

  // --- Email magic link flow ---

  async function sendMagicLink() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Skriv inn en gyldig e-postadresse");
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: magicError } = await supabase.auth.signInWithOtp({
      email: trimmed,
    });

    setIsLoading(false);

    if (magicError) {
      setError("Kunne ikke sende lenke. Prov igjen.");
      return;
    }

    setEmailSent(true);
  }

  // --- Post-auth: handle workspace assignment based on flow ---

  async function handlePostAuth() {
    const { flow, workspaceId, token } = params;

    if (flow === "invite" && token) {
      // Call accept-invitation Edge Function — creates profile, contract, payroll
      // The user is already authenticated (OTP/magic link), so the Edge Function
      // detects the auth header and skips password-based user creation.
      const firstName = params.firstName ?? "";
      const lastName = params.lastName ?? "";
      const inviteEmail = params.email ?? "";
      const invitePhone = params.phone ?? "";

      const { data, error: fnError } = await supabase.functions.invoke("accept-invitation", {
        body: {
          token,
          first_name: firstName,
          last_name: lastName,
          email: inviteEmail || undefined,
          phone: invitePhone || undefined,
        },
      });

      if (fnError || !data?.success) {
        console.error("accept-invitation failed:", fnError?.message ?? data?.error);
        // Don't block navigation — profile may already exist (re-click)
      }
    }

    if (flow === "search" && workspaceId) {
      // Create inbound join request — profile creation happens on admin accept
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("invitation").insert({
          workspace_id: workspaceId,
          company_id: workspaceId, // required FK — workspace has same company scope
          direction: "inbound",
          status: "pending",
          invite_type: "link",
          role: "employee",
          phone: user.phone ?? null,
          email: user.email ?? null,
        });
      }
    }

    // For 'code' flow, workspace assignment is handled by the backend
    // when the profile is provisioned (code IS authorization).

    // Navigate based on flow — search goes to pending, others to workspace-select
    if (flow === "search") {
      router.replace("/(auth)/pending");
    } else {
      router.replace("/(auth)/workspace-select");
    }
  }

  // --- Normalize Norwegian phone number to E.164 ---

  function normalizePhone(raw: string): string | null {
    const digits = raw.replace(/\D/g, "");

    // Already has country code
    if (digits.startsWith("47") && digits.length === 10) {
      return `+${digits}`;
    }

    // 8-digit Norwegian number
    if (digits.length === 8) {
      return `+47${digits}`;
    }

    return null;
  }

  // --- OTP input handler ---

  function handleOtpChange(text: string) {
    const cleaned = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setOtp(cleaned);
    setError(null);

    if (cleaned.length === OTP_LENGTH) {
      // Auto-verify when all digits entered
      void verifyOtpWithCode(cleaned);
    }
  }

  async function verifyOtpWithCode(code: string) {
    const normalized = normalizePhone(phone);
    if (!normalized) return;

    setIsLoading(true);
    setError(null);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: code,
      type: "sms",
    });

    setIsLoading(false);

    if (verifyError) {
      setError("Feil kode. Sjekk SMS-en og prov igjen.");
      return;
    }

    await handlePostAuth();
  }

  // --- Render ---

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableOpacity
        style={styles.backLink}
        onPress={() => (canGoBack ? router.back() : router.replace("/(auth)/welcome"))}
      >
        <Text style={styles.backLinkText}>Tilbake</Text>
      </TouchableOpacity>

      {params.workspaceName && <Text style={styles.workspaceLabel}>{params.workspaceName}</Text>}

      <Text style={styles.heading}>Verifiser deg</Text>
      <Text style={styles.subtitle}>Bekreft identiteten din for a fortsette.</Text>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "phone" && styles.tabActive]}
          onPress={() => {
            setActiveTab("phone");
            setError(null);
          }}
        >
          <Text style={[styles.tabText, activeTab === "phone" && styles.tabTextActive]}>SMS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "email" && styles.tabActive]}
          onPress={() => {
            setActiveTab("email");
            setError(null);
          }}
        >
          <Text style={[styles.tabText, activeTab === "email" && styles.tabTextActive]}>
            E-post
          </Text>
        </TouchableOpacity>
      </View>

      {/* Phone tab */}
      {activeTab === "phone" && !otpSent && (
        <View style={styles.form}>
          <Text style={styles.label}>Mobilnummer</Text>
          <View style={styles.phoneRow}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>+47</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="12 34 56 78"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                setError(null);
              }}
              keyboardType="phone-pad"
              maxLength={11}
              autoFocus
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={sendOtp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Send kode</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* OTP input */}
      {activeTab === "phone" && otpSent && (
        <View style={styles.form}>
          <Text style={styles.label}>Skriv inn koden fra SMS</Text>

          <View style={styles.otpRow}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.otpBox, i < otp.length && styles.otpBoxFilled]}
                onPress={() => otpInputRef.current?.focus()}
              >
                <Text style={styles.otpChar}>{otp[i] ?? ""}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            ref={otpInputRef}
            style={styles.hiddenInput}
            value={otp}
            onChangeText={handleOtpChange}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            autoFocus
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          {isLoading && <ActivityIndicator color="#F97316" style={styles.loader} />}

          <TouchableOpacity
            style={styles.resendLink}
            onPress={() => {
              setOtp("");
              setOtpSent(false);
              setError(null);
            }}
          >
            <Text style={styles.resendLinkText}>Fikk du ikke kode? Send pa nytt</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Email tab */}
      {activeTab === "email" && !emailSent && (
        <View style={styles.form}>
          <Text style={styles.label}>E-postadresse</Text>
          <TextInput
            style={styles.input}
            placeholder="din@epost.no"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={sendMagicLink}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Send innloggingslenke</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Email sent confirmation */}
      {activeTab === "email" && emailSent && (
        <View style={styles.form}>
          <Text style={styles.successHeading}>Sjekk innboksen din</Text>
          <Text style={styles.successText}>
            Vi har sendt en innloggingslenke til {email}. Klikk pa lenken for a logge inn.
          </Text>

          <TouchableOpacity
            style={styles.resendLink}
            onPress={() => {
              setEmailSent(false);
              setError(null);
            }}
          >
            <Text style={styles.resendLinkText}>Fikk du ikke e-post? Prov igjen</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 24,
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
    marginBottom: 24,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 3,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#111827",
    fontWeight: "600",
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  countryCode: {
    width: 64,
    height: 52,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  phoneInput: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderLeftWidth: 0,
    borderRadius: 12,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#F9FAFB",
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
    marginBottom: 12,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  otpBoxFilled: {
    borderColor: "#F97316",
    backgroundColor: "#FFF7ED",
  },
  otpChar: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 0,
    width: 0,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  primaryButton: {
    width: "100%",
    height: 52,
    backgroundColor: "#F97316",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loader: {
    marginVertical: 16,
  },
  resendLink: {
    marginTop: 24,
    alignItems: "center",
    padding: 8,
  },
  resendLinkText: {
    color: "#F97316",
    fontSize: 14,
    fontWeight: "500",
  },
  successHeading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginTop: 40,
  },
  successText: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 16,
    lineHeight: 22,
  },
});
