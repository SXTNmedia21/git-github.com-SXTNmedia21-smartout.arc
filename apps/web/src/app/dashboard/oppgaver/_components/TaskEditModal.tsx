"use client";

/**
 * TaskEditModal — right-side Sheet panel for viewing, completing, and re-timing a task.
 *
 * Opened when the user clicks a TaskBlock on the Manager Timeline (Task 6.2).
 * Wave 1 Phase A.5: adds `editMode` prop — when true the panel renders
 * scheduled_at + assignee_profile_id form fields (keyboard a11y fallback for
 * drag-and-drop per Deliverable 5). The edit form delegates to
 * updateTaskScheduledAtAction — same write-path as DnD.
 *
 * Props:
 *   task       — the focused TimelineTask, or null (panel stays closed)
 *   onClose    — called when the user dismisses the panel
 *   onComplete — async; called with taskId; parent handles action + state reset
 *   editMode   — (optional) when true, show re-timing form instead of
 *                view-only panel. Default: false.
 *   onTaskUpdated — called after a successful updateTaskScheduledAtAction
 *                   so the parent can refresh data.
 *
 * Design: Nordic Split tokens only (ADR-0366 + ADR-0361).
 *
 * i18n keys in "oppgaver" namespace:
 *   oppgaver.task_modal.title
 *   oppgaver.task_modal.time_range
 *   oppgaver.task_modal.assignee
 *   oppgaver.task_modal.status
 *   oppgaver.task_modal.complete_action
 *   oppgaver.task_modal.close_aria
 *   oppgaver.task_modal.edit_time_label
 *   oppgaver.task_modal.edit_assignee_label
 *   oppgaver.task_modal.save_action
 *
 * References: ADR-0238, ADR-0298, ADR-0361, ADR-0366.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "@smartout/i18n";
import { CheckCircle2, Clock, User, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { updateTaskScheduledAtAction } from "@/app/dashboard/_actions/update-task-scheduled-at";
import type { TimelineTask, TaskStatus } from "../_chart/TaskBlock";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  /** The focused task. When null the Sheet is closed (controlled). */
  task: TimelineTask | null;
  /** Dismiss handler — parent sets task back to null. */
  onClose: () => void;
  /**
   * Called when the user confirms completion.
   * Parent is responsible for triggering completeSessionTaskAction and
   * clearing selectedTask after the action settles.
   */
  onComplete: (taskId: string) => Promise<void> | void;
  /**
   * When true, renders the re-timing edit form instead of view-only.
   * Keyboard accessibility fallback for DnD (Wave 1 Phase A.5).
   */
  editMode?: boolean;
  /** Called after a successful edit save — parent should refresh data. */
  onTaskUpdated?: () => void;
  /**
   * ISO date string (YYYY-MM-DD) of the day currently visible in the timeline.
   * Used to build the correct scheduled_at ISO when saving — avoids defaulting
   * to today when the manager is viewing a past or future day (MEDIUM-1).
   */
  dateISO: string;
};

// ─── Status helpers ────────────────────────────────────────────────────────────

function statusLabel(status: TaskStatus | undefined): string {
  switch (status) {
    case "done":
      return "Ferdig";
    case "in_progress":
      return "Pågår";
    case "missed":
      return "Avvik";
    case "upcoming":
    default:
      return "Kommende";
  }
}

function statusVariant(
  status: TaskStatus | undefined,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "done":
      return "secondary";
    case "missed":
      return "destructive";
    case "in_progress":
      return "default";
    case "upcoming":
    default:
      return "outline";
  }
}

// ─── TaskEditModal ─────────────────────────────────────────────────────────────

export function TaskEditModal({
  task,
  onClose,
  onComplete,
  editMode = false,
  onTaskUpdated,
  dateISO,
}: Props) {
  const { t } = useTranslation("oppgaver");

  const isOpen = task !== null;
  const t_ = task;
  const canComplete = t_ !== null && t_.status !== "done";

  // Edit form state — initialised from task.start so the field is pre-filled
  // on open (HIGH-1: unconditional "" caused blank field + disabled Save).
  const [editTime, setEditTime] = useState<string>(() => task?.start ?? "");
  const [editAssignee, setEditAssignee] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Sync editTime when task changes while the modal stays mounted (e.g. the
  // user navigates to a different task without closing the Sheet).
  useEffect(() => {
    if (task && editMode) setEditTime(task.start);
  }, [task, editMode]);

  async function handleComplete() {
    if (!task) return;
    await onComplete(task.id);
    onClose();
  }

  async function handleSaveEdit() {
    if (!task || !editTime) return;
    setSaving(true);
    try {
      // editTime is HH:MM from the <input type="time">. Combine with the
      // timeline's dateISO (MEDIUM-1: was new Date() → wrong day on past/future
      // views). Use local setHours so the resulting ISO reflects Norwegian wall
      // clock, not UTC (HIGH-2: plain string interpolation stored UTC Z offsets
      // causing a ±2 h display shift). Matches useDragRetiming.ts baseDate.setHours
      // pattern.
      const [hh, mm] = editTime.split(":").map(Number);
      const d = new Date(dateISO + "T00:00:00");
      d.setHours(hh!, mm!, 0, 0);
      const isoScheduledAt = d.toISOString();

      const res = await updateTaskScheduledAtAction({
        task_id: task.id,
        scheduled_at: isoScheduledAt,
        assignee_profile_id: editAssignee.trim() || null,
        fromIso: null,
        fromAssignee: task.emp ?? null,
      });

      if (!res.ok) {
        toast.error(res.reason ?? "Kunne ikke oppdatere oppgaven.");
        return;
      }

      toast.success("Oppgaven er oppdatert.");
      onTaskUpdated?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        aria-label={t("task_modal.close_aria")}
        className="bg-card flex flex-col gap-0 p-0"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <SheetHeader className="border-border border-b px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="font-heading text-foreground text-xl leading-snug">
              {t_ ? task.title : t("task_modal.title")}
            </SheetTitle>
            <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
              {editMode && (
                <Pencil
                  className="text-muted-foreground h-3.5 w-3.5"
                  aria-label="Redigeringsmodus"
                />
              )}
              <Badge variant={statusVariant(t_ ? task.status : undefined)}>
                {statusLabel(t_ ? task.status : undefined)}
              </Badge>
            </div>
          </div>
          <SheetDescription className="sr-only">{t("task_modal.title")}</SheetDescription>
        </SheetHeader>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {editMode ? (
            /* Re-timing form — keyboard a11y fallback (Deliverable 5) */
            <>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="edit-time"
                  className="text-muted-foreground text-xs tracking-wide uppercase"
                >
                  {t("task_modal.edit_time_label")}
                </Label>
                <div className="flex items-center gap-2">
                  <Clock
                    className="text-muted-foreground h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <Input
                    id="edit-time"
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="h-8 font-mono text-sm"
                    aria-describedby="edit-time-hint"
                  />
                </div>
                <span id="edit-time-hint" className="text-muted-foreground text-xs">
                  Oppgavens starttidspunkt
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="edit-assignee"
                  className="text-muted-foreground text-xs tracking-wide uppercase"
                >
                  {t("task_modal.edit_assignee_label")}
                </Label>
                <div className="flex items-center gap-2">
                  <User className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <Input
                    id="edit-assignee"
                    type="text"
                    placeholder="Profil-UUID (valgfritt)"
                    value={editAssignee}
                    onChange={(e) => setEditAssignee(e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>
            </>
          ) : (
            /* View-only mode */
            <>
              {/* Time range */}
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs tracking-wide uppercase">
                  {t("task_modal.time_range")}
                </span>
                <div className="text-foreground flex items-center gap-1.5 font-mono text-sm">
                  <Clock
                    className="text-muted-foreground h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{t_ && task.start}</span>
                  <span aria-hidden="true">–</span>
                  <span>{t_ && task.end}</span>
                </div>
              </div>

              {/* Assignee */}
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs tracking-wide uppercase">
                  {t("task_modal.assignee")}
                </span>
                <div className="text-foreground flex items-center gap-1.5 text-sm">
                  <User className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{(t_ && task.emp) ?? "—"}</span>
                </div>
              </div>

              {/* Status pill */}
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs tracking-wide uppercase">
                  {t("task_modal.status")}
                </span>
                <Badge variant={statusVariant(t_ ? task.status : undefined)} className="w-fit">
                  {statusLabel(t_ ? task.status : undefined)}
                </Badge>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <SheetFooter className="border-border border-t px-6 py-4">
          {editMode ? (
            <Button
              type="button"
              className="w-full"
              disabled={saving || !editTime}
              onClick={() => void handleSaveEdit()}
            >
              {t("task_modal.save_action")}
            </Button>
          ) : (
            canComplete && (
              <Button type="button" className="w-full" onClick={() => void handleComplete()}>
                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("task_modal.complete_action")}
              </Button>
            )
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
