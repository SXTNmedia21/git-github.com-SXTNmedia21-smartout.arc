// Streaming skeleton for /dashboard/people/contracts/[id]/revise — back link + form wizard skeleton.

export default function ReviseContractLoading() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Laster revisjonsflyt">
      {/* Back link */}
      <div className="bg-muted/50 h-4 w-40 animate-pulse rounded" />

      {/* Wizard step indicator */}
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-muted h-2 w-12 animate-pulse rounded-full" />
        ))}
      </div>

      {/* Form card skeleton */}
      <div className="bg-muted h-64 w-full animate-pulse rounded-lg" />

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <div className="bg-muted/50 h-9 w-24 animate-pulse rounded-lg" />
        <div className="bg-muted h-9 w-24 animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
