/**
 * Shift detail — Bottom sheet style over the shifts list.
 *
 * Nordic Split bento layout:
 * 1. Handle + shift header (calendar icon, title, ref)
 * 2. Tab bar — Details, Tasks, Emma (AI)
 * 3. Content — Status, Time, Position, Employee, Notes
 * 4. Floating "Ask Emma" CTA
 *
 * Opens as a modal card presentation from the shifts list.
 */

import React, { useMemo, useCallback, useState } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  Calendar,
  Clock,
  Briefcase,
  UserCheck,
  Users,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ArrowLeftRight,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import { useMyShifts } from "@/hooks/queries/use-my-shifts";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useShiftColleagues } from "@/hooks/queries/use-shift-colleagues";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";
import { enqueue } from "@/lib/sync/queue";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type TabKey = "details" | "tasks" | "emma";

const TABS: { key: TabKey; label: string; hasSparkle?: boolean }[] = [
  { key: "details", label: "Detaljer" },
  { key: "tasks", label: "Oppgaver" },
  { key: "emma", label: "Emma", hasSparkle: true },
];

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatShiftDate(dateStr: string): string {
  const DAYS = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
  const MONTHS = [
    "Januar",
    "Februar",
    "Mars",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
}

/** Detail row — icon, label, content card */
function DetailRow({
  icon: IconComponent,
  label,
  children,
  index,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  children: React.ReactNode;
  index: number;
}) {
  const styles = useDetailStyles();
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(200 + index * 80)
        .duration(400)
        .springify()}
      style={styles.container}
    >
      <View style={styles.labelRow}>
        <IconComponent
          size={16}
          color={withOpacity(theme.colors.mutedForeground, 0.4)}
          strokeWidth={1.5}
        />
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const useDetailStyles = createStyles((theme) => ({
  container: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
  },
  content: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: "transparent",
  },
}));

export default function ShiftDetailScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: shifts } = useMyShifts();
  const { data: profile } = useMyProfile();
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);
  const [activeTab, setActiveTab] = useState<TabKey>("details");
  const [confirming, setConfirming] = useState(false);

  const shift = useMemo(
    () => shifts?.find((s) => s.schedule_shift_id === id) ?? null,
    [shifts, id],
  );

  const { data: colleagues } = useShiftColleagues(
    shift?.shift_date ?? null,
    profile?.profile_id ?? null,
  );

  const handleConfirm = useCallback(
    async (shiftId: string) => {
      if (!profile) return;
      setConfirming(true);
      try {
        await enqueue("confirm_shift", {
          schedule_shift_id: shiftId,
        });
        queryClient.setQueryData<ScheduleShift[]>(["my-shifts", selectedProfileId], (old) =>
          old?.map((s) =>
            s.schedule_shift_id === shiftId
              ? { ...s, confirmed_at: new Date().toISOString(), confirmed_by: profile.profile_id }
              : s,
          ),
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } finally {
        setConfirming(false);
      }
    },
    [profile, queryClient, selectedProfileId],
  );

  if (!shift) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Vakt ikke funnet</Text>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            accessibilityRole="button"
            style={styles.backButton}
          >
            <ChevronLeft size={18} color={theme.colors.brandOrange} strokeWidth={2} />
            <Text style={styles.backText}>Tilbake</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isConfirmed = !!shift.confirmed_at;
  const refId = `#ST-${shift.schedule_shift_id.slice(0, 4).toUpperCase()}`;
  const ownerName = profile?.display_name ?? "Ukjent";
  const ownerNameParts = ownerName.split(" ");
  const ownerFirstName = ownerNameParts[0] ?? "";
  const ownerLastName = ownerNameParts.slice(1).join(" ");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Handle */}
      <View style={styles.handleRow}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Lukk"
        >
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <View style={styles.handle} />
        <View style={{ width: 24 }} />
      </View>

      {/* Shift Header */}
      <Animated.View entering={FadeIn.delay(50).duration(400)} style={styles.header}>
        <View style={styles.headerIcon}>
          <Calendar size={28} color={theme.colors.brandOrange} strokeWidth={1.5} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Vaktdetaljer</Text>
          <Text style={styles.headerRef}>REF: {refId}</Text>
        </View>
      </Animated.View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(tab.key);
              }}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.tabContent}>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tab.hasSparkle && (
                  <Sparkles
                    size={14}
                    color={
                      isActive
                        ? theme.colors.brandOrange
                        : withOpacity(theme.colors.mutedForeground, 0.4)
                    }
                    strokeWidth={1.5}
                  />
                )}
              </View>
              {isActive && <View style={styles.tabIndicator} />}
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "details" && (
          <View style={styles.detailsGrid}>
            {/* Status */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(400).springify()}
              style={styles.statusRow}
            >
              <Text style={styles.statusLabel}>Status</Text>
              <View style={[styles.statusBadge, isConfirmed && styles.statusBadgeConfirmed]}>
                <View style={[styles.statusDot, isConfirmed && styles.statusDotConfirmed]} />
                <Text style={[styles.statusText, isConfirmed && styles.statusTextConfirmed]}>
                  {isConfirmed ? "CONFIRMED" : "PENDING"}
                </Text>
              </View>
            </Animated.View>

            {/* Time */}
            <DetailRow icon={Clock} label="Tid" index={0}>
              <Text style={styles.timeValue}>
                {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
              </Text>
              <Text style={styles.dateValue}>{formatShiftDate(shift.shift_date)}</Text>
            </DetailRow>

            {/* Position */}
            <DetailRow icon={Briefcase} label="Posisjon" index={1}>
              <View style={styles.positionRow}>
                <Text style={styles.positionValue}>{shift.role ?? "Servitør"}</Text>
                <ChevronRight
                  size={18}
                  color={withOpacity(theme.colors.mutedForeground, 0.3)}
                  strokeWidth={1.5}
                />
              </View>
            </DetailRow>

            {/* You — shift owner */}
            <DetailRow icon={UserCheck} label="Din vakt" index={2}>
              <View style={styles.employeeRow}>
                <View style={styles.employeeAvatarWrap}>
                  <Avatar name={ownerName} imageUrl={null} size="lg" />
                  {isConfirmed && (
                    <View style={styles.employeeCheck}>
                      <Text style={styles.employeeCheckIcon}>✓</Text>
                    </View>
                  )}
                </View>
                <View>
                  <Text style={styles.employeeName}>{ownerName}</Text>
                  <Text style={styles.employeeRole}>{shift.role?.toUpperCase() ?? "ANSATT"}</Text>
                </View>
              </View>
            </DetailRow>

            {/* Colleagues on same day */}
            {colleagues && colleagues.length > 0 && (
              <DetailRow icon={Users} label="På jobb samme dag" index={3}>
                <View style={styles.colleagueList}>
                  {colleagues.map((c) => (
                    <View key={c.profileId} style={styles.colleagueRow}>
                      <Avatar
                        name={`${c.firstName} ${c.lastName}`}
                        imageUrl={c.avatarUrl}
                        size="sm"
                      />
                      <View style={styles.colleagueInfo}>
                        <Text style={styles.colleagueName}>
                          {c.firstName} {c.lastName}
                        </Text>
                        <Text style={styles.colleagueMeta}>
                          {c.role} · {c.startTime.slice(0, 5)}–{c.endTime.slice(0, 5)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </DetailRow>
            )}
          </View>
        )}

        {activeTab === "tasks" && (
          <View style={styles.emptyTab}>
            <Text style={styles.emptyTabText}>Ingen oppgaver for denne vakten ennå.</Text>
          </View>
        )}

        {activeTab === "emma" && (
          <View style={styles.emptyTab}>
            <Sparkles
              size={32}
              color={withOpacity(theme.colors.brandOrange, 0.3)}
              strokeWidth={1.2}
            />
            <Text style={styles.emptyTabText}>Spør Emma om denne vakten.</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar — contextual CTA. Secondary actions (Bekreft/Bytt)
          stack as a top row; Stemple inn is the full-width primary on bottom. */}
      <Animated.View
        entering={FadeInDown.delay(600).duration(500).springify()}
        style={styles.bottomBar}
      >
        {(!isConfirmed ||
          (shift.status === "published" && shift.employee_id === selectedProfileId)) && (
          <View style={styles.secondaryRow}>
            {/* Confirm shift — only if not yet confirmed */}
            {!isConfirmed && (
              <Pressable
                onPress={() => handleConfirm(shift.schedule_shift_id)}
                disabled={confirming}
                style={({ pressed }) => [styles.confirmButton, pressed && styles.confirmPressed]}
                accessibilityRole="button"
                accessibilityLabel="Bekreft vakt"
              >
                <UserCheck size={16} color={theme.colors.brandOrange} strokeWidth={2} />
                <Text style={styles.confirmText}>
                  {confirming ? "Bekrefter..." : "Bekreft vakt"}
                </Text>
              </Pressable>
            )}

            {/* Swap shift — only published shifts owned by current user */}
            {shift.status === "published" && shift.employee_id === selectedProfileId && (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({
                    pathname: "/(app)/(shifts)/swap",
                    params: { shiftId: shift.schedule_shift_id },
                  });
                }}
                style={({ pressed }) => [styles.swapButton, pressed && styles.confirmPressed]}
                accessibilityRole="button"
                accessibilityLabel="Bytt vakt"
              >
                <ArrowLeftRight size={16} color={theme.colors.brandOrange} strokeWidth={2} />
                <Text style={styles.confirmText}>Bytt vakt</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Primary CTA — navigate to punch clock */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/(app)/(home)/punch-clock");
          }}
          style={({ pressed }) => [styles.punchButton, pressed && styles.punchPressed]}
          accessibilityRole="button"
          accessibilityLabel="Stemple inn"
        >
          <Text style={styles.punchText}>Stemple inn</Text>
          <ChevronRight size={16} color="#ffffff" strokeWidth={2.5} />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  /* Handle */
  handleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.tight,
    paddingBottom: theme.spacing.tight,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.muted,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.section,
    paddingHorizontal: theme.spacing.page,
    paddingBottom: theme.spacing.section,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.6) : theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.sm,
  },
  headerTitle: {
    ...theme.typography.largeTitle,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  headerRef: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
    marginTop: 4,
  },

  /* Tab bar */
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.page,
    gap: theme.spacing.page,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(theme.colors.border, 0.05),
  },
  tab: {
    paddingVertical: theme.spacing.element,
  },
  tabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tabLabel: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  tabLabelActive: {
    color: theme.colors.brandOrange,
  },
  tabIndicator: {
    height: 2,
    backgroundColor: theme.colors.brandOrange,
    borderRadius: 1,
    marginTop: 6,
  },

  /* Scroll */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.page,
    paddingTop: theme.spacing.page,
    paddingBottom: 120,
  },

  /* Details grid */
  detailsGrid: {
    gap: theme.spacing.page,
  },

  /* Status row */
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusLabel: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.mutedForeground, 0.2),
    backgroundColor: withOpacity(theme.colors.muted, 0.3),
  },
  statusBadgeConfirmed: {
    borderColor: withOpacity(theme.colors.brandOrange, 0.2),
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.06),
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.mutedForeground,
  },
  statusDotConfirmed: {
    backgroundColor: theme.colors.brandOrange,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
  },
  statusTextConfirmed: {
    color: theme.colors.brandOrange,
  },

  /* Detail content */
  timeValue: {
    fontSize: 20,
    fontWeight: "500",
    letterSpacing: -0.5,
    color: theme.colors.foreground,
  },
  dateValue: {
    ...theme.typography.caption,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
    marginTop: 4,
  },
  positionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  positionValue: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },

  /* Employee */
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  employeeAvatarWrap: {
    position: "relative",
  },
  employeeCheck: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.brandOrange,
    borderWidth: 2,
    borderColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  employeeCheckIcon: {
    fontSize: 8,
    fontWeight: "700",
    color: "#ffffff",
  },
  employeeName: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  employeeRole: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },

  /* Colleague list */
  colleagueList: {
    gap: 10,
  },
  colleagueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  colleagueInfo: {
    flex: 1,
    gap: 1,
  },
  colleagueName: {
    ...theme.typography.body,
    fontWeight: "500",
    color: theme.colors.foreground,
    fontSize: 13,
  },
  colleagueMeta: {
    fontSize: 11,
    color: theme.colors.mutedForeground,
  },

  /* Empty tabs */
  emptyTab: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.element,
    paddingVertical: theme.spacing.xl,
  },
  emptyTabText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },

  /* Bottom action bar */
  bottomBar: {
    flexDirection: "column",
    gap: theme.spacing.element,
    paddingHorizontal: theme.spacing.page,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: withOpacity(theme.colors.border, 0.1),
    backgroundColor: theme.colors.background,
  },
  secondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
  },
  confirmButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.section,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.brandOrange, 0.2),
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.06),
  },
  confirmPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  confirmText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.brandOrange,
  },
  swapButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.section,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.brandOrange, 0.2),
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.06),
  },
  punchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.brandOrange,
    borderRadius: theme.radius.lg,
    ...theme.shadows.lg,
  },
  punchPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  punchText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },

  /* Not found */
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.element,
  },
  notFoundText: {
    ...theme.typography.headline,
    color: theme.colors.mutedForeground,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  backText: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.brandOrange,
  },
}));
