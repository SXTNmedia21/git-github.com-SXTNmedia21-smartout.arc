"use client";

/**
 * Compact task row within a cascade group.
 * Opens the entity drawer on click instead of navigating.
 * Emits telemetry on click for audit trail.
 */

import { useCallback, useContext } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Clock, Info, ChevronRight } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useEntityDrawer } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import { resolveKey, interpolateParams } from "./translate-todo";
import type { CascadeTask, TaskUrgency } from "@smartout/types";

type TodoTaskCardProps = {
  task: CascadeTask;
  index: number;
};

const urgencyConfig: Record<
  TaskUrgency,
  { borderClass: string; Icon: typeof AlertCircle; iconClass: string }
> = {
  critical: {
    borderClass: "border-l-destructive",
    Icon: AlertCircle,
    iconClass: "text-destructive",
  },
  should: {
    borderClass: "border-l-warning",
    Icon: Clock,
    iconClass: "text-warning",
  },
  can_wait: {
    borderClass: "border-l-border",
    Icon: Info,
    iconClass: "text-muted-foreground",
  },
};

/** Per-card entrance stagger: 40ms delay, fadeInUp, 500ms */
const cardVariants = {
  initial: { opacity: 0, y: 12 },
  animate: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.04,
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
    },
  }),
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.25 },
  },
};

export function TodoTaskCard({ task, index }: TodoTaskCardProps) {
  const { t } = useTranslation("dashboard");
  const { openDrawer } = useEntityDrawer();
  const { profileId } = useContext(DashboardContext);
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id ?? null;
  const { borderClass, Icon, iconClass } = urgencyConfig[task.urgency];

  const handleClick = useCallback(() => {
    void emit({
      event: "task_surface clicked",
      workspace_id: wsId,
      actor_id: profileId ?? "",
      properties: {
        entity: { entity_type: "task_surface", entity_id: task.id },
        data: {
          group: task.group,
          dimension: task.dimension,
          urgency: task.urgency,
        },
      },
    });
    void emit({
      event: "entity_drawer opened",
      workspace_id: wsId,
      actor_id: profileId ?? "",
      properties: {
        data: { entity_type: "cascade_task", entity_id: task.id, source: "todo_list" },
      },
    });
    openDrawer("cascade_task", task.id);
  }, [openDrawer, task, wsId, profileId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <motion.div
      layout
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      custom={index}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`flex cursor-pointer items-center gap-2.5 rounded-[10px] border-l-[3px] px-3 py-2 transition-all duration-200 hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${borderClass} bg-transparent hover:bg-card/40`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} />
      <span className="text-foreground min-w-0 flex-1 truncate text-xs font-medium">
        {interpolateParams(t(resolveKey(task.title_key)), task.title_params)}
      </span>
      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
        task.urgency === "critical"
          ? "bg-destructive/10 text-destructive"
          : task.urgency === "should"
            ? "bg-warning/10 text-warning"
            : "bg-muted text-muted-foreground"
      }`}>
        {t(`entity_drawer.urgency_${task.urgency}`)}
      </span>
      <span className="sr-only">
        {task.urgency === "critical" ? "High urgency" : task.urgency === "should" ? "Medium urgency" : "Low urgency"}
      </span>
      <ChevronRight className="text-muted-foreground h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.div>
  );
}
