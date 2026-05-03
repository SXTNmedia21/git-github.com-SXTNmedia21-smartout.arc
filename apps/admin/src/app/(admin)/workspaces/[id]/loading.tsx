// loading.tsx — Suspense skeleton for /workspaces/[id]
//
// Renders gray pulse blocks that match the 7-section layout of the
// kartotek detail page. No content flicker — dimensions approximate
// each section's typical height.

import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceDetailLoading() {
  return (
    <div className="space-y-6">
      {/* WorkspaceHeader skeleton */}
      <div className="border-border space-y-3 rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex gap-6 pt-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* BillingConfigSection skeleton */}
      <div className="border-border space-y-3 rounded-lg border p-6">
        <Skeleton className="h-5 w-36" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* OrderHistorySection skeleton */}
      <div className="border-border space-y-3 rounded-lg border p-6">
        <Skeleton className="h-5 w-28" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>

      {/* PaymentStatusSection skeleton */}
      <div className="border-border space-y-3 rounded-lg border p-6">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-6">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      {/* ContractSection skeleton */}
      <div className="border-border space-y-3 rounded-lg border p-6">
        <Skeleton className="h-5 w-24" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>

      {/* MembersSection skeleton */}
      <div className="border-border space-y-3 rounded-lg border p-6">
        <Skeleton className="h-5 w-24" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>

      {/* RecentActivitySection skeleton */}
      <div className="border-border space-y-3 rounded-lg border p-6">
        <Skeleton className="h-5 w-32" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}
