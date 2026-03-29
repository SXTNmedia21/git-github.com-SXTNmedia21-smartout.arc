"use client";

// DashboardMetricStrip — 56px compact top bar showing mode toggle, metric pills,
// and last-updated timestamp. Pills crossfade between operative and preparatory
// sets when the dashboard mode switches.

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  CheckSquare,
  FileText,
  GraduationCap,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import type { CockpitSeverityTone } from "../cockpit/severity-styles";
import { DashboardModeToggle } from "./DashboardModeToggle";
import { MetricPill } from "./MetricPill";

type DashboardMetricStripProps = {
  mode: "operative" | "preparatory";
  override: "operative" | "preparatory" | "auto";
  autoMode: "operative" | "preparatory";
  onOverrideChange: (mode: "operative" | "preparatory" | "auto") => void;
  isLoading: boolean;
  lastUpdatedAt: string | null;

  /* Operative counters */
  onDutyCount: number;
  lateCount: number;
  deviationCount: number;
  tasksDueCount: number;

  /* Preparatory counters */
  gaps7d: number;
  unsignedContracts: number;
  expiringTraining: number;
  budgetVariance: string;
};

// Crossfade transition — 200ms dissolve between pill sets
const CROSSFADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

/**
 * Derives a severity tone from a counter value.
 * Zero = neutral, otherwise uses the provided non-zero tone.
 */
function toneForCount(
  value: number | string,
  nonZeroTone: CockpitSeverityTone,
): CockpitSeverityTone {
  if (value === 0 || value === "0%") return "neutral";
  return nonZeroTone;
}

/**
 * Formats the last-updated timestamp into a localized "HH:MM" string.
 */
function formatUpdatedTime(isoString: string | null): string | null {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

export function DashboardMetricStrip({
  mode,
  override,
  autoMode,
  onOverrideChange,
  isLoading,
  lastUpdatedAt,
  onDutyCount,
  lateCount,
  deviationCount,
  tasksDueCount,
  gaps7d,
  unsignedContracts,
  expiringTraining,
  budgetVariance,
}: DashboardMetricStripProps) {
  const { t } = useTranslation("dashboard");
  const formattedTime = useMemo(() => formatUpdatedTime(lastUpdatedAt), [lastUpdatedAt]);

  return (
    <div className="flex h-14 items-center gap-3 px-4">
      <DashboardModeToggle
        override={override}
        autoMode={autoMode}
        onOverrideChange={onOverrideChange}
      />

      <div className="flex-1" />

      {/* Pill set — crossfades between operative and preparatory */}
      <AnimatePresence mode="wait">
        {mode === "operative" ? (
          <motion.div key="operative-pills" className="flex items-center gap-2" {...CROSSFADE}>
            <MetricPill
              icon={Users}
              value={onDutyCount}
              label={t("interactive.pill_on_duty")}
              tone={toneForCount(onDutyCount, "info")}
              isLoading={isLoading}
            />
            <MetricPill
              icon={AlertTriangle}
              value={lateCount}
              label={t("interactive.pill_late")}
              tone={toneForCount(lateCount, "critical")}
              isLoading={isLoading}
            />
            <MetricPill
              icon={ShieldAlert}
              value={deviationCount}
              label={t("interactive.pill_deviations")}
              tone={toneForCount(deviationCount, "critical")}
              isLoading={isLoading}
            />
            <MetricPill
              icon={CheckSquare}
              value={tasksDueCount}
              label={t("interactive.pill_tasks_due")}
              tone={toneForCount(tasksDueCount, "warning")}
              isLoading={isLoading}
            />
          </motion.div>
        ) : (
          <motion.div key="preparatory-pills" className="flex items-center gap-2" {...CROSSFADE}>
            <MetricPill
              icon={Calendar}
              value={gaps7d}
              label={t("interactive.pill_gaps_7d")}
              tone={toneForCount(gaps7d, "warning")}
              isLoading={isLoading}
            />
            <MetricPill
              icon={FileText}
              value={unsignedContracts}
              label={t("interactive.pill_unsigned_contracts")}
              tone={toneForCount(unsignedContracts, "warning")}
              isLoading={isLoading}
            />
            <MetricPill
              icon={GraduationCap}
              value={expiringTraining}
              label={t("interactive.pill_expiring_training")}
              tone={toneForCount(expiringTraining, "warning")}
              isLoading={isLoading}
            />
            <MetricPill
              icon={TrendingUp}
              value={budgetVariance}
              label={t("interactive.pill_budget_variance")}
              tone={toneForCount(budgetVariance, "info")}
              isLoading={isLoading}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1" />

      {/* Last-updated timestamp */}
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {formattedTime
          ? t("interactive.updated_at", { time: formattedTime })
          : t("interactive.no_updates")}
      </span>
    </div>
  );
}
