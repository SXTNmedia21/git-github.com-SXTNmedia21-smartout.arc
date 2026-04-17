import {
  SkeletonCard,
  SkeletonHeading,
  SkeletonLine,
  SkeletonTableRow,
  SkeletonEntrance,
} from "@smartout/ui";

/**
 * /dashboard/billing route-level loading skeleton.
 *
 * Matches the two-row layout of the real page:
 * - Header (heading + subcopy)
 * - Invoice table (5 table rows)
 *
 * Per ADR-0115 RSC migration: `loading.tsx` files power route-level
 * Suspense streaming so the shell paints before server data resolves.
 */
export default function BillingLoading() {
  return (
    <SkeletonEntrance
      isLoading
      skeleton={
        <div className="space-y-6" role="status" aria-live="polite" aria-label="Laster fakturaer">
          <header className="space-y-2">
            <SkeletonHeading className="h-9 w-48" />
            <SkeletonLine className="h-4 w-2/3" />
          </header>

          <SkeletonCard className="min-h-64 p-0">
            <div className="border-b px-3 py-3">
              <div className="flex gap-4">
                <SkeletonLine className="w-16" />
                <SkeletonLine className="w-32" />
                <SkeletonLine className="ml-auto w-24" />
                <SkeletonLine className="w-20" />
                <SkeletonLine className="w-20" />
              </div>
            </div>
            <div className="divide-border/40 divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} className="px-3" />
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
