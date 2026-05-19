/**
 * loading.tsx — Suspense fallback for /dashboard/proposals/[proposalId].
 *
 * Matches ProposalDetailClient skeleton: header + main card + audit card.
 * Uses Nordic Split tokens — no hardcoded colors.
 */

export default function ProposalDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-col gap-6">
        {/* Header row skeleton */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="bg-muted h-6 w-48 animate-pulse rounded" />
            <div className="bg-muted h-4 w-64 animate-pulse rounded" />
          </div>
          <div className="bg-muted h-6 w-24 animate-pulse rounded-full" />
        </div>

        {/* Main detail card skeleton */}
        <div className="bg-muted h-52 animate-pulse rounded-xl" />

        {/* Audit trail card skeleton */}
        <div className="bg-muted h-28 animate-pulse rounded-xl" />
      </div>
    </div>
  );
}
