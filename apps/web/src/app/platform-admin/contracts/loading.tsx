export default function ContractsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-36 animate-pulse rounded-lg bg-zinc-800/50" />
          <div className="mt-1 h-4 w-72 animate-pulse rounded bg-zinc-800/30" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded bg-zinc-800/30" />
          <div className="h-9 w-28 animate-pulse rounded bg-zinc-800/30" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800/20" />
        ))}
      </div>
    </div>
  );
}
