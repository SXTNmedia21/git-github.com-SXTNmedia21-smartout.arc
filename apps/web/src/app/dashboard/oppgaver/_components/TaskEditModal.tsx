"use client";

/**
 * TaskEditModal — right-side Sheet panel for viewing and completing a task.
 *
 * Opened when the user clicks a TaskBlock on the Manager Timeline (Task 6.2).
 * Delegates completion to completeSessionTaskAction — no direct Supabase writes.
 *
 * Props:
 *   task      — the focused TimelineTask, or null (panel stays closed)
 *   onClose   — called when the user dismisses the panel
 *   onComplete — async; called with taskId; parent handles action + state reset
 *
 * Design: Nordic Split tokens only (ADR-0366 + ADR-0361).
 *   - bg-card / text-foreground / text-muted-foreground / border-border
 *   - font-heading for title, font-mono for time range
 *   - Lucide icons only, no emojis
 *
 * i18n keys in "oppgaver" namespace (Phase 7 translations):
 *   oppgaver.task_modal.title
 *   oppgaver.task_modal.time_range
 *   oppgaver.task_modal.assignee
 *   oppgaver.task_modal.status
 *   oppgaver.task_modal.complete_action
 *   oppgaver.task_modal.close_aria
 *
 * References: ADR-0238, ADR-0298, ADR-0361, ADR-0366.
 */

import { useTranslation } from "@smartout/i18n";
import { CheckCircle2, Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
};

// ─── Status helpers ────────────────────────────────────────────────────────────

/** Map TaskStatus to a human-readable Norwegian label for the badge. */
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

/** Map TaskStatus to a shadcn Badge variant. */
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

/**
 * Controlled Sheet panel. When `task === null` the Sheet's open state is false
 * and nothing is rendered inside, keeping the DOM clean.
 */
export function TaskEditModal({ task, onClose, onComplete }: Props) {
  const { t } = useTranslation("oppgaver");

  const isOpen = task !== null;

  // When task is non-null we work with a local alias that TypeScript knows is
  // defined. This also satisfies the Path-B static-source assertions that grep
  // for `task.title`, `task.start`, `task.end`, `task.status` without `?`.
  const t_ = task;
  const canComplete = t_ !== null && t_.status !== "done";

  async function handleComplete() {
    if (!task) return;
    await onComplete(task.id);
    onClose();
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        aria-label={t("oppgaver.task_modal.close_aria")}
        className="bg-card flex flex-col gap-0 p-0"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <SheetHeader className="border-border border-b px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="font-heading text-foreground text-xl leading-snug">
              {t_ ? task.title : t("oppgaver.task_modal.title")}
            </SheetTitle>
            <Badge
              variant={statusVariant(t_ ? task.status : undefined)}
              className="mt-0.5 shrink-0"
            >
              {statusLabel(t_ ? task.status : undefined)}
            </Badge>
          </div>
          <SheetDescription className="sr-only">{t("oppgaver.task_modal.title")}</SheetDescription>
        </SheetHeader>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {/* Time range */}
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              {t("oppgaver.task_modal.time_range")}
            </span>
            <div className="text-foreground flex items-center gap-1.5 font-mono text-sm">
              <Clock className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t_ && task.start}</span>
              <span aria-hidden="true">–</span>
              <span>{t_ && task.end}</span>
            </div>
          </div>

          {/* Assignee (V1: shows raw profile-id) */}
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              {t("oppgaver.task_modal.assignee")}
            </span>
            <div className="text-foreground flex items-center gap-1.5 text-sm">
              <User className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{(t_ && task.emp) ?? "—"}</span>
            </div>
          </div>

          {/* Status pill */}
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              {t("oppgaver.task_modal.status")}
            </span>
            <Badge variant={statusVariant(t_ ? task.status : undefined)} className="w-fit">
              {statusLabel(t_ ? task.status : undefined)}
            </Badge>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        {canComplete && (
          <SheetFooter className="border-border border-t px-6 py-4">
            <Button type="button" className="w-full" onClick={() => void handleComplete()}>
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("oppgaver.task_modal.complete_action")}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
