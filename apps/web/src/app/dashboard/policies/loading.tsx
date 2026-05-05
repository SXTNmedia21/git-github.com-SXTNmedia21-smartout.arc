/**
 * loading.tsx — Skeleton placeholder for /dashboard/policies.
 * Mirrors the structure of apps/web/src/app/dashboard/people/loading.tsx.
 */

import { SkeletonCard, SkeletonHeading, SkeletonTableRow } from "@smartout/ui";

export default function PoliciesLoading() {
  return (
    <div
      className="flex flex-col gap-6 p-6"
      role="status"
      aria-live="polite"
      aria-label="Laster policies"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} className="min-h-[104px]" />
        ))}
      </div>

      <SkeletonCard className="min-h-96">
        <SkeletonHeading className="mb-4 h-6 w-1/4" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
