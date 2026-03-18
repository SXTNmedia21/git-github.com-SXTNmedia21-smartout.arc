/**
 * InviteEntry — validates an invitation token and shows the workspace to join.
 * Used when the user arrives via a deep link (Path 1) or manually enters a token.
 * On confirmation, navigates to the verify screen with workspace context.
 */
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

type InviteWorkspace = {
  workspaceId: string;
  workspaceName: string;
  logoUrl: string | null;
  token: string;
};

type InviteEntryProps = {
  /** Pre-filled token from deep link — skips manual entry */
  initialToken?: string;
  onBack: () => void;
};

export function InviteEntry({ initialToken, onBack }: InviteEntryProps) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken ?? "");
  const [workspace, setWorkspace] = useState<InviteWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-validate if we got a token from a deep link
  const shouldAutoValidate = !!initialToken && !workspace && !isLoading && !error;
  if (shouldAutoValidate) {
    void validateToken(initialToken);
  }

  async function validateToken(tokenValue: string) {
    const trimmed = tokenValue.trim();
    if (!trimmed) {
      setError("Skriv inn invitasjonskoden din");
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("invitation")
      .select("invitation_id, token, status, workspace:workspace_id(workspace_id, name, logo_url)")
      .eq("token", trimmed)
      .eq("status", "pending")
      .single();

    setIsLoading(false);

    if (fetchError || !data) {
      setError("Ugyldig eller utlopt invitasjon. Sjekk koden og prov igjen.");
      return;
    }

    // workspace comes back as a joined object
    const ws = data.workspace as unknown as {
      workspace_id: string;
      name: string;
      logo_url: string | null;
    } | null;

    if (!ws) {
      setError("Fant ikke arbeidsplassen knyttet til denne invitasjonen.");
      return;
    }

    setWorkspace({
      workspaceId: ws.workspace_id,
      workspaceName: ws.name,
      logoUrl: ws.logo_url,
      token: trimmed,
    });
  }

  function handleConfirm() {
    if (!workspace) return;
    router.push({
      pathname: "/(auth)/verify",
      params: {
        flow: "invite",
        workspaceId: workspace.workspaceId,
        workspaceName: workspace.workspaceName,
        token: workspace.token,
      },
    });
  }

  // Confirmation view — token validated, show workspace
  if (workspace) {
    return (
      <View style={styles.container}>
        {workspace.logoUrl ? (
          <Image source={{ uri: workspace.logoUrl }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>
              {workspace.workspaceName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <Text style={styles.heading}>Bli med i</Text>
        <Text style={styles.workspaceName}>{workspace.workspaceName}</Text>
        <Text style={styles.subtitle}>Du er invitert til denne arbeidsplassen.</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleConfirm}>
          <Text style={styles.primaryButtonText}>Bekreft og fortsett</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Avbryt</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Token entry view
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Har du en invitasjon?</Text>
      <Text style={styles.subtitle}>
        Skriv inn invitasjonskoden du fikk fra din leder.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Invitasjonskode"
        value={token}
        onChangeText={(text) => {
          setToken(text);
          setError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={() => validateToken(token)}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
        onPress={() => validateToken(token)}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Sjekk invitasjon</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
        <Text style={styles.secondaryButtonText}>Tilbake</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    color: "#111827",
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 16,
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
  secondaryButton: {
    marginTop: 16,
    padding: 12,
  },
  secondaryButtonText: {
    color: "#6B7280",
    fontSize: 15,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 16,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoPlaceholderText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#F97316",
  },
  workspaceName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F97316",
    marginTop: 4,
    marginBottom: 8,
  },
});
