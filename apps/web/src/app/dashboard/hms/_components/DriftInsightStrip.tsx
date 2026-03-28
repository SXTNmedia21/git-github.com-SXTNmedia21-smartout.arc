"use client";

import { useTranslation } from "@smartout/i18n";
import {
  CalendarCheck,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";
import { useDriftInsights } from "../_hooks/use-drift-insights";

type MetricCellProps = {
  icon: typeof CalendarCheck;
  label: string;
  value: string | number;
  sublabel?: string;
  variant?: "default" | "warning" | "critical";
};

function MetricCell({
  icon: Icon,
  label,
  value,
  sublabel,
  variant = "default",
}: MetricCellProps) {
  const variantStyles = {
    default: "border-border",
    warning: "border-yellow-500/40",
    critical: "border-destructive/40",
  };

  const valueStyles = {
    default: "text-foreground",
    warning: "text-yellow-500",
    critical: "text-destructive",
  };

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-3 border-r px-4 py-3 last:border-r-0 ${variantStyles[variant]}`}
    >
      <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="text-muted-foreground h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
          {label}
        </p>
        <p className={`text-lg font-bold leading-tight ${valueStyles[variant]}`}>
          {value}
        </p>
        {sublabel && (
          <p className="text-muted-foreground truncate text-[10px]">
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}

type DriftInsightStripProps = {
  date: string;
};

export function DriftInsightStrip({ date }: DriftInsightStripProps) {
  const { insights, isLoading } = useDriftInsights(date);
  const { t } = useTranslation("dashboard");

  if (isLoading) {
    return (
      <div className="border-border bg-card/50 flex items-center justify-center rounded-xl border py-4">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (insights.totalSessions === 0) {
    return null;
  }

  const sessionSublabel =
    insights.activeSessions > 0
      ? t("hms.drift_insights.sessions_active", {
          count: insights.activeSessions,
        })
      : insights.closedSessions === insights.totalSessions
        ? t("hms.drift_insights.sessions_all_closed")
        : t("hms.drift_insights.sessions_closed", {
            count: insights.closedSessions,
          });

  const sessionVariant =
    insights.missedSessions > 0 ? "critical" : "default";

  const taskVariant =
    insights.taskCompletionPercent < 50
      ? "critical"
      : insights.taskCompletionPercent < 80
        ? "warning"
        : "default";

  const deviationVariant =
    insights.blockingDeviations > 0
      ? "critical"
      : insights.openDeviations > 0
        ? "warning"
        : "default";

  const deviationSublabel =
    insights.blockingDeviations > 0
      ? t("hms.drift_insights.deviations_blocking", {
          count: insights.blockingDeviations,
        })
      : undefined;

  const overdueVariant =
    insights.overdueTasks > 0 ? "warning" : "default";

  return (
    <div className="border-border bg-card/50 flex rounded-xl border">
      <MetricCell
        icon={CalendarCheck}
        label={t("hms.drift_insights.sessions_label")}
        value={`${insights.closedSessions}/${insights.totalSessions}`}
        sublabel={sessionSublabel}
        variant={sessionVariant}
      />
      <MetricCell
        icon={ClipboardCheck}
        label={t("hms.drift_insights.tasks_label")}
        value={`${insights.taskCompletionPercent}%`}
        sublabel={t("hms.drift_insights.tasks_sublabel", {
          completed: insights.completedTasks,
          total: insights.totalTasks,
        })}
        variant={taskVariant}
      />
      <MetricCell
        icon={AlertTriangle}
        label={t("hms.drift_insights.deviations_label")}
        value={
          insights.openDeviations > 0
            ? insights.openDeviations
            : t("hms.drift_insights.deviations_none")
        }
        sublabel={deviationSublabel}
        variant={deviationVariant}
      />
      <MetricCell
        icon={Clock}
        label={t("hms.drift_insights.overdue_label")}
        value={
          insights.overdueTasks > 0
            ? insights.overdueTasks
            : t("hms.drift_insights.overdue_none")
        }
        variant={overdueVariant}
      />
    </div>
  );
}
