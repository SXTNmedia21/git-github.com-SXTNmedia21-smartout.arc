import {
  SkeletonCard,
  SkeletonHeading,
  SkeletonLine,
  SkeletonTableRow,
  SkeletonEntrance,
} from "@smartout/ui";

/**
 * /dashboard/cost route-level loading skeleton.
 *
 * Matches CostOverview layout:
 * - Header row (title + week navigation)
 * - 3 summary cards (planned / actual / variance)
 * - Department cost table
 *
 * Per ADR-0115 RSC migration: `loading.tsx` streams the shell while
 * the server shell resolves the workspace context.
 */
export default function CostLoading() {
  return (
    <SkeletonEntrance
      isLoading
      skeleton={
        <div
          className="space-y-6 p-4"
          role="status"
          aria-live="polite"
          aria-label="Laster lønnskostnad"
        >
          <div className="flex items-center justify-between">
            <SkeletonHeading className="h-7 w-40" />
            <div className="flex items-center gap-2">
              <SkeletonLine className="h-9 w-9 rounded-md" />
              <SkeletonLine className="h-4 w-48" />
              <SkeletonLine className="h-9 w-9 rounded-md" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} className="min-h-[120px]">
                <SkeletonLine className="mb-3 h-4 w-1/3" />
                <SkeletonHeading className="h-8 w-2/3" />
              </SkeletonCard>
            ))}
          </div>

          <SkeletonCard className="min-h-64 p-0">
            <div className="border-b px-4 py-3">
              <SkeletonLine className="h-5 w-1/4" />
            </div>
            <div className="divide-border/40 divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} className="px-4" />
              ))}
            </div>
          </SkeletonCard>
        </div>
      }
    >
      {null}
    </SkeletonEntrance>
  );
}
