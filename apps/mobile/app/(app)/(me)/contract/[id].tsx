/**
 * Contract detail screen — shows contract info with segmented tabs.
 *
 * Tabs: Kontrakt | Rettigheter | Forklart (Forklart disabled in Phase 1).
 * Simpler than the web version — basic info display with themed styling.
 */

import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft,
  FileText,
  Briefcase,
  Clock,
  Calendar,
  Scale,
  Lock,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type Contract = Database["public"]["Tables"]["employment_contract"]["Row"];

type Tab = "kontrakt" | "rettigheter" | "forklart";

const TABS: { key: Tab; label: string; disabled: boolean }[] = [
  { key: "kontrakt", label: "Kontrakt", disabled: false },
  { key: "rettigheter", label: "Rettigheter", disabled: false },
  { key: "forklart", label: "Forklart", disabled: true },
];

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
  };
  return map[status] ?? status;
}

export default function ContractDetailScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("kontrakt");

  useEffect(() => {
    if (!id) return;

    supabase
      .from("employment_contract")
      .select("*")
      .eq("contract_id", id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setContract(data);
        setLoading(false);
      });
  }, [id]);

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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {contract?.position_title ?? "Kontrakt"}
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* Segmented tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => {
              if (tab.disabled) return;
              Haptics.selectionAsync();
              setActiveTab(tab.key);
            }}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive,
              tab.disabled && styles.tabDisabled,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key, disabled: tab.disabled }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
                tab.disabled && styles.tabTextDisabled,
              ]}
            >
              {tab.label}
            </Text>
            {tab.disabled && (
              <Lock
                size={10}
                color={withOpacity(theme.colors.mutedForeground, 0.4)}
                strokeWidth={1.5}
              />
            )}
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={styles.centered}>
            <Text style={styles.mutedText}>Laster...</Text>
          </View>
        )}

        {!loading && !contract && (
          <View style={styles.centered}>
            <Text style={styles.mutedText}>Kontrakten ble ikke funnet.</Text>
          </View>
        )}

        {/* Kontrakt tab */}
        {!loading && contract && activeTab === "kontrakt" && (
          <View style={styles.details}>
            <View style={styles.statusRow}>
              <View style={styles.heroIcon}>
                <FileText size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{statusLabel(contract.status)}</Text>
              </View>
            </View>

            <InfoRow
              icon={<Briefcase size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />}
              label="Stilling"
              value={contract.position_title}
              styles={styles}
            />
            <InfoRow
              icon={<Briefcase size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />}
              label="Kompensasjon"
              value={
                contract.hourly_rate
                  ? `${contract.hourly_rate} kr/t`
                  : contract.monthly_salary
                    ? `${contract.monthly_salary} kr/mnd`
                    : "Ikke satt"
              }
              styles={styles}
            />
            <InfoRow
              icon={<Clock size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />}
              label="Stillingsandel"
              value={
                contract.employment_percentage ? `${contract.employment_percentage}%` : "Ikke satt"
              }
              styles={styles}
            />
            <InfoRow
              icon={<Calendar size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />}
              label="Startdato"
              value={formatDate(contract.start_date)}
              styles={styles}
            />
            {contract.end_date && (
              <InfoRow
                icon={<Calendar size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />}
                label="Sluttdato"
                value={formatDate(contract.end_date)}
                styles={styles}
              />
            )}
            <InfoRow
              icon={<Briefcase size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />}
              label="Kategori"
              value={contract.employment_category}
              styles={styles}
            />
          </View>
        )}

        {/* Rettigheter tab — placeholder content */}
        {!loading && contract && activeTab === "rettigheter" && (
          <View style={styles.centered}>
            <Scale
              size={40}
              color={withOpacity(theme.colors.mutedForeground, 0.3)}
              strokeWidth={1.2}
            />
            <Text style={[styles.mutedText, { marginTop: 12 }]}>
              Rettigheter og tariffinfo kommer snart.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Reusable info row component */
function InfoRow({
  icon,
  label,
  value,
  styles,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  styles: ReturnType<typeof useStyles>;
}) {
  return (
    <View style={styles.infoRow}>
      {icon}
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
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
    flex: 1,
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
    textAlign: "center" as const,
  },

  /* Segmented tabs */
  tabRow: {
    flexDirection: "row" as const,
    marginHorizontal: theme.spacing.section,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : theme.colors.muted,
    borderRadius: theme.radius.lg,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 4,
    paddingVertical: 8,
    borderRadius: theme.radius.lg - 2,
  },
  tabActive: {
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "#ffffff",
    ...theme.shadows.sm,
  },
  tabDisabled: { opacity: 0.4 },
  tabText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
  },
  tabTextActive: { color: theme.colors.foreground },
  tabTextDisabled: {},

  scrollContent: { paddingHorizontal: theme.spacing.section, paddingBottom: 120 },

  centered: {
    paddingVertical: 60,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  mutedText: { ...theme.typography.body, color: theme.colors.mutedForeground },

  /* Details */
  details: { gap: theme.spacing.md },
  statusRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    marginBottom: theme.spacing.element,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.1),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  statusBadge: {
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

  infoRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
  },
  infoContent: { flex: 1, gap: 2 },
  infoLabel: { ...theme.typography.caption, color: theme.colors.mutedForeground },
  infoValue: {
    ...theme.typography.body,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },
}));
