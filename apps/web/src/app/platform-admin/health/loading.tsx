export default function HealthLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-800/50" />
          <div className="mt-1 h-4 w-72 animate-pulse rounded bg-zinc-800/30" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded-lg bg-zinc-800/30" />
      </div>
      <div className="h-10 w-96 animate-pulse rounded-lg bg-zinc-800/30" />
      <div className="h-12 animate-pulse rounded-lg bg-zinc-800/50" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[68px] animate-pulse rounded-lg border border-zinc-800/20 bg-zinc-800/30"
          />
        ))}
      </div>
    </div>
  );
}
