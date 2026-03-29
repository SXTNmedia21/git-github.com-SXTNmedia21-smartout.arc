/**
 * DuringShiftView — "På vakt" home content when clocked in.
 *
 * Nordic Split layout:
 * 1. "På vakt" hero with live timer
 * 2. Live earnings card
 * 3. Real-time update (glassmorphism notification)
 * 4. Task list with priority glow borders
 * 5. Quick actions 2x2 grid
 */

import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  Banknote,
  UtensilsCrossed,
  Phone,
  MessageCircle,
  AlertTriangle,
  Coffee,
  ChevronRight,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import type { Database } from "@smartout/supabase/database.types";
import type { TimeEntry } from "@/types/time-entry";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];
type SessionTask = Database["public"]["Tables"]["session_task"]["Row"];

type DuringShiftViewProps = {
  shift: ScheduleShift | null;
  timeEntry: TimeEntry;
  tasks?: SessionTask[];
  onPunchOut?: () => void;
  punchingOut?: boolean;
  leaderPhone?: string | null;
};

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

function sortTasksByPriority(tasks: SessionTask[]): SessionTask[] {
  return [...tasks].sort((a, b) => {
    if (a.is_compliance_required !== b.is_compliance_required)
      return a.is_compliance_required ? -1 : 1;
    const order: Record<string, number> = { overdue: 0, pending: 1, available: 2, in_progress: 3 };
    return (order[a.status] ?? 99) - (order[b.status] ?? 99);
  });
}

export function DuringShiftView({ timeEntry, tasks = [], leaderPhone }: DuringShiftViewProps) {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();

  const [timer, setTimer] = useState(() => formatTimer(timeEntry.punch_in));
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    timerRef.current = setInterval(() => setTimer(formatTimer(timeEntry.punch_in)), 1000);
    return () => clearInterval(timerRef.current);
  }, [timeEntry.punch_in]);

  const activeTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "skipped");
  const sortedTasks = sortTasksByPriority(activeTasks);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <Animated.View entering={FadeIn.delay(50).duration(400)} style={styles.hero}>
        <View style={styles.heroRow}>
          <Text style={styles.heroTitle}>På vakt</Text>
          <View style={styles.timerCol}>
            <Text style={styles.timerLabel}>LIVE SHIFT TIME</Text>
            <Text style={styles.timerValue}>{timer}</Text>
          </View>
        </View>
        <View style={styles.heroLine} />
      </Animated.View>

      {/* Live earnings */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(400).springify()}
        style={styles.earningsCard}
      >
        <View style={styles.earningsLeft}>
          <Banknote size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
          <Text style={styles.earningsLabel}>Live earnings</Text>
        </View>
        <Text style={styles.earningsValue}>~ kr 1,240 earned so far</Text>
      </Animated.View>

      {/* Real-time notification */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(400).springify()}
        style={styles.liveCard}
      >
        <View style={styles.livePulse}>
          <View style={styles.livePulseInner} />
        </View>
        <View style={styles.liveContent}>
          <Text style={styles.liveLabel}>NÅ SKJER DET</Text>
          <View style={styles.liveRow}>
            <UtensilsCrossed size={28} color={theme.colors.brandOrange} strokeWidth={1.3} />
            <Text style={styles.liveText}>
              VIP Dinner arriving in <Text style={styles.liveAccent}>15 min</Text>
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Tasks */}
      {sortedTasks.length > 0 && (
        <View style={styles.taskSection}>
          <View style={styles.taskHeader}>
            <Text style={styles.sectionTitle}>Dine oppgaver ({activeTasks.length})</Text>
            <View style={styles.priorityTag}>
              <Text style={styles.priorityTagText}>Priority View</Text>
            </View>
          </View>
          {sortedTasks.map((task, i) => {
            const isCritical = task.is_compliance_required || task.status === "overdue";
            const isNormal = task.status === "pending" || task.status === "in_progress";
            return (
              <Animated.View
                key={task.id}
                entering={FadeInDown.delay(300 + i * 60)
                  .duration(400)
                  .springify()}
              >
                <Pressable
                  onPress={() => Haptics.selectionAsync()}
                  style={({ pressed }) => [
                    styles.taskRow,
                    isCritical && styles.taskRowCritical,
                    isNormal && !isCritical && styles.taskRowNormal,
                    pressed && styles.taskRowPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.taskBar,
                      {
                        backgroundColor: isCritical
                          ? theme.colors.destructive
                          : isNormal
                            ? theme.colors.brandOrange
                            : theme.colors.mutedForeground,
                      },
                      !isCritical && !isNormal && { opacity: 0.4 },
                    ]}
                  />
                  <View style={styles.taskContent}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={[styles.taskMeta, isCritical && styles.taskMetaCritical]}>
                      {isCritical
                        ? "CRITICAL · PAST DUE"
                        : isNormal
                          ? "NORMAL · IN PROGRESS"
                          : "ROUTINE · UP NEXT"}
                    </Text>
                  </View>
                  <ChevronRight
                    size={18}
                    color={withOpacity(theme.colors.mutedForeground, 0.3)}
                    strokeWidth={1.5}
                  />
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Quick Actions */}
      <Animated.View
        entering={FadeInDown.delay(500).duration(400).springify()}
        style={styles.actionsSection}
      >
        <Text style={styles.sectionTitle}>Raske handlinger</Text>
        <View style={styles.actionsGrid}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (leaderPhone) Linking.openURL(`tel:${leaderPhone}`);
            }}
            style={({ pressed }) => [
              styles.actionCard,
              styles.actionCardPrimary,
              pressed && styles.actionPressed,
            ]}
          >
            <Phone size={24} color="#ffffff" strokeWidth={1.5} />
            <Text style={styles.actionLabelPrimary}>Ring leder</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/(app)/(chat)");
            }}
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
          >
            <MessageCircle size={24} color={theme.colors.brandOrange} strokeWidth={1.5} />
            <Text style={styles.actionLabel}>Åpne chat</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/(app)/(home)/deviation");
            }}
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
          >
            <AlertTriangle size={24} color={theme.colors.destructive} strokeWidth={1.5} />
            <Text style={styles.actionLabel}>Rapporter avvik</Text>
          </Pressable>
          <Pressable
            onPress={() => Haptics.selectionAsync()}
            style={({ pressed }) => [
              styles.actionCard,
              styles.actionCardMuted,
              pressed && styles.actionPressed,
            ]}
          >
            <Coffee size={24} color={theme.colors.mutedForeground} strokeWidth={1.5} />
            <Text style={styles.actionLabelMuted}>Ta pause</Text>
          </Pressable>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1 },
  content: {
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.xl + 40,
  },

  hero: { gap: 8, marginBottom: theme.spacing.page },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  heroTitle: { fontSize: 40, fontWeight: "300", letterSpacing: -1, color: theme.colors.foreground },
  timerCol: { alignItems: "flex-end" },
  timerLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    color: withOpacity(theme.colors.mutedForeground, 0.4),
  },
  timerValue: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -1,
    color: theme.colors.brandOrange,
  },
  heroLine: { width: 48, height: 2, borderRadius: 1, backgroundColor: theme.colors.brandOrange },

  earningsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.05),
    marginBottom: theme.spacing.section,
  },
  earningsLeft: { flexDirection: "row", alignItems: "center", gap: theme.spacing.element },
  earningsLabel: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
  },
  earningsValue: {
    ...theme.typography.body,
    fontWeight: "600",
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },

  liveCard: {
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.card, 0.4)
      : withOpacity(theme.colors.muted, 0.4),
    borderRadius: theme.radius.lg,
    padding: theme.spacing.page,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    marginBottom: theme.spacing.page,
    position: "relative",
    overflow: "hidden",
  },
  livePulse: { position: "absolute", top: 16, right: 16 },
  livePulseInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.brandOrange,
  },
  liveContent: { gap: theme.spacing.md },
  liveLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  liveRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  liveText: { ...theme.typography.title, color: theme.colors.foreground, flex: 1, lineHeight: 30 },
  liveAccent: { fontStyle: "italic", color: theme.colors.brandOrange },

  taskSection: { marginBottom: theme.spacing.page, gap: theme.spacing.element },
  taskHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { ...theme.typography.title, color: theme.colors.foreground, paddingHorizontal: 4 },
  priorityTag: {
    backgroundColor: withOpacity(theme.colors.muted, 0.5),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  priorityTagText: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.5,
    color: theme.colors.mutedForeground,
  },

  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.card,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.background,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.element,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
  },
  taskRowCritical: { borderColor: withOpacity(theme.colors.destructive, 0.15) },
  taskRowNormal: { borderColor: withOpacity(theme.colors.brandOrange, 0.15) },
  taskRowPressed: { opacity: 0.85 },
  taskBar: { width: 3, height: 32, borderRadius: 2, marginRight: theme.spacing.md },
  taskContent: { flex: 1, gap: 2 },
  taskTitle: { ...theme.typography.body, fontWeight: "500", color: theme.colors.foreground },
  taskMeta: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
  },
  taskMetaCritical: { color: theme.colors.destructive },

  actionsSection: { gap: theme.spacing.md },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.element },
  actionCard: {
    width: "48%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: theme.spacing.section,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.background,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
    ...theme.shadows.sm,
  },
  actionCardPrimary: { backgroundColor: theme.colors.brandOrange, borderColor: "transparent" },
  actionCardMuted: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.3) : theme.colors.muted,
  },
  actionPressed: { transform: [{ scale: 0.95 }] },
  actionLabel: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
  actionLabelPrimary: { ...theme.typography.subheadline, fontWeight: "500", color: "#ffffff" },
  actionLabelMuted: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
  },
}));
