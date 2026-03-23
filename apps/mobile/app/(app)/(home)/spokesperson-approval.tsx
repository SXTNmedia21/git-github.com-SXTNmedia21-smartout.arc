/**
 * SpokespersonApprovalScreen — Route for an employee to respond to a
 * spokesperson assignment request from their workspace admin.
 *
 * Receives spokespersonId as a query param, fetches the full record
 * (including workspace name via join), and renders ApprovalCard.
 * On response (accept or decline) the employee is taken back to home.
 */
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft } from "lucide-react-native";
import { createStyles } from "@/theme";
import { supabase } from "@/lib/supabase";
import {
  ApprovalCard,
  type SpokespersonApprovalData,
} from "@/components/spokesperson/ApprovalCard";

export default function SpokespersonApprovalScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { spokespersonId } = useLocalSearchParams<{ spokespersonId: string }>();

  const [data, setData] = useState<SpokespersonApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!spokespersonId) {
      setError("Mangler talsperson-ID.");
      setLoading(false);
      return;
    }
    loadData(spokespersonId);
  }, [spokespersonId]);

  async function loadData(id: string) {
    setLoading(true);
    setError(null);

    try {
      // Fetch spokesperson record — RLS ensures employee can only see their own
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row, error: fetchError } = await (supabase as any)
        .schema("websites")
        .from("website_spokesperson")
        .select(
          `
          website_spokesperson_id,
          role_title,
          quote,
          bio,
          status,
          assigned_at,
          content_schedule,
          profile:profile_id (
            display_name,
            avatar_url
          ),
          workspace:workspace_id (
            name
          )
        `,
        )
        .eq("website_spokesperson_id", id)
        .single();

      if (fetchError) throw fetchError;
      if (!row) throw new Error("Forespørselen ble ikke funnet.");

      setData({
        website_spokesperson_id: row.website_spokesperson_id,
        role_title: row.role_title ?? "",
        quote: row.quote ?? "",
        bio: row.bio ?? "",
        status: row.status,
        assigned_at: row.assigned_at,
        content_schedule: Array.isArray(row.content_schedule) ? row.content_schedule : [],
        workspace_name: row.workspace?.name ?? "Arbeidsplassen din",
        employee_name: row.profile?.display_name ?? "Ukjent",
        avatar_url: row.profile?.avatar_url ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  }

  const handleResponded = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [router]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={28} color={styles.foreground.color} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Forespørsel</Text>
      </View>

      {/* Content */}
      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={styles.primaryColor.color} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && data && !error && <ApprovalCard data={data} onResponded={handleResponded} />}
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    gap: theme.spacing.tight,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  foreground: {
    color: theme.colors.foreground,
  },
  primaryColor: {
    color: theme.colors.primary,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.destructive,
    textAlign: "center",
    paddingHorizontal: theme.spacing.section,
  },
}));
