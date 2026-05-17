import { SkeletonHeading, SkeletonCard, SkeletonLine } from "@smartout/ui";

export default function HmsDeviationsLoading() {
  return (
    <div
      className="space-y-4 p-6"
      role="status"
      aria-live="polite"
      aria-label="Laster avviksoversikt"
    >
      <SkeletonHeading className="h-7 w-32" />

      {/* Kanban column skeleton — 4 columns */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="min-w-[200px] flex-1 space-y-2">
            {/* Column header */}
            <div className="border-border mb-2 flex items-center justify-between border-b-2 pb-2">
              <SkeletonLine className="h-3 w-16" />
              <SkeletonLine className="h-5 w-5 rounded-full" />
            </div>
            {/* Cards */}
            <SkeletonCard className="min-h-20">
              <SkeletonLine className="mb-2 h-3 w-1/3" />
              <SkeletonLine className="mb-1 h-3 w-full" />
              <SkeletonLine className="h-3 w-2/3" />
            </SkeletonCard>
            <SkeletonCard className="min-h-20">
              <SkeletonLine className="mb-2 h-3 w-1/4" />
              <SkeletonLine className="mb-1 h-3 w-full" />
              <SkeletonLine className="h-3 w-1/2" />
            </SkeletonCard>
          </div>
        ))}
      </div>
    </div>
  );
}
