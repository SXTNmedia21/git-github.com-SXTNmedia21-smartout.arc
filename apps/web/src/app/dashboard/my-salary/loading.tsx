import { SkeletonCard, SkeletonHeading, SkeletonLine, SkeletonEntrance } from "@smartout/ui";

/**
 * Loading skeleton for /dashboard/my-salary.
 * Mirrors the three-column geometry in `MySalaryPageClient`:
 *   Left column: period list rows
 *   Center column: payslip detail hero + breakdown
 *   Right column: balances (absence quotas + timebank)
 * Nordic Split skeleton primitives per ADR-0115.
 */
export default function MySalaryLoading() {
  return (
    <SkeletonEntrance
      isLoading
      skeleton={
        <div
          className="flex h-full flex-col gap-4 p-4 lg:flex-row"
          role="status"
          aria-live="polite"
          aria-label="Laster lønn"
        >
          {/* Left: period list */}
          <div className="order-2 w-full shrink-0 lg:order-1 lg:w-72">
            <SkeletonCard className="min-h-[480px]">
              <SkeletonHeading className="mb-4 h-6 w-2/5" />
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <SkeletonLine className="w-2/5" />
                    <SkeletonLine className="w-1/4" />
                  </div>
                ))}
              </div>
            </SkeletonCard>
          </div>

          {/* Center: payslip detail hero + breakdown */}
          <div className="order-1 min-h-0 flex-1 lg:order-2">
            <SkeletonCard className="min-h-[480px]">
              <SkeletonHeading className="mb-6 h-9 w-1/3" />
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                <SkeletonCard className="min-h-[104px]" />
                <SkeletonCard className="min-h-[104px]" />
                <SkeletonCard className="min-h-[104px]" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <SkeletonLine className="w-1/3" />
                    <SkeletonLine className="w-20" />
                  </div>
                ))}
              </div>
            </SkeletonCard>
          </div>

          {/* Right: absence + timebank balances */}
          <div className="order-3 w-full shrink-0 lg:w-72">
            <SkeletonCard className="min-h-[480px]">
              <SkeletonHeading className="mb-4 h-6 w-2/5" />
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <SkeletonLine className="w-1/2" />
                    <SkeletonLine className="h-6 w-full rounded-full" />
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
