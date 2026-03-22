/**
 * ContentTaskList — List of recurring content tasks for an approved spokesperson.
 * Each task shows its type, frequency, deadline, and current status.
 * Tapping a task opens ContentCreator for submission.
 */
import React, { useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import * as Haptics from "expo-haptics";
import { Camera, PenLine, MessageSquareQuote, Wrench, ChevronRight } from "lucide-react-native";
import { EmptyState } from "@/components/ui";
import { createStyles, useTheme } from "@/theme";
import { ContentCreator } from "./ContentCreator";

// ─── Types ────────────────────────────────────────────────────────

export type ContentTaskStatus = "upcoming" | "overdue" | "completed";

export type ContentTaskItem = {
  /** Unique key for this task instance */
  id: string;
  type: "upload_photo" | "write_post" | "update_quote" | "custom";
  frequency: "weekly" | "biweekly" | "monthly";
  deadlineDay: number;
  instructions: string;
  /** ISO date string for the current deadline */
  dueDate: string;
  status: ContentTaskStatus;
};

type ContentTaskListProps = {
  tasks: ContentTaskItem[];
  spokespersonId: string;
  onTaskSubmitted?: (taskId: string) => void;
};

// ─── Labels & Icons ───────────────────────────────────────────────

const TASK_LABELS: Record<ContentTaskItem["type"], string> = {
  upload_photo: "Last opp bilde",
  write_post: "Skriv innlegg",
  update_quote: "Oppdater sitat",
  custom: "Egendefinert",
};

const FREQUENCY_LABELS: Record<ContentTaskItem["frequency"], string> = {
  weekly: "Ukentlig",
  biweekly: "Annenhver uke",
  monthly: "Månedlig",
};

function TaskIcon({ type, color }: { type: ContentTaskItem["type"]; color: string }) {
  const size = 18;
  const strokeWidth = 2;
  switch (type) {
    case "upload_photo":
      return <Camera size={size} color={color} strokeWidth={strokeWidth} />;
    case "write_post":
      return <PenLine size={size} color={color} strokeWidth={strokeWidth} />;
    case "update_quote":
      return <MessageSquareQuote size={size} color={color} strokeWidth={strokeWidth} />;
    case "custom":
      return <Wrench size={size} color={color} strokeWidth={strokeWidth} />;
  }
}

// ─── Status configuration ─────────────────────────────────────────

const STATUS_CONFIG: Record<
  ContentTaskStatus,
  { label: string; bg: string; border: string; text: string }
> = {
  overdue: {
    label: "Forfalt",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.25)",
    text: "#ef4444",
  },
  upcoming: {
    label: "Kommende",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
    text: "#f59e0b",
  },
  completed: {
    label: "Levert",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.25)",
    text: "#22c55e",
  },
};

// ─── Component ────────────────────────────────────────────────────

export function ContentTaskList({ tasks, spokespersonId, onTaskSubmitted }: ContentTaskListProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [activeTask, setActiveTask] = useState<ContentTaskItem | null>(null);

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="Ingen oppgaver"
        subtitle="Ingen innholdsoppgaver er konfigurert for din talsperson-rolle."
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            onPress={() => {
              if (item.status !== "completed") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTask(item);
              }
            }}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />

      {activeTask && (
        <ContentCreator
          task={activeTask}
          spokespersonId={spokespersonId}
          onSubmitted={() => {
            onTaskSubmitted?.(activeTask.id);
            setActiveTask(null);
          }}
          onDismiss={() => setActiveTask(null)}
        />
      )}
    </View>
  );
}

// ─── Task row ─────────────────────────────────────────────────────

function TaskRow({ task, onPress }: { task: ContentTaskItem; onPress: () => void }) {
  const styles = useStyles();
  // Theme available via useTheme() if needed
  const config = STATUS_CONFIG[task.status];

  const dueDate = new Date(task.dueDate).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
  });

  const iconColor =
    task.status === "overdue"
      ? "#ef4444"
      : task.status === "completed"
        ? "#22c55e"
        : theme.colors.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      disabled={task.status === "completed"}
      style={({ pressed }) => [
        styles.row,
        pressed && task.status !== "completed" && styles.rowPressed,
        task.status === "completed" && styles.rowCompleted,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${TASK_LABELS[task.type]}, ${config.label}`}
    >
      <View style={styles.rowLeft}>
        <TaskIcon type={task.type} color={iconColor} />
      </View>

      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{TASK_LABELS[task.type]}</Text>
        <Text style={styles.rowMeta}>
          {FREQUENCY_LABELS[task.frequency]} · Frist {dueDate}
        </Text>
        {task.instructions ? (
          <Text style={styles.rowInstructions} numberOfLines={2}>
            {task.instructions}
          </Text>
        ) : null}
      </View>

      <View style={styles.rowRight}>
        {/* Status badge */}
        <View
          style={[styles.statusBadge, { backgroundColor: config.bg, borderColor: config.border }]}
        >
          <Text style={[styles.statusLabel, { color: config.text }]}>{config.label}</Text>
        </View>

        {task.status !== "completed" && (
          <ChevronRight size={16} color={theme.colors.mutedForeground} strokeWidth={2} />
        )}
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
  },
  list: {
    gap: theme.spacing.tight,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.element,
    gap: theme.spacing.element,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  rowCompleted: {
    opacity: 0.6,
  },
  rowLeft: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  rowMeta: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  rowInstructions: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontStyle: "italic",
    marginTop: 2,
  },
  rowRight: {
    alignItems: "flex-end",
    gap: theme.spacing.tight,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.tight,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  statusLabel: {
    ...theme.typography.micro,
    fontWeight: theme.fontWeights.semibold,
  },
}));
