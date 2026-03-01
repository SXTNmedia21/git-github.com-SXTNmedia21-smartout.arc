"use client";

import type { StatusSummary } from "./schedule-context";

type StatusStripProps = {
  isDark: boolean;
  statusSummary: StatusSummary;
};

export function StatusStrip({ isDark, statusSummary }: StatusStripProps) {
  return (
    <div
      className={`z-20 flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.03] px-6 py-2 ${isDark ? "bg-[#08080a]/80" : "bg-white/80"} backdrop-blur-md print:hidden`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-lg border px-2 py-1 text-xs ${
            statusSummary.coverageRisks > 0
              ? "border-rose-500/40 bg-rose-500/20 font-black text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.15)]"
              : "border-zinc-500/10 bg-zinc-500/5 font-medium text-zinc-500"
          }`}
        >
          Dekningsrisiko: {statusSummary.coverageRisks}
        </span>
        <span
          className={`rounded-lg border px-2 py-1 text-xs ${
            statusSummary.overtimeRisks > 0
              ? "border-orange-500/25 bg-orange-500/10 font-semibold text-orange-400"
              : "border-zinc-500/10 bg-zinc-500/5 font-medium text-zinc-500"
          }`}
        >
          Overtidsrisiko: {statusSummary.overtimeRisks}
        </span>
        <span
          className={`rounded-lg border px-2 py-1 text-xs ${
            statusSummary.complianceRisks > 0
              ? "border-amber-500/25 bg-amber-500/10 font-semibold text-amber-400"
              : "border-zinc-500/10 bg-zinc-500/5 font-medium text-zinc-500"
          }`}
        >
          Compliance: {statusSummary.complianceRisks}
        </span>
        <span className="rounded-lg border border-zinc-500/10 bg-zinc-500/5 px-2 py-1 text-xs font-medium text-zinc-500">
          Ledige vakter: {statusSummary.openShiftQueue}
        </span>
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

      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <span className="rounded-md border border-zinc-500/8 bg-zinc-500/[0.03] px-2 py-0.5 text-[11px] font-medium text-zinc-500">
          Draft {statusSummary.draftCount}
        </span>
        <span className="rounded-md border border-zinc-500/8 bg-zinc-500/[0.03] px-2 py-0.5 text-[11px] font-medium text-zinc-500">
          Published {statusSummary.publishedCount}
        </span>
        <span className="rounded-md border border-zinc-500/8 bg-zinc-500/[0.03] px-2 py-0.5 text-[11px] font-medium text-zinc-500">
          Active {statusSummary.activeCount}
        </span>
        <span className="rounded-md border border-zinc-500/8 bg-zinc-500/[0.03] px-2 py-0.5 text-[11px] font-medium text-zinc-500">
          Completed {statusSummary.completedCount}
        </span>
        <span
          className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
            statusSummary.absenceCount > 0
              ? "border-rose-500/20 bg-rose-500/5 text-rose-400"
              : "border-zinc-500/8 bg-zinc-500/[0.03] text-zinc-500"
          }`}
        >
          Fravær {statusSummary.absenceCount}
        </span>
      </div>
    </div>
  );
}
