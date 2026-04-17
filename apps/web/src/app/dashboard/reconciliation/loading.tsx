import { SkeletonCard, SkeletonHeading, SkeletonLine, SkeletonEntrance } from "@smartout/ui";

/**
 * Loading skeleton for /dashboard/reconciliation.
 * Mirrors the two-panel geometry in `ReconciliationPageClient`:
 *   Left (w-80): day list rows
 *   Right (flex-1): day approval detail
 * Nordic Split skeleton primitives per ADR-0115.
 */
export default function ReconciliationLoading() {
  return (
    <SkeletonEntrance
      isLoading
      skeleton={
        <div
          className="flex h-full gap-4 p-4"
          role="status"
          aria-live="polite"
          aria-label="Laster daglig avstemming"
        >
          {/* Left: day list */}
          <div className="w-80 shrink-0">
            <SkeletonCard className="min-h-[480px]">
              <SkeletonHeading className="mb-4 h-6 w-2/5" />
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <SkeletonLine className="w-1/3" />
                      <SkeletonLine className="w-16" />
                    </div>
                    <SkeletonLine className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            </SkeletonCard>
          </div>

          {/* Right: approval detail */}
          <div className="flex-1">
            <SkeletonCard className="min-h-[480px]">
              <SkeletonHeading className="mb-6 h-9 w-1/3" />
              <div className="mb-6 grid gap-4 md:grid-cols-2">
                <SkeletonCard className="min-h-[128px]" />
                <SkeletonCard className="min-h-[128px]" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <SkeletonLine className="w-2/5" />
                    <SkeletonLine className="w-24" />
                  </div>
                ))}
              </div>
            </SkeletonCard>
          </div>
        </div>
      }
    >
      {null}
    </SkeletonEntrance>
  );
}
