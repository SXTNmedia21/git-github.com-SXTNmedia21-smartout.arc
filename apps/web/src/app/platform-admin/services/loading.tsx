export default function ServicesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="bg-muted/50 h-8 w-32 animate-pulse rounded-lg" />
          <div className="bg-muted/30 mt-1 h-4 w-64 animate-pulse rounded" />
        </div>
        <div className="flex gap-2">
          <div className="bg-muted/30 h-9 w-28 animate-pulse rounded-lg" />
          <div className="bg-muted/30 h-9 w-28 animate-pulse rounded-lg" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="border-border/20 bg-muted/30 h-32 animate-pulse rounded-lg border"
          />
        ))}
      </div>
    </div>
  );
}
