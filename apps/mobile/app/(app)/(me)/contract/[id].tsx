/**
 * Contract detail screen — shows contract info with segmented tabs.
 *
 * Tabs: Kontrakt | Rettigheter | Forklart (Forklart disabled in Phase 1).
 * Simpler than the web version — basic info display with themed styling.
 */

import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
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
  ExternalLink,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { supabase } from "@/lib/supabase";
import { strings } from "@/constants/strings";
import type { Database } from "@smartout/supabase/database.types";

type Contract = Database["public"]["Tables"]["employment_contract"]["Row"];

type Tab = "kontrakt" | "rettigheter" | "forklart";

const TABS: { key: Tab; label: string; disabled: boolean }[] = [
  { key: "kontrakt", label: strings.contract.tabKontrakt, disabled: false },
  { key: "rettigheter", label: strings.contract.tabRettigheter, disabled: false },
  { key: "forklart", label: strings.contract.tabForklart, disabled: true },
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
    draft: strings.contract.statusDraft,
    sent: strings.contract.statusSent,
    viewed: strings.contract.statusViewed,
    signed: strings.contract.statusSigned,
    expired: strings.contract.statusExpired,
    terminated: strings.contract.statusTerminated,
    pending_data: strings.contract.statusPendingData,
    declined: strings.contract.statusDeclined,
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
  const [signingUrl, setSigningUrl] = useState<string | null>(null);

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

  useEffect(() => {
    if (!contract?.signing_contract_id) return;

    supabase
      .from("contract")
      .select("signing_url")
      .eq("contract_id", contract.signing_contract_id)
      .single()
      .then(({ data }) => {
        if (data?.signing_url) setSigningUrl(data.signing_url);
      });
  }, [contract?.signing_contract_id]);

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
          {contract?.position_title ?? strings.contract.headerFallback}
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
            <Text style={styles.mutedText}>{strings.contract.loading}</Text>
          </View>
        )}

        {!loading && !contract && (
          <View style={styles.centered}>
            <Text style={styles.mutedText}>{strings.contract.notFound}</Text>
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

            {["sent", "viewed"].includes(contract.status) && (
              <View style={styles.signingBanner}>
                <Text style={styles.signingText}>{strings.contract.awaitingSignature}</Text>
                {signingUrl && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      const url = `https://smartout.ai/sign/${signingUrl}`;
                      Linking.openURL(url);
                    }}
                    style={styles.signingButton}
                    accessibilityRole="button"
                    accessibilityLabel={strings.contract.signContract}
                  >
                    <ExternalLink size={16} color="#ffffff" strokeWidth={1.8} />
                    <Text style={styles.signingButtonText}>{strings.contract.signContract}</Text>
                  </Pressable>
                )}
              </View>
            )}

            {contract.status === "pending_data" && (
              <View style={styles.dataBanner}>
                <Text style={styles.dataText}>{strings.contract.pendingDataNotice}</Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push("/(app)/(me)/contract/complete-data");
                  }}
                  style={styles.dataButton}
                  accessibilityRole="button"
                  accessibilityLabel={strings.contract.fillInfoButton}
                >
                  <Text style={styles.dataButtonText}>{strings.contract.fillInfoButton}</Text>
                </Pressable>
              </View>
            )}

            <InfoRow
              icon={<Briefcase size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />}
              label={strings.contract.labelPosition}
              value={contract.position_title}
              styles={styles}
            />
            <InfoRow
              icon={<Briefcase size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />}
              label={strings.contract.labelCompensation}
              value={
                contract.hourly_rate
                  ? `${contract.hourly_rate} ${strings.contract.hourlyRateSuffix}`
                  : contract.monthly_salary
                    ? `${contract.monthly_salary} ${strings.contract.monthlySuffix}`
                    : strings.contract.notSet
              }
              styles={styles}
            />
            <InfoRow
              icon={<Clock size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />}
              label={strings.contract.labelEmploymentShare}
              value={
                contract.employment_percentage
                  ? `${contract.employment_percentage}%`
                  : strings.contract.notSet
              }
              styles={styles}
            />
            <InfoRow
              icon={<Calendar size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />}
              label={strings.contract.labelStartDate}
              value={formatDate(contract.start_date)}
              styles={styles}
            />
            {contract.end_date && (
              <InfoRow
                icon={<Calendar size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />}
                label={strings.contract.labelEndDate}
                value={formatDate(contract.end_date)}
                styles={styles}
              />
            )}
            <InfoRow
              icon={<Briefcase size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />}
              label={strings.contract.labelCategory}
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
              {strings.contract.rightsComingSoon}
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

  signingBanner: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    gap: 12,
    marginBottom: theme.spacing.md,
  },
  signingText: {
    ...theme.typography.body,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },
  signingButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    backgroundColor: theme.colors.brandOrange,
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  signingButtonText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#ffffff",
  },
  dataBanner: {
    backgroundColor: withOpacity("#3b82f6", 0.08),
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    marginBottom: theme.spacing.md,
    gap: 12,
  },
  dataText: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  dataButton: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "#3b82f6",
    borderRadius: theme.radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dataButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#ffffff",
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
