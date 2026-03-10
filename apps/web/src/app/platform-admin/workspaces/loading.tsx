export default function WorkspacesLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-800/50" />
        <div className="mt-1 h-4 w-64 animate-pulse rounded bg-zinc-800/30" />
      </div>
      <div className="space-y-2">
        <div className="flex gap-3">
          <div className="h-8 w-60 animate-pulse rounded bg-zinc-800/30" />
          <div className="h-8 w-36 animate-pulse rounded bg-zinc-800/30" />
          <div className="h-8 w-36 animate-pulse rounded bg-zinc-800/30" />
        </div>
        <div className="rounded-md border border-zinc-800/50">
          <div className="h-10 animate-pulse rounded-t-md bg-zinc-800/30" />
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse border-t border-zinc-800/20 bg-zinc-800/10"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
