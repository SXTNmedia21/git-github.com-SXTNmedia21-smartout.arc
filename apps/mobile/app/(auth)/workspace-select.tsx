/**
 * Workspace selector — shown after successful auth when user has multiple profiles.
 * Fetches all profiles for the authenticated user. If exactly 1, auto-redirects to (app).
 * If 0 (join request pending), redirects to pending screen.
 * If >1, shows a list for the user to pick which workspace to enter.
 */
import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { useTheme, withOpacity } from "@/theme";

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
  const { colors } = useTheme();

  const [profiles, setProfiles] = useState<ProfileWithWorkspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("profile")
      .select(
        "profile_id, display_name, role, workspace:workspace_id(workspace_id, name, logo_url)",
      )
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
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          padding: 24,
        }}
      >
        <ActivityIndicator size="large" color={colors.brandOrange} />
        <Text style={{ fontSize: 15, color: colors.mutedForeground, marginTop: 16 }}>
          Henter arbeidsplassene dine...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          padding: 24,
        }}
      >
        <Text
          style={{ color: colors.destructive, fontSize: 15, textAlign: "center", marginBottom: 16 }}
        >
          {error}
        </Text>
        <TouchableOpacity
          style={{
            paddingHorizontal: 24,
            paddingVertical: 12,
            backgroundColor: colors.brandOrange,
            borderRadius: 10,
          }}
          onPress={fetchProfiles}
        >
          <Text style={{ color: colors.primaryForeground, fontSize: 15, fontWeight: "600" }}>
            Prov igjen
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: 24,
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <Text
        style={{ fontSize: 24, fontWeight: "700", color: colors.foreground, textAlign: "center" }}
      >
        Velg arbeidsplass
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: colors.mutedForeground,
          textAlign: "center",
          marginTop: 8,
          marginBottom: 24,
        }}
      >
        Du har tilgang til flere arbeidsplasser. Hvilken vil du apne?
      </Text>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.profile_id}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              borderRadius: 14,
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={() => handleSelectWorkspace(item)}
          >
            {item.workspace.logo_url ? (
              <Image
                source={{ uri: item.workspace.logo_url }}
                style={{ width: 48, height: 48, borderRadius: 10, marginRight: 14 }}
              />
            ) : (
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  backgroundColor: withOpacity(colors.brandOrange, 0.08),
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: "700", color: colors.brandOrange }}>
                  {item.workspace.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>
                {item.workspace.name}
              </Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
                {formatRole(item.role)}
              </Text>
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
