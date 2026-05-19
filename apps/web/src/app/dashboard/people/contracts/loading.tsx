// Streaming skeleton for /dashboard/people/contracts — header + tab nav + list rows.

export default function ContractsLoading() {
  return (
    <div
      className="relative flex flex-col gap-5"
      role="status"
      aria-live="polite"
      aria-label="Laster kontrakter"
    >
      {/* Header: H1 + subtitle on left, CTA button on right */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="bg-muted h-8 w-56 animate-pulse rounded-lg" />
          <div className="bg-muted/50 h-4 w-80 animate-pulse rounded" />
        </div>
        <div className="bg-muted h-9 w-36 animate-pulse rounded-lg" />
      </div>

      {/* Tab nav */}
      <div className="border-border flex gap-2 border-b pb-2">
        <div className="bg-muted h-8 w-28 animate-pulse rounded-lg" />
        <div className="bg-muted/50 h-8 w-24 animate-pulse rounded-lg" />
        <div className="bg-muted/50 h-8 w-24 animate-pulse rounded-lg" />
      </div>

      {/* Contract list rows */}
      <div className="flex flex-col gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-muted h-16 w-full animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
