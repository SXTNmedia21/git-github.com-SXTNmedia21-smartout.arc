export default function PlatformAdminLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Title skeleton */}
      <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-800/50" />

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-900/50"
          />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="space-y-2">
        <div className="h-10 animate-pulse rounded-lg bg-zinc-800/30" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800/20" />
        ))}
      </div>
    </div>
  );
}
