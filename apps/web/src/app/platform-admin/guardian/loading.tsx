export default function GuardianLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-800/50" />
        <div className="mt-1 h-4 w-56 animate-pulse rounded bg-zinc-800/30" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-zinc-800/20" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-800/20" />
        ))}
      </div>
    </div>
  );
}
