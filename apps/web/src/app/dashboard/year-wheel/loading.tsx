import { SkeletonCard, SkeletonHeading, SkeletonLine, SkeletonEntrance } from "@smartout/ui";

/**
 * /dashboard/year-wheel route-level loading skeleton.
 *
 * Matches the real timeline layout:
 * - Year navigation strip
 * - Date-picker + view controls row
 * - Full-width timeline canvas (12-month horizontal grid)
 * - Action toolbar
 * - Two-column "Seasons + Events" detail lists
 *
 * Per ADR-0115 RSC migration: `loading.tsx` streams the shell while
 * the server shell resolves the workspace context, then the client
 * hydrates and fires its TanStack queries for seasons + events.
 */
export default function YearWheelLoading() {
  return (
    <SkeletonEntrance
      isLoading
      skeleton={
        <div
          className="z-10 mx-auto w-full max-w-7xl flex-1 overflow-x-hidden overflow-y-auto px-6 py-6 md:px-10 lg:px-12"
          role="status"
          aria-live="polite"
          aria-label="Laster årshjul"
        >
          {/* Year navigation */}
          <div className="mb-6 flex items-center justify-center gap-4">
            <SkeletonLine className="h-9 w-9 rounded-md" />
            <SkeletonHeading className="h-8 w-32" />
            <SkeletonLine className="h-9 w-9 rounded-md" />
          </div>

          {/* Controls row */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SkeletonLine className="h-9 w-[180px] rounded-md" />
            <SkeletonLine className="h-9 w-28 rounded-lg" />
            <SkeletonLine className="h-9 w-20 rounded-lg" />
            <SkeletonLine className="ml-2 h-9 w-40 rounded-md" />
          </div>

          {/* Timeline canvas */}
          <SkeletonCard className="mb-8 min-h-[260px] p-4">
            <div className="mb-3 flex gap-1">
              {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonLine key={i} className="h-4 flex-1" />
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonLine key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          </SkeletonCard>

          {/* Toolbar */}
          <div className="mb-8 flex flex-wrap items-center justify-end gap-3">
            <SkeletonLine className="h-9 w-40 rounded-lg" />
            <SkeletonLine className="h-9 w-32 rounded-lg" />
            <SkeletonLine className="h-9 w-36 rounded-lg" />
          </div>

          {/* Two-column lists */}
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, col) => (
              <SkeletonCard key={col} className="min-h-[260px]">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <SkeletonLine className="h-5 w-24" />
                  <SkeletonLine className="h-8 w-28 rounded-md" />
                </div>
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-1 px-3 py-2">
                      <SkeletonLine className="h-4 w-2/3" />
                      <SkeletonLine className="h-3 w-1/3" />
                    </div>
                  ))}
                </div>
              </SkeletonCard>
            ))}
          </div>
        </div>
      }
    >
      {null}
    </SkeletonEntrance>
  );
}
