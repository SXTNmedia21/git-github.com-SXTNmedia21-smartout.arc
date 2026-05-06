export default function HealthLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="bg-muted/50 h-8 w-40 animate-pulse rounded-lg" />
          <div className="bg-muted/30 mt-1 h-4 w-72 animate-pulse rounded" />
        </div>
        <div className="bg-muted/30 h-9 w-24 animate-pulse rounded-lg" />
      </div>
      <div className="bg-muted/30 h-10 w-96 animate-pulse rounded-lg" />
      <div className="bg-muted/50 h-12 animate-pulse rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border-border/20 bg-muted/30 h-[68px] animate-pulse rounded-lg border"
          />
        ))}
      </div>
    </div>
  );
}
