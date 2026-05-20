/**
 * Verify / Login screen — dual purpose based on flow param.
 *
 * flow === "login": Email + password login (matches web login), Google SSO,
 *                   or passwordless OTP via "Send meg kode".
 * flow === "invite" | "search": SMS OTP or magic link verification for
 *                   workspace onboarding flows.
 *
 * After successful auth, AuthProvider picks up the session and routes to workspace-select.
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
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import {
  lightColors,
  withOpacity,
  spacing,
  typography,
  fontWeights,
  radius,
  shadows,
} from "@/theme";

type VerifyTab = "phone" | "email";

const OTP_LENGTH = 6;

const t = lightColors;

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

  const isLogin = params.flow === "login";

  const router = useRouter();
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<VerifyTab>("phone");

  // Login flow: "password" shows the classic email+password form,
  // "otp" shows the SMS/email OTP tabs for passwordless login.
  const [loginMode, setLoginMode] = useState<"password" | "otp">("password");

  // Login flow state (email + password)
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  // Phone flow state
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const otpInputRef = useRef<TextInput>(null);

  // Email OTP / magic link state
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const emailOtpInputRef = useRef<TextInput>(null);

  // Shared state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Password reset ---

  async function handleForgotPassword() {
    const trimmed = loginEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      Alert.alert(
        "Skriv inn e-post først",
        "Fyll inn e-postadressen din over, så sender vi en lenke for å tilbakestille passordet.",
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    // Universal Link target — per ADR-0021 amendment + SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md §3.3.
    // Supabase Cloud Redirect URLs whitelist is `app.smartout.ai/**` only;
    // `smartout://` scheme is NOT a valid Cloud redirectTo and would be rejected.
    // The web bridge at /m/update-password attempts the scheme-URL relay if the
    // OS missed the Universal-Link intent (desktop, no app installed).
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: "https://app.smartout.ai/m/update-password",
    });

    setIsLoading(false);

    if (resetError) {
      setError("Kunne ikke sende tilbakestillingslenke. Prøv igjen.");
      return;
    }

    Alert.alert(
      "Sjekk e-posten din",
      `Vi har sendt en lenke til ${trimmed} for å tilbakestille passordet ditt.`,
    );
  }

  // --- Email + password login (matches web) ---

  async function handleLogin() {
    const trimmed = loginEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Skriv inn en gyldig e-postadresse");
      return;
    }
    if (!loginPassword) {
      setError("Skriv inn passord");
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password: loginPassword,
    });

    setIsLoading(false);

    if (authError) {
      if (
        authError.message.includes("Invalid login credentials") ||
        authError.message.includes("invalid_credentials")
      ) {
        setError("Feil e-post eller passord.");
        return;
      }
      if (
        authError.message.includes("Failed to fetch") ||
        authError.message.includes("NetworkError")
      ) {
        setError("Kunne ikke koble til serveren. Prov igjen.");
        return;
      }
      setError(authError.message);
      return;
    }

    // Navigate to workspace-select after successful login.
    // AuthProvider won't redirect because verify is in the post-auth flow list.
    router.replace("/(auth)/workspace-select");
  }

  async function handleGoogleLogin() {
    setError(null);
    setGoogleLoading(true);

    // Universal Link target on mobile — Apple/Android intercept and route to
    // the native `(auth)/callback.tsx` screen when the app is installed; the
    // web bridge at /m/auth/callback handles the fallback (no-app case).
    // Web path is unchanged — same-host callback for the Expo-on-web variant.
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          Platform.OS === "web"
            ? `${window.location.origin}/api/auth/callback`
            : "https://app.smartout.ai/m/auth/callback",
      },
    });

    // Reset loading state regardless of outcome — the OAuth call opens an
    // external browser, so we never get a "success" callback here to reset it.
    setGoogleLoading(false);

    if (oauthError) {
      setError("Noe gikk galt med Google-innlogging.");
    }
  }

  // --- Phone OTP flow ---

  async function sendOtp() {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("Skriv inn et gyldig norsk mobilnummer (8 siffer)");
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: normalized });

    setIsLoading(false);

    if (otpError) {
      setError("Kunne ikke sende kode. Prov igjen.");
      return;
    }

    setOtpSent(true);
  }

  // --- Email OTP flow ---
  // Supabase signInWithOtp({ email }) sends both a magic link AND a 6-digit
  // code. The user can either click the link or enter the code manually.

  async function sendEmailOtp() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Skriv inn en gyldig e-postadresse");
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: otpError } = await supabase.auth.signInWithOtp({ email: trimmed });

    setIsLoading(false);

    if (otpError) {
      setError("Kunne ikke sende kode. Prov igjen.");
      return;
    }

    setEmailSent(true);
  }

  function handleEmailOtpChange(text: string) {
    const cleaned = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setEmailOtp(cleaned);
    setError(null);
    if (cleaned.length === OTP_LENGTH) {
      void verifyEmailOtpWithCode(cleaned);
    }
  }

  async function verifyEmailOtpWithCode(code: string) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: trimmed,
      token: code,
      type: "email",
    });

    setIsLoading(false);

    if (verifyError) {
      setError("Feil kode. Sjekk e-posten og prov igjen.");
      return;
    }

    if (isLogin) {
      router.replace("/(auth)/workspace-select");
      return;
    }

    await handlePostAuth();
  }

  // --- Post-auth: handle workspace assignment based on flow ---

  async function handlePostAuth() {
    const { flow, workspaceId, token } = params;

    if (flow === "invite" && token) {
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
      }
    }

    if (flow === "search" && workspaceId) {
      const [
        {
          data: { user },
        },
        { data: workspace },
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("workspace").select("company_id").eq("workspace_id", workspaceId).single(),
      ]);

      // company_id is a required FK on invitation — it must come from the
      // workspace record, not the workspaceId itself (they are different entities).
      if (user && workspace?.company_id) {
        await supabase.from("invitation").insert({
          workspace_id: workspaceId,
          company_id: workspace.company_id,
          direction: "inbound",
          status: "pending",
          invite_type: "link",
          role: "employee",
          phone: user.phone ?? null,
          email: user.email ?? null,
        });
      }
    }

    if (flow === "search") {
      router.replace("/(auth)/pending");
    } else {
      router.replace("/(auth)/workspace-select");
    }
  }

  function normalizePhone(raw: string): string | null {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("47") && digits.length === 10) return `+${digits}`;
    if (digits.length === 8) return `+47${digits}`;
    return null;
  }

  function handleOtpChange(text: string) {
    const cleaned = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setOtp(cleaned);
    setError(null);
    if (cleaned.length === OTP_LENGTH) {
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

    // Passwordless login via OTP — skip handlePostAuth (no workspace-specific
    // setup needed), go straight to workspace-select which finds the user's profiles.
    if (isLogin) {
      router.replace("/(auth)/workspace-select");
      return;
    }

    await handlePostAuth();
  }

  // --- Render: Login flow ---

  if (isLogin) {
    return (
      <KeyboardAvoidingView
        style={[s.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={s.backLink}
            onPress={() => {
              if (loginMode === "otp") {
                setLoginMode("password");
                setError(null);
                setOtpSent(false);
                setOtp("");
                setEmailSent(false);
                setEmailOtp("");
              } else if (canGoBack) {
                router.back();
              } else {
                router.replace("/(auth)/welcome");
              }
            }}
          >
            <Text style={s.backLinkText}>Tilbake</Text>
          </TouchableOpacity>

          {/* --- Password login mode --- */}
          {loginMode === "password" && (
            <>
              <View style={s.loginHeader}>
                <Text style={s.heading}>Velkommen tilbake</Text>
                <Text style={s.subtitle}>Logg inn for a fortsette til Smartout.</Text>
              </View>

              {error && (
                <View style={s.errorBanner}>
                  <Text style={s.errorBannerText}>{error}</Text>
                </View>
              )}

              {/* Google SSO */}
              <TouchableOpacity
                style={s.googleButton}
                activeOpacity={0.7}
                onPress={handleGoogleLogin}
                disabled={googleLoading || isLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator color={t.foreground} />
                ) : (
                  <Text style={s.googleButtonText}>Fortsett med Google</Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>eller</Text>
                <View style={s.dividerLine} />
              </View>

              {/* Email */}
              <Text style={s.label}>E-post</Text>
              <TextInput
                style={s.input}
                placeholder="din@epost.no"
                placeholderTextColor={t.mutedForeground}
                value={loginEmail}
                onChangeText={(v) => {
                  setLoginEmail(v);
                  setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />

              {/* Password */}
              <View style={s.passwordHeader}>
                <Text style={s.label}>Passord</Text>
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={s.forgotLink}>Glemt passord?</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={s.input}
                placeholder="Passord"
                placeholderTextColor={t.mutedForeground}
                value={loginPassword}
                onChangeText={(v) => {
                  setLoginPassword(v);
                  setError(null);
                }}
                secureTextEntry
                autoComplete="password"
              />

              {/* Submit */}
              <TouchableOpacity
                style={[s.primaryButton, isLoading && s.buttonDisabled]}
                activeOpacity={0.85}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={t.primaryForeground} />
                ) : (
                  <Text style={s.primaryButtonText}>Logg inn</Text>
                )}
              </TouchableOpacity>

              {/* Passwordless OTP login — alternative to password */}
              <TouchableOpacity
                style={s.sendCodeLink}
                onPress={() => {
                  setLoginMode("otp");
                  setError(null);
                }}
              >
                <Text style={s.sendCodeLinkText}>Send meg kode</Text>
              </TouchableOpacity>

              {/* Sign up link */}
              <TouchableOpacity onPress={() => router.replace("/(auth)/welcome")}>
                <Text style={s.footerText}>
                  Har du ikke konto? <Text style={s.footerLink}>Opprett konto</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* --- OTP login mode (passwordless) --- */}
          {loginMode === "otp" && (
            <>
              <View style={s.loginHeader}>
                <Text style={s.heading}>Send meg kode</Text>
                <Text style={s.subtitle}>
                  Skriv inn telefonnummer eller e-post, sa sender vi en innloggingskode.
                </Text>
              </View>

              {/* Tab switcher: SMS / E-post */}
              <View style={s.tabRow}>
                <TouchableOpacity
                  style={[s.tab, activeTab === "phone" && s.tabActive]}
                  onPress={() => {
                    setActiveTab("phone");
                    setError(null);
                  }}
                >
                  <Text style={[s.tabText, activeTab === "phone" && s.tabTextActive]}>SMS</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.tab, activeTab === "email" && s.tabActive]}
                  onPress={() => {
                    setActiveTab("email");
                    setError(null);
                  }}
                >
                  <Text style={[s.tabText, activeTab === "email" && s.tabTextActive]}>E-post</Text>
                </TouchableOpacity>
              </View>

              {/* Phone: enter number */}
              {activeTab === "phone" && !otpSent && (
                <View style={s.form}>
                  <Text style={s.label}>Mobilnummer</Text>
                  <View style={s.phoneRow}>
                    <View style={s.countryCode}>
                      <Text style={s.countryCodeText}>+47</Text>
                    </View>
                    <TextInput
                      style={s.phoneInput}
                      placeholder="12 34 56 78"
                      placeholderTextColor={t.mutedForeground}
                      value={phone}
                      onChangeText={(v) => {
                        setPhone(v);
                        setError(null);
                      }}
                      keyboardType="phone-pad"
                      maxLength={11}
                      autoFocus
                    />
                  </View>

                  {error && <Text style={s.errorText}>{error}</Text>}

                  <TouchableOpacity
                    style={[s.primaryButton, isLoading && s.buttonDisabled]}
                    onPress={sendOtp}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={t.primaryForeground} />
                    ) : (
                      <Text style={s.primaryButtonText}>Send kode</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Phone: enter OTP */}
              {activeTab === "phone" && otpSent && (
                <View style={s.form}>
                  <Text style={s.label}>Skriv inn koden fra SMS</Text>

                  <View style={s.otpRow}>
                    {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[s.otpBox, i < otp.length && s.otpBoxFilled]}
                        onPress={() => otpInputRef.current?.focus()}
                      >
                        <Text style={s.otpChar}>{otp[i] ?? ""}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    ref={otpInputRef}
                    style={s.hiddenInput}
                    value={otp}
                    onChangeText={handleOtpChange}
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                    autoFocus
                  />

                  {error && <Text style={s.errorText}>{error}</Text>}
                  {isLoading && <ActivityIndicator color={t.brandOrange} style={s.loader} />}

                  <TouchableOpacity
                    style={s.resendLink}
                    onPress={() => {
                      setOtp("");
                      setOtpSent(false);
                      setError(null);
                    }}
                  >
                    <Text style={s.resendLinkText}>Fikk du ikke kode? Send pa nytt</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Email: enter address */}
              {activeTab === "email" && !emailSent && (
                <View style={s.form}>
                  <Text style={s.label}>E-postadresse</Text>
                  <TextInput
                    style={s.input}
                    placeholder="din@epost.no"
                    placeholderTextColor={t.mutedForeground}
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      setError(null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />

                  {error && <Text style={s.errorText}>{error}</Text>}

                  <TouchableOpacity
                    style={[s.primaryButton, isLoading && s.buttonDisabled]}
                    onPress={sendEmailOtp}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={t.primaryForeground} />
                    ) : (
                      <Text style={s.primaryButtonText}>Send kode</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Email: enter OTP code */}
              {activeTab === "email" && emailSent && (
                <View style={s.form}>
                  <Text style={s.label}>Skriv inn koden fra e-posten</Text>
                  <Text style={s.emailOtpHint}>Vi sendte en 6-sifret kode til {email}</Text>

                  <View style={s.otpRow}>
                    {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[s.otpBox, i < emailOtp.length && s.otpBoxFilled]}
                        onPress={() => emailOtpInputRef.current?.focus()}
                      >
                        <Text style={s.otpChar}>{emailOtp[i] ?? ""}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    ref={emailOtpInputRef}
                    style={s.hiddenInput}
                    value={emailOtp}
                    onChangeText={handleEmailOtpChange}
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                    autoFocus
                  />

                  {error && <Text style={s.errorText}>{error}</Text>}
                  {isLoading && <ActivityIndicator color={t.brandOrange} style={s.loader} />}

                  <TouchableOpacity
                    style={s.resendLink}
                    onPress={() => {
                      setEmailOtp("");
                      setEmailSent(false);
                      setError(null);
                    }}
                  >
                    <Text style={s.resendLinkText}>Fikk du ikke kode? Send pa nytt</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- Render: Verify flow (invite/search) ---

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableOpacity
        style={s.backLink}
        onPress={() => (canGoBack ? router.back() : router.replace("/(auth)/welcome"))}
      >
        <Text style={s.backLinkText}>Tilbake</Text>
      </TouchableOpacity>

      {params.workspaceName && <Text style={s.workspaceLabel}>{params.workspaceName}</Text>}

      <Text style={s.heading}>Verifiser deg</Text>
      <Text style={s.subtitle}>Bekreft identiteten din for a fortsette.</Text>

      {/* Tab switcher */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tab, activeTab === "phone" && s.tabActive]}
          onPress={() => {
            setActiveTab("phone");
            setError(null);
          }}
        >
          <Text style={[s.tabText, activeTab === "phone" && s.tabTextActive]}>SMS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === "email" && s.tabActive]}
          onPress={() => {
            setActiveTab("email");
            setError(null);
          }}
        >
          <Text style={[s.tabText, activeTab === "email" && s.tabTextActive]}>E-post</Text>
        </TouchableOpacity>
      </View>

      {/* Phone tab */}
      {activeTab === "phone" && !otpSent && (
        <View style={s.form}>
          <Text style={s.label}>Mobilnummer</Text>
          <View style={s.phoneRow}>
            <View style={s.countryCode}>
              <Text style={s.countryCodeText}>+47</Text>
            </View>
            <TextInput
              style={s.phoneInput}
              placeholder="12 34 56 78"
              placeholderTextColor={t.mutedForeground}
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                setError(null);
              }}
              keyboardType="phone-pad"
              maxLength={11}
              autoFocus
            />
          </View>

          {error && <Text style={s.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[s.primaryButton, isLoading && s.buttonDisabled]}
            onPress={sendOtp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={t.primaryForeground} />
            ) : (
              <Text style={s.primaryButtonText}>Send kode</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* OTP input */}
      {activeTab === "phone" && otpSent && (
        <View style={s.form}>
          <Text style={s.label}>Skriv inn koden fra SMS</Text>

          <View style={s.otpRow}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <TouchableOpacity
                key={i}
                style={[s.otpBox, i < otp.length && s.otpBoxFilled]}
                onPress={() => otpInputRef.current?.focus()}
              >
                <Text style={s.otpChar}>{otp[i] ?? ""}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            ref={otpInputRef}
            style={s.hiddenInput}
            value={otp}
            onChangeText={handleOtpChange}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            autoFocus
          />

          {error && <Text style={s.errorText}>{error}</Text>}
          {isLoading && <ActivityIndicator color={t.brandOrange} style={s.loader} />}

          <TouchableOpacity
            style={s.resendLink}
            onPress={() => {
              setOtp("");
              setOtpSent(false);
              setError(null);
            }}
          >
            <Text style={s.resendLinkText}>Fikk du ikke kode? Send pa nytt</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Email tab: enter address */}
      {activeTab === "email" && !emailSent && (
        <View style={s.form}>
          <Text style={s.label}>E-postadresse</Text>
          <TextInput
            style={s.input}
            placeholder="din@epost.no"
            placeholderTextColor={t.mutedForeground}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />

          {error && <Text style={s.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[s.primaryButton, isLoading && s.buttonDisabled]}
            onPress={sendEmailOtp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={t.primaryForeground} />
            ) : (
              <Text style={s.primaryButtonText}>Send kode</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Email tab: enter OTP code */}
      {activeTab === "email" && emailSent && (
        <View style={s.form}>
          <Text style={s.label}>Skriv inn koden fra e-posten</Text>
          <Text style={s.emailOtpHint}>Vi sendte en 6-sifret kode til {email}</Text>

          <View style={s.otpRow}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <TouchableOpacity
                key={i}
                style={[s.otpBox, i < emailOtp.length && s.otpBoxFilled]}
                onPress={() => emailOtpInputRef.current?.focus()}
              >
                <Text style={s.otpChar}>{emailOtp[i] ?? ""}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            ref={emailOtpInputRef}
            style={s.hiddenInput}
            value={emailOtp}
            onChangeText={handleEmailOtpChange}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            autoFocus
          />

          {error && <Text style={s.errorText}>{error}</Text>}
          {isLoading && <ActivityIndicator color={t.brandOrange} style={s.loader} />}

          <TouchableOpacity
            style={s.resendLink}
            onPress={() => {
              setEmailOtp("");
              setEmailSent(false);
              setError(null);
            }}
          >
            <Text style={s.resendLinkText}>Fikk du ikke kode? Send pa nytt</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.background,
    paddingHorizontal: spacing.section,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backLink: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
    padding: spacing.xs,
  },
  backLinkText: {
    ...typography.subheadline,
    color: t.mutedForeground,
  },

  // Login header
  loginHeader: {
    marginBottom: spacing.section,
  },
  heading: {
    ...typography.largeTitle,
    color: t.foreground,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    ...typography.subheadline,
    color: t.mutedForeground,
    textAlign: "center",
    marginTop: spacing.tight,
    marginBottom: spacing.section,
  },
  workspaceLabel: {
    ...typography.subheadline,
    fontWeight: fontWeights.semibold,
    color: t.brandOrange,
    textAlign: "center",
    marginBottom: spacing.tight,
  },

  // Error banner (login)
  errorBanner: {
    backgroundColor: withOpacity(t.destructive, 0.08),
    borderWidth: 1,
    borderColor: withOpacity(t.destructive, 0.3),
    borderRadius: radius.lg,
    paddingVertical: spacing.element,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.caption,
    color: t.destructive,
    textAlign: "center",
  },

  // Google button
  googleButton: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: radius.xl,
    backgroundColor: t.background,
    paddingVertical: 14,
    alignItems: "center",
    ...shadows.sm,
    marginBottom: spacing.md,
  },
  googleButtonText: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: t.foreground,
  },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: t.border,
  },
  dividerText: {
    ...typography.caption,
    color: t.mutedForeground,
    paddingHorizontal: spacing.element,
  },

  // Form elements
  form: {
    flex: 1,
  },
  label: {
    ...typography.subheadline,
    fontWeight: fontWeights.semibold,
    color: t.foreground,
    marginBottom: spacing.tight,
  },
  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.tight,
  },
  forgotLink: {
    ...typography.caption,
    color: t.mutedForeground,
  },
  sendCodeLink: {
    alignItems: "center",
    marginTop: spacing.md,
    padding: spacing.tight,
  },
  sendCodeLinkText: {
    ...typography.subheadline,
    fontWeight: fontWeights.medium,
    color: t.brandOrange,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: t.foreground,
    backgroundColor: t.secondary,
    marginBottom: spacing.element,
  },

  // Primary CTA
  primaryButton: {
    height: 52,
    backgroundColor: t.brandOrange,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.tight,
    ...shadows.md,
    shadowColor: t.brandOrange,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: t.primaryForeground,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Footer (login)
  footerText: {
    ...typography.caption,
    color: t.mutedForeground,
    textAlign: "center",
    marginTop: spacing.section,
  },
  footerLink: {
    fontWeight: fontWeights.semibold,
    color: t.brandOrange,
  },

  // Verify tabs
  tabRow: {
    flexDirection: "row",
    backgroundColor: t.secondary,
    borderRadius: radius.lg,
    padding: 3,
    marginBottom: spacing.section,
  },
  tab: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: t.background,
    ...shadows.sm,
  },
  tabText: {
    ...typography.subheadline,
    fontWeight: fontWeights.medium,
    color: t.mutedForeground,
  },
  tabTextActive: {
    color: t.foreground,
    fontWeight: fontWeights.semibold,
  },

  // Phone input
  phoneRow: {
    flexDirection: "row",
    marginBottom: spacing.element,
  },
  countryCode: {
    width: 64,
    height: 52,
    backgroundColor: t.secondary,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: radius.xl,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  countryCodeText: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: t.foreground,
  },
  phoneInput: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: t.border,
    borderLeftWidth: 0,
    borderRadius: radius.xl,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: t.foreground,
    backgroundColor: t.secondary,
  },

  // OTP
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.tight,
    marginBottom: spacing.section,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: t.border,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.secondary,
  },
  otpBoxFilled: {
    borderColor: t.brandOrange,
    backgroundColor: withOpacity(t.brandOrange, 0.08),
  },
  otpChar: {
    ...typography.title,
    fontWeight: fontWeights.bold,
    color: t.foreground,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 0,
    width: 0,
  },

  // Error / loading / resend
  errorText: {
    ...typography.subheadline,
    color: t.destructive,
    textAlign: "center",
    marginBottom: spacing.element,
  },
  loader: {
    marginVertical: spacing.md,
  },
  resendLink: {
    marginTop: spacing.section,
    alignItems: "center",
    padding: spacing.tight,
  },
  resendLinkText: {
    ...typography.subheadline,
    fontWeight: fontWeights.medium,
    color: t.brandOrange,
  },
  emailOtpHint: {
    ...typography.caption,
    color: t.mutedForeground,
    textAlign: "center",
    marginBottom: spacing.section,
  },
});
