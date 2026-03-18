/**
 * Pending screen — shown when user has sent a join request (Path 3: search)
 * and is waiting for admin approval.
 * Subscribes to Supabase Realtime for invitation status changes.
 * When accepted, redirects to workspace-select (which auto-routes to app).
 */
import { useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";

export default function Pending() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Check if any invitation has been accepted (in case we missed the realtime event)
  const checkStatus = useCallback(async () => {
    if (!user) return;

    // Look for any profile that was created for this user (means admin accepted)
    const { data: profiles } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1);

    if (profiles && profiles.length > 0) {
      router.replace("/(auth)/workspace-select");
    }
  }, [user, router]);

  useEffect(() => {
    // Initial check
    void checkStatus();

    // Subscribe to invitation changes for this user's email/phone
    // When admin accepts, a profile is created — we watch for that
    if (!user) return;

    const channel = supabase
      .channel("pending-approval")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "profile",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Profile created — admin accepted the join request
          router.replace("/(auth)/workspace-select");
        },
      )
      .subscribe();

    // Also poll every 30 seconds as a fallback for missed realtime events
    const interval = setInterval(() => {
      void checkStatus();
    }, 30_000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, router, checkStatus]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/welcome");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <ActivityIndicator size="small" color="#F97316" />
        </View>

        <Text style={styles.heading}>Forespørsel sendt</Text>

        <Text style={styles.body}>
          Din forespørsel er sendt til arbeidsplassens administrator. Du far en melding nar den er godkjent.
        </Text>

        <Text style={styles.hint}>
          Dette kan ta litt tid. Du kan lukke appen — vi varsler deg nar du har fatt tilgang.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.refreshButton} onPress={checkStatus}>
          <Text style={styles.refreshButtonText}>Sjekk status</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Logg ut</Text>
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
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  hint: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  footer: {
    gap: 12,
  },
  refreshButton: {
    width: "100%",
    height: 48,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "600",
  },
  signOutButton: {
    width: "100%",
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutButtonText: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "500",
  },
});
