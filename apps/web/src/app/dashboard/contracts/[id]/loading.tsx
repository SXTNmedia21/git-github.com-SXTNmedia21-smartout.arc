// Streaming skeleton for /dashboard/contracts/[id] — back link + header + detail sections.

export default function ContractDetailLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="Laster kontrakt">
      {/* Back link */}
      <div className="bg-muted/50 h-4 w-32 animate-pulse rounded" />

      {/* Header: name + status badge */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="bg-muted h-7 w-64 animate-pulse rounded-lg" />
          <div className="bg-muted/50 h-5 w-24 animate-pulse rounded-full" />
        </div>
        <div className="flex gap-2">
          <div className="bg-muted h-9 w-24 animate-pulse rounded-lg" />
          <div className="bg-muted/50 h-9 w-28 animate-pulse rounded-lg" />
        </div>
      </div>

      {/* Detail section blocks */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-muted h-32 w-full animate-pulse rounded-lg" />
        <div className="bg-muted h-32 w-full animate-pulse rounded-lg" />
      </div>
      <div className="bg-muted/50 h-24 w-full animate-pulse rounded-lg" />
      <div className="bg-muted/50 h-20 w-full animate-pulse rounded-lg" />
    </div>
  );
}
