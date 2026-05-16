/**
 * proposed-plan.tsx — Mobile Bundle Proposal Accept/Reject Screen.
 *
 * V1 per ADR-0309: Three components ONLY — BundleCard + BundleActionBar +
 * ReadOnlyShiftList. No per-row toggle, no checkboxes, no per-row interaction.
 * The UI is intentionally atomic: Accept ALL or Reject ALL.
 *
 * ADR compliance:
 *   ADR-0309 — V1 atomic accept/reject. No per-row toggle.
 *   ADR-0133 — Accept/Reject are Approve verbs, mobile-allowed.
 *   ADR-0151 — workspace_id + profile_id server-derived via Bearer token at BFF.
 *   ADR-0134 — getProfileContext() resolves identity BEFORE emit(). Empty-string FORBIDDEN.
 *   L-0177   — fail-fast on missing identity; no silent empty-string fallback.
 *   L-0255   — column-name discipline: trigger_entity_id (not entity_id), initiated_by (not proposed_by).
 *
 * Motion: nativeTheme.motion.springAmbient for BundleCard enter. No per-row stutter.
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, CheckCircle2, XCircle, LayoutList } from "lucide-react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme, withOpacity, createStyles } from "@/theme";
import { nativeTheme } from "@smartout/design-tokens/native";
import { supabase } from "@/lib/supabase";
import { getProfileContext } from "@/lib/profile-context";
import { emit } from "@smartout/telemetry";
import {
  getSchedulerProposalsUrl,
  getSchedulerAcceptBundleUrl,
  getSchedulerRejectBundleUrl,
} from "@/lib/web-api";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProposedShift = {
  employee_id: string;
  employee_name?: string;
  role?: string;
  shift_date: string;
  start_time: string;
  end_time: string;
};

type BundleProposal = {
  change_proposal_id: string;
  status: string;
  trigger_type: string;
  initiated_by: string;
  created_at: string;
  objective_score: number | null;
  gap_count: number | null;
  proposed_shift_count: number | null;
  proposed_shifts?: ProposedShift[];
};

// ─── Proposal query key ────────────────────────────────────────────────────────

const PROPOSALS_KEY = ["scheduler", "proposals", "pending"] as const;

// ─── Bearer fetch helpers ─────────────────────────────────────────────────────
// Identity fields are NEVER part of the body (ADR-0151).

async function bffGet<T>(url: string): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Ikke innlogget.");

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    let msg = `BFF ${res.status}`;
    try {
      const parsed = (await res.json()) as { error?: string };
      if (parsed?.error) msg = parsed.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function bffPost(url: string, body: Record<string, unknown>): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Ikke innlogget.");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `BFF ${res.status}`;
    try {
      const parsed = (await res.json()) as { error?: string };
      if (parsed?.error) msg = parsed.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

// ─── Styles (module-level, returns hook per createStyles contract) ─────────────

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center" as const,
    fontSize: 17,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },
  headerSpacer: {
    width: 36,
  },
  centered: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 16,
    paddingHorizontal: 32,
  },
  content: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // BundleCard
  bundleCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  bundleCardHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  bundleCardTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },
  bundleCardMetaRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
  },
  metaChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center" as const,
    minWidth: 60,
  },
  metaChipLabel: {
    fontSize: 10,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metaChipValue: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: theme.colors.foreground,
  },
  // Section label
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  // ReadOnlyShiftList
  shiftListContent: {
    paddingBottom: 8,
  },
  emptyState: {
    alignItems: "center" as const,
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.mutedForeground,
  },
  shiftRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  shiftRowLeft: {
    flex: 1,
    marginRight: 12,
    gap: 2,
  },
  shiftEmployee: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },
  shiftRole: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
  },
  shiftRowRight: {
    alignItems: "flex-end" as const,
    gap: 2,
  },
  shiftDate: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
  },
  shiftTime: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },
  // BundleActionBar
  actionBar: {
    flexDirection: "row" as const,
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.destructive,
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: theme.colors.destructive,
  },
  acceptButton: {
    flex: 1.4,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#ffffff",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  successText: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
    textAlign: "center" as const,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.destructive,
    textAlign: "center" as const,
  },
}));

// ─── BundleCard ───────────────────────────────────────────────────────────────

type BundleCardProps = {
  proposal: BundleProposal;
};

function BundleCard({ proposal }: BundleCardProps) {
  const theme = useTheme();
  const styles = useStyles();

  const dateRange =
    proposal.proposed_shifts && proposal.proposed_shifts.length > 0
      ? (() => {
          const dates = proposal.proposed_shifts.map((s) => s.shift_date).sort();
          const first = dates[0];
          const last = dates[dates.length - 1];
          if (first === last) return formatDate(first ?? "");
          return `${formatDate(first ?? "")} – ${formatDate(last ?? "")}`;
        })()
      : "—";

  const score =
    proposal.objective_score != null ? `${Math.round(proposal.objective_score * 100)}%` : "—";
  const gaps = proposal.gap_count ?? 0;
  const shiftCount = proposal.proposed_shift_count ?? proposal.proposed_shifts?.length ?? 0;

  // Spring: nativeTheme.motion.springAmbient — stiffness=35, duration-equivalent ~350ms
  const enterDurationMs = nativeTheme.motion.springAmbient.stiffness * 10;

  return (
    <Animated.View
      entering={FadeInDown.duration(enterDurationMs).springify()}
      style={styles.bundleCard}
    >
      <View style={styles.bundleCardHeader}>
        <LayoutList size={18} color={theme.colors.primary} strokeWidth={1.8} />
        <Text style={styles.bundleCardTitle}>Forslag til vaktplan</Text>
      </View>

      <View style={styles.bundleCardMetaRow}>
        <MetaChip label="Periode" value={dateRange} />
        <MetaChip label="Vakter" value={String(shiftCount)} />
        <MetaChip label="Mangler" value={String(gaps)} />
        <MetaChip label="Score" value={score} />
      </View>
    </Animated.View>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.metaChip, { backgroundColor: withOpacity(theme.colors.primary, 0.08) }]}>
      <Text style={styles.metaChipLabel}>{label}</Text>
      <Text style={styles.metaChipValue}>{value}</Text>
    </View>
  );
}

// ─── ReadOnlyShiftList ────────────────────────────────────────────────────────
// Flat list: employee name + role + time. NO toggle. NO checkboxes.

type ReadOnlyShiftListProps = {
  shifts: ProposedShift[];
};

function ReadOnlyShiftList({ shifts }: ReadOnlyShiftListProps) {
  const styles = useStyles();

  if (shifts.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Ingen foreslåtte vakter.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={shifts}
      keyExtractor={(item, index) =>
        `${item.employee_id}-${item.shift_date}-${item.start_time}-${index}`
      }
      renderItem={({ item }) => <ShiftRow shift={item} />}
      contentContainerStyle={styles.shiftListContent}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    />
  );
}

function ShiftRow({ shift }: { shift: ProposedShift }) {
  const styles = useStyles();
  return (
    <View style={styles.shiftRow}>
      <View style={styles.shiftRowLeft}>
        <Text style={styles.shiftEmployee} numberOfLines={1}>
          {shift.employee_name ?? truncateId(shift.employee_id)}
        </Text>
        {shift.role ? (
          <Text style={styles.shiftRole} numberOfLines={1}>
            {shift.role}
          </Text>
        ) : null}
      </View>
      <View style={styles.shiftRowRight}>
        <Text style={styles.shiftDate}>{formatDate(shift.shift_date)}</Text>
        <Text style={styles.shiftTime}>
          {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
        </Text>
      </View>
    </View>
  );
}

// ─── BundleActionBar ─────────────────────────────────────────────────────────
// Bottom bar with Accept ALL + Reject ALL. NO per-row interaction.

type BundleActionBarProps = {
  proposalId: string;
  onAccepted: () => void;
  onRejected: () => void;
};

function BundleActionBar({ proposalId, onAccepted, onRejected }: BundleActionBarProps) {
  const styles = useStyles();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const acceptMutation = useMutation({
    mutationFn: async () => {
      // ADR-0134: resolve identity BEFORE emit(). Fail-fast per L-0177.
      const { workspaceId, profileId } = await getProfileContext();

      await bffPost(getSchedulerAcceptBundleUrl(), {
        change_proposal_id: proposalId,
      });

      // ONE emit per accept (ADR-0134). NEVER per-shift.
      await emit({
        event: "scheduler.proposal.accepted",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          entity: {
            entity_type: "change_proposal",
            entity_id: proposalId,
          },
          data: {
            change_proposal_id: proposalId,
            solver_run_id: "",
            accepted_by_profile_id: profileId,
            applied_shift_count: 0,
            gate_evaluation_id: null,
          },
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROPOSALS_KEY });
      onAccepted();
    },
    onError: (err: Error) => {
      Alert.alert("Kunne ikke godta", err.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      // ADR-0134: resolve identity BEFORE emit(). Fail-fast per L-0177.
      const { workspaceId, profileId } = await getProfileContext();

      await bffPost(getSchedulerRejectBundleUrl(), {
        change_proposal_id: proposalId,
      });

      // ONE emit per reject (ADR-0134). NEVER per-shift.
      await emit({
        event: "scheduler.proposal.rejected",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          entity: {
            entity_type: "change_proposal",
            entity_id: proposalId,
          },
          data: {
            change_proposal_id: proposalId,
            solver_run_id: "",
            rejected_by_profile_id: profileId,
            rejection_reason: null,
            gate_evaluation_id: null,
          },
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROPOSALS_KEY });
      onRejected();
    },
    onError: (err: Error) => {
      Alert.alert("Kunne ikke avslå", err.message);
    },
  });

  const isPending = acceptMutation.isPending || rejectMutation.isPending;

  const handleAccept = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    acceptMutation.mutate();
  }, [acceptMutation]);

  const handleReject = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Avslå forslag", "Er du sikker på at du vil avslå hele vaktplanen?", [
      { text: "Avbryt", style: "cancel" },
      {
        text: "Avslå",
        style: "destructive",
        onPress: () => rejectMutation.mutate(),
      },
    ]);
  }, [rejectMutation]);

  return (
    <View style={styles.actionBar}>
      <Pressable
        style={[styles.rejectButton, isPending && styles.buttonDisabled]}
        onPress={handleReject}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityLabel="Avslå alle"
      >
        {rejectMutation.isPending ? (
          <ActivityIndicator size="small" color={theme.colors.destructive} />
        ) : (
          <>
            <XCircle size={18} color={theme.colors.destructive} strokeWidth={1.8} />
            <Text style={styles.rejectButtonText}>Avslå alle</Text>
          </>
        )}
      </Pressable>

      <Pressable
        style={[styles.acceptButton, isPending && styles.buttonDisabled]}
        onPress={handleAccept}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityLabel="Godta alle"
      >
        {acceptMutation.isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <CheckCircle2 size={18} color="#fff" strokeWidth={1.8} />
            <Text style={styles.acceptButtonText}>Godta alle</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProposedPlanScreen() {
  const router = useRouter();
  const styles = useStyles();
  const theme = useTheme();
  const [accepted, setAccepted] = useState(false);
  const [rejected, setRejected] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: PROPOSALS_KEY,
    queryFn: async () => {
      const result = await bffGet<{ ok: boolean; proposals: BundleProposal[] }>(
        getSchedulerProposalsUrl(),
      );
      return result.proposals;
    },
    staleTime: 30_000,
  });

  const proposal = data?.[0] ?? null;

  const handleAccepted = useCallback(() => {
    setAccepted(true);
  }, []);

  const handleRejected = useCallback(() => {
    setRejected(true);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Tilbake"
          accessibilityRole="button"
        >
          <ChevronLeft size={22} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>Vaktplanforslag</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : "Kunne ikke laste forslag."}
          </Text>
        </View>
      ) : accepted ? (
        <View style={styles.centered}>
          <CheckCircle2 size={48} color={theme.colors.primary} strokeWidth={1.5} />
          <Text style={styles.successText}>Vaktplanen er godtatt.</Text>
        </View>
      ) : rejected ? (
        <View style={styles.centered}>
          <XCircle size={48} color={theme.colors.destructive} strokeWidth={1.5} />
          <Text style={styles.successText}>Forslaget er avslått.</Text>
        </View>
      ) : !proposal ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Ingen ventende forslag.</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.scrollArea}>
            <BundleCard proposal={proposal} />
            <Text style={styles.sectionLabel}>Foreslåtte vakter</Text>
            <ReadOnlyShiftList shifts={proposal.proposed_shifts ?? []} />
          </View>

          <BundleActionBar
            proposalId={proposal.change_proposal_id}
            onAccepted={handleAccepted}
            onRejected={handleRejected}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  // "YYYY-MM-DD" → "DD.MM"
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[2]}.${parts[1]}`;
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "—";
  return timeStr.slice(0, 5);
}

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 6)}…` : id;
}
