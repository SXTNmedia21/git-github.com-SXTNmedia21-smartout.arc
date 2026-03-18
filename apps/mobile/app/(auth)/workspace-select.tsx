/**
 * Workspace selector — shown after successful auth when user has multiple profiles.
 * Fetches all profiles for the authenticated user. If exactly 1, auto-redirects to (app).
 * If 0 (join request pending), redirects to pending screen.
 * If >1, shows a list for the user to pick which workspace to enter.
 */
import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";

type ProfileWithWorkspace = {
  profile_id: string;
  display_name: string;
  role: string;
  workspace: {
    workspace_id: string;
    name: string;
    logo_url: string | null;
  };
};

export default function WorkspaceSelect() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [profiles, setProfiles] = useState<ProfileWithWorkspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("profile")
      .select("profile_id, display_name, role, workspace:workspace_id(workspace_id, name, logo_url)")
      .eq("user_id", user.id)
      .eq("is_active", true);

    setIsLoading(false);

    if (fetchError) {
      setError("Kunne ikke hente arbeidsplassene dine. Prov igjen.");
      return;
    }

    const profileList = (data ?? []) as unknown as ProfileWithWorkspace[];

    if (profileList.length === 0) {
      // No profiles yet — join request pending
      router.replace("/(auth)/pending");
      return;
    }

    if (profileList.length === 1) {
      // Single workspace — go straight in
      router.replace("/(app)");
      return;
    }

    setProfiles(profileList);
  }, [user, router]);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  function handleSelectWorkspace(_profile: ProfileWithWorkspace) {
    // In a multi-workspace scenario, we'd store the selected profile/workspace
    // in a Zustand store or MMKV. For now, navigate to app — the app will use
    // the first active profile's workspace context.
    router.replace("/(app)");
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.loadingText}>Henter arbeidsplassene dine...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfiles}>
          <Text style={styles.retryButtonText}>Prov igjen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.heading}>Velg arbeidsplass</Text>
      <Text style={styles.subtitle}>Du har tilgang til flere arbeidsplasser. Hvilken vil du apne?</Text>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.profile_id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.workspaceRow}
            onPress={() => handleSelectWorkspace(item)}
          >
            {item.workspace.logo_url ? (
              <Image source={{ uri: item.workspace.logo_url }} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {item.workspace.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.workspaceInfo}>
              <Text style={styles.workspaceName}>{item.workspace.name}</Text>
              <Text style={styles.roleBadge}>{formatRole(item.role)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function formatRole(role: string): string {
  const roleMap: Record<string, string> = {
    employee: "Ansatt",
    manager: "Leder",
    admin: "Administrator",
    owner: "Eier",
  };
  return roleMap[role] ?? role;
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
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
  },
  workspaceRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 14,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  logoPlaceholderText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F97316",
  },
  workspaceInfo: {
    flex: 1,
  },
  workspaceName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  roleBadge: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  loadingText: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#F97316",
    borderRadius: 10,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
