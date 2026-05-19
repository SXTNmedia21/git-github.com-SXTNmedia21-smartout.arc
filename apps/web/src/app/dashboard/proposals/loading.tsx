/**
 * loading.tsx — Suspense fallback for /dashboard/proposals.
 *
 * Matches the page layout: header + card with 3 skeleton rows.
 * Uses Nordic Split tokens (bg-muted, animate-pulse) — no hardcoded colors.
 */

export default function ProposalsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Page header skeleton */}
      <div className="mb-6 flex flex-col gap-2">
        <div className="bg-muted h-7 w-48 animate-pulse rounded" />
        <div className="bg-muted h-4 w-72 animate-pulse rounded" />
      </div>

      {/* Card skeleton matching ProposalsListClient card shell */}
      <div className="rounded-xl border">
        <div className="border-b px-6 py-4">
          <div className="bg-muted h-5 w-44 animate-pulse rounded" />
        </div>
        <div className="flex flex-col gap-2 p-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-muted h-16 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
