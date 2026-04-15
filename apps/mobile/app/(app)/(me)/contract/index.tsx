/**
 * Contract list — hero card for active + history.
 *
 * Same data as web /dashboard/my-contract but rendered with
 * React Native primitives and the project's createStyles theme.
 */

import React, { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { FileText, Briefcase, Clock, Calendar, ChevronLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";
import type { Database } from "@smartout/supabase/database.types";

type Contract = Database["public"]["Tables"]["employment_contract"]["Row"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusLabel(status: Contract["status"]): string {
  const map: Record<Contract["status"], string> = {
    draft: "Utkast",
    sent: "Sendt",
    viewed: "Sett",
    signed: "Signert",
    expired: "Utloept",
    terminated: "Oppsagt",
    pending_data: "Venter paa data",
    declined: "Avslatt",
    ready_to_send: "Klar til sending",
  };
  return map[status] ?? status;
}

function compensationText(c: Contract): string {
  if (c.hourly_rate) return `${c.hourly_rate} kr/t`;
  if (c.monthly_salary) return `${c.monthly_salary} kr/mnd`;
  return "Ikke satt";
}

export default function ContractListScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const profileId = profile?.profile_id;
  const workspaceId = profile?.workspace_id;

  useEffect(() => {
    if (!profileId || !workspaceId) return;

    supabase
      .from("employment_contract")
      .select("*")
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setContracts(data);
        setLoading(false);
      });
  }, [profileId, workspaceId]);

  const ACTIVE_STATUSES = ["signed", "sent", "viewed", "pending_data"] as const;
  const active = useMemo(
    () =>
      contracts.find((c) =>
        ACTIVE_STATUSES.includes(c.status as (typeof ACTIVE_STATUSES)[number]),
      ) ?? null,
    [contracts],
  );
  const history = useMemo(
    () => contracts.filter((c) => c.contract_id !== active?.contract_id),
    [contracts, active],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={22} color={theme.colors.foreground} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.headerTitle}>Min kontrakt</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Laster...</Text>
          </View>
        )}

        {!loading && contracts.length === 0 && (
          <View style={styles.emptyState}>
            <FileText
              size={48}
              color={withOpacity(theme.colors.mutedForeground, 0.4)}
              strokeWidth={1.2}
            />
            <Text style={styles.emptyTitle}>Ingen kontrakter</Text>
            <Text style={styles.emptyDesc}>
              Du har ingen kontrakter knyttet til denne arbeidsplassen ennaa.
            </Text>
          </View>
        )}

        {/* Active contract hero */}
        {active && (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/(app)/(me)/contract/${active.contract_id}`);
            }}
            style={({ pressed }) => [styles.heroCard, pressed && styles.cardPressed]}
          >
            <View style={styles.heroHeader}>
              <View style={styles.heroIcon}>
                <FileText size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
              </View>
              <View style={styles.heroTitleWrap}>
                <Text style={styles.heroTitle}>{active.position_title}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{statusLabel(active.status)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.detailGrid}>
              <View style={styles.detailRow}>
                <Briefcase size={14} color={theme.colors.mutedForeground} strokeWidth={1.5} />
                <Text style={styles.detailLabel}>Kompensasjon</Text>
                <Text style={styles.detailValue}>{compensationText(active)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Clock size={14} color={theme.colors.mutedForeground} strokeWidth={1.5} />
                <Text style={styles.detailLabel}>Stillingsandel</Text>
                <Text style={styles.detailValue}>
                  {active.employment_percentage ? `${active.employment_percentage}%` : "Ikke satt"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Calendar size={14} color={theme.colors.mutedForeground} strokeWidth={1.5} />
                <Text style={styles.detailLabel}>Startdato</Text>
                <Text style={styles.detailValue}>{formatDate(active.start_date)}</Text>
              </View>
            </View>
          </Pressable>
        )}

        {/* History */}
        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historikk</Text>
            {history.map((c) => (
              <Pressable
                key={c.contract_id}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/(app)/(me)/contract/${c.contract_id}`);
                }}
                style={({ pressed }) => [styles.historyRow, pressed && styles.cardPressed]}
              >
                <View>
                  <Text style={styles.historyTitle}>{c.position_title}</Text>
                  <Text style={styles.historyMeta}>
                    {formatDate(c.start_date)} — {statusLabel(c.status)}
                  </Text>
                </View>
                <Text style={styles.historyComp}>{compensationText(c)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    height: 50,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },

  scrollContent: { paddingHorizontal: theme.spacing.section, paddingBottom: 120 },

  loadingCard: {
    padding: theme.spacing.page,
    alignItems: "center" as const,
  },
  loadingText: { ...theme.typography.body, color: theme.colors.mutedForeground },

  emptyState: {
    paddingVertical: 60,
    alignItems: "center" as const,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },
  emptyDesc: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
    maxWidth: 260,
  },

  /* Hero card */
  heroCard: {
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.03)" : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    borderWidth: 2,
    borderColor: withOpacity(theme.colors.brandOrange, 0.2),
    marginBottom: theme.spacing.page,
  },
  cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  heroHeader: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 12,
    marginBottom: theme.spacing.section,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.1),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  heroTitleWrap: { flex: 1, gap: 4 },
  heroTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },
  statusBadge: {
    alignSelf: "flex-start" as const,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.1),
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: theme.colors.brandOrange,
  },

  detailGrid: { gap: 10 },
  detailRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  detailLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    flex: 1,
  },
  detailValue: {
    ...theme.typography.body,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },

  /* History section */
  section: { gap: theme.spacing.element },
  sectionTitle: {
    ...theme.typography.subheadline,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
    marginBottom: 4,
  },
  historyRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: theme.spacing.card,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.4)",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
    opacity: 0.6,
  },
  historyTitle: {
    ...theme.typography.body,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },
  historyMeta: { ...theme.typography.caption, color: theme.colors.mutedForeground },
  historyComp: { ...theme.typography.body, color: theme.colors.mutedForeground },
}));
