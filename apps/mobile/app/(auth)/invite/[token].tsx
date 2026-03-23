/**
 * Deep link handler for invite tokens.
 * URL: app.smartout.ai/invite/[token] or smartout://invite/[token]
 * Validates the token against the invitation table, shows the workspace,
 * and redirects to verify screen with invite context on confirmation.
 */
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Image, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

type InviteData = {
  workspaceId: string;
  workspaceName: string;
  logoUrl: string | null;
  token: string;
};

export default function InviteDeepLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Ingen invitasjonskode funnet i lenken.");
      setIsLoading(false);
      return;
    }

    void validateToken(token);
  }, [token]);

  async function validateToken(tokenValue: string) {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("invitation")
      .select("invitation_id, token, status, workspace:workspace_id(workspace_id, name, logo_url)")
      .eq("token", tokenValue)
      .eq("status", "pending")
      .single();

    setIsLoading(false);

    if (fetchError || !data) {
      setError("Denne invitasjonen er ugyldig eller har utlopt.");
      return;
    }

    const ws = data.workspace as unknown as {
      workspace_id: string;
      name: string;
      logo_url: string | null;
    } | null;

    if (!ws) {
      setError("Fant ikke arbeidsplassen knyttet til denne invitasjonen.");
      return;
    }

    setInvite({
      workspaceId: ws.workspace_id,
      workspaceName: ws.name,
      logoUrl: ws.logo_url,
      token: tokenValue,
    });
  }

  function handleConfirm() {
    if (!invite) return;
    router.push({
      pathname: "/(auth)/verify",
      params: {
        flow: "invite",
        workspaceId: invite.workspaceId,
        workspaceName: invite.workspaceName,
        token: invite.token,
      },
    });
  }

  function handleGoToWelcome() {
    router.replace("/(auth)/welcome");
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.loadingText}>Sjekker invitasjonen...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorHeading}>Noe gikk galt</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleGoToWelcome}>
          <Text style={styles.primaryButtonText}>Ga til innlogging</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Invite found — show workspace confirmation
  if (!invite) return null;

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.content}>
        {invite.logoUrl ? (
          <Image source={{ uri: invite.logoUrl }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>
              {invite.workspaceName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <Text style={styles.heading}>Bli med i</Text>
        <Text style={styles.workspaceName}>{invite.workspaceName}</Text>
        <Text style={styles.subtitle}>
          Du er invitert til denne arbeidsplassen. Bekreft for a komme i gang.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleConfirm}>
          <Text style={styles.primaryButtonText}>Bekreft og fortsett</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleGoToWelcome}>
          <Text style={styles.secondaryButtonText}>Avbryt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    gap: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  workspaceName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F97316",
    textAlign: "center",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 18,
    marginBottom: 20,
  },
  logoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 18,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoPlaceholderText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#F97316",
  },
  loadingText: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 16,
  },
  errorHeading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  errorText: {
    color: "#6B7280",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  primaryButton: {
    width: "100%",
    height: 52,
    backgroundColor: "#F97316",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    width: "100%",
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#6B7280",
    fontSize: 15,
  },
});
