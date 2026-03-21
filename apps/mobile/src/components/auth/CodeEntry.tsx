/**
 * CodeEntry — 6-character workspace join code input.
 * Calls lookup_workspace_by_code() RPC, shows workspace for confirmation,
 * then navigates to verify screen. Code IS authorization (bypasses invitation table).
 */
import { useState, useRef } from "react";
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

type WorkspaceResult = {
  workspace_id: string;
  name: string;
  logo_url: string | null;
};

type CodeEntryProps = {
  onBack: () => void;
};

const CODE_LENGTH = 6;

export function CodeEntry({ onBack }: CodeEntryProps) {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCodeChange(text: string) {
    // Only allow alphanumeric, max 6 chars
    const cleaned = text
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, CODE_LENGTH);
    setCode(cleaned);
    setError(null);

    // Auto-lookup when 6 characters entered
    if (cleaned.length === CODE_LENGTH) {
      void lookupCode(cleaned);
    }
  }

  async function lookupCode(codeValue: string) {
    setIsLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("lookup_workspace_by_code", {
      code: codeValue,
    });

    setIsLoading(false);

    if (rpcError || !data) {
      setError("Ingen arbeidsplass funnet med denne koden. Sjekk og prov igjen.");
      return;
    }

    // RPC uses RETURNS TABLE so Supabase returns an array — take first row
    const rows = data as unknown as WorkspaceResult[];
    if (!rows || rows.length === 0) {
      setError("Ingen arbeidsplass funnet med denne koden. Sjekk og prov igjen.");
      return;
    }
    setWorkspace(rows[0]);
  }

  function handleConfirm() {
    if (!workspace) return;
    router.push({
      pathname: "/(auth)/verify",
      params: {
        flow: "code",
        workspaceId: workspace.workspace_id,
        workspaceName: workspace.name,
      },
    });
  }

  function handleReset() {
    setWorkspace(null);
    setCode("");
    setError(null);
    inputRef.current?.focus();
  }

  // Confirmation view — workspace found
  if (workspace) {
    return (
      <View style={styles.container}>
        {workspace.logo_url ? (
          <Image source={{ uri: workspace.logo_url }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>{workspace.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}

        <Text style={styles.heading}>Er dette riktig?</Text>
        <Text style={styles.workspaceName}>{workspace.name}</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleConfirm}>
          <Text style={styles.primaryButtonText}>Ja, fortsett</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
          <Text style={styles.secondaryButtonText}>Nei, prov en annen kode</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Code input view
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Skriv inn koden</Text>
      <Text style={styles.subtitle}>
        Din leder har gitt deg en 6-tegns kode for arbeidsplassen.
      </Text>

      {/* Single hidden input driving the visual code boxes */}
      <View style={styles.codeRow}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.codeBox, i < code.length && styles.codeBoxFilled]}
            onPress={() => inputRef.current?.focus()}
          >
            <Text style={styles.codeChar}>{code[i] ?? ""}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={code}
        onChangeText={handleCodeChange}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={CODE_LENGTH}
        autoFocus
      />

      {isLoading && <ActivityIndicator color="#F97316" style={styles.loader} />}

      {error && <Text style={styles.errorText}>{error}</Text>}

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
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  codeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  codeBoxFilled: {
    borderColor: "#F97316",
    backgroundColor: "#FFF7ED",
  },
  codeChar: {
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
  loader: {
    marginBottom: 12,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 16,
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
    marginBottom: 24,
  },
});
