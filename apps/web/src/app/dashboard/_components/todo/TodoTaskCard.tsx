"use client";

/**
 * Individual task card within a cascade group.
 * Shows urgency border, icon, title/description, and navigates to the relevant page.
 * Emits telemetry on click for audit trail.
 */

import { useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Clock, Info, ChevronRight } from "lucide-react";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
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

/**
 * Interpolates title/description keys with params.
 * Falls back to the key itself when i18n is not wired up yet.
 */
function interpolate(key: string, params?: Record<string, string>): string {
  if (!params) return key;
  let result = key;
  for (const [k, v] of Object.entries(params)) {
    result = result.replace(`{${k}}`, v);
  }
  return result;
}

export function TodoTaskCard({ task, index }: TodoTaskCardProps) {
  const router = useRouter();
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
    router.push(task.href);
  }, [router, task, wsId, profileId]);

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
      className={`border-border relative flex items-start gap-3 rounded-lg border border-l-4 ${borderClass} bg-card/70 hover:bg-card/80 focus-visible:ring-ring cursor-pointer p-4 backdrop-blur-[8px] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none`}
    >
      {/* Noise overlay for frosted glass */}
      <div
        className="pointer-events-none absolute inset-0 rounded-lg opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />

      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">
          {interpolate(task.title_key, task.title_params)}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {interpolate(task.description_key, task.description_params)}
        </p>
      </div>

      <ChevronRight className="text-brand-orange mt-0.5 h-4 w-4 shrink-0 transition-opacity duration-200 hover:opacity-80" />
    </motion.div>
  );
}
