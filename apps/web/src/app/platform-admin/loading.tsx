export default function PlatformAdminLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Title skeleton */}
      <div className="bg-muted/50 h-8 w-48 animate-pulse rounded-lg" />

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="border-border/50 bg-card/50 h-28 animate-pulse rounded-xl border"
          />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="space-y-2">
        <div className="bg-muted/30 h-10 animate-pulse rounded-lg" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-muted/20 h-12 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
