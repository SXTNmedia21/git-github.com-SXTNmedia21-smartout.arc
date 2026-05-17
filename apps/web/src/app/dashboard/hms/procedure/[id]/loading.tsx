import { SkeletonHeading, SkeletonCard, SkeletonLine, SkeletonTableRow } from "@smartout/ui";

export default function HmsProcedureLoading() {
  return (
    <div className="space-y-6 p-6" role="status" aria-live="polite" aria-label="Laster prosedyre">
      {/* Procedure title + breadcrumb */}
      <div className="space-y-2">
        <SkeletonLine className="h-3 w-24" />
        <SkeletonHeading className="h-8 w-64" />
        <SkeletonLine className="h-3 w-48" />
      </div>

      {/* Tab navigation skeleton */}
      <div className="border-border bg-muted/50 flex gap-1 rounded-xl border p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonLine key={i} className="h-9 flex-1 rounded-lg" />
        ))}
      </div>

      {/* Tab content skeleton — 2 info cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard className="min-h-24">
          <SkeletonLine className="h-3 w-1/3" />
          <SkeletonHeading className="mt-2 h-6 w-1/2" />
        </SkeletonCard>
        <SkeletonCard className="min-h-24">
          <SkeletonLine className="h-3 w-1/3" />
          <SkeletonHeading className="mt-2 h-6 w-1/2" />
        </SkeletonCard>
      </div>

      {/* Steps list skeleton */}
      <SkeletonCard className="min-h-48">
        <SkeletonHeading className="mb-4 h-5 w-1/4" />
        <div className="space-y-2">
          <SkeletonTableRow />
          <SkeletonTableRow />
          <SkeletonTableRow />
        </div>
      </SkeletonCard>
    </div>
  );
}
