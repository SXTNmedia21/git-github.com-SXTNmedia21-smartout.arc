/**
 * CodeEntry — 6-character workspace join code input.
 * Calls lookup_workspace_by_code() RPC, shows workspace for confirmation,
 * then navigates to verify screen. Code IS authorization (bypasses invitation table).
 */
import { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme, withOpacity } from "@/theme";

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
  const { colors } = useTheme();
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

  if (workspace) {
    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        {workspace.logo_url ? (
          <Image
            source={{ uri: workspace.logo_url }}
            style={{ width: 80, height: 80, borderRadius: 16, marginBottom: 16 }}
          />
        ) : (
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              backgroundColor: withOpacity(colors.brandOrange, 0.08),
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 32, fontWeight: "700", color: colors.brandOrange }}>
              {workspace.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <Text
          style={{ fontSize: 22, fontWeight: "700", textAlign: "center", color: colors.foreground }}
        >
          Er dette riktig?
        </Text>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: colors.brandOrange,
            marginTop: 4,
            marginBottom: 24,
          }}
        >
          {workspace.name}
        </Text>

        <TouchableOpacity
          style={{
            width: "100%",
            height: 52,
            backgroundColor: colors.brandOrange,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 8,
          }}
          onPress={handleConfirm}
        >
          <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "600" }}>
            Ja, fortsett
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ marginTop: 16, padding: 12 }} onPress={handleReset}>
          <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>
            Nei, prov en annen kode
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <Text
        style={{ fontSize: 22, fontWeight: "700", textAlign: "center", color: colors.foreground }}
      >
        Skriv inn koden
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: colors.mutedForeground,
          textAlign: "center",
          marginTop: 8,
          marginBottom: 32,
          paddingHorizontal: 16,
        }}
      >
        Din leder har gitt deg en 6-tegns kode for arbeidsplassen.
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
          <TouchableOpacity
            key={i}
            style={[
              {
                width: 48,
                height: 56,
                borderWidth: 2,
                borderColor: colors.border,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.muted,
              },
              i < code.length && {
                borderColor: colors.brandOrange,
                backgroundColor: withOpacity(colors.brandOrange, 0.08),
              },
            ]}
            onPress={() => inputRef.current?.focus()}
          >
            <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground }}>
              {code[i] ?? ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        ref={inputRef}
        style={{ position: "absolute", opacity: 0, height: 0, width: 0 }}
        value={code}
        onChangeText={handleCodeChange}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={CODE_LENGTH}
        autoFocus
      />

      {isLoading && <ActivityIndicator color={colors.brandOrange} style={{ marginBottom: 12 }} />}

      {error && (
        <Text
          style={{
            color: colors.destructive,
            fontSize: 14,
            textAlign: "center",
            marginBottom: 12,
            paddingHorizontal: 16,
          }}
        >
          {error}
        </Text>
      )}

      <TouchableOpacity style={{ marginTop: 16, padding: 12 }} onPress={onBack}>
        <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Tilbake</Text>
      </TouchableOpacity>
    </View>
  );
}
