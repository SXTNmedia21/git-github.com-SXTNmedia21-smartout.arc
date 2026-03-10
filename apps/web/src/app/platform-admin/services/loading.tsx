export default function ServicesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-32 animate-pulse rounded-lg bg-zinc-800/50" />
          <div className="mt-1 h-4 w-64 animate-pulse rounded bg-zinc-800/30" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-zinc-800/30" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-zinc-800/30" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-lg border border-zinc-800/20 bg-zinc-800/30"
          />
        ))}
      </div>
    </div>
  );
}
