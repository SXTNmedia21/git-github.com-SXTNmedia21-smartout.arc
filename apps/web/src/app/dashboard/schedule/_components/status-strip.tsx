"use client";

type StatusSummary = {
  coverageRisks: number;
  overtimeRisks: number;
  complianceRisks: number;
  openShiftQueue: number;
  draftCount: number;
  publishedCount: number;
  activeCount: number;
  completedCount: number;
  publishedState: string;
};

type StatusStripProps = {
  isDark: boolean;
  statusSummary: StatusSummary;
};

export function StatusStrip({ isDark, statusSummary }: StatusStripProps) {
  return (
    <div
      className={`z-20 flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-6 py-2 ${isDark ? "bg-[#08080a]/80" : "bg-white/80"} backdrop-blur-md print:hidden`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
            statusSummary.coverageRisks > 0
              ? "border-rose-500/30 bg-rose-500/15 text-rose-400"
              : "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
          }`}
        >
          Dekningsrisiko: {statusSummary.coverageRisks}
        </span>
        <span
          className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
            statusSummary.overtimeRisks > 0
              ? "border-orange-500/30 bg-orange-500/15 text-orange-400"
              : "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
          }`}
        >
          Overtidsrisiko: {statusSummary.overtimeRisks}
        </span>
        <span
          className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
            statusSummary.complianceRisks > 0
              ? "border-amber-500/30 bg-amber-500/15 text-amber-400"
              : "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
          }`}
        >
          Compliance: {statusSummary.complianceRisks}
        </span>
        <span className="rounded-lg border border-blue-500/30 bg-blue-500/15 px-2 py-1 text-[11px] font-bold text-blue-400">
          Ledige vakter: {statusSummary.openShiftQueue}
        </span>
        <span
          className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
            statusSummary.publishedState === "Publisert"
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
              : "border-zinc-500/30 bg-zinc-500/15 text-zinc-300"
          }`}
        >
          {statusSummary.publishedState}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <span className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-400">
          Draft {statusSummary.draftCount}
        </span>
        <span className="rounded-md border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
          Published {statusSummary.publishedCount}
        </span>
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
          Active {statusSummary.activeCount}
        </span>
        <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400">
          Completed {statusSummary.completedCount}
        </span>
        <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
          Absence
        </span>
        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
          Risk
        </span>
      </div>
    </div>
  );
}
