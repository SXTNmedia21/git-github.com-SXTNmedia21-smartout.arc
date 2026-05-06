export default function LandingLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="bg-muted/50 h-8 w-48 animate-pulse rounded-lg" />
        <div className="bg-muted/30 mt-1 h-4 w-80 animate-pulse rounded" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border-border/50 bg-card/50 h-28 animate-pulse rounded-xl border"
          />
        ))}
      </div>
      <div className="bg-muted/30 h-10 w-80 animate-pulse rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-muted/20 h-12 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
