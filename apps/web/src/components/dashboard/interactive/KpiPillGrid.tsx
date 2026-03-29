"use client";

// KpiPillGrid — 2×2 grid of compact KPI mini-cards.
// Switches between operative metrics (task completion, deviations, staff, session)
// and preparatory metrics (training readiness, absence, turnover, fill rate)
// based on the current dashboard mode. Each card expands on click to show detail.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@smartout/i18n";
import { useOperationsData } from "@/app/dashboard/operations/_hooks/use-operations-data";
import { useTrainingReadiness } from "@/app/dashboard/_hooks/use-training-readiness";
import { useAbsenceRate } from "@/app/dashboard/_hooks/use-absence-rate";
import { useStaffTurnover } from "@/app/dashboard/_hooks/use-staff-turnover";
import {
  useStaffingCoverage,
  getCurrentWeekStart,
} from "@/app/dashboard/_hooks/use-staffing-coverage";

// ─── Types ───────────────────────────────────────────────────────────────────

type KpiPillGridProps = {
  mode: "operative" | "preparatory";
  isLoading: boolean;
};

// ─── Constants ───────────────────────────────────────────────────────────────

// Snappy spring for inline expand — Nordic Split interactive spec
const SNAPPY_SPRING = {
  type: "spring" as const,
  stiffness: 250,
  damping: 22,
};

// ─── Sub-components ──────────────────────────────────────────────────────────

type KpiCardProps = {
  label: string;
  value: string | number;
  valueColor?: string;
  detail?: string;
  isLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
};

/**
 * Single KPI mini-card with label, value, and optional inline expand detail.
 *
 * Why: ~120×80px footprint keeps the 2×2 grid compact while still supporting
 * a quick-detail expand without navigating away.
 *
 * @param props - Label, value, optional detail text, loading state, and expand toggle.
 */
function KpiCard({
  label,
  value,
  valueColor = "text-foreground",
  detail,
  isLoading,
  isExpanded,
  onToggle,
}: KpiCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="bg-card border-border flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors hover:bg-card/80"
      style={{ minWidth: "120px", minHeight: "80px" }}
    >
      {/* Label */}
      <span className="text-muted-foreground leading-none text-[11px]">{label}</span>

      {/* Value */}
      {isLoading ? (
        <div className="bg-muted mt-1 h-6 w-12 animate-pulse rounded" />
      ) : (
        <span className={`text-lg font-bold tabular-nums leading-tight ${valueColor}`}>
          {value}
        </span>
      )}

      {/* Inline expand detail */}
      <AnimatePresence>
        {isExpanded && detail && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: SNAPPY_SPRING }}
            exit={{ height: 0, opacity: 0, transition: SNAPPY_SPRING }}
            className="overflow-hidden"
          >
            <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">{detail}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

/** Loading skeleton for the 2×2 grid. */
function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-card border-border h-20 animate-pulse rounded-xl border"
        />
      ))}
    </div>
  );
}

// ─── Operative sub-grid ──────────────────────────────────────────────────────

/**
 * 2×2 grid showing live operative KPIs: task completion, deviations, staff, session status.
 *
 * Why: Operative mode managers need at-a-glance today's numbers without leaving
 * the dashboard header.
 */
function OperativeKpiGrid({ isLoading: parentLoading }: { isLoading: boolean }) {
  const { t } = useTranslation("dashboard");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const { data: ops, isLoading: opsLoading } = useOperationsData();

  const loading = parentLoading || opsLoading;

  const toggle = (key: string) => setExpandedKey((prev) => (prev === key ? null : key));

  // ── Derive values ─────────────────────────────────────────────────────
  const taskPct = ops?.taskCompletion.pct ?? 0;
  const taskLabel = ops
    ? `${ops.taskCompletion.done}/${ops.taskCompletion.total}`
    : "—";

  const deviations = ops?.openDeviations ?? 0;
  const deviationColor =
    deviations === 0 ? "text-success" : deviations >= 3 ? "text-destructive" : "text-warning";

  const staffPresent = ops?.staffPresent.present ?? 0;
  const staffExpected = ops?.staffPresent.expected ?? 0;
  const staffColor =
    staffPresent >= staffExpected ? "text-success" : staffPresent > 0 ? "text-warning" : "text-destructive";

  // Session status: if any session is active, show "Aktiv" — else "Venter"
  const sessionStatus = ops && staffPresent > 0 ? t("interactive.session_active") : t("interactive.session_waiting");
  const sessionColor = staffPresent > 0 ? "text-success" : "text-muted-foreground";

  return (
    <div className="grid grid-cols-2 gap-2">
      {/* 1. Task completion */}
      <KpiCard
        label={t("interactive.kpi_task_completion")}
        value={`${taskPct}%`}
        detail={t("interactive.kpi_task_completion_detail", { done: ops?.taskCompletion.done ?? 0, total: ops?.taskCompletion.total ?? 0 })}
        isLoading={loading}
        isExpanded={expandedKey === "tasks"}
        onToggle={() => toggle("tasks")}
      />

      {/* 2. Open deviations */}
      <KpiCard
        label={t("interactive.kpi_deviations")}
        value={deviations}
        valueColor={deviationColor}
        detail={t("interactive.kpi_deviations_detail", { count: deviations })}
        isLoading={loading}
        isExpanded={expandedKey === "deviations"}
        onToggle={() => toggle("deviations")}
      />

      {/* 3. Staff present */}
      <KpiCard
        label={t("interactive.kpi_staff_present")}
        value={`${staffPresent}/${staffExpected}`}
        valueColor={staffColor}
        detail={ops?.staffPresent.names.join(", ") ?? "—"}
        isLoading={loading}
        isExpanded={expandedKey === "staff"}
        onToggle={() => toggle("staff")}
      />

      {/* 4. Session status */}
      <KpiCard
        label={t("interactive.kpi_session_status")}
        value={sessionStatus}
        valueColor={sessionColor}
        isLoading={loading}
        isExpanded={expandedKey === "session"}
        onToggle={() => toggle("session")}
      />
    </div>
  );
}

// ─── Preparatory sub-grid ───────────────────────────────────────────────────

/**
 * 2×2 grid showing planning KPIs: training readiness, absence, turnover, fill rate.
 *
 * Why: Preparatory mode focuses on forward-looking workforce health — these four
 * numbers answer "are we ready for the next period?".
 */
function PreparatoryKpiGrid({ isLoading: parentLoading }: { isLoading: boolean }) {
  const { t } = useTranslation("dashboard");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const { data: readiness, isLoading: readinessLoading } = useTrainingReadiness();
  const { data: absence, isLoading: absenceLoading } = useAbsenceRate();
  const { data: turnover, isLoading: turnoverLoading } = useStaffTurnover();
  const weekStart = getCurrentWeekStart();
  const { data: coverage, isLoading: coverageLoading } = useStaffingCoverage(weekStart);

  const loading =
    parentLoading || readinessLoading || absenceLoading || turnoverLoading || coverageLoading;

  const toggle = (key: string) => setExpandedKey((prev) => (prev === key ? null : key));

  // Average fill rate across the week
  const avgFillRate =
    coverage && coverage.length > 0
      ? Math.round(coverage.reduce((sum, d) => sum + d.fillPercent, 0) / coverage.length)
      : 0;

  return (
    <div className="grid grid-cols-2 gap-2">
      {/* 1. Training readiness */}
      <KpiCard
        label={t("interactive.kpi_training_readiness")}
        value={`${readiness?.readinessPercent ?? 0}%`}
        valueColor={
          (readiness?.readinessPercent ?? 0) >= 80
            ? "text-success"
            : (readiness?.readinessPercent ?? 0) >= 60
              ? "text-warning"
              : "text-destructive"
        }
        detail={t("interactive.kpi_training_readiness_detail", {
          completed: readiness?.completed ?? 0,
          total: readiness?.totalAssignments ?? 0,
        })}
        isLoading={loading}
        isExpanded={expandedKey === "readiness"}
        onToggle={() => toggle("readiness")}
      />

      {/* 2. Absence rate */}
      <KpiCard
        label={t("interactive.kpi_absence_rate")}
        value={`${absence?.rate ?? 0}%`}
        valueColor={
          (absence?.rate ?? 0) > 10
            ? "text-destructive"
            : (absence?.rate ?? 0) > 5
              ? "text-warning"
              : "text-success"
        }
        detail={t("interactive.kpi_absence_rate_detail", {
          days: absence?.absenceDays ?? 0,
          period: absence?.periodDays ?? 30,
        })}
        isLoading={loading}
        isExpanded={expandedKey === "absence"}
        onToggle={() => toggle("absence")}
      />

      {/* 3. Staff turnover */}
      <KpiCard
        label={t("interactive.kpi_staff_turnover")}
        value={`${turnover?.rate ?? 0}%`}
        valueColor={
          (turnover?.rate ?? 0) > 15
            ? "text-destructive"
            : (turnover?.rate ?? 0) > 8
              ? "text-warning"
              : "text-success"
        }
        detail={t("interactive.kpi_staff_turnover_detail", {
          departed: turnover?.departed ?? 0,
          period: turnover?.periodDays ?? 90,
        })}
        isLoading={loading}
        isExpanded={expandedKey === "turnover"}
        onToggle={() => toggle("turnover")}
      />

      {/* 4. Fill rate 7d */}
      <KpiCard
        label={t("interactive.kpi_fill_rate_7d")}
        value={`${avgFillRate}%`}
        valueColor={
          avgFillRate >= 90
            ? "text-success"
            : avgFillRate >= 70
              ? "text-warning"
              : "text-destructive"
        }
        detail={t("interactive.kpi_fill_rate_7d_detail", { rate: avgFillRate })}
        isLoading={loading}
        isExpanded={expandedKey === "fillrate"}
        onToggle={() => toggle("fillrate")}
      />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * KpiPillGrid — 2×2 grid of compact KPI cards that switches between operative
 * and preparatory data sets based on the active dashboard mode.
 *
 * @param mode - "operative" shows live today metrics; "preparatory" shows planning metrics.
 * @param isLoading - Parent loading state passed down to suppress premature renders.
 */
export function KpiPillGrid({ mode, isLoading }: KpiPillGridProps) {
  if (isLoading) {
    return <GridSkeleton />;
  }

  if (mode === "operative") {
    return <OperativeKpiGrid isLoading={false} />;
  }

  return <PreparatoryKpiGrid isLoading={false} />;
}
