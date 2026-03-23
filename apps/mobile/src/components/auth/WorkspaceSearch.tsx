/**
 * WorkspaceSearch — search for a workspace by name and send a join request.
 * Calls search_workspaces() RPC (min 3 chars). User picks a workspace,
 * confirms the join request, then navigates to verify screen.
 * After verification, an inbound invitation is created (handled in verify flow).
 */
import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

type WorkspaceHit = {
  workspace_id: string;
  name: string;
  logo_url: string | null;
};

type WorkspaceSearchProps = {
  onBack: () => void;
};

const MIN_QUERY_LENGTH = 3;

export function WorkspaceSearch({ onBack }: WorkspaceSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkspaceHit[]>([]);
  const [selected, setSelected] = useState<WorkspaceHit | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    const { data, error: rpcError } = await supabase.rpc("search_workspaces", {
      query: searchQuery,
    });

    setIsSearching(false);

    if (rpcError) {
      setError("Kunne ikke soke. Prov igjen.");
      return;
    }

    setResults((data as unknown as WorkspaceHit[]) ?? []);
  }, []);

  function handleQueryChange(text: string) {
    setQuery(text);
    setSelected(null);
    setError(null);

    // Debounced search — search on every keystroke after 3 chars
    if (text.length >= MIN_QUERY_LENGTH) {
      void search(text);
    } else {
      setResults([]);
      setHasSearched(false);
    }
  }

  function handleSelect(workspace: WorkspaceHit) {
    setSelected(workspace);
  }

  function handleConfirmJoinRequest() {
    if (!selected) return;
    router.push({
      pathname: "/(auth)/verify",
      params: {
        flow: "search",
        workspaceId: selected.workspace_id,
        workspaceName: selected.name,
      },
    });
  }

  // Confirmation view — workspace selected, ready to send join request
  if (selected) {
    return (
      <View style={styles.container}>
        {selected.logo_url ? (
          <Image source={{ uri: selected.logo_url }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>{selected.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}

        <Text style={styles.heading}>Send forespørsel til</Text>
        <Text style={styles.workspaceName}>{selected.name}</Text>
        <Text style={styles.subtitle}>
          Din leder vil motta en forespørsel. Du far beskjed nar den er godkjent.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleConfirmJoinRequest}>
          <Text style={styles.primaryButtonText}>Send forespørsel</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => setSelected(null)}>
          <Text style={styles.secondaryButtonText}>Velg en annen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Search view
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Finn arbeidsplassen din</Text>
      <Text style={styles.subtitle}>Sok etter navnet pa arbeidsplassen din.</Text>

      <TextInput
        style={styles.input}
        placeholder="Sok (min. 3 tegn)..."
        value={query}
        onChangeText={handleQueryChange}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      {isSearching && <ActivityIndicator color="#F97316" style={styles.loader} />}

      {!isSearching && hasSearched && results.length === 0 && (
        <Text style={styles.emptyText}>Ingen arbeidsplasser funnet. Prov et annet sokeord.</Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.workspace_id}
        style={styles.resultsList}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.resultRow} onPress={() => handleSelect(item)}>
            {item.logo_url ? (
              <Image source={{ uri: item.logo_url }} style={styles.resultLogo} />
            ) : (
              <View style={styles.resultLogoPlaceholder}>
                <Text style={styles.resultLogoText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.resultName}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.secondaryButtonText}>Tilbake</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    color: "#111827",
    marginTop: 60,
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
  loader: {
    marginVertical: 16,
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 14,
    textAlign: "center",
    marginTop: 24,
  },
  resultsList: {
    flex: 1,
    marginTop: 8,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    marginBottom: 8,
  },
  resultLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  resultLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  resultLogoText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F97316",
  },
  resultName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
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
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#6B7280",
    fontSize: 15,
  },
  backButton: {
    padding: 12,
    alignItems: "center",
    marginTop: 8,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 16,
    alignSelf: "center",
    marginTop: 60,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    alignSelf: "center",
    marginTop: 60,
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
    textAlign: "center",
    marginTop: 4,
    marginBottom: 8,
  },
});
