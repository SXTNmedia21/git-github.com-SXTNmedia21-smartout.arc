/**
 * Home screen — renders different content based on the current shift phase.
 *
 * Layout (top to bottom):
 * 1. Header — avatar, greeting, quick actions
 * 2. Punch button — enters from below with spring animation
 * 3. Priority action cards (NEW) — smart contextual nudges via prioritizeActions()
 * 4. Phase-specific content — NoShift / BeforeShift / DuringShift / AfterShift
 *
 * Animations:
 * - Animated ScrollView for smooth native scroll
 * - Header scrolls with content (not sticky — more natural on mobile)
 * - Punch button enters with spring from below
 * - Phase content fades in with delay after header/punch settle
 * - Bottom sheets for notifications + settings
 */

import React, { useCallback, useRef } from "react";
import { View, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { createStyles, useTheme } from "@/theme";
import { SyncIndicator } from "@/components/common/SyncIndicator";
import { HomeHeader } from "@/components/home/HomeHeader";
import { NotificationSheet } from "@/components/home/NotificationSheet";
import { SettingsSheet } from "@/components/home/SettingsSheet";
import { NoShiftView } from "@/components/home/NoShiftView";
import { BeforeShiftView } from "@/components/home/BeforeShiftView";
import { DuringShiftView } from "@/components/home/DuringShiftView";
import { AfterShiftView } from "@/components/home/AfterShiftView";
import { PunchButton } from "@/components/shift/PunchButton";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useMyTasks } from "@/hooks/queries/use-my-tasks";
import { useDayInfo } from "@/hooks/queries/use-day-info";
import { useShiftColleagues } from "@/hooks/queries/use-shift-colleagues";
import {
  prioritizeActions,
  type HubAction,
  type Shift,
  type Task,
  type TimeEntry as HubTimeEntry,
} from "@/lib/prioritize-actions";
import type { TimeEntry } from "@/types/time-entry";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];
type SessionTask = Database["public"]["Tables"]["session_task"]["Row"];

/** Maps the DB schedule_shift row to the shape prioritizeActions expects */
function toHubShift(shift: ScheduleShift | null): Shift | null {
  if (!shift) return null;
  return {
    id: shift.schedule_shift_id,
    // Combine shift_date with time columns to produce ISO datetime strings.
    // start_time/end_time are stored as time-only strings (HH:MM:SS) in the DB.
    start_time: `${shift.shift_date}T${shift.start_time}`,
    end_time: `${shift.shift_date}T${shift.end_time}`,
    // position_name and department_name are not denormalized on this table —
    // we leave them undefined; the priority engine handles missing labels gracefully.
    position: undefined,
    department_name: undefined,
  };
}

/** Maps DB session_task rows to the Task shape prioritizeActions expects */
function toHubTasks(tasks: SessionTask[]): Task[] {
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    // session_task has no due_at or task_type columns — omit them
    due_at: undefined,
    task_type: undefined,
  }));
}

/** Maps the local TimeEntry type to the shape prioritizeActions expects */
function toHubTimeEntry(entry: TimeEntry | null): HubTimeEntry | null {
  if (!entry) return null;
  return {
    id: entry.time_entry_id,
    clock_in: entry.punch_in,
    clock_out: entry.punch_out ?? undefined,
    // breaks is a JSON column — extract break_start if present, otherwise omit
    break_start:
      entry.breaks && typeof entry.breaks === "object" && "break_start" in (entry.breaks as object)
        ? String((entry.breaks as Record<string, unknown>).break_start)
        : undefined,
  };
}

/** Left-border color for a card based on urgency level */
function urgencyColor(urgency: HubAction["urgency"], theme: ReturnType<typeof useTheme>): string {
  switch (urgency) {
    case "immediate":
      return theme.colors.destructive;
    case "soon":
      return theme.colors.warning;
    case "info":
    default:
      return theme.colors.mutedForeground;
  }
}

/** Single priority action card with urgency color bar, title, and optional subtitle */
function PriorityCard({ action }: { action: HubAction }) {
  const styles = useCardStyles();
  const theme = useTheme();

  const handlePress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (action.route) {
      router.push(action.route as Parameters<typeof router.push>[0]);
    }
  }, [action.route]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Urgency indicator — colored left border */}
      <View style={[styles.urgencyBar, { backgroundColor: urgencyColor(action.urgency, theme) }]} />

      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={2}>
          {action.title}
        </Text>
        {action.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {action.subtitle}
          </Text>
        ) : null}
      </View>

      {/* Chevron — only shown when the card has a navigation route */}
      {action.route ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  );
}

const useCardStyles = createStyles((theme) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    marginBottom: theme.spacing.tight,
    ...theme.shadows.sm,
  },
  cardPressed: {
    opacity: 0.75,
  },
  urgencyBar: {
    width: 4,
    alignSelf: "stretch",
  },
  cardBody: {
    flex: 1,
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.card,
  },
  title: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    fontWeight: "600",
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  chevron: {
    ...theme.typography.headline,
    color: theme.colors.mutedForeground,
    paddingRight: theme.spacing.element,
  },
}));

export default function HomeScreen() {
  const styles = useStyles();
  const { phase, activeShift, activeTimeEntry, nextShift } = useShiftPhase();
  const { data: profile } = useMyProfile();
  const { data: tasks } = useMyTasks();
  const { data: dayInfo } = useDayInfo();

  // NotificationSheet ref kept for legacy bottom sheet — notifications now also
  // accessible via NotificationBell which navigates to the full screen.
  const notificationSheetRef = useRef<GorhomBottomSheet>(null);
  const settingsSheetRef = useRef<GorhomBottomSheet>(null);

  const relevantShiftDate = activeShift?.shift_date ?? nextShift?.shift_date ?? null;
  const { data: colleagues } = useShiftColleagues(relevantShiftDate, profile?.profile_id ?? null);

  const firstName = profile?.display_name?.split(" ")[0] ?? "";

  // Compute priority action cards from the current shift state.
  // Guardian signals and unread count are not yet wired to live hooks,
  // so we pass empty/zero defaults — the engine is safe with these.
  const actions = prioritizeActions(
    phase,
    toHubShift(activeShift),
    toHubShift(nextShift),
    toHubTasks(tasks ?? []),
    [], // guardianSignals — no hook yet
    0, // unreadCount — no hook yet
    toHubTimeEntry(activeTimeEntry),
  ).slice(0, 8); // Cap at 8 cards per design spec

  const handleMenuPress = useCallback(() => {
    settingsSheetRef.current?.snapToIndex(0);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SyncIndicator />

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* Header: avatar, greeting, quick actions */}
        <HomeHeader
          displayName={profile?.display_name ?? ""}
          avatarUrl={profile?.avatar_url}
          profileId={profile?.profile_id}
          onMenuPress={handleMenuPress}
        />

        {/* Punch button — enters from below with spring */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(500).springify().damping(13)}
          style={styles.punchArea}
        >
          <PunchButton />
        </Animated.View>

        {/* Priority action cards — smart contextual nudges above phase content */}
        {actions.length > 0 && (
          <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.prioritySection}>
            {actions.map((action) => (
              <PriorityCard key={action.id} action={action} />
            ))}
          </Animated.View>
        )}

        {/* Phase-specific content — fades in after punch settles */}
        <Animated.View entering={FadeIn.delay(700).duration(500)} style={styles.content}>
          {phase === "no_shift" && <NoShiftView firstName={firstName} nextShift={nextShift} />}
          {phase === "before_shift" && nextShift && (
            <BeforeShiftView
              shift={nextShift}
              colleagues={colleagues ?? []}
              dayInfo={dayInfo}
              tasks={tasks ?? []}
            />
          )}
          {phase === "during_shift" && activeTimeEntry && (
            <DuringShiftView shift={activeShift} timeEntry={activeTimeEntry} tasks={tasks ?? []} />
          )}
          {phase === "after_shift" && activeTimeEntry && (
            <AfterShiftView shift={activeShift} timeEntry={activeTimeEntry} />
          )}
        </Animated.View>
      </Animated.ScrollView>

      {/* Bottom sheets — mounted outside scroll */}
      <NotificationSheet ref={notificationSheetRef} />
      <SettingsSheet ref={settingsSheetRef} />
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl + 20,
  },
  punchArea: {
    paddingTop: theme.spacing.section,
    paddingBottom: theme.spacing.element,
  },
  prioritySection: {
    paddingHorizontal: theme.spacing.page,
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.section,
  },
  content: {
    flex: 1,
    paddingTop: theme.spacing.element,
  },
}));
