// ============================================
// status-strip.tsx
// Renders the schedule status bar with clickable filter badges.
// Left side: risk/coverage badges. Right side: shift status badges.
// Clicking a badge toggles a filter that parent components can use
// to highlight or dim matching shifts in the grid views.
// Connected to: apps/web/src/app/dashboard/schedule/page.tsx (receives filter state)
// ============================================
"use client";

import type { StatusSummary } from "../_hooks/use-schedule-computed";

type StatusStripProps = {
  isDark: boolean;
  statusSummary: StatusSummary;
  activeFilter: string | null;
  onFilterClick: (filter: string | null) => void;
};

/**
 * Displays schedule status badges that double as filter toggles.
 * Left side shows risk indicators (coverage, overtime, compliance, open shifts).
 * Right side shows shift status counts (draft, published, active, completed, absence).
 *
 * Clicking any badge toggles it as the active filter. Clicking again clears the filter.
 *
 * @param isDark - Whether the dashboard is in dark mode
 * @param statusSummary - Aggregated shift status counts from schedule context
 * @param activeFilter - Currently active filter key, or null if none
 * @param onFilterClick - Callback to set or clear the active filter
 */
export function StatusStrip({
  isDark,
  statusSummary,
  activeFilter,
  onFilterClick,
}: StatusStripProps) {
  /**
   * Returns the toggle handler for a given filter key.
   * If the filter is already active, clicking clears it (sets null).
   * Otherwise, it activates the clicked filter.
   */
  const toggleFilter = (key: string) => {
    onFilterClick(activeFilter === key ? null : key);
  };

  return (
    <div
      className={`z-20 flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.03] px-6 py-2 ${isDark ? "bg-[#08080a]/80" : "bg-white/80"} backdrop-blur-md print:hidden`}
    >
      {/* Left side: risk and coverage badges */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => toggleFilter("coverage_risk")}
          className={`rounded-lg border px-2 py-1 text-xs transition-all ${
            activeFilter === "coverage_risk"
              ? "border-orange-500/40 bg-orange-500/20 font-black text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.2)]"
              : statusSummary.coverageRisks > 0
                ? "border-rose-500/40 bg-rose-500/20 font-black text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.15)] hover:bg-rose-500/30"
                : "border-zinc-500/10 bg-zinc-500/5 font-medium text-zinc-500 hover:bg-zinc-500/10"
          }`}
        >
          Dekningsrisiko: {statusSummary.coverageRisks}
        </button>
        <button
          onClick={() => toggleFilter("overtime_risk")}
          className={`rounded-lg border px-2 py-1 text-xs transition-all ${
            activeFilter === "overtime_risk"
              ? "border-orange-500/40 bg-orange-500/20 font-black text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.2)]"
              : statusSummary.overtimeRisks > 0
                ? "border-orange-500/25 bg-orange-500/10 font-semibold text-orange-400 hover:bg-orange-500/20"
                : "border-zinc-500/10 bg-zinc-500/5 font-medium text-zinc-500 hover:bg-zinc-500/10"
          }`}
        >
          Overtidsrisiko: {statusSummary.overtimeRisks}
        </button>
        <button
          onClick={() => toggleFilter("compliance_risk")}
          className={`rounded-lg border px-2 py-1 text-xs transition-all ${
            activeFilter === "compliance_risk"
              ? "border-orange-500/40 bg-orange-500/20 font-black text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.2)]"
              : statusSummary.complianceRisks > 0
                ? "border-amber-500/25 bg-amber-500/10 font-semibold text-amber-400 hover:bg-amber-500/20"
                : "border-zinc-500/10 bg-zinc-500/5 font-medium text-zinc-500 hover:bg-zinc-500/10"
          }`}
        >
          Compliance: {statusSummary.complianceRisks}
        </button>
        <button
          onClick={() => toggleFilter("open_shifts")}
          className={`rounded-lg border px-2 py-1 text-xs font-medium transition-all ${
            activeFilter === "open_shifts"
              ? "border-orange-500/40 bg-orange-500/20 font-black text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.2)]"
              : "border-zinc-500/10 bg-zinc-500/5 text-zinc-500 hover:bg-zinc-500/10"
          }`}
        >
          Ledige vakter: {statusSummary.openShiftQueue}
        </button>
        <span
          className={`rounded-lg border px-2 py-1 text-xs font-medium ${
            statusSummary.publishedState === "Publisert"
              ? "border-zinc-500/10 bg-zinc-500/5 text-zinc-500"
              : "border-orange-500/25 bg-orange-500/8 text-orange-400/80"
          }`}
        >
          {statusSummary.publishedState}
        </span>
      </div>

      {/* Right side: shift status count badges */}
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <button
          onClick={() => toggleFilter("draft")}
          className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-all ${
            activeFilter === "draft"
              ? "border-orange-500/40 bg-orange-500/20 text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.2)]"
              : "border-zinc-500/8 bg-zinc-500/[0.03] text-zinc-500 hover:bg-zinc-500/10"
          }`}
        >
          Draft {statusSummary.draftCount}
        </button>
        <button
          onClick={() => toggleFilter("published")}
          className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-all ${
            activeFilter === "published"
              ? "border-orange-500/40 bg-orange-500/20 text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.2)]"
              : "border-zinc-500/8 bg-zinc-500/[0.03] text-zinc-500 hover:bg-zinc-500/10"
          }`}
        >
          Published {statusSummary.publishedCount}
        </button>
        <button
          onClick={() => toggleFilter("active")}
          className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-all ${
            activeFilter === "active"
              ? "border-orange-500/40 bg-orange-500/20 text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.2)]"
              : "border-zinc-500/8 bg-zinc-500/[0.03] text-zinc-500 hover:bg-zinc-500/10"
          }`}
        >
          Active {statusSummary.activeCount}
        </button>
        <button
          onClick={() => toggleFilter("completed")}
          className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-all ${
            activeFilter === "completed"
              ? "border-orange-500/40 bg-orange-500/20 text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.2)]"
              : "border-zinc-500/8 bg-zinc-500/[0.03] text-zinc-500 hover:bg-zinc-500/10"
          }`}
        >
          Completed {statusSummary.completedCount}
        </button>
        <button
          onClick={() => toggleFilter("absence")}
          className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-all ${
            activeFilter === "absence"
              ? "border-orange-500/40 bg-orange-500/20 text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.2)]"
              : statusSummary.absenceCount > 0
                ? "border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10"
                : "border-zinc-500/8 bg-zinc-500/[0.03] text-zinc-500 hover:bg-zinc-500/10"
          }`}
        >
          Fravær {statusSummary.absenceCount}
        </button>
      </div>
    </div>
  );
}
