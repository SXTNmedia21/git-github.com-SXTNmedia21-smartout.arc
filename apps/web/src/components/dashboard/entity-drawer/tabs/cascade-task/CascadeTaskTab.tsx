"use client";

/**
 * Drawer tab showing cascade task context: why it matters, dimension, urgency, and action button.
 * Data comes from the already-fetched useCascadeTasks() — no extra query needed.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Clock, Info, ExternalLink } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useCascadeTasks } from "@/app/dashboard/_hooks/use-cascade-tasks";
import { resolveKey, interpolateParams } from "@/app/dashboard/_components/todo/translate-todo";
import type { CascadeTask, TaskUrgency } from "@smartout/types";
import { useEntityDrawer } from "../../EntityDrawerContext";

const urgencyIcons: Record<TaskUrgency, typeof AlertCircle> = {
  critical: AlertCircle,
  should: Clock,
  can_wait: Info,
};

const urgencyColors: Record<TaskUrgency, string> = {
  critical: "text-destructive",
  should: "text-warning",
  can_wait: "text-muted-foreground",
};

export function CascadeTaskTab({ entityId }: { entityId: string }) {
  const { t } = useTranslation("dashboard");
  const router = useRouter();
  const { closeDrawer } = useEntityDrawer();
  const { data, isLoading, isError, refetch } = useCascadeTasks();

  const task: CascadeTask | undefined = data?.groups
    .flatMap((g) => g.tasks)
    .find((t) => String(t.id) === String(entityId));

  const handleNavigate = useCallback(() => {
    if (!task) return;
    closeDrawer();
    router.push(task.href);
  }, [task, closeDrawer, router]);

  const handleOpenDashboard = useCallback(() => {
    closeDrawer();
    router.push("/dashboard");
  }, [closeDrawer, router]);

  if (isLoading) {
    return (
      <div className="text-muted-foreground/30 flex items-center justify-center py-12 text-sm">
        {t("entity_drawer.task_loading")}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3 p-4">
        <div className="text-muted-foreground bg-card/40 rounded-xl p-3 text-xs">
          {t("entity_drawer.task_load_failed")}
        </div>
        <button
          onClick={() => void refetch()}
          className="border-border text-foreground/80 hover:bg-card/60 flex w-full items-center justify-center gap-2 rounded-[10px] border px-4 py-2.5 text-xs font-semibold transition-colors"
        >
          {t("entity_drawer.task_retry")}
        </button>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-3 p-4">
        <div className="text-muted-foreground bg-card/40 rounded-xl p-3 text-xs">
          {t("entity_drawer.task_not_found")}
        </div>
        <button
          onClick={handleOpenDashboard}
          className="border-border text-foreground/80 hover:bg-card/60 flex w-full items-center justify-center gap-2 rounded-[10px] border px-4 py-2.5 text-xs font-semibold transition-colors"
        >
          {t("entity_drawer.task_open_dashboard")}
        </button>
      </div>
    );
  }

  const Icon = urgencyIcons[task.urgency];
  const iconColor = urgencyColors[task.urgency];

  return (
    <div className="space-y-4 p-4">
      {/* Title + urgency */}
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
        <div>
          <h3 className="text-foreground text-sm font-bold">
            {interpolateParams(t(resolveKey(task.title_key)), task.title_params)}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted-foreground/30 text-[9px] font-bold tracking-wider uppercase">
              {t("entity_drawer.task_urgency")}
            </span>
            <span className={`text-[10px] font-bold ${iconColor}`}>
              {t(`entity_drawer.urgency_${task.urgency}`)}
            </span>
          </div>
        </div>
      </div>

      {/* Description — why it matters */}
      <div className="bg-card/40 rounded-xl p-3">
        <div className="text-muted-foreground/30 mb-1.5 text-[9px] font-bold tracking-wider uppercase">
          {t("entity_drawer.task_why")}
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {interpolateParams(t(resolveKey(task.description_key)), task.description_params)}
        </p>
      </div>

      {/* Dimension badge */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground/30 text-[9px] font-bold tracking-wider uppercase">
          {t("entity_drawer.task_dimension")}
        </span>
        <span className="text-muted-foreground bg-card/60 rounded-md px-2 py-0.5 font-mono text-[11px]">
          {task.dimension}
        </span>
      </div>

      {/* Action button */}
      <button
        onClick={handleNavigate}
        className="bg-brand-orange flex w-full items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-xs font-semibold text-white shadow-[0_2px_8px_oklch(0.65_0.22_40/0.25)] transition-all hover:brightness-110"
      >
        {t("entity_drawer.task_go_to")}
        <ExternalLink className="h-3 w-3" />
      </button>
    </div>
  );
}
