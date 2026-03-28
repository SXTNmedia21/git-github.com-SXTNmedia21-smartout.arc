"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Clock, Camera } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { SessionTask } from "../_hooks/use-session-tasks";

type Props = {
  task: SessionTask;
  onComplete: (taskId: string, evidence: Record<string, unknown>) => void;
  onFlagDeviation: (task: SessionTask) => void;
  compact?: boolean;
};

function statusColor(status: SessionTask["status"]): string {
  switch (status) {
    case "completed":
      return "border-l-green-500";
    case "overdue":
    case "escalated":
      return "border-l-red-500";
    case "in_progress":
      return "border-l-yellow-500";
    case "pending":
    case "available":
      return "border-l-blue-500";
    case "skipped":
      return "border-l-zinc-500";
    default:
      return "border-l-border";
  }
}

function statusBadge(status: SessionTask["status"], t: (key: string) => string) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-500/15 text-[10px] text-green-600 hover:bg-green-500/15">
          {t("hms.task_card.status_completed")}
        </Badge>
      );
    case "overdue":
      return (
        <Badge className="bg-red-500/15 text-[10px] text-red-600 hover:bg-red-500/15">
          {t("hms.task_card.status_overdue")}
        </Badge>
      );
    case "in_progress":
      return (
        <Badge className="bg-yellow-500/15 text-[10px] text-yellow-600 hover:bg-yellow-500/15">
          {t("hms.task_card.status_in_progress")}
        </Badge>
      );
    case "pending":
    case "available":
      return (
        <Badge variant="outline" className="text-[10px]">
          {t("hms.task_card.status_pending")}
        </Badge>
      );
    default:
      return null;
  }
}

export function TaskCard({ task, onComplete, onFlagDeviation, compact = false }: Props) {
  const { t } = useTranslation("dashboard");
  const [expanded, setExpanded] = useState(false);
  const [measuredValue, setMeasuredValue] = useState("");
  const [notes, setNotes] = useState("");
  const isCompleted = task.status === "completed";

  function handleComplete() {
    const evidence: Record<string, unknown> = {};
    if (measuredValue) evidence.measured_value = measuredValue;
    if (notes) evidence.notes = notes;
    onComplete(task.id, evidence);
  }

  return (
    <div
      className={`border-border rounded-lg border border-l-4 transition-all ${statusColor(task.status)} ${
        isCompleted ? "opacity-60" : ""
      }`}
    >
      {/* Collapsed header */}
      <button
        onClick={() => !compact && setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-3 text-left"
        disabled={compact}
      >
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
        ) : (
          <div className="border-muted-foreground h-5 w-5 shrink-0 rounded border-2" />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-semibold ${isCompleted ? "text-muted-foreground line-through" : "text-foreground"}`}
          >
            {task.title}
          </p>
          {!expanded && task.description && (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {task.isComplianceRequired && (
            <Badge variant="destructive" className="text-[9px]">
              {t("hms.task_card.required")}
            </Badge>
          )}
          {statusBadge(task.status, t)}
          {!compact &&
            (expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && !isCompleted && (
        <div className="border-t border-inherit px-3 pt-2 pb-3">
          {task.description && (
            <p className="text-muted-foreground mb-3 text-sm">{task.description}</p>
          )}

          {/* Evidence inputs */}
          <div className="mb-3 space-y-2">
            <Input
              placeholder={t("hms.task_card.measured_value_placeholder")}
              value={measuredValue}
              onChange={(e) => setMeasuredValue(e.target.value)}
              className="text-sm"
            />
            <Textarea
              placeholder={t("hms.task_card.notes_placeholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm"
            />
            <Button variant="outline" size="sm" disabled>
              <Camera className="mr-1.5 h-3.5 w-3.5" />
              {t("hms.task_card.add_photo")}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleComplete}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              {t("hms.task_card.complete")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 hover:text-red-600"
              onClick={() => onFlagDeviation(task)}
            >
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              {t("hms.task_card.deviation")}
            </Button>
          </div>
        </div>
      )}

      {/* Completed evidence summary */}
      {expanded && isCompleted && task.evidence && (
        <div className="border-t border-inherit px-3 pt-2 pb-3">
          <p className="text-muted-foreground text-xs">
            <Clock className="mr-1 inline h-3 w-3" />
            {t("hms.task_card.completed_at")}{" "}
            {task.completedAt
              ? new Date(task.completedAt).toLocaleTimeString("nb-NO", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </p>
          {task.evidence && Object.keys(task.evidence).length > 0 && (
            <pre className="bg-muted text-muted-foreground mt-2 rounded p-2 text-[10px]">
              {JSON.stringify(task.evidence, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
