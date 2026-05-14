/**
 * (shifts)/marketplace.tsx — Employee Shift Marketplace
 *
 * Displays open shift offers the employee can claim.
 * Pull-to-refresh + 30s TanStack Query refetch while tab is focused.
 *
 * ADR-0133: claim = Approve verb → mobile-allowed.
 * ADR-0132: no direct DB writes from mobile — claim goes through the BFF.
 * ADR-0288: claim is chat-only; mobile BFF pins channel='chat'.
 * ADR-0134: emit happens server-side in BFF — no mobile-side emit here.
 * L-0177:   getProfileContext() throws on empty/missing IDs — fail fast.
 *
 * Motion:
 *   Card entrance: Reanimated withSpring(1, nativeTheme.motion.springAmbient).
 *   Stagger per-card capped at 4 rows (24ms step) so list never stutters.
 *   Claim button press: withSpring scale 0.96 → 1, springReactive.
 */

import React, { useCallback, useRef, useState } from "react";
import type { ListRenderItemInfo } from "react-native";
import { Alert, FlatList, Modal, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, { useSharedValue, withSpring } from "react-native-reanimated";
import { ChevronLeft, Briefcase, Clock, MapPin, CheckCircle } from "lucide-react-native";

import { createStyles, useTheme } from "@/theme";
import { supabase } from "@/lib/supabase";
import { getProfileContext } from "@/lib/profile-context";
import { getMarketplaceOpenOffersUrl, getMarketplaceClaimUrl } from "@/lib/web-api";
import { nativeTheme } from "@smartout/design-tokens/native";

// ── Types (mirrors BFF OpenOffer shape) ──────────────────────────────────────

type OpenOfferShift = {
  shift_date: string;
  start_time: string;
  end_time: string;
  role: string | null;
  department_id: string | null;
  position_id: string | null;
};

type OpenOffer = {
  schedule_shift_offer_id: string;
  shift_id: string;
  posted_at: string;
  expires_at: string | null;
  posted_by_profile_id: string;
  shift: OpenOfferShift | null;
};

type OpenOffersResponse = {
  offers: OpenOffer[];
  total: number;
};

type ClaimResult =
  | { ok: true; offer_id: string; shift_id: string; claimed_at: string; message: string }
  | { ok: false; error: string; reason?: string; codes?: string[] };

// ── Blocker code translations ─────────────────────────────────────────────────

const BLOCKER_MESSAGES: Record<string, string> = {
  SHIFT_OVERLAP: "Du har et skift som overlapper med denne vakten.",
  AML_HOURS_EXCEEDED: "AML-grensen for ukentlige timer vil overskrides.",
  MISSING_COMPETENCE: "Du mangler nødvendig kompetanse for denne rollen.",
  OFFER_NOT_OPEN: "Dette tilbudet er ikke lenger tilgjengelig.",
  AUTHORITY_DENIED: "Du har ikke tillatelse til å krev denne vakten.",
  SELF_CLAIM: "Du kan ikke krev din egen vakt.",
};

function resolveBlockerMessage(codes?: string[], reason?: string): string {
  if (codes?.length) {
    const msg = codes.map((c) => BLOCKER_MESSAGES[c] ?? c).join("\n");
    return msg;
  }
  return reason ?? "Noe gikk galt. Prøv igjen.";
}

// ── Date/time formatting ─────────────────────────────────────────────────────

function formatShiftDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ["sø", "ma", "ti", "on", "to", "fr", "lø"];
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "mai",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "des",
  ];
  return `${days[d.getDay()]} ${d.getDate()}. ${months[d.getMonth()]}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Animated offer card ───────────────────────────────────────────────────────

type OfferCardProps = {
  offer: OpenOffer;
  index: number;
  claimingId: string | null;
  claimedIds: Set<string>;
  onClaim: (offer: OpenOffer) => void;
};

function OfferCard({ offer, index, claimingId, claimedIds, onClaim }: OfferCardProps) {
  const styles = useStyles();
  const theme = useTheme();

  // Stagger: cap at row 4 (index >= 4 → no additional delay) to avoid list stutter.
  const delayMs = Math.min(index, 4) * 24;
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);
  const buttonScale = useSharedValue(1);

  // Entrance spring (ADR-0134 / Nordic Split: springAmbient for content, slow + organic).
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      opacity.value = withSpring(1, { stiffness: 35, damping: 22, mass: 2.2 });
      translateY.value = withSpring(0, { stiffness: 35, damping: 22, mass: 2.2 });
    }, delayMs);
    return () => clearTimeout(timeout);
  }, []);

  const shift = offer.shift;
  const isClaiming = claimingId === offer.schedule_shift_offer_id;
  const isClaimed = claimedIds.has(offer.schedule_shift_offer_id);
  const isDisabled = isClaiming || isClaimed || claimingId !== null;

  const handlePressIn = () => {
    if (isDisabled) return;
    buttonScale.value = withSpring(0.96, nativeTheme.motion.springReactive);
  };
  const handlePressOut = () => {
    buttonScale.value = withSpring(1, nativeTheme.motion.springReactive);
  };

  return (
    <Animated.View
      style={[
        styles.card,
        { opacity, transform: [{ translateY }] },
        isClaimed && styles.cardClaimed,
      ]}
    >
      <View style={styles.cardHeader}>
        {shift?.role ? (
          <View style={styles.rolePill}>
            <Briefcase size={12} color={theme.colors.brandOrange} strokeWidth={2} />
            <Text style={styles.roleText}>{shift.role}</Text>
          </View>
        ) : null}
        {isClaimed && (
          <View style={styles.claimedBadge}>
            <CheckCircle size={12} color={theme.colors.success} strokeWidth={2} />
            <Text style={styles.claimedBadgeText}>Krevd</Text>
          </View>
        )}
      </View>

      {shift ? (
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Clock size={14} color={theme.colors.mutedForeground} strokeWidth={1.5} />
            <Text style={styles.infoText}>
              {formatShiftDate(shift.shift_date)} · {formatTime(shift.start_time)}–
              {formatTime(shift.end_time)}
            </Text>
          </View>
          {shift.department_id ? (
            <View style={styles.infoRow}>
              <MapPin size={14} color={theme.colors.mutedForeground} strokeWidth={1.5} />
              <Text style={styles.infoText} numberOfLines={1}>
                Avdeling {shift.department_id.slice(0, 8)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.infoText}>Vaktdetaljer utilgjengelig</Text>
      )}

      <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
        <Pressable
          style={[styles.claimBtn, isDisabled && styles.claimBtnDisabled]}
          onPress={() => onClaim(offer)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isDisabled}
          accessibilityLabel={`Krev vakten ${shift?.role ?? ""} ${shift ? formatShiftDate(shift.shift_date) : ""}`}
          accessibilityRole="button"
        >
          <Text style={[styles.claimBtnText, isDisabled && styles.claimBtnTextDisabled]}>
            {isClaiming ? "Sender…" : isClaimed ? "Venter godkjenning" : "Krev"}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ── Confirmation sheet ────────────────────────────────────────────────────────

type ConfirmSheetProps = {
  offer: OpenOffer | null;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming: boolean;
};

function ConfirmSheet({ offer, onConfirm, onCancel, isConfirming }: ConfirmSheetProps) {
  const styles = useStyles();
  const theme = useTheme();
  const shift = offer?.shift;

  return (
    <Modal visible={!!offer} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.sheetOverlay} onPress={onCancel}>
        <Pressable style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Krev vakten?</Text>
          {shift ? (
            <View style={styles.sheetBody}>
              {shift.role ? <Text style={styles.sheetDetail}>Rolle: {shift.role}</Text> : null}
              <Text style={styles.sheetDetail}>
                {formatShiftDate(shift.shift_date)} · {formatTime(shift.start_time)}–
                {formatTime(shift.end_time)}
              </Text>
            </View>
          ) : null}
          <Text style={styles.sheetNote}>
            Vakten tildeles deg etter at leder godkjenner kravet.
          </Text>
          <View style={styles.sheetActions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={isConfirming}>
              <Text style={styles.cancelBtnText}>Avbryt</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, isConfirming && styles.confirmBtnDisabled]}
              onPress={onConfirm}
              disabled={isConfirming}
            >
              <Text style={styles.confirmBtnText}>{isConfirming ? "Sender…" : "Bekreft"}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MarketplaceScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [pendingOffer, setPendingOffer] = useState<OpenOffer | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);

  // TanStack Query — 30s refetch while tab is focused (ADR-0306 V1 pull-poll).
  const { data, isLoading, isError, refetch, isFetching } = useQuery<OpenOffersResponse>({
    queryKey: ["marketplace", "open-offers"],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const res = await fetch(getMarketplaceOpenOffersUrl(), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`BFF error ${res.status}`);
      return res.json() as Promise<OpenOffersResponse>;
    },
    refetchInterval: 30_000, // V1 pull-poll: 30s
    refetchIntervalInBackground: false, // Only poll when tab focused
    staleTime: 15_000,
  });

  // Tap "Krev" → open confirmation sheet.
  const handleTapClaim = useCallback((offer: OpenOffer) => {
    setPendingOffer(offer);
  }, []);

  // Confirm in sheet → call BFF → optimistic gray-out → refetch.
  const handleConfirmClaim = useCallback(async () => {
    if (!pendingOffer) return;
    setIsConfirming(true);
    setClaimingId(pendingOffer.schedule_shift_offer_id);

    try {
      // ADR-0134 + L-0177: resolve identity server-side on BFF.
      // getProfileContext() throws on empty IDs — no silent fallback.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Alert.alert("Feil", "Du er ikke innlogget. Logg inn på nytt.");
        return;
      }

      const res = await fetch(getMarketplaceClaimUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ offer_id: pendingOffer.schedule_shift_offer_id }),
      });

      const result = (await res.json()) as ClaimResult;

      if (result.ok) {
        // Optimistic: mark claimed immediately, refetch in background.
        setClaimedIds((prev) => new Set(prev).add(pendingOffer.schedule_shift_offer_id));
        void queryClient.invalidateQueries({ queryKey: ["marketplace", "open-offers"] });
        setPendingOffer(null);
      } else {
        const msg = resolveBlockerMessage(result.codes, result.reason);
        Alert.alert("Kan ikke krev vakten", msg);
        setPendingOffer(null);
      }
    } catch (err) {
      Alert.alert("Nettverksfeil", "Sjekk tilkoblingen og prøv igjen.");
    } finally {
      setIsConfirming(false);
      setClaimingId(null);
    }
  }, [pendingOffer, queryClient]);

  const handleCancelSheet = useCallback(() => {
    if (isConfirming) return; // Don't dismiss mid-request
    setPendingOffer(null);
  }, [isConfirming]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<OpenOffer>) => (
      <OfferCard
        offer={item}
        index={index}
        claimingId={claimingId}
        claimedIds={claimedIds}
        onClaim={handleTapClaim}
      />
    ),
    [claimingId, claimedIds, handleTapClaim],
  );

  const keyExtractor = useCallback((item: OpenOffer) => item.schedule_shift_offer_id, []);

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Tilbake"
          accessibilityRole="button"
        >
          <ChevronLeft size={20} color={theme.colors.brandOrange} strokeWidth={2} />
        </Pressable>
        <Text style={styles.heading}>Vakt-markedsplass</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Laster tilbud…</Text>
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Kunne ikke laste tilbud.</Text>
          <Pressable style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>Prøv igjen</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data?.offers ?? []}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={onRefresh}
              tintColor={theme.colors.brandOrange}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Ingen åpne tilbud</Text>
              <Text style={styles.emptySubtitle}>
                Ledere legger ut vakttilbud her. Kom tilbake snart.
              </Text>
            </View>
          }
        />
      )}

      {/* Confirmation sheet */}
      <ConfirmSheet
        offer={pendingOffer}
        onConfirm={handleConfirmClaim}
        onCancel={handleCancelSheet}
        isConfirming={isConfirming}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  heading: {
    flex: 1,
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  headerRight: {
    width: 32,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 12,
    padding: 24,
  },
  // ── Card ───────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardClaimed: {
    opacity: 0.55,
  },
  cardHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    flexWrap: "wrap" as const,
  },
  rolePill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    backgroundColor: theme.colors.brandOrange + "20",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  roleText: {
    ...theme.typography.caption,
    color: theme.colors.brandOrange,
    fontWeight: "600" as const,
  },
  claimedBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: theme.colors.muted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  claimedBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: "500" as const,
  },
  cardBody: {
    gap: 6,
  },
  infoRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  infoText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    flexShrink: 1,
  },
  claimBtn: {
    backgroundColor: theme.colors.brandOrange,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center" as const,
  },
  claimBtnDisabled: {
    backgroundColor: theme.colors.muted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  claimBtnText: {
    ...theme.typography.body,
    color: "#fff",
    fontWeight: "600" as const,
  },
  claimBtnTextDisabled: {
    color: theme.colors.mutedForeground,
  },
  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    paddingTop: 48,
    alignItems: "center" as const,
    gap: 8,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    textAlign: "center" as const,
  },
  emptySubtitle: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.brandOrange,
  },
  retryText: {
    ...theme.typography.body,
    color: theme.colors.brandOrange,
    fontWeight: "600" as const,
  },
  // ── Confirmation sheet ─────────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end" as const,
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: "center" as const,
    marginBottom: 8,
  },
  sheetTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    textAlign: "center" as const,
  },
  sheetBody: {
    gap: 4,
    alignItems: "center" as const,
  },
  sheetDetail: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    textAlign: "center" as const,
  },
  sheetNote: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
  },
  sheetActions: {
    flexDirection: "row" as const,
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelBtnText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    fontWeight: "500" as const,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center" as const,
    backgroundColor: theme.colors.brandOrange,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    ...theme.typography.body,
    color: "#fff",
    fontWeight: "600" as const,
  },
}));
