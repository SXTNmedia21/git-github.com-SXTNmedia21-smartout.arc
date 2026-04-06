/**
 * Punch Clock — Nordic Split immersive shift experience.
 *
 * Two states:
 * - Before shift: "Stemple inn" CTA
 * - During shift: Dark header with live timer, 2x2 action grid,
 *   task feed, earnings stats, "Stemple ut" CTA
 *
 * Layout matches the Driftsleder mockup with bento action cards.
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  Coffee,
  StickyNote,
  Banknote,
  Phone,
  LogOut,
  Clock,
  CheckCircle2,
  LogIn,
} from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";
import { withOpacity } from "@/theme/colors";
import { Avatar } from "@/components/common/Avatar";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useMyTasks } from "@/hooks/queries/use-my-tasks";
import { usePunch } from "@/hooks/mutations/use-punch";
import { useLeaderPhone } from "@/hooks/queries/use-leader-phone";
import { strings } from "@/constants/strings";

/** Formats elapsed time as HH:MM:SS */
function formatTimer(punchIn: string): string {
  const diff = Math.max(0, Date.now() - new Date(punchIn).getTime());
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

// ── Action Grid ──

type ActionItem = {
  key: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  badge?: number;
  onPress?: () => void;
};

function ActionCard({ item, index }: { item: ActionItem; index: number }) {
  const styles = useActionStyles();
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(200 + index * 60)
        .duration(400)
        .springify()}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          item.onPress?.();
        }}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={item.label}
      >
        {item.badge !== undefined && item.badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
        <View style={styles.iconCircle}>
          <item.icon size={22} color={theme.colors.brandOrange} strokeWidth={1.5} />
        </View>
        <Text style={styles.label}>{item.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const useActionStyles = createStyles((theme) => ({
  card: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    padding: theme.spacing.section,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    position: "relative",
    aspectRatio: 1,
  },
  cardPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  badge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: theme.colors.brandOrange,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#ffffff",
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.5) : theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
}));

// ── Main Screen ──

export default function PunchClockScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { phase, activeShift, activeTimeEntry, nextShift } = useShiftPhase();
  // In before_shift phase, the shift is on nextShift, not activeShift
  const relevantShift = activeShift ?? nextShift;
  const { data: profile } = useMyProfile();
  const { data: tasks } = useMyTasks();
  const { punchIn, punchOut } = usePunch();
  const { data: leaderPhone } = useLeaderPhone(profile?.profile_id);
  const [punching, setPunching] = useState(false);
  const [callPopupVisible, setCallPopupVisible] = useState(false);

  const isDuring = phase === "during_shift" && activeTimeEntry;

  // Live timer — depends on punch_in directly, not isDuring (Zustand lags TanStack Query)
  const [timer, setTimer] = useState("00:00:00");

  useEffect(() => {
    if (!activeTimeEntry?.punch_in) {
      setTimer("00:00:00");
      return;
    }

    setTimer(formatTimer(activeTimeEntry.punch_in));
    const interval = setInterval(() => {
      setTimer(formatTimer(activeTimeEntry.punch_in));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimeEntry?.punch_in]);

  const activeTasks = (tasks ?? []).filter((t) => t.status !== "skipped");

  const handlePunchIn = useCallback(async () => {
    if (!relevantShift || punching) return;
    setPunching(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await punchIn(relevantShift.schedule_shift_id);
    } finally {
      setPunching(false);
    }
  }, [relevantShift, punchIn, punching]);

  const handlePunchOut = useCallback(async () => {
    if (!activeTimeEntry || punching) return;
    setPunching(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await punchOut(activeTimeEntry.time_entry_id);
    } finally {
      setPunching(false);
    }
  }, [activeTimeEntry, punchOut, punching]);

  // All hooks must be before any conditional return
  const [countdown, setCountdown] = useState("");
  const [activeTab, setActiveTab] = useState<"feed" | "chat" | "notes">("feed");

  const actions: ActionItem[] = [
    { key: "break", icon: Coffee, label: "Pause" },
    { key: "note", icon: StickyNote, label: "Notat" },
    { key: "supplements", icon: Banknote, label: "Tillegg", badge: 1 },
    {
      key: "call",
      icon: Phone,
      label: "Ring leder",
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setCallPopupVisible(true);
      },
    },
  ];

  useEffect(() => {
    if (isDuring || !relevantShift) return;
    const calc = () => {
      const cleanTime = relevantShift.start_time.replace(/[Z+-].*$/, "");
      const start = new Date(`${relevantShift.shift_date}T${cleanTime}`);
      const diff = Math.max(0, start.getTime() - Date.now());
      const h = Math.floor(diff / 3600000)
        .toString()
        .padStart(2, "0");
      const m = Math.floor((diff % 3600000) / 60000)
        .toString()
        .padStart(2, "0");
      const s = Math.floor((diff % 60000) / 1000)
        .toString()
        .padStart(2, "0");
      setCountdown(`${h}:${m}:${s}`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [isDuring, activeShift, nextShift]);

  // ── Before Shift State — big fingerprint button ──
  if (!isDuring) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.containerLight} edges={["top", "bottom"]}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <Avatar
                name={profile?.display_name ?? "?"}
                imageUrl={profile?.avatar_url}
                size="sm"
              />
              <Text style={styles.topBarTitle}>ShiftClock</Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/(app)/(home)/settings");
              }}
            >
              <Clock
                size={22}
                color={withOpacity(theme.colors.mutedForeground, 0.5)}
                strokeWidth={1.5}
              />
            </Pressable>
          </View>

          <View style={styles.beforeContent}>
            {/* Next shift info */}
            <Animated.View entering={FadeIn.delay(50).duration(500)} style={styles.beforeShiftInfo}>
              <Text style={styles.beforeLabel}>NESTE VAKT</Text>
              <Text style={styles.beforeTime}>
                {relevantShift?.start_time.slice(0, 5) ?? "—"} –{" "}
                {relevantShift?.end_time.slice(0, 5) ?? "—"}
              </Text>
              <View style={styles.countdownRow}>
                <Text style={styles.countdownValue}>{countdown}</Text>
                <Text style={styles.countdownSuffix}>TIL START</Text>
              </View>
            </Animated.View>

            {/* Pulse button */}
            <Animated.View entering={FadeIn.delay(200).duration(600)} style={styles.pulseContainer}>
              {/* Pulsing rings */}
              <View style={styles.pulseRingOuter} />
              <View style={styles.pulseRingInner} />
              <Pressable
                onPress={handlePunchIn}
                disabled={punching}
                style={({ pressed }) => [
                  styles.punchCircle,
                  pressed && { transform: [{ scale: 0.9 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Stemple inn"
              >
                <LogIn size={44} color="#ffffff" strokeWidth={1.5} />
                <Text style={styles.punchCircleText}>TOUCH TO PUNCH</Text>
              </Pressable>
            </Animated.View>

            {/* Status pill */}
            <Animated.View
              entering={FadeInDown.delay(400).duration(400).springify()}
              style={styles.statusPill}
            >
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>IDLE · READY TO SYNC</Text>
            </Animated.View>

            {/* Meta cards */}
            <Animated.View
              entering={FadeInDown.delay(500).duration(400).springify()}
              style={styles.metaGrid}
            >
              <View style={styles.metaCard}>
                <Text style={styles.metaLabel}>LOKASJON</Text>
                <Text style={styles.metaValue}>{relevantShift?.zone ?? "Arbeidsplass"}</Text>
              </View>
              <View style={styles.metaCard}>
                <Text style={styles.metaLabel}>STATUS</Text>
                <Text style={styles.metaValue}>Verifisert</Text>
              </View>
            </Animated.View>
          </View>
        </SafeAreaView>
      </>
    );
  }

  // ── During Shift State (matches punch-in mockup) ──
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <Avatar name={profile?.display_name ?? "?"} imageUrl={profile?.avatar_url} size="sm" />
            <Text style={styles.topBarTitle}>ShiftClock</Text>
          </View>
          <Pressable onPress={() => Haptics.selectionAsync()}>
            <Clock
              size={22}
              color={withOpacity(theme.colors.mutedForeground, 0.5)}
              strokeWidth={1.5}
            />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Live Timer Section — centered */}
          <Animated.View entering={FadeIn.delay(50).duration(400)} style={styles.timerSection}>
            <View style={styles.onDutyBadge}>
              <View style={styles.onDutyDot} />
              <Text style={styles.onDutyText}>PÅ VAKT</Text>
            </View>
            <Text style={styles.timerValue}>{timer}</Text>
            <Text style={styles.timerSubtitle}>Dagens vakt · {relevantShift?.role ?? "Vakt"}</Text>
          </Animated.View>

          {/* 2x2 Action Grid */}
          <View style={styles.actionGrid}>
            {actions.map((action, i) => (
              <View key={action.key} style={styles.actionGridItem}>
                <ActionCard item={action} index={i} />
              </View>
            ))}
          </View>

          {/* Tabbed Activity View */}
          <View style={styles.tabSection}>
            <View style={styles.tabBar}>
              <View style={styles.tabRow}>
                {(["feed", "chat", "notes"] as const).map((tab) => (
                  <Pressable
                    key={tab}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveTab(tab);
                    }}
                  >
                    <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                      {tab === "feed" ? "Feed" : tab === "chat" ? "Chat" : "Notater"}
                    </Text>
                    {activeTab === tab && <View style={styles.tabIndicator} />}
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={() => Haptics.selectionAsync()}>
                <Text style={styles.tabSeeAll}>SE ALLE</Text>
              </Pressable>
            </View>

            {/* Feed content */}
            {activeTab === "feed" && (
              <View style={styles.feedList}>
                {activeTasks.length > 0 ? (
                  activeTasks.slice(0, 5).map((task, i) => (
                    <Animated.View
                      key={task.id}
                      entering={FadeInDown.delay(100 + i * 60)
                        .duration(300)
                        .springify()}
                      style={styles.feedItem}
                    >
                      <View
                        style={[
                          styles.feedIcon,
                          task.is_compliance_required && styles.feedIconPrimary,
                        ]}
                      >
                        <CheckCircle2
                          size={16}
                          color={
                            task.is_compliance_required
                              ? theme.colors.brandOrange
                              : theme.colors.mutedForeground
                          }
                          strokeWidth={1.5}
                        />
                      </View>
                      <View style={styles.feedContent}>
                        <Text style={styles.feedTitle}>{task.title}</Text>
                        <Text style={styles.feedMeta}>
                          {task.status === "completed" ? "Fullført" : "Planlagt oppgave"}
                        </Text>
                      </View>
                    </Animated.View>
                  ))
                ) : (
                  <Text style={styles.feedEmpty}>Ingen aktivitet ennå</Text>
                )}
              </View>
            )}

            {activeTab === "chat" && (
              <View style={styles.feedList}>
                <Text style={styles.feedEmpty}>Åpne kanaler for å chatte</Text>
              </View>
            )}

            {activeTab === "notes" && (
              <View style={styles.feedList}>
                <Text style={styles.feedEmpty}>Ingen notater for denne vakten</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Punch Out CTA */}
        <View style={styles.ctaWrap}>
          <Pressable
            onPress={handlePunchOut}
            disabled={punching}
            style={({ pressed }) => [styles.punchOutButton, pressed && styles.ctaPressed]}
            accessibilityRole="button"
            accessibilityLabel={strings.shift.punchOut}
          >
            <LogOut size={20} color="#ffffff" strokeWidth={2} />
            <Text style={styles.punchOutText}>{strings.shift.punchOut}</Text>
          </Pressable>
        </View>
        {/* Call leader popup */}
        <CallLeaderPopup
          visible={callPopupVisible}
          phone={leaderPhone ?? null}
          onClose={() => setCallPopupVisible(false)}
        />
      </SafeAreaView>
    </>
  );
}

// ── Call Leader Popup ──

function CallLeaderPopup({
  visible,
  phone,
  onClose,
}: {
  visible: boolean;
  phone: string | null;
  onClose: () => void;
}) {
  const styles = useCallStyles();
  const theme = useTheme();

  if (!visible) return null;

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.popup}>
        <View style={styles.popupHandle} />
        <View style={styles.popupIconCircle}>
          <Phone size={24} color={theme.colors.brandOrange} strokeWidth={1.5} />
        </View>
        <Text style={styles.popupTitle}>Ring leder</Text>
        {phone ? (
          <>
            <Text style={styles.popupPhone}>{phone}</Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Linking.openURL(`tel:${phone}`);
                onClose();
              }}
              style={({ pressed }) => [
                styles.callButton,
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
            >
              <Phone size={18} color="#ffffff" strokeWidth={2} />
              <Text style={styles.callButtonText}>Ring nå</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.popupNoPhone}>Ingen telefonnummer registrert</Text>
        )}
        <Pressable onPress={onClose} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Avbryt</Text>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

const useCallStyles = createStyles((theme) => ({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    zIndex: 100,
  },
  popup: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: "center",
    gap: 12,
  },
  popupHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.muted,
    marginBottom: 8,
  },
  popupIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.foreground,
  },
  popupPhone: {
    fontSize: 20,
    fontWeight: "300",
    letterSpacing: 1,
    color: theme.colors.mutedForeground,
  },
  popupNoPhone: {
    fontSize: 13,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: "#2d6a4f",
    marginTop: 8,
  },
  callButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
  },
}));

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  containerLight: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  /* ── Top Bar ── */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.section,
    height: 50,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topBarTitle: {
    fontSize: 20,
    fontStyle: "italic",
    fontWeight: "300",
    color: theme.colors.brandOrange,
    letterSpacing: -0.3,
  },

  /* ── Timer Section ── */
  timerSection: {
    alignItems: "center",
    gap: 8,
    marginBottom: theme.spacing.section,
  },
  timerValue: {
    fontSize: 56,
    fontWeight: "500",
    letterSpacing: -2,
    color: theme.colors.brandOrange,
  },
  timerSubtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },

  onDutyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.brandOrange, 0.2),
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.05),
  },
  onDutyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.brandOrange,
  },
  onDutyText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    color: theme.colors.brandOrange,
  },

  /* ── Scroll ── */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.section,
    paddingBottom: 120,
    gap: theme.spacing.page,
  },

  /* ── Action Grid ── */
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  actionGridItem: {
    width: "48%",
  },

  /* ── Tasks ── */
  taskSection: {
    gap: theme.spacing.md,
  },
  taskSectionTitle: {
    ...theme.typography.title,
    color: theme.colors.mutedForeground,
    marginLeft: 4,
  },

  /* ── Tabs ── */
  tabSection: {
    gap: theme.spacing.md,
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(theme.colors.border, 0.1),
  },
  tabRow: {
    flexDirection: "row",
    gap: theme.spacing.page,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: withOpacity(theme.colors.mutedForeground, 0.5),
    paddingBottom: 10,
  },
  tabLabelActive: {
    color: theme.colors.foreground,
  },
  tabIndicator: {
    height: 2,
    backgroundColor: theme.colors.brandOrange,
    borderRadius: 1,
    marginTop: -1,
  },
  tabSeeAll: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: theme.colors.brandOrange,
    paddingBottom: 12,
  },

  /* ── Feed ── */
  feedList: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.element,
  },
  feedItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
    padding: theme.spacing.card,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.3) : theme.colors.background,
    borderRadius: theme.radius.lg,
    ...theme.shadows.sm,
  },
  feedIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.4) : theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  feedIconPrimary: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.1),
  },
  feedContent: {
    flex: 1,
    gap: 2,
  },
  feedTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
  feedMeta: {
    fontSize: 11,
    color: theme.colors.mutedForeground,
  },
  feedEmpty: {
    fontSize: 13,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
    textAlign: "center",
    paddingVertical: theme.spacing.page,
  },

  /* ── Punch Out CTA ── */
  ctaWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.section,
    paddingBottom: theme.spacing.page,
    paddingTop: theme.spacing.section,
  },
  punchOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.element,
    height: 64,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.destructive,
    ...theme.shadows.lg,
  },
  punchOutText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#ffffff",
  },
  ctaPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },

  /* ── Before Shift ── */
  beforeContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.page,
    gap: 32,
  },

  beforeShiftInfo: {
    alignItems: "flex-start",
    width: "100%",
    gap: 4,
  },
  beforeLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: theme.colors.brandOrange,
    marginBottom: 4,
  },
  beforeTime: {
    fontSize: 42,
    fontWeight: "300",
    letterSpacing: -1,
    color: theme.colors.foreground,
  },
  countdownRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 12,
  },
  countdownValue: {
    fontSize: 24,
    fontWeight: "400",
    letterSpacing: -0.5,
    color: theme.colors.mutedForeground,
  },
  countdownSuffix: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
  },

  /* Pulse button */
  pulseContainer: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRingOuter: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.brandOrange, 0.08),
  },
  pulseRingInner: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.brandOrange, 0.05),
  },
  punchCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...theme.shadows.lg,
  },
  punchCircleText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },

  /* Status pill */
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.brandOrange,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
  },

  /* Meta grid */
  metaGrid: {
    flexDirection: "row",
    gap: theme.spacing.md,
    width: "100%",
  },
  metaCard: {
    flex: 1,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.3) : theme.colors.background,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    gap: 4,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.05),
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 1,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.foreground,
  },
}));
