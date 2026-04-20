"use client";

/**
 * Drawer tab showing cascade task context: why it matters, dimension, urgency, and action button.
 * Data comes from the already-fetched useCascadeTasks() — no extra query needed.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Clock, Info, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@smartout/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCascadeTasks } from "@/app/dashboard/_hooks/use-cascade-tasks";
import { resolveKey, interpolateParams } from "@/app/dashboard/_components/todo/translate-todo";
import type { CascadeTask, TaskUrgency } from "@smartout/types";
import { useEntityDrawer } from "../../EntityDrawerContext";

const urgencyConfig: Record<
  TaskUrgency,
  {
    Icon: typeof AlertCircle;
    iconClass: string;
    badgeVariant: "destructive" | "outline" | "secondary";
    glowClass: string;
    borderClass: string;
  }
> = {
  critical: {
    Icon: AlertCircle,
    iconClass: "text-destructive",
    badgeVariant: "destructive",
    glowClass: "shadow-[0_0_12px_oklch(0.65_0.25_25/0.15)]",
    borderClass: "border-l-destructive",
  },
  should: {
    Icon: Clock,
    iconClass: "text-warning",
    badgeVariant: "outline",
    glowClass: "",
    borderClass: "border-l-warning",
  },
  can_wait: {
    Icon: Info,
    iconClass: "text-muted-foreground",
    badgeVariant: "secondary",
    glowClass: "",
    borderClass: "border-l-border",
  },
};

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.35,
      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
    },
  }),
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
      <div className="flex items-center justify-center py-16">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3 p-5">
        <p className="text-muted-foreground text-sm">{t("entity_drawer.task_load_failed")}</p>
        <Button variant="outline" size="sm" className="w-full" onClick={() => void refetch()}>
          {t("entity_drawer.task_retry")}
        </Button>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-3 p-5">
        <p className="text-muted-foreground text-sm">{t("entity_drawer.task_not_found")}</p>
        <Button variant="outline" size="sm" className="w-full" onClick={handleOpenDashboard}>
          {t("entity_drawer.task_open_dashboard")}
        </Button>
      </div>
    );
  }

  const { Icon, iconClass, badgeVariant, glowClass, borderClass } = urgencyConfig[task.urgency];

  return (
    <div className="space-y-5 p-5">
      {/* Header — icon, title, urgency badge */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        custom={0}
        className={`flex items-start gap-3 rounded-xl border-l-[3px] py-1 pl-3 ${borderClass} ${glowClass}`}
      >
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="text-foreground text-sm leading-snug font-semibold">
            {interpolateParams(t(resolveKey(task.title_key)), task.title_params)}
          </h3>
          <Badge variant={badgeVariant} className="text-[10px] tracking-wide uppercase">
            {t(`entity_drawer.urgency_${task.urgency}`)}
          </Badge>
        </div>
      </motion.div>

      {/* Description card */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        custom={1}
        className="bg-card/60 border-border/40 rounded-xl border p-4 backdrop-blur-sm"
      >
        <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          {t("entity_drawer.task_why")}
        </p>
        <p className="text-foreground/80 mt-2 text-sm leading-relaxed">
          {interpolateParams(t(resolveKey(task.description_key)), task.description_params)}
        </p>
      </motion.div>

      {/* Dimension badge */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        custom={2}
        className="flex items-center gap-2.5"
      >
        <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          {t("entity_drawer.task_dimension")}
        </span>
        <span className="bg-muted text-foreground rounded-md px-2.5 py-1 font-mono text-xs font-semibold">
          {task.dimension}
        </span>
      </motion.div>

      {/* Action button */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" custom={3}>
        <Button
          onClick={handleNavigate}
          className="bg-brand-orange hover:bg-brand-orange/90 w-full gap-2 text-white"
          size="default"
        >
          {t("entity_drawer.task_go_to")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}
