export default function LandingLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-800/50" />
        <div className="mt-1 h-4 w-80 animate-pulse rounded bg-zinc-800/30" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-900/50"
          />
        ))}
      </div>
      <div className="h-10 w-80 animate-pulse rounded-lg bg-zinc-800/30" />
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800/20" />
        ))}
      </div>
    </div>
  );
}
